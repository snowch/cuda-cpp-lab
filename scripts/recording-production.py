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
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')


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
        'SM': 'S M', 'runKernel': 'run kernel', 'onlineAttention': 'online attention',
        'keysPerTile': 'keys per tile', 'warpsPerBlock': 'warps per block',
        'threadsPerBlock': 'threads per block', 'startingValue': 'starting value',
        'narrowInputs': 'narrow inputs', 'blockCounts': 'block counts',
        'keepCategory': 'keep category', 'C[0,0]': 'C at row zero, column zero',
        'expf(x)': 'exp F of x', '__syncthreads()': 'sync threads',
        'input[lane × stride]': 'input at lane times stride',
    }
    for token, replacement in aliases.items():
        text = text.replace(token, replacement)
    text = re.sub(r'(?<!\[)\bCUDA\b', '[CUDA](/ˈkuːdə/)', text, flags=re.I)
    text = text.replace('Which value will main print this time?', 'Which value will the function main print this time?')
    return text.replace('↔', 'to').replace('×', 'times').replace('→', 'then')


def prepare(workers):
    WORK.mkdir(parents=True, exist_ok=True)
    before = WORK / 'before.json'
    if not before.exists():
        write(before, {str(p.relative_to(ROOT)): digest(p) for p in (ROOT/'assets/media').rglob('*.mp4')})
    subprocess.run(['node', 'scripts/render-v2-recordings.mjs'], cwd=ROOT, check=True)
    recordings = []
    for source in sorted((ROOT/'content').glob('*-scenes.json')):
        slug = source.name.removesuffix('-scenes.json')
        target = ROOT/f'assets/media/{slug}/{slug}.mp4'
        if not target.exists():
            continue
        folder = ROOT/f'test-results/{slug}-recording'
        source_scenes = read(source)
        if slug == 'inside-sm':
            folder.mkdir(parents=True, exist_ok=True)
            source_scenes = [{**s, 'captions': sentences(s['text'])} for s in source_scenes]
            cues = [{'id': f'{s["id"]}-c{i+1}', 'step': s['title'], 'text': text, 'say': spoken(text)}
                    for s in source_scenes for i, text in enumerate(s['captions'])]
            write(folder/'scenes.json', cues)
        else:
            subprocess.run(['node', f'scripts/render-{slug}-recording.mjs', str(folder)], cwd=ROOT, check=True)
            cues = [{**cue, 'say': spoken(cue.get('say', cue['text']))} for cue in read(folder/'scenes.json')]
            write(folder/'scenes.json', cues)
        recordings.append({'key': slug, 'slug': slug, 'kind': 'deck', 'work': str(folder),
                           'scenes': source_scenes, 'cues': cues, 'video': str(target.relative_to(ROOT))})
    for item in read(ROOT/'test-results/v2-recordings/inputs.json'):
        slug = item['slug']
        folder = ROOT/f'test-results/v2-recordings/{slug}'
        folder.mkdir(parents=True, exist_ok=True)
        scenes = []
        for i, scene in enumerate(item['scenes'], 1):
            (folder/f'{i-1}.html').write_text(scene['html'])
            scenes.append({'id': f's{i:02}', 'title': scene['title'], 'captions': sentences(scene['text'])})
        cues = [{'id': f'{s["id"]}-c{i+1}', 'step': s['title'], 'text': text, 'say': spoken(text)}
                for s in scenes for i, text in enumerate(s['captions'])]
        write(folder/'scenes.json', cues)
        recordings.append({'key': 'v2-'+slug, 'slug': slug, 'kind': 'v2', 'work': str(folder),
                           'scenes': scenes, 'cues': cues, 'video': f'assets/media/v2/{slug}/recap.mp4'})
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
    write(WORK/'plan.json', {'recordings': recordings, 'workers': workers})
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
            shutil.copyfile(worker/'audio'/f'{key}.wav', folder/f'{cue["id"]}.wav')
            durations[cue['id']] = speech['durations'][key]
        write(folder/'durations.json', {**speech, 'durations': durations,
              'skill': {'repository': SKILL_URL, 'commit': SKILL_COMMIT},
              'scriptSha256': digest(skill/'scripts/tts.py')})


def refine(plan, skill):
    """Regenerate only speech forms refined after phoneme/ASR inspection."""
    changed = {}
    for r in plan['recordings']:
        for cue in r['cues']:
            say = spoken(cue.get('say', cue['text']))
            if say != cue.get('say', cue['text']):
                cue['say'] = say
                changed[r['key']+'__'+cue['id']] = say
        write(Path(r['work'])/'scenes.json', r['cues'])
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
    print('Refined speech forms:', len(changed), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--skill-dir', type=Path, required=True)
    parser.add_argument('--stage', choices=['prepare', 'narrate', 'refine', 'phonemes', 'screen', 'build'], required=True)
    parser.add_argument('--workers', type=int, default=2)
    args = parser.parse_args()
    skill = args.skill_dir.resolve()
    revision = subprocess.check_output(['git', '-C', str(skill), 'rev-parse', 'HEAD'], text=True).strip()
    assert revision == SKILL_COMMIT, 'Use the same pinned revision as Common Ground'
    if args.stage == 'prepare':
        prepare(args.workers)
        return
    plan = read(WORK/'plan.json')
    if args.stage == 'refine':
        refine(plan, skill)
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
