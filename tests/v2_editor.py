# Copyright © 2026 Christopher Snow.
"""Check a starter and a source edit in every lesson through Chromium."""
import os
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import socket
import subprocess
import sys
from threading import Thread
import time
from urllib.request import urlopen

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


@contextmanager
def serve():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    url = f'http://127.0.0.1:{port}/cuda-cpp-lab/'
    process = subprocess.Popen(
        ['node', 'scripts/serve.mjs', '--dist'],
        cwd=ROOT, env={**os.environ, 'PORT': str(port)}, stdout=subprocess.DEVNULL,
    )
    try:
        for _ in range(60):
            try:
                with urlopen(url, timeout=1):
                    break
            except OSError:
                time.sleep(0.1)
        else:
            raise RuntimeError('Course server did not start.')
        yield url
    finally:
        process.terminate()
        process.wait()


class CompilerHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()


@contextmanager
def serve_compiler(directory):
    if not directory:
        yield None
        return
    handler = partial(CompilerHandler, directory=directory)
    with ThreadingHTTPServer(('127.0.0.1', 0), handler) as server:
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f'http://127.0.0.1:{server.server_port}/'
        finally:
            server.shutdown()
            thread.join()

CHECKS = {
  'first-kernel': ['42.0f', '7.0f', '42.0', '7.0'],
  'one-thread-one-element': ['input[i] * 2.0f', 'input[i] * 3.0f', '[2, 4, 6, 8, 10]', '[3, 6, 9, 12, 15]'],
  'more-threads-than-elements': ['threadsPerBlock = 4', 'threadsPerBlock = 3',
    '2 blocks × 4 threads', '2 blocks × 3 threads', '#program-operations pre'],
  'from-cpu-array-to-gpu-result': ['4.0f, 5.0f', '4.0f, 5.0f, 6.0f, 7.0f, 8.0f, 9.0f',
    '[2, 4, 6, 8, 10]', '[2, 4, 6, 8, 10, 12, 14, 16, 18]'],
  'coalescing': ['stride = 1', 'stride = 32', 'Sectors touched: 4', 'Sectors touched: 32'],
  'tensor-cores': ['startingValue = 0.0f', 'startingValue = 4.0f', 'C[0,0]: 16.0', 'C[0,0]: 20.0'],
  'attention': ['keysPerTile = 2', 'keysPerTile = 4', 'Tiles: 4; weighted value:', 'Tiles: 2; weighted value:'],
  'precision': ['narrowInputs = true', 'narrowInputs = false', 'FP32 accumulation: 0', 'FP32 accumulation: 0.002'],
  'inference': ['cached = 4', 'cached = 8', 'Old cache read: 128 bytes;', 'Old cache read: 256 bytes;'],
  'pipelines': ['overlap = true', 'overlap = false', 'last output: 32.0; chunk synchronizations: 0', 'last output: 32.0; chunk synchronizations: 4'],
  'scheduling': ['warpsPerBlock = 1', 'warpsPerBlock = 2', 'last output: 128.0', 'last output: 256.0'],
  'divergence': ['alternateSigns = true', 'alternateSigns = false', 'lane 1: 2.0', 'lane 1: 4.0'],
  'reduction': ['threads = 4', 'threads = 8', 'Sum: 10.0', 'Sum: 36.0'],
  'shared-memory-banks': ['stride = 32', 'stride = 33', 'rounds: 32', 'rounds: 1'],
  'matmul': ['tile = 2', 'tile = 4', 'algorithm: 64; shared', 'algorithm: 32; shared'],
  'matmul-investigation': ['tile = 2', 'tile = 4', 'algorithm: 512; shared', 'algorithm: 256; shared'],
  'histograms': ['{0, 1, 0, 2, 1, 0, 3, 0}', '{0, 0, 0, 0, 0, 0, 0, 0}', '[4, 2, 1, 1]', '[8, 0, 0, 0]'],
  'scan': ['inclusive = true', 'inclusive = false', 'Index 5: 3; index 7: 4', 'Index 5: 2; index 7: 3'],
  'compaction': ['keepCategory = 0', 'keepCategory = 1', 'Kept token: 7', 'Kept token: 4'],
  'progress': ['readers = 2', 'readers = 4', 'Read outputs: 2 3 0 0', 'Read outputs: 2 3 4 1'],
  'token-routing': ['hot = false', 'hot = true', 'Slot 1: token 2', 'Slot 1: token 1'],
}

