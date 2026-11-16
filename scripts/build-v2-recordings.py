# Copyright © 2026 Christopher Snow.
"""Build V2 CUDA recaps with original frames, Flite speech and matching VTT cues.
Run from the repository root. Requires Chromium/Playwright and FFmpeg with Flite.
Ordinary course builds use the committed recordings and never run TTS.
"""
import concurrent.futures
import functools
import http.server
import json
import math
import sys
from pathlib import Path
import re
import shutil
import subprocess
import threading
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'test-results/v2-recordings'
subprocess.run(['node', 'scripts/render-v2-recordings.mjs'], cwd=ROOT, check=True)
inputs = json.loads((WORK / 'inputs.json').read_text())
if len(sys.argv) > 1:
    inputs = [item for item in inputs if item['slug'] in sys.argv[1:]]
    assert len(inputs) == len(sys.argv) - 1, 'Unknown lesson slug'
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1600,'height':900})
    for item in inputs:
        folder = WORK / item['slug']; folder.mkdir(exist_ok=True)
        for index, scene in enumerate(item['scenes']):
            path = folder / f'{index}.html'; path.write_text(scene['html'])
            page.goto(f'http://127.0.0.1:{server.server_port}/{path.relative_to(ROOT)}')
            page.evaluate('document.fonts.ready')
            assert page.evaluate('document.documentElement.scrollHeight <= 900'), item['slug']
            assert page.evaluate('document.documentElement.scrollWidth <= 1600'), item['slug']
            page.screenshot(path=str(folder / f'{index}.png'))
    browser.close()
server.shutdown()
server.server_close()
def command(args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
def stamp(seconds):
    ms = round(seconds * 1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'
def build(item):
    folder = WORK / item['slug']
    dest = ROOT / 'assets/media/v2' / item['slug']; dest.mkdir(parents=True,exist_ok=True)
    cursor = 0; captions = ['WEBVTT','']; metadata = []
    for index, scene in enumerate(item['scenes']):
        # Synthesize each sentence separately so captions follow exact audio cues.
        sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', scene['text'])
        duration = 0
        audio_parts = []
        for cue, sentence in enumerate(sentences):
            cue_path = folder / f'{index}-{cue}'
            spoken = sentence.replace('SM', 'ess em').replace('FP32', 'F P thirty two').replace('FP16', 'F P sixteen').replace('CUDA', 'Kooda').replace('↔','to').replace('×','times').replace('→','then')
            cue_path.with_suffix('.txt').write_text(spoken)
            command(['ffmpeg','-y','-v','error','-f','lavfi','-i',f"flite=textfile='{cue_path.with_suffix('.txt')}':voice=slt",'-ar','24000',str(cue_path.with_suffix('.wav'))])
            seconds = float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(cue_path.with_suffix('.wav'))]))
            captions += [f'{stamp(cursor + .5 + duration)} --> {stamp(cursor + .5 + duration + seconds)}',sentence,'']
            duration += seconds
            audio_parts.append(f"file '{cue_path.with_suffix('.wav')}'")
        (folder / f'{index}-audio.txt').write_text('\n'.join(audio_parts))
        command(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(folder / f'{index}-audio.txt'),'-c:a','pcm_s16le',str(folder / f'{index}.wav')])
        total = duration + 1.5
        command(['ffmpeg','-y','-v','error','-loop','1','-framerate','12','-i',str(folder / f'{index}.png'),'-i',str(folder / f'{index}.wav'),'-vf','scale=1280:720,format=yuv420p','-af','adelay=500|500,apad','-t',str(total),'-c:v','libx264','-preset','ultrafast','-tune','stillimage','-crf','23','-threads','2','-c:a','aac','-b:a','64k',str(folder / f'{index}.mp4')])
        metadata.append({'start':cursor,'end':cursor+total,'title':scene['title']});cursor+=total
    (folder / 'concat.txt').write_text('\n'.join(f"file '{folder / f'{i}.mp4'}'" for i in range(3)))
    command(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(folder/'concat.txt'),'-c','copy','-movflags','+faststart',str(dest/'recap.mp4')])
    command(['ffmpeg','-y','-v','error','-i',str(folder/'0.png'),'-vf','scale=1280:720','-frames:v','1',str(dest/'poster.jpg')])
    (dest/'captions.vtt').write_text('\n'.join(captions))
    print('Built recap:',item['slug'],math.ceil(cursor),'seconds',flush=True)
    return item['slug'], {'durationSeconds':math.ceil(cursor),'bytes':(dest/'recap.mp4').stat().st_size,'scenes':metadata,'speech':{'engine':'Flite','voice':'slt'},'captionTiming':'Sentence cues use individually synthesised audio durations; scenes include a leading half-second and one-second closing hold.'}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
    results = dict(executor.map(build,inputs))
manifest_path = ROOT/'content/v2-media.json'
manifest = json.loads(manifest_path.read_text()) if len(sys.argv) > 1 else {}
manifest.update(results)
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
