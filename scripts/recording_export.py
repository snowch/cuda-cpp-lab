# Copyright © 2026 Christopher Snow.
"""Native 4K deck export using speech made by the external record-demo skill."""
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import hashlib
import os
from pathlib import Path
import shutil
import struct
import subprocess
import textwrap
from threading import Thread

import numpy as np
import soundfile as sf
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT/'test-results/record-demo-all'


def digest(path):
    with Path(path).open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def fingerprint(r, speech):
    folder = Path(r['work'])
    inputs = {'key': r['key'], 'scenes': r['scenes'], 'exporterSha256': digest(__file__),
              'speech': {k: speech[k] for k in ['voice', 'speed', 'engine', 'skill']},
              'preset': os.environ.get('DEMO_FFMPEG_PRESET', 'veryfast'),
              'frames': [digest(folder/'slides'/(s['id']+'.png')) for s in r['scenes']],
              'audio': [digest(folder/'audio'/(c['id']+'.wav')) for c in r['cues']]}
    return hashlib.sha256(json.dumps(inputs, sort_keys=True).encode()).hexdigest()


def command(args):
    try:
        subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as error:
        print(error.stderr.decode(errors='replace')[-4000:], flush=True)
        raise


def stamp(seconds, srt=False):
    ms = round(seconds*1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}{"," if srt else "."}{ms%1000:03}'


def display_captions(text, start, end, limit=None):
    """Short display cues inside a measured speech cue, preserving every word.

    Narration remains intact. Display boundaries are interpolated by text length;
    they are not claimed to be forced word alignment or additional speech clips.
    """
    chunks = textwrap.wrap(text, width=limit, break_long_words=False,
                           break_on_hyphens=False) if limit else [text]
    # Avoid flashing a trailing word on its own after a full display line.
    if limit and len(chunks)>1 and len(chunks[-1])<limit/2:
        tail=chunks[-2]+' '+chunks[-1]
        if len(tail)<=limit:
            chunks[-2:]=[tail]
        else:
            previous=chunks[-2].split()
            while len(chunks[-1])<limit/2 and len(previous)>1:
                candidate=previous[-1]+' '+chunks[-1]
                if len(candidate)>limit or len(' '.join(previous[:-1]))<limit/2:
                    break
                chunks[-1]=candidate
                previous.pop()
            chunks[-2]=' '.join(previous)
    assert ' '.join(chunks) == text
    total = sum(len(chunk) for chunk in chunks)
    cursor = start
    result = []
    for i, chunk in enumerate(chunks):
        boundary = end if i == len(chunks)-1 else cursor+(end-start)*len(chunk)/total
        result.append({'start':round(cursor,3),'end':round(boundary,3),'text':chunk})
        cursor = boundary
    return result


def capture(recordings):
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'))
            for r in recordings:
                folder = Path(r['work'])
                slides = folder/'slides'
                slides.mkdir(exist_ok=True)
                if r['slug'] == 'inside-sm':
                    command(['pdftoppm', '-png', '-scale-to-x', '3840', '-scale-to-y', '2160',
                             str(ROOT/'assets/media/inside-sm/slides.pdf'), str(slides/'pdf')])
                    pages = sorted(slides.glob('pdf-*.png'))
                    assert len(pages) == len(r['scenes'])
                    for scene, page in zip(r['scenes'], pages):
                        shutil.copyfile(page, slides/(scene['id']+'.png'))
                else:
                    v2 = r['kind'] == 'v2'
                    page = browser.new_page(viewport={'width': 1600 if v2 else 1280, 'height': 900 if v2 else 720},
                                            device_scale_factor=2.4 if v2 else 3)
                    for i, scene in enumerate(r['scenes']):
                        path = folder/(f'{i}.html' if v2 else 'deck.html')
                        page.goto(f'http://127.0.0.1:{server.server_port}/'+str(path.relative_to(ROOT)))
                        page.evaluate('document.fonts.ready')
                        element = page.locator('.slide' if v2 else '#'+scene['id'])
                        assert element.evaluate('el=>el.scrollHeight<=el.clientHeight && el.scrollWidth<=el.clientWidth'), (r['key'], scene['id'])
                        element.screenshot(path=str(slides/(scene['id']+'.png')), animations='disabled')
                    if not v2:
                        page.pdf(path=str(ROOT/f'assets/media/{r["slug"]}/slides.pdf'),
                                 print_background=True, prefer_css_page_size=True)
                    page.close()
                for scene in r['scenes']:
                    data = (slides/(scene['id']+'.png')).read_bytes()
                    assert struct.unpack('>II', data[16:24]) == (3840, 2160), (r['key'], scene['id'])
                print('Captured native 4K:', r['key'], flush=True)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


