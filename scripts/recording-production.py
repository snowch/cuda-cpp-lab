# /// script
# requires-python = ">=3.11,<3.13"
# dependencies = ["playwright==1.58.0", "numpy", "soundfile"]
# ///
# Copyright © 2026 Christopher Snow.
"""Regenerate GPU Lab speech through Common Ground's pinned record-demo skill.

The upstream scripts stay in a separate checkout; no upstream implementation or
speech model is bundled. Use --stage prepare/narrate/screen to resume a production.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'test-results/record-demo-all'
SKILL_COMMIT = 'c9a7c521568632aa216932f4c965df386498602a'
SKILL_URL = 'https://github.com/snowch/claude-skills'


def read(path):
    return json.loads(Path(path).read_text())


def write(path, value):
    path=Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    pending=path.with_name('.'+path.name+'.pending')
    pending.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')
    pending.replace(path)


def digest(path):
    return hashlib.file_digest(Path(path).open('rb'), 'sha256').hexdigest()


def sentences(text):
    return re.split(r'(?<=[.!?])\s+(?=[A-Z])', text)


def spoken(text):
    # Visible text stays canonical. Only speech gets expanded code notation.
    aliases = {
        'cudaStreamWaitEvent': 'CUDA stream wait event', 'cudaMalloc': 'CUDA malloc',
        'cudaMemcpy': 'CUDA mem copy', 'blockIdx.x': 'block index dot x',
        'threadIdx.x': 'thread index dot x', 'blockDim.x': 'block dimension dot x',
        'blockIdx': 'block index', 'threadIdx': 'thread index', 'blockDim': 'block dimension',
        'doubleValues': 'double values', 'alternateSigns': 'alternate signs',
        'readWords': 'read words', 'scanFlags': 'scan flags',
        'FlashAttention': 'Flash attention', 'JavaScript': 'Java Script',
        'input[i]': 'input at index i', 'output[i]': 'output at index i',
        'words[lane * stride]': 'words at lane times stride', 'flags[t]': 'flags at index t',
        'ready[s]': 'ready at slot s', 'used[s]': 'used at slot s',
        'FP32': 'F P thirty two', 'FP16': 'F P sixteen', 'BF16': 'B F sixteen',
        'SMs': 'streaming multiprocessors', 'SM': 'S M', 'runKernel': 'run kernel', 'onlineAttention': 'online attention',
        'keysPerTile': 'keys per tile', 'warpsPerBlock': 'warps per block',
        'threadsPerBlock': 'threads per block', 'startingValue': 'starting value',
        'narrowInputs': 'narrow inputs', 'blockCounts': 'block counts',
        'keepCategory': 'keep category', 'C[0,0]': 'C at row zero, column zero',
        'expf(x)': 'exp F of x', '__syncthreads()': 'sync threads',
        'input[lane × stride]': 'input at lane times stride',
        '__syncthreads': 'sync threads', '__float2half_rn': 'float to half, round to nearest,',
        '__half2float': 'half to float', 'fill_fragment': 'fill fragment', 'WMMA': 'W M M A',
        'sizeof(x)': 'size of x', 'expf': 'exp F',
        'IDs': 'identifiers',
    }
    for token, replacement in aliases.items():
        text = text.replace(token, replacement)
    text = re.sub(r'(?<!\[)\bCUDA\b', '[CUDA](/ˈkuːdə/)', text, flags=re.I)
    text = text.replace('Which value will main print this time?', 'Which value will the function main print this time?')
    text = text.replace('value < 0.0f', 'whether value is less than zero')
    text = text.replace('Check i < n.', 'Check whether i is less than n.')
    text = text.replace('i < n protects', 'the check that i is less than n protects')
    text = text.replace('Keep the barrier outside t < readers.',
                        'Keep the barrier outside the condition t is less than readers.')
    return text.replace('↔', 'to').replace('×', 'times').replace('→', 'then')


def prepare(workers, only=None):
    WORK.mkdir(parents=True, exist_ok=True)
    before = WORK / 'before.json'
    if not before.exists():
        write(before, {str(p.relative_to(ROOT)): digest(p) for p in (ROOT/'assets/media').rglob('*.mp4')})
        if only:
            write(WORK/'previous-production.json', read(ROOT/'content/recording-production.json'))
            write(WORK/'previous-screen.json', read(ROOT/'docs/recording-speech-screen.json'))
    subprocess.run(['node', 'scripts/render-v2-recordings.mjs'], cwd=ROOT, check=True)
    recordings = []
    for source in sorted((ROOT/'content').glob('*-scenes.json')):
        slug = source.name.removesuffix('-scenes.json')
        if only and slug not in only:
            continue
        target = ROOT/f'assets/media/{slug}/{slug}.mp4'
        if not target.exists():
            continue
        folder = ROOT/f'test-results/{slug}-recording'
        source_scenes = read(source)
        subprocess.run(['node', f'scripts/render-{slug}-recording.mjs', str(folder)], cwd=ROOT, check=True)
        cues = [{**cue, 'say': spoken(cue.get('say', cue['text']))} for cue in read(folder/'scenes.json')]
        write(folder/'scenes.json', cues)
        recordings.append({'key': slug, 'slug': slug, 'kind': 'deck', 'work': str(folder),
                           'scenes': source_scenes, 'cues': cues, 'video': str(target.relative_to(ROOT))})
    for item in read(ROOT/'test-results/v2-recordings/inputs.json'):
        slug = item['slug']
        if only and 'v2-'+slug not in only:
            continue
        folder = ROOT/f'test-results/v2-recordings/{slug}'
        folder.mkdir(parents=True, exist_ok=True)
        scenes = []
        for i, scene in enumerate(item['scenes'], 1):
            (folder/f'{i-1}.html').write_text(scene['html'])
            scenes.append({'id': f's{i:02}', 'title': scene['title'], 'captions': scene.get('captions', sentences(scene['text'])),
                           **({'captionSettings':scene['captionSettings']} if 'captionSettings' in scene else {}),
                           **({'captionMaxChars':scene['captionMaxChars']} if 'captionMaxChars' in scene else {}),
                           **({'speech':scene['speech']} if 'speech' in scene else {}),
                           **({'hold':scene['hold']} if 'hold' in scene else {})})
        cues = [{'id': f'{s["id"]}-c{i+1}', 'step': s['title'], 'text': text, 'say': spoken(s.get('speech',s['captions'])[i])}
                for s in scenes for i, text in enumerate(s['captions'])]
        write(folder/'scenes.json', cues)
        recordings.append({'key': 'v2-'+slug, 'slug': slug, 'kind': 'v2', 'work': str(folder),
                           **({'learning':item['learning']} if 'learning' in item else {}),
                           'scenes': scenes, 'cues': cues, 'video': f'assets/media/v2/{slug}/recap.mp4'})
    if only:
        assert {r['key'] for r in recordings} == set(only), 'Unknown recording key'
    else:
        assert {r['video'] for r in recordings} == set(read(before)), 'Every existing recording must be covered'
    groups = [[] for _ in range(workers)]
    costs = [0] * workers
    for recording in sorted(recordings, key=lambda r: -sum(len(c['text']) for c in r['cues'])):
        group = min(range(workers), key=lambda i: costs[i])
        recording['worker'] = group
        for cue in recording['cues']:
            groups[group].append({**cue, 'id': recording['key']+'__'+cue['id']})
            costs[group] += len(cue['text'])
    for i, cues in enumerate(groups):
        write(WORK/f'worker-{i}/scenes.json', cues)
    write(WORK/'plan.json', {'recordings': recordings, 'workers': workers, 'partial':bool(only)})
    print(f'Prepared {len(recordings)} recordings, {sum(len(r["cues"]) for r in recordings)} cues', flush=True)


def original_script(skill, stage, worker, only=None):
    directory = WORK/f'worker-{worker}'
    script = {'narrate': 'tts.py', 'refine': 'tts.py', 'phonemes': 'phonemes.py', 'screen': 'asr.py'}[stage]
    extra = {'narrate': ['af_heart', '1.0'], 'refine': ['af_heart', '1.0'], 'phonemes': ['--all'], 'screen': ['small.en']}[stage]
    env = {**os.environ, 'DEMO_TTS_BACKEND': 'onnx', 'DEMO_TTS_THREADS': '2', 'HF_HUB_DISABLE_XET': '1'}
    env.pop('SCENES', None)  # A full production never silently reuses selected old speech.
    if only:
        env['SCENES'] = ','.join(only)
    with (directory/f'{stage}.log').open('w') as log:
        subprocess.run(['uv', 'run', str(skill/'scripts'/script), str(directory), *extra],
                       cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
    print(f'{stage}: worker {worker} complete', flush=True)


def distribute(plan, skill):
    for r in plan['recordings']:
        worker = WORK/f'worker-{r["worker"]}'
        speech = read(worker/'audio/durations.json')
        assert speech['voice'] == 'af_heart' and speech['speed'] == 1.0
        assert speech['engine']['backend'] == 'onnx'
        folder = Path(r['work'])/'audio'
        folder.mkdir(exist_ok=True)
        durations = {}
        for cue in r['cues']:
            key = r['key']+'__'+cue['id']
            pending=folder/f'.{cue["id"]}.pending.wav'
            shutil.copyfile(worker/'audio'/f'{key}.wav',pending)
            pending.replace(folder/f'{cue["id"]}.wav')
            durations[cue['id']] = speech['durations'][key]
        write(folder/'durations.json', {**speech, 'durations': durations,
              'skill': {'repository': SKILL_URL, 'commit': SKILL_COMMIT},
              'scriptSha256': digest(skill/'scripts/tts.py')})


def resume_worker(skill, worker):
    """Recover completed cue files from this interrupted, unchanged campaign."""
    import numpy as np
    import soundfile as sf
    folder = WORK/f'worker-{worker}'
    reference = read(ROOT/'content/first-kernel-media.json')['speech']
    assert (reference['voice'], reference['speed'], reference['engine']['backend']) == ('af_heart', 1.0, 'onnx')
    durations, missing = {}, []
    for scene in read(folder/'scenes.json'):
        path = folder/'audio'/f'{scene["id"]}.wav'
        try:
            audio, sr = sf.read(path, dtype='float32')
            assert sr == 24000 and audio.ndim == 1 and len(audio) > 2400
            assert np.isfinite(audio).all() and np.max(np.abs(audio)) < 1
            durations[scene['id']] = round(len(audio)/sr, 3)
        except (OSError, RuntimeError, AssertionError):
            missing.append(scene['id'])
    write(folder/'audio/durations.json', {**reference, 'durations': durations})
    print(f'Resume worker {worker}: {len(durations)} complete, {len(missing)} remaining', flush=True)
    original_script(skill, 'narrate', worker, missing or ['__all_cues_already_complete__'])


def refine(plan, skill):
    """Regenerate only speech forms refined after phoneme/ASR inspection."""
    pending = WORK/'refinement-pending.json'
    changed = read(pending) if pending.exists() else {}
    for r in plan['recordings']:
        for cue in r['cues']:
            say = spoken(cue.get('say', cue['text']))
            if say != cue.get('say', cue['text']) or r['key']+'__'+cue['id'] in changed:
                cue['say'] = say
                changed[r['key']+'__'+cue['id']] = say
        write(Path(r['work'])/'scenes.json', r['cues'])
    write(pending, changed)
    write(WORK/'plan.json', plan)
    for worker in range(plan['workers']):
        path = WORK/f'worker-{worker}/scenes.json'
        scenes = read(path)
        selected = []
        for scene in scenes:
            if scene['id'] in changed:
                scene['say'] = changed[scene['id']]
                selected.append(scene['id'])
        write(path, scenes)
        if selected:
            original_script(skill, 'refine', worker, selected)
    distribute(plan, skill)
    pending.unlink()
    print('Refined speech forms:', len(changed), flush=True)


def screen_batch(skill, worker, number, scenes):
    """Run the original Whisper checker in resumable batches of unchanged WAVs."""
    folder = WORK/f'asr-batches/worker-{worker}-{number:02}'
    (folder/'audio').mkdir(parents=True, exist_ok=True)
    source = WORK/f'worker-{worker}/audio'
    inputs = {'scenes': scenes, 'audio': {s['id']: digest(source/(s['id']+'.wav')) for s in scenes},
              'checkerSha256': digest(skill/'scripts/asr.py'), 'model': 'small.en'}
    marker = folder/'inputs.json'
    report = folder/'audio/asr-report.json'
    if marker.exists() and report.exists() and read(marker) == inputs:
        assert {s['id'] for s in read(report)['scenes']} == {s['id'] for s in scenes}
        print(f'Reused speech screen: worker {worker}, batch {number}', flush=True)
        return folder
    write(folder/'scenes.json', scenes)
    for scene in scenes:
        link = folder/'audio'/(scene['id']+'.wav')
        if link.is_symlink():
            link.unlink()
        assert not link.exists(), f'Unexpected non-link ASR working file: {link}'
        link.symlink_to(source/(scene['id']+'.wav'))
    with (folder/'screen.log').open('w') as log:
        subprocess.run(['uv', 'run', str(skill/'scripts/asr.py'), str(folder), 'small.en'], cwd=ROOT,
                       env={**os.environ, 'HF_HUB_OFFLINE': '1'}, stdout=log, stderr=subprocess.STDOUT, check=True)
    result = read(report)
    assert {s['id'] for s in result['scenes']} == {s['id'] for s in scenes}
    write(marker, inputs)
    print(f'Screened worker {worker}, batch {number}: {len(scenes)} cues, {result["flagged"]} raw flags', flush=True)
    return folder


def screen(plan, skill):
    jobs = []
    for worker in range(plan['workers']):
        scenes = read(WORK/f'worker-{worker}/scenes.json')
        jobs.extend((worker, i//24, scenes[i:i+24]) for i in range(0, len(scenes), 24))
    with ThreadPoolExecutor(max_workers=plan['workers']) as pool:
        folders = list(pool.map(lambda job: screen_batch(skill, *job), jobs))
    for worker in range(plan['workers']):
        batches = [folder for folder in folders if folder.name.startswith(f'worker-{worker}-')]
        reports = [read(folder/'audio/asr-report.json') for folder in batches]
        write(WORK/f'worker-{worker}/audio/asr-report.json', {
            'method': 'Original record-demo Whisper screening in resumable batches; not listening approval',
            'model': 'small.en', 'flagged': sum(r['flagged'] for r in reports),
            'scenes': [scene for r in reports for scene in r['scenes']]})
        (WORK/f'worker-{worker}/screen.log').write_text('\n'.join((folder/'screen.log').read_text() for folder in batches))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--skill-dir', type=Path, required=True)
    parser.add_argument('--stage', choices=['prepare', 'narrate', 'resume', 'refine', 'phonemes', 'screen', 'build'], required=True)
    parser.add_argument('--workers', type=int, default=2)
    parser.add_argument('--only', nargs='+', help='Prepare a targeted rebuild; retain verified evidence for unchanged media')
    args = parser.parse_args()
    skill = args.skill_dir.resolve()
    revision = subprocess.check_output(['git', '-C', str(skill), 'rev-parse', 'HEAD'], text=True).strip()
    assert revision == SKILL_COMMIT, 'Use the same pinned revision as Common Ground'
    if args.stage == 'prepare':
        prepare(args.workers, args.only)
        return
    plan = read(WORK/'plan.json')
    if args.stage == 'resume':
        with ThreadPoolExecutor(max_workers=plan['workers']) as pool:
            list(pool.map(lambda i: resume_worker(skill, i), range(plan['workers'])))
        distribute(plan, skill)
        return
    if args.stage == 'refine':
        refine(plan, skill)
        return
    if args.stage == 'screen':
        screen(plan, skill)
        return
    if args.stage == 'build':
        from recording_export import export
        export(plan['recordings'])
        return
    with ThreadPoolExecutor(max_workers=plan['workers']) as pool:
        list(pool.map(lambda i: original_script(skill, args.stage, i), range(plan['workers'])))
    if args.stage == 'narrate':
        distribute(plan, skill)


if __name__ == '__main__':
    main()
