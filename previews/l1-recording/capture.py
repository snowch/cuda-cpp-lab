# Copyright © 2026 Christopher Snow.
"""Capture the review deck at native 4K; no published lesson or storage is changed."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import shutil
from threading import Thread

from PIL import Image, ImageOps, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'previews/l1-recording'
WORK = ROOT / 'test-results/l1-recording-review'
WORK.mkdir(exist_ok=True, parents=True)
(WORK / 'slides').mkdir(exist_ok=True)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
scenes = json.loads((SOURCE / 'scenes.json').read_text())
shutil.copyfile(SOURCE / 'scenes.json', WORK / 'scenes.json')
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'))
    page = browser.new_page(viewport={'width': 1280, 'height': 720}, device_scale_factor=3)
    page.goto(f'http://127.0.0.1:{server.server_port}/previews/l1-recording/deck.html')
    page.evaluate('document.fonts.ready')
    for scene in scenes:
        shot = page.locator('#' + scene['id'])
        # The graphic and the dedicated caption band must never overlap.
        positions = shot.evaluate('''el => {
          const visual=el.querySelector('.visual'), caption=el.querySelector('.caption').getBoundingClientRect();
          const bounds=[...visual.children].map(x=>x.getBoundingClientRect());
          const bottom=Math.max(...bounds.map(x=>x.bottom));
          const overflow=[...el.querySelectorAll('.caption, pre, h1')].some(x=>x.scrollHeight>x.clientHeight+1||x.scrollWidth>x.clientWidth+1);
          return {bottom,captionTop:caption.top,overflow};
        }''')
        assert positions['bottom'] <= positions['captionTop'], (scene['id'], positions)
        assert not positions['overflow'], (scene['id'], positions)
        shot.screenshot(path=str(WORK / 'slides' / f"s-{scene['slide']:02}.png"))
    page.pdf(path=str(WORK / 'slides/deck.pdf'), print_background=True, prefer_css_page_size=True)
    browser.close()
server.shutdown()
sheet = Image.new('RGB', (1280, 4 * 210), '#dce6e1')
draw = ImageDraw.Draw(sheet)
for i, scene in enumerate(scenes):
    source = Image.open(WORK / 'slides' / f"s-{scene['slide']:02}.png")
    assert source.size == (3840, 2160), source.size
    tile = ImageOps.contain(source, (320, 180))
    x, y = i % 4 * 320, i // 4 * 210
    sheet.paste(tile, (x, y + 22))
    draw.text((x + 8, y + 4), scene['id'] + ' ' + scene['stage'], fill='#193237')
sheet.save(WORK / 'contact-sheet.jpg')
print('Captured and checked 16 native 4K shots; graphics clear the caption band.')
