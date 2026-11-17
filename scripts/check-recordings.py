# /// script
# requires-python = ">=3.11,<3.13"
# dependencies = []
# ///
# Copyright © 2026 Christopher Snow.
"""Verify completed recording bytes and retain media/speech production evidence."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT/'test-results/record-demo-all'
MODEL_HASHES = {
    'kokoro-v1.0.onnx': 'beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a',
    'voices-v1.0.bin': 'bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d',
}


def read(path):
    return json.loads(Path(path).read_text())


def write(path, data):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(data, indent=2, ensure_ascii=False)+'\n')


def digest(path):
    with Path(path).open('rb') as file:
        return hashlib.file_digest(file, 'sha256').hexdigest()


def metadata(r):
    return read(ROOT/'content/v2-media.json')[r['slug']] if r['kind']=='v2' else read(ROOT/f'content/{r["slug"]}-media.json')


def decode(r):
    video = ROOT/r['video']
    media = metadata(r)
    folder = WORK/'qc'/r['key']
    folder.mkdir(parents=True, exist_ok=True)
    recipe = {'qaVersion': 2, 'videoSha256': digest(video), 'scenes': media['scenes'], 'cues': media['cues']}
    marker = folder/'decode.json'
    if marker.exists() and read(marker)['inputs'] == recipe:
        result = read(marker)
        if all((folder/f'frame-{i+1:03}.jpg').exists() for i in range(len(media['scenes']))):
            print('Reused complete decode:',r['key'],flush=True)
            return result
    probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-show_chapters','-of','json',str(video)]))
    picture = next(s for s in probe['streams'] if s['codec_type']=='video')
    sound = next(s for s in probe['streams'] if s['codec_type']=='audio')
    subtitles = next(s for s in probe['streams'] if s['codec_type']=='subtitle')
    assert (picture['width'],picture['height'],picture['r_frame_rate'],picture['codec_name'])==(3840,2160,'30/1','h264'),r['key']
    assert picture['avg_frame_rate']=='30/1',r['key']
    assert int(picture['nb_frames'])==round(media['scenes'][-1]['end']*30),r['key']
    assert (sound['codec_name'],int(sound['sample_rate']))==('aac',48000),r['key']
    assert subtitles['codec_name']=='mov_text' and subtitles['tags']['language']=='eng',r['key']
    assert len(probe['chapters'])==len(media['scenes']),r['key']
    duration = float(probe['format']['duration'])
    assert abs(duration-media['durationSeconds'])<1 and video.stat().st_size==media['bytes'],r['key']
    selections = '+'.join(f'eq(n,{round((s["start"]+s["end"])/2*30)})' for s in media['scenes'])
    filters = f"[0:v]split=2[check][pick];[pick]select='{selections}'[shots];[0:a]loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[sound]"
    command = ['ffmpeg','-y','-xerror','-v','info','-nostats','-threads','2','-i',str(video),'-filter_complex',filters,
               '-map','[check]','-map','[sound]','-f','null','-',
               '-map','[shots]','-fps_mode','vfr','-q:v','3',str(folder/'frame-%03d.jpg')]
    result = subprocess.run(command,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,text=True)
    (folder/'decode.log').write_text(result.stderr)
    if result.returncode:
        raise RuntimeError(r['key']+': '+result.stderr[-3000:])
    matches = re.findall(r'\{\s*"input_i"[^}]+\}',result.stderr)
    assert matches,'Missing measured loudness: '+r['key']
    loudness = json.loads(matches[-1])
    assert float(loudness['input_tp'])<0,'Clipping after encoding: '+r['key']
    assert abs(float(loudness['input_i'])+16)<1,'Unexpected loudness: '+r['key']
    similarities=[]
    for i,scene in enumerate(media['scenes']):
        frame=folder/f'frame-{i+1:03}.jpg'
        assert frame.exists(),r['key']
        # Check scene order and pixel preservation after packet repetition/muxing.
        compared=subprocess.run(['ffmpeg','-v','info','-i',str(Path(r['work'])/'slides'/(scene['id']+'.png')),
                                 '-i',str(frame),'-lavfi','ssim','-f','null','-'],
                                stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,text=True,check=True)
        similarity=float(re.search(r'All:([0-9.]+)',compared.stderr)[1])
        assert similarity>.99,(r['key'],scene['id'],'encoded scene differs from its native source',similarity)
        similarities.append(similarity)
    evidence = {'inputs':recipe,'width':picture['width'],'height':picture['height'],'fps':30,
                'audioSampleRate':int(sound['sample_rate']),'durationSeconds':duration,
                'chapters':len(probe['chapters']),'measuredLUFS':float(loudness['input_i']),
                'measuredTruePeakDB':float(loudness['input_tp']),'minSceneSSIM':min(similarities),'fullDecode':True}
    write(marker,evidence)
    print('Decoded and measured:',r['key'],duration,'seconds',flush=True)
    return evidence


def report(plan):
    expected={r['video'] for r in plan['recordings']}
    assert expected=={str(p.relative_to(ROOT)) for p in (ROOT/'assets/media').rglob('*.mp4')}
    previous=read(WORK/'before.json')
    speech_rows,flagged=[],{}
    for worker in range(plan['workers']):
        folder=WORK/f'worker-{worker}'
        original=read(folder/'audio/asr-report.json')
        assert original['model']=='small.en'
        speech_rows.extend(original['scenes'])
        lines=(folder/'screen.log').read_text().splitlines()
        for i,line in enumerate(lines):
            if line.startswith('!! '):
                flagged[line.split()[1]]=lines[i+1].strip() if i+1<len(lines) else ''
    assert {s['id'] for s in speech_rows}=={r['key']+'__'+c['id'] for r in plan['recordings'] for c in r['cues']}
    reviews=read(WORK/'speech-review.json')
    assert set(flagged)==set(reviews),'Every raw ASR flag needs an explicit review'
    spoken_forms={r['key']+'__'+c['id']:c.get('say',c['text']) for r in plan['recordings'] for c in r['cues']}
    assert not any(re.search(r'[<>]',say) for say in spoken_forms.values()),'Expand code comparisons before narration'
    entries=[]
    for r in plan['recordings']:
        media=metadata(r);video=ROOT/r['video']
        assert (media['speech']['voice'],media['speech']['speed'],media['speech']['engine']['backend'])==('af_heart',1.0,'onnx')
        assert media['speech']['engine']['sha256']==MODEL_HASHES
        assert media['speech']['skill']['commit']=='c9a7c521568632aa216932f4c965df386498602a'
        captions=' '.join(l for l in (video.parent/'captions.vtt').read_text().splitlines() if l and l!='WEBVTT' and ' --> ' not in l)
        assert captions==' '.join(c for s in r['scenes'] for c in s['captions']),r['key']
        assert [c['text'] for c in media['cues']]==[c['text'] for c in r['cues']],r['key']
        decoded=read(WORK/'qc'/r['key']/'decode.json')
        assert decoded['inputs']['videoSha256']==digest(video),r['key']
        entries.append({'key':r['key'],'video':r['video'],'sha256':digest(video),'previousSha256':previous[r['video']],
                        'captionSha256':digest(video.parent/'captions.vtt'),'posterSha256':digest(video.parent/'poster.jpg'),
                        'bytes':video.stat().st_size,'durationSeconds':media['durationSeconds'],
                        'cueCount':len(r['cues']),'sceneCount':len(r['scenes']),
                        'fullDecode':True,'width':3840,'height':2160,'fps':30,
                        'measuredLUFS':decoded['measuredLUFS'],'measuredTruePeakDB':decoded['measuredTruePeakDB'],
                        'minSceneSSIM':decoded['minSceneSSIM']})
    write(ROOT/'content/recording-production.json',{'skill':{'repository':'https://github.com/snowch/claude-skills','commit':'c9a7c521568632aa216932f4c965df386498602a'},
          'voice':'af_heart','speed':1.0,'backend':'onnx','modelSha256':MODEL_HASHES,
          'asrModel':'small.en','asrCueCount':len(speech_rows),'rawFlagCount':len(flagged),'recordings':entries,
          'reviewLimits':'Author review and independent ASR; no human listening approval or learner study.'})
    write(ROOT/'docs/recording-speech-screen.json',{'model':'small.en','method':'Original pinned record-demo checker in resumable batches',
          'rawFlags':flagged,'reviews':reviews,'spokenForms':spoken_forms,'scenes':speech_rows})
    print('Production evidence:',len(entries),'videos,',len(speech_rows),'screened cues,',len(flagged),'reviewed raw flags',flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage',choices=['decode','report'],required=True)
    parser.add_argument('--only',nargs='*')
    args=parser.parse_args()
    plan=read(WORK/'plan.json')
    if args.stage=='report':
        report(plan)
    else:
        selected=[r for r in plan['recordings'] if not args.only or r['key'] in args.only]
        with ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(decode,selected))