def lesson_context(browser, compiler_url):
    context = browser.new_context(viewport={'width': 820, 'height': 1080})
    # First-run onboarding is covered by code_runner_browser.py.
    context.add_init_script("try{localStorage.setItem('gpu-lab:code-runner-intro:3','1')}catch{}")
    if compiler_url:
        def redirect_compiler(route):
            filename = route.request.url.rsplit('/', 1)[-1]
            if filename not in {'Compiler.js', 'Compiler.wasm', 'Compiler.data'}:
                route.abort()
                return
            route.fulfill(
                status=302,
                headers={'Access-Control-Allow-Origin': '*', 'Location': compiler_url + filename},
            )
        context.route('https://llvm-explorer.dev/compiler/*', redirect_compiler)
    return context


def check(browser, url, compiler_url, selected):
    with browser.new_context() as context:
        page = context.new_page()
        page.goto(url)
        routes = page.locator('.v2-list li[data-course-kind="core"] a').evaluate_all('links => links.map(link => link.href)')
    slugs = [route.rsplit('/', 1)[-1][:-5] for route in routes]
    assert set(slugs) == set(CHECKS), 'Every listed lesson needs a browser execution check.'
    for route, slug in zip(routes, slugs):
        if selected and slug not in selected:
            continue
        context = lesson_context(browser, compiler_url)
        page = context.new_page()
        page.goto(route)
        frame = page.frame_locator('[data-kernel-workbench]')
        editor = frame.get_by_role('textbox', name='CUDA source')
        run = frame.get_by_role('button', name='Compile and run')
        console = frame.locator('#program-output')
        code = editor.input_value()
        before, after, initial, edited, *selector = CHECKS[slug]
        assert before in code, (slug, before)
        result = frame.locator(selector[0]) if selector else console
        for source, expected in [(code, initial), (code.replace(before, after, 1), edited)]:
            if source != code:
                editor.fill(source)
            run.click()
            frame.locator('#run:enabled').wait_for(timeout=95_000)
            status = frame.locator('#status').inner_text()
            assert status == 'Ran main() and the kernel in GPGPU-Sim.', (
                slug, status, frame.locator('#diagnostics').text_content())
            assert expected in result.text_content(), (slug, expected, result.text_content())
            assert '.entry' in frame.locator('#ptx').text_content(), slug
        if slug in ['coalescing', 'histograms']:
            extra = code.replace('stride = 1', 'stride = 2') if slug == 'coalescing' else code.replace('{0, 1, 0, 2, 1, 0, 3, 0}', '{0, 0, 0, 0, 0, 0, 0, 0}').replace('blockCounts = true', 'blockCounts = false')
            editor.fill(extra)
            run.click()
            frame.locator('#run:enabled').wait_for(timeout=95000)
            assert frame.locator('#status').get_attribute('data-error') == 'false'
            assert ('Sectors touched: 8' if slug == 'coalescing' else '[8, 0, 0, 0]') in console.inner_text()
        if slug in ['matmul', 'matmul-investigation']:
            width = 4 if slug == 'matmul' else 8
            tail = 5 if slug == 'matmul' else 7
            editor.fill(code.replace(f'width = {width}', f'width = {tail}').replace('tile = 2', 'tile = 4'))
            run.click()
            frame.locator('#run:enabled').wait_for(timeout=95_000)
            assert frame.locator('#status').inner_text() == 'Ran main() and the kernel in GPGPU-Sim.', frame.locator('#diagnostics').text_content()
            assert f'Checked {tail * tail} matrix values; mismatches: 0' in console.inner_text()
        if slug == 'token-routing':
            editor.fill(code.replace('positions[start + rank] = t;', 'if (t != 0) positions[start + rank] = t;'))
            run.click()
            frame.locator('#run:enabled').wait_for(timeout=95_000)
            assert frame.locator('#status').inner_text() == 'main() finished with exit code 1. Read Console for the program’s checks.'
            assert frame.locator('#status').get_attribute('data-error') == 'false'
            assert frame.locator('#status').get_attribute('data-outcome') == 'program-exit'
            assert 'Routing verification failed at slot 0' in console.inner_text()
        context.close()
        print(f'PASS {slug} starter and edit', flush=True)


if __name__ == '__main__':
    compiler = os.environ.get('CUDA_TEST_COMPILER_DIR')
    executable = os.environ.get('CHROMIUM_PATH')
    with serve() as url, serve_compiler(compiler) as compiler_url, sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=executable)
        try:
            check(browser, url, compiler_url, set(sys.argv[1:]))
        finally:
            browser.close()
