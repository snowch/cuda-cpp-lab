# Copyright © 2026 Christopher Snow.
"""Play every published recording, seek captions and preserve paused position."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import time
from urllib.request import urlopen

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
(ROOT/'test-results/recording-context').mkdir(parents=True,exist_ok=True)
PORT = 5182
URL = f'http://127.0.0.1:{PORT}/gpu-lab/'
recordings=[]
for video in sorted((ROOT/'assets/media').rglob('*.mp4')):
    slug=video.parent.name
    current=video.parent.parent.name=='v2'
    metadata=(json.loads((ROOT/'content/v2-media.json').read_text())[slug] if current
              else json.loads((ROOT/f'content/{slug}-media.json').read_text()))
    recordings.append({'key':('v2-' if current else '')+slug,'durationSeconds':metadata['durationSeconds']})
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--only',nargs='+',help='Recheck selected recording keys after a media change')
args=parser.parse_args()
if args.only:
    assert set(args.only)<={r['key'] for r in recordings},'Unknown recording key'
    recordings=[r for r in recordings if r['key'] in args.only]
server = subprocess.Popen(['node', 'scripts/serve.mjs', '--dist'], cwd=ROOT,
                          env={**os.environ, 'PORT': str(PORT)}, stdout=subprocess.DEVNULL)
try:
    for attempt in range(60):
        try:
            with urlopen(URL, timeout=1) as response:
                assert response.status == 200
            break
        except OSError:
            if server.poll() is not None:
                raise RuntimeError('Recording preview stopped')
            time.sleep(.1)
    else:
        raise RuntimeError('Recording preview did not start')
    with sync_playwright() as p:
        options = {'headless': True}
        if os.environ.get('CHROMIUM_PATH'):
            options['executable_path'] = os.environ['CHROMIUM_PATH']
        browser = p.chromium.launch(**options)
        representative={'first-kernel','inside-sm','reduction','matmul','v2-reduction',
                        'v2-matmul','v2-tensor-cores','v2-token-routing'}
        for width, theme in [(390, 'light'), (390, 'dark'), (820, 'light'),
                             (820, 'dark'), (1440, 'light'), (1440, 'dark')]:
            context = browser.new_context(viewport={'width': width, 'height': 1100},
                                          color_scheme=theme, service_workers='block')
            context.route('https://api.github.com/**', lambda route: route.abort())
            page = context.new_page()
            selected=recordings if args.only or (theme=='light' and width in [390,1440]) else [r for r in recordings if r['key'] in representative]
            for item in selected:
                key = item['key']
                current = key.startswith('v2-') or key == 'first-kernel'
                slug = key[3:] if key.startswith('v2-') else key
                route = f'v2/{slug}.html' if current else f'lessons/{slug}{"" if slug=="inside-sm" else "-video"}.html'
                page.goto(URL + route)
                page.wait_for_load_state('load')
                video = page.locator('video')
                expect(video).to_have_count(1)
                if current:
                    section = page.locator('#v2-first-video' if slug=='first-kernel' else '#v2-video')
                    section.locator(':scope > summary').focus()
                    page.keyboard.press('Enter')
                    expect(section).to_have_attribute('open', '')
                expect(video).to_be_visible()
                expect(video.locator('track')).to_have_attribute('kind', 'captions')
                video.evaluate('v=>{v.muted=true;v.load()}')
                page.wait_for_function('document.querySelector("video").readyState>=1')
                assert video.evaluate('v=>[v.videoWidth,v.videoHeight]') == [3840, 2160], key
                assert abs(video.evaluate('v=>v.duration')-item['durationSeconds'])<1, key
                metadata = (json.loads((ROOT/'content/v2-media.json').read_text())[slug] if key.startswith('v2-')
                            else json.loads((ROOT/f'content/{slug}-media.json').read_text()))
                cue = metadata.get('displayCues',metadata['cues'])[-1]
                target = (cue['start']+cue['end'])/2
                video.evaluate('(v,time)=>{v.currentTime=time;return v.play()}', target)
                page.wait_for_function('time=>document.querySelector("video").currentTime>time+.1', arg=target)
                video.evaluate('v=>{v.pause();v.playbackRate=1.25}')
                page.wait_for_function('text=>[...document.querySelector("video").textTracks[0].activeCues||[]].some(c=>c.text===text)',arg=cue['text'])
                assert video.evaluate('v=>v.textTracks[0].mode')=='showing', key
                if key in ['first-kernel','v2-one-thread-one-element']:
                    assert video.evaluate('v=>[...v.textTracks[0].activeCues].every(c=>c.line==="auto"&&c.position===50&&c.size===92)'), key
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), key
                transcript = page.locator('.sm-transcript > summary')
                transcript.focus();page.keyboard.press('Enter')
                expect(page.locator('.sm-transcript')).to_have_attribute('open', '')
                # Use the same snapshot API as an offline restart, then reload.
                position = video.evaluate('v=>v.currentTime')
                page.evaluate('''async()=>{
                    const source=[...document.scripts].find(s=>s.src.includes('/src/offline.mjs'));
                    const state=await import(new URL('experiment-state.mjs',source.src));
                    state.saveReadingState();
                }''')
                page.reload()
                video.scroll_into_view_if_needed()
                page.wait_for_function('time=>{const v=document.querySelector("video");return !v.seeking&&v.readyState>=3&&Math.abs(v.currentTime-time)<.15}', arg=position)
                page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
                assert video.evaluate('v=>v.paused&&v.playbackRate===1.25'), key
                expect(page.locator('.sm-transcript')).to_have_attribute('open', '')
                if key in ['first-kernel','inside-sm','v2-reduction','v2-matmul','v2-tensor-cores','v2-token-routing']:
                    video.screenshot(path=str(ROOT/f'test-results/recording-{key}-{width}-{theme}.png'))
                if theme=='light' and width in [390,1440]:
                    page.locator('.sm-transcript > summary').press('Enter')
                    video.evaluate('v=>scrollTo({top:Math.max(0,v.closest(".sm-recording").getBoundingClientRect().top+scrollY-180),behavior:"instant"})')
                    page.screenshot(path=str(ROOT/f'test-results/recording-context/{key}-{width}.png'))
            context.close()
            print(f'PASS: {len(selected)} recordings: {width}px/{theme}, playback, captions, seeking, keyboard and paused restart',flush=True)
        browser.close()
finally:
    server.terminate()
    server.wait(timeout=10)
