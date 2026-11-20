from v2_practical import check_v2_practical
from v2_navigation import check_v2_navigation
from v2_editor_focus import check_v2_editor_focus
from v2_clarity import check_v2_clarity
from v2_footer import check_v2_footer
from v2_context import check_v2_context
from v2_browser import check_v2
from version_check import check_version
from current_appendices import check_current_appendices
from v2_editor_ready import check_editor_ready
# Copyright © 2026 Christopher Snow.
"""Browser checks against the built course, including the GitHub Pages subpath."""
import os
import sys
from pathlib import Path
import subprocess
import time
from urllib.request import urlopen

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
PORT = 5178
URL = f"http://127.0.0.1:{PORT}/gpu-lab/"
server = subprocess.Popen(
    ["node", "scripts/serve.mjs", "--dist"], cwd=ROOT,
    env={**os.environ, "PORT": str(PORT)}, stdout=subprocess.DEVNULL,
)
try:
    for attempt in range(60):
        try:
            with urlopen(URL, timeout=1) as response:
                assert response.status == 200
            break
        except OSError:
            if server.poll() is not None:
                raise RuntimeError("Preview server stopped")
            time.sleep(0.1)
    else:
        raise RuntimeError("Preview server did not start")

    with sync_playwright() as playwright:
        options = {"headless": True}
        if os.environ.get("CHROMIUM_PATH"):
            options["executable_path"] = os.environ["CHROMIUM_PATH"]
        browser = playwright.chromium.launch(**options)
        errors = []
        check_editor_ready(browser, ROOT)
        check_v2_practical(browser, URL, ROOT)
        check_v2(browser, URL)
        check_v2_context(browser, URL, ROOT)
        check_v2_footer(browser, URL, ROOT)
        check_v2_navigation(browser, URL, ROOT)
        check_v2_editor_focus(browser, URL, ROOT)
        check_v2_clarity(browser, URL, ROOT)
        check_version(browser, URL)
        check_current_appendices(browser, URL, ROOT)
        browser.close()
        assert not errors, errors
        print('PASS: current course and retained appendices; no V1 pages are published')
finally:
    server.terminate()
    server.wait(timeout=5)
