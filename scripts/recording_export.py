# Copyright © 2026 Christopher Snow.
"""Native 4K deck export using speech made by the external record-demo skill."""
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
from threading import Thread

import numpy as np
import soundfile as sf
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT/'test-results/record-demo-all'


def command(args):
    try:
        subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as error:
        print(error.stderr.decode(errors='replace')[-4000:], flush=True)
        raise


def stamp(seconds, srt=False):
    ms = round(seconds*1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}{"," if srt else "."}{ms%1000:03}'


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
    folder = Path(r['work'])
    dest = ROOT/r['video']
    speech = json.loads((folder/'audio/durations.json').read_text())
    assert (speech['voice'], speech['speed'], speech['engine']['backend']) == ('af_heart', 1.0, 'onnx')
    assert speech['skill']['commit'] == 'c9a7c521568632aa216932f4c965df386498602a'
    pieces, captions, srt, cuts, cues = [], ['WEBVTT', ''], [], [], []
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
            captions += [f'{stamp(cursor)} --> {stamp(end)}', text, '']
            srt += [str(len(cues)+1), f'{stamp(cursor, True)} --> {stamp(end, True)}', text, '']
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
    command(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(folder/'frames.txt'),
             '-i', str(folder/'narration.wav'), '-i', str(folder/'captions.srt'), '-i', str(folder/'chapters.txt'),
             '-map', '0:v', '-map', '1:a', '-map', '2:s', '-map_metadata', '3', '-map_chapters', '3',
             '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', os.environ.get('DEMO_FFMPEG_PRESET', 'veryfast'),
             '-threads', os.environ.get('DEMO_FFMPEG_THREADS', '2'), '-crf', '18', '-tune', 'stillimage',
             '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '160k',
             '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng', '-movflags', '+faststart', '-t', str(round(cursor, 3)), str(dest)])
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
              'scenes': cuts, 'cues': cues, 'speech': speech, 'video': {'width': 3840, 'height': 2160, 'fps': 30},
              'audio': {'codec': 'aac', 'sampleRate': 48000, 'bitrate': 160000, 'loudnessTargetLUFS': -16, 'truePeakTargetDB': -1.5}}
    if r['kind'] == 'deck':
        (ROOT/f'content/{r["slug"]}-media.json').write_text(json.dumps(result, indent=2)+'\n')
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