def encode(r):
    assert not (WORK/'refinement-pending.json').exists(), 'Complete pending pronunciation refinements before encoding'
    folder = Path(r['work'])
    dest = ROOT/r['video']
    speech = json.loads((folder/'audio/durations.json').read_text())
    assert (speech['voice'], speech['speed'], speech['engine']['backend']) == ('af_heart', 1.0, 'onnx')
    assert speech['skill']['commit'] == 'c9a7c521568632aa216932f4c965df386498602a'
    marker = WORK/'encoded'/(r['key']+'.json')
    source_hash = fingerprint(r, speech)
    if marker.exists():
        saved = json.loads(marker.read_text())
        outputs = [dest, dest.parent/'captions.vtt', dest.parent/'poster.jpg']
        if saved['inputSha256'] == source_hash and all(p.exists() and digest(p) == saved['files'][p.name] for p in outputs):
            if r['kind'] == 'deck':
                (ROOT/f'content/{r["slug"]}-media.json').write_text(json.dumps(saved['result'], indent=2)+'\n')
            print('Reused verified export:', r['key'], flush=True)
            return r['slug'], saved['result']
    pieces, captions, srt, cuts, cues, display = [], ['WEBVTT', ''], [], [], [], []
    chapters = [';FFMETADATA1', 'title='+r['scenes'][0]['title'], 'artist=GPU Lab']
    cursor, sr = 0.0, 24000
    for scene in r['scenes']:
        start = cursor
        pieces.append(np.zeros(round(.6*sr), dtype=np.float32))
        cursor += .6
        for i, text in enumerate(scene['captions'], 1):
            cue_id = f'{scene["id"]}-c{i}'
            audio, source_sr = sf.read(folder/'audio'/f'{cue_id}.wav', dtype='float32')
            assert source_sr == sr and audio.ndim == 1 and np.isfinite(audio).all() and np.max(np.abs(audio)) < 1
            end = cursor + len(audio)/sr
            settings = scene.get('captionSettings', '')
            for shown in display_captions(text, cursor, end, scene.get('captionMaxChars')):
                captions += [f'{stamp(shown["start"])} --> {stamp(shown["end"])}'+(' '+settings if settings else ''), shown['text'], '']
                srt += [str(len(display)+1), f'{stamp(shown["start"], True)} --> {stamp(shown["end"], True)}', shown['text'], '']
                display.append(shown)
            cues.append({'id': cue_id, 'start': round(cursor, 3), 'end': round(end, 3), 'text': text})
            pieces.extend([audio, np.zeros(round(.22*sr), dtype=np.float32)])
            cursor = end + .22
        hold = scene.get('hold', 1.2)
        pieces.append(np.zeros(round(hold*sr), dtype=np.float32))
        cursor += hold
        cuts.append({'id': scene['id'], 'start': round(start, 3), 'end': round(cursor, 3), 'title': scene['title']})
        chapters += ['[CHAPTER]', 'TIMEBASE=1/1000', f'START={round(start*1000)}', f'END={round(cursor*1000)}', 'title='+scene['title']]
    sf.write(folder/'narration.wav', np.concatenate(pieces), sr, subtype='PCM_24')
    (dest.parent/'captions.vtt').write_text('\n'.join(captions))
    (folder/'captions.srt').write_text('\n'.join(srt))
    (folder/'chapters.txt').write_text('\n'.join(chapters))
    frames = []
    for cut in cuts:
        frames += [f"file '{folder / 'slides' / (cut['id']+'.png')}'", f"duration {cut['end']-cut['start']:.3f}"]
    frames.append(f"file '{folder / 'slides' / (cuts[-1]['id']+'.png')}'")
    (folder/'frames.txt').write_text('\n'.join(frames))
    # These decks are stills. Encode one closed four-second GOP per scene and
    # repeat its packets, rather than encoding the same pixels for every second
    # of narration. Cumulative frame rounding keeps scene boundaries within half
    # a frame; every published frame is still native 4K at 30 fps.
    segments = []
    scene_folder = folder/'encoded-scenes'
    scene_folder.mkdir(exist_ok=True)
    for cut in cuts:
        count = round(cut['end']*30)-round(cut['start']*30)
        seed_count = min(count,120)
        seed = scene_folder/(cut['id']+'-seed.mp4')
        segment = scene_folder/(cut['id']+'.mp4')
        image = folder/'slides'/(cut['id']+'.png')
        still = scene_folder/(cut['id']+'.txt')
        still.write_text(f"file '{image}'\nduration {seed_count/30:.9f}\nfile '{image}'\n")
        command(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(still),
                 '-vf','format=yuv420p,fps=30','-frames:v',str(seed_count),
                 '-c:v','libx264','-preset',os.environ.get('DEMO_FFMPEG_PRESET','veryfast'),
                 '-threads',os.environ.get('DEMO_FFMPEG_THREADS','2'),'-crf','18','-tune','stillimage',
                 '-g','120','-keyint_min','120','-sc_threshold','0','-bf','0',str(seed)])
        command(['ffmpeg','-y','-v','error','-stream_loop',str((count+seed_count-1)//seed_count-1),
                 '-i',str(seed),'-map','0:v','-frames:v',str(count),'-c','copy',str(segment)])
        segments += [f"file '{segment}'",f'duration {count/30:.9f}']
    (folder/'segments.txt').write_text('\n'.join(segments)+'\n')
    encoded = folder/'encoded.mp4'
    command(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(folder/'segments.txt'),
             '-i', str(folder/'narration.wav'), '-i', str(folder/'captions.srt'), '-i', str(folder/'chapters.txt'),
             '-map', '0:v', '-map', '1:a', '-map', '2:s', '-map_metadata', '3', '-map_chapters', '3',
             '-c:v', 'copy',
             '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '160k',
             '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng', '-movflags', '+faststart', '-t', str(round(cursor, 3)), str(encoded)])
    encoded.replace(dest)
    command(['ffmpeg', '-y', '-v', 'error', '-i', str(folder/'slides'/f'{cuts[0]["id"]}.png'),
             '-vf', 'scale=1920:1080', '-frames:v', '1', str(dest.parent/'poster.jpg')])
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(dest)]))
    video = next(s for s in probe['streams'] if s['codec_type'] == 'video')
    assert (video['width'], video['height']) == (3840, 2160)
    out = WORK/'out'
    out.mkdir(exist_ok=True)
    command(['ffmpeg', '-y', '-v', 'error', '-i', str(dest), '-map', '0:v', '-c', 'copy', '-an', str(out/(r['key']+'-4k-silent.mp4'))])
    shutil.copyfile(dest, out/(r['key']+'-4k-narrated.mp4'))
    rows = ['# '+r['scenes'][0]['title'], '', '| Start | End | On screen | Narration |', '| --- | --- | --- | --- |']
    for scene, cut in zip(r['scenes'], cuts):
        rows.append(f'| {stamp(cut["start"])} | {stamp(cut["end"])} | {scene["title"]} | '+ ' '.join(scene['captions']).replace('|', '\\|')+' |')
    (out/(r['key']+'-shot-list.md')).write_text('\n'.join(rows)+'\n')
    result = {'durationSeconds': round(float(probe['format']['duration'])), 'bytes': dest.stat().st_size,
              'scenes': cuts, 'cues': cues, 'displayCues': display, 'speech': speech, 'video': {'width': 3840, 'height': 2160, 'fps': 30},
              'encoding': {'preset': os.environ.get('DEMO_FFMPEG_PRESET', 'veryfast'), 'crf': 18,
                           'gopFrames': 120, 'method': 'closed-GOP repetition of native still scenes'},
              'audio': {'codec': 'aac', 'sampleRate': 48000, 'bitrate': 160000, 'loudnessTargetLUFS': -16, 'truePeakTargetDB': -1.5}}
    if r['kind'] == 'deck':
        (ROOT/f'content/{r["slug"]}-media.json').write_text(json.dumps(result, indent=2)+'\n')
    marker.parent.mkdir(exist_ok=True)
    marker.write_text(json.dumps({'inputSha256': source_hash, 'result': result,
                                'files': {p.name: digest(p) for p in [dest, dest.parent/'captions.vtt', dest.parent/'poster.jpg']}}, indent=2)+'\n')
    print('Encoded 4K / af_heart:', r['key'], result['durationSeconds'], 'seconds', flush=True)
    return r['slug'], result


def export(recordings, slides_only=False):
    capture(recordings)
    if slides_only:
        return
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(encode, recordings))
    v2 = {slug: metadata for r, (slug, metadata) in zip(recordings, results) if r['kind'] == 'v2'}
    if v2:
        path = ROOT/'content/v2-media.json'
        previous = json.loads(path.read_text())
        previous.update(v2)
        path.write_text(json.dumps(previous, indent=2)+'\n')
