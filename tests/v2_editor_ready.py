# Copyright © 2026 Christopher Snow.
"""A slow editor document must not accept edits its startup will replace."""
import mimetypes
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Event, Thread
from urllib.parse import urlsplit
from playwright.sync_api import expect


def check_editor_ready(browser, root):
    folder = (root / 'dist').resolve()
    release = Event()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            path = urlsplit(self.path).path.removeprefix('/gpu-lab/')
            file = (folder / (path or 'index.html')).resolve()
            if not file.is_relative_to(folder) or not file.is_file():
                self.send_error(404)
                return
            body = file.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', mimetypes.guess_type(file.name)[0] or 'application/octet-stream')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            if path == 'v2/cuda-source-workbench.html' and not release.is_set():
                # Deliver the visible textarea and controls, but hold the inline
                # starter/draft initialisation as a slow connection can do.
                split = body.index(b'<script>const lab = ')
                self.wfile.write(body[:split])
                self.wfile.flush()
                release.wait(20)
                self.wfile.write(body[split:])
            else:
                self.wfile.write(body)

    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    context = browser.new_context(viewport={'width': 390, 'height': 1000})
    try:
        url = f'http://127.0.0.1:{server.server_port}/gpu-lab/v2/cuda-source-workbench.html?embed=hello'
        page = context.new_page()
        page.goto(url, wait_until='commit')
        editor = page.locator('#source')
        expect(editor).to_be_visible()
        assert page.evaluate('document.readyState') == 'loading'
        expect(editor).not_to_be_editable()
        for name in ['run', 'reset', 'export-source']:
            expect(page.locator('#' + name)).to_be_disabled()
        expect(page.locator('#status')).to_have_text('Preparing the CUDA source editor…')
        release.set()
        page.wait_for_load_state('load')
        expect(editor).to_be_editable()
        expect(editor).to_have_value(re.compile(r'output\[0\] = 42\.0f;'))
        expect(page.locator('#run')).to_be_enabled()
        expect(page.locator('#export-source')).to_be_enabled()
        draft = editor.input_value().replace('42.0f', '7.0f', 1)
        editor.fill(draft)
        page.close()
        page = context.new_page()
        page.goto(url)
        expect(page.locator('#source')).to_be_editable()
        expect(page.locator('#source')).to_have_value(draft)
        print('PASS: delayed editor stays read-only until ready; the complete starter loads and the first edit survives closing/reopening.', flush=True)
    finally:
        release.set()
        context.close()
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
