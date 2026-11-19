# Copyright © 2026 Christopher Snow.
"""Two independently built releases, actual worker/cache/network lifecycle.
No mocked service-worker methods or synthetic version-only SW substitutions.
"""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
import subprocess
from threading import Event, Thread
from tempfile import TemporaryDirectory
import time
from urllib.parse import unquote, urlsplit
from playwright.sync_api import TimeoutError, sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / 'test-results'
RESULTS.mkdir(exist_ok=True)
# This is a whole-course transfer plus hash verification, not an inactivity
# deadline. The 287 MB release can take over 30 s on persistent-profile CI disks.
# The application's separate progress/inactivity watchdog remains in force.
DOWNLOAD_TIMEOUT = 120_000

class CourseHandler(BaseHTTPRequestHandler):
    revision = 'one'
    roots = {}
    requests = []
    fail = None
    slow = False
    legacy = False
    corrupt = None
    pause = None
    def log_message(self, *_): pass
    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        if path.startswith('/gpu-lab/'): path = path[len('/gpu-lab'):]
        if path.endswith('/'): path += 'index.html'
        path = path.lstrip('/')
        self.requests.append(path)
        root = self.roots[self.revision]
        # A real static release directory. Both versions are retained for this
        # test deployment, just as documented for durable immutable assets.
        if path.startswith('releases/'):
            for candidate in self.roots.values():
                if (candidate / path).is_file(): root = candidate; break
        file = (root / path).resolve()
        if self.slow and path.startswith('releases/') and not path.endswith('release.json'): time.sleep(.07)
        if self.fail and path.endswith(self.fail): self.send_error(503); return
        if not file.is_relative_to(root) or not file.is_file(): self.send_error(404); return
        body = file.read_bytes()
        # Hold one real response while checking progress/cancel, within the
        # worker's 15-second per-file deadline. Release it immediately on cancel.
        pause = self.pause
        if pause and path == pause[0]: pause[1].wait(12)
        if self.corrupt and path.endswith(self.corrupt): body += b'corrupt'
        if self.legacy and path == 'sw.js':
            legacy=(ROOT/'tests/fixtures/legacy-worker.js').read_text()
            files=json.loads((root/'release.json').read_text())['files']
            body=legacy.replace('__VERSION__',json.dumps('legacy-complete')).replace('__FILES__',json.dumps([f['path'] for f in files])).encode()
        types = {'.mp4':'video/mp4', '.vtt':'text/vtt', '.jpg':'image/jpeg', '.pdf':'application/pdf', '.woff2':'font/woff2', '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.webmanifest':'application/manifest+json', '.svg':'image/svg+xml', '.png':'image/png', '.cu':'text/plain', '.py':'text/plain'}
        types['.wasm'] = 'application/wasm'
        self.send_response(200); self.send_header('Content-Type', types.get(file.suffix,'application/octet-stream'))
        self.send_header('Cache-Control','no-store'); self.send_header('Content-Length',str(len(body))); self.end_headers()
        try: self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError): pass

def foreground(context):
    # This suite verifies the unsupported-browser foreground path. Playwright's
    # minimal headless shell advertises Background Fetch but never transfers its
    # jobs. offline_background.py uses full Chromium for real native downloads,
    # including the complete production course.
    context.add_init_script("if(typeof ServiceWorkerRegistration!=='undefined')Object.defineProperty(ServiceWorkerRegistration.prototype,'backgroundFetch',{get:()=>undefined})")
    return context

def panel(page):
    # Release markup can appear before the restarted page has attached its controls.
    page.wait_for_load_state('load')
    if not page.locator('#app-status-dialog').is_visible(): page.locator('#app-status-open').click()

def check(page):
    panel(page); page.locator('#check-update').click()

def ready(page):
    expect(page.locator('#offline-status')).to_have_text('Available offline', timeout=DOWNLOAD_TIMEOUT)

def update_ready(page):
    started = time.monotonic()
    try:
        expect(page.locator('#version-status')).to_have_text('Update ready', timeout=DOWNLOAD_TIMEOUT)
        expect(page.locator('#app-status-error')).to_be_empty()
    except AssertionError:
        print('Update diagnostics:', {
            'elapsed': time.monotonic() - started,
            'error': page.locator('#app-status-error').inner_text(),
            'progress': page.locator('#progress-text').inner_text(),
            'storage': page.evaluate('navigator.storage.estimate()'),
            'recentRequests': CourseHandler.requests[-8:],
        }, flush=True)
        raise
    print(f'Update verified in {time.monotonic() - started:.2f}s', flush=True)

def built(temp, name):
    source = temp / name; source.mkdir()
    for path in ['scripts','src','content','assets','docker','examples','index.html','manifest.webmanifest']:
        item = ROOT / path
        if item.is_dir(): shutil.copytree(item, source / path)
        else: shutil.copy2(item, source / path)
    # Reuse the build cache for both releases; each build checks the pinned hashes.
    compiler = ROOT / 'vendor/v2-compiler'
    if compiler.is_dir(): shutil.copytree(compiler, source / 'vendor/v2-compiler')
    p = source / 'index.html'; p.write_text(p.read_text().replace('<html ', f'<html data-test-release="{name}" ',1))
    subprocess.run(['node','scripts/build.mjs'],cwd=source,check=True,stdout=subprocess.DEVNULL)
    return source / 'dist'

with TemporaryDirectory(prefix='gpu-status-releases-') as tmp:
    temp = Path(tmp)
    CourseHandler.roots = {name: built(temp, name) for name in ['one','two']}
    releases = {name: json.loads((root/'release.json').read_text()) for name,root in CourseHandler.roots.items()}
    assert releases['one']['id'] != releases['two']['id']
    server = ThreadingHTTPServer(('127.0.0.1',0),CourseHandler)
    Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as p:
            options = {'headless':True}
            if os.environ.get('CHROMIUM_PATH'): options['executable_path'] = os.environ['CHROMIUM_PATH']
            browser = p.chromium.launch(**options)
            # A V2 Update is also the offline download, including the real compiler.
            CourseHandler.revision='one'
            url=f'http://127.0.0.1:{server.server_port}/gpu-lab/'
            ctx=foreground(browser.new_context());tab=ctx.new_page();tab.goto(url+'v2/first-kernel.html');panel(tab)
            expect(tab.locator('#offline-status')).to_have_text('Not saved for offline use')
            expect(tab.locator('#save-offline')).to_be_visible()
            CourseHandler.revision='two';check(tab);expect(tab.locator('#version-status')).to_have_text('Update available')
            tab.locator('#download-update').click();update_ready(tab)
            expect(tab.locator('#offline-status')).to_have_text('Available after restarting update')
            expect(tab.locator('#save-offline')).to_be_hidden()
            expect(tab.locator('#offline-size')).to_be_hidden()
            tab.locator('#later-update').click();tab.reload()
            expect(tab.locator('meta[name="gpu-release"]')).to_have_attribute('content',releases['one']['id'])
            tab.close();tab=ctx.new_page();tab.goto(url+'v2/first-kernel.html')
            expect(tab.locator('meta[name="gpu-release"]')).to_have_attribute('content',releases['one']['id'])
            hello=tab.frame_locator('[data-kernel-workbench="hello"]')
            editor=hello.get_by_role('textbox',name='CUDA source')
            draft=editor.input_value().replace('42.0f','7.0f');editor.fill(draft)
            reason=hello.locator('#run').evaluate("button=>{button.click();const detail={reason:''};dispatchEvent(new CustomEvent('gpu-lab:before-restart',{detail}));return detail.reason;}")
            assert 'CUDA' in reason,reason
            expect(hello.locator('#status')).to_have_text('Ran main() and the kernel in GPGPU-Sim.',timeout=90000)
            expect(hello.locator('#program-output')).to_contain_text('7.0')
            panel(tab);expect(tab.locator('#version-status')).to_have_text('Update ready')
            ctx.set_offline(True);tab.locator('#restart-update').click()
            expect(tab.locator('meta[name="gpu-release"]')).to_have_attribute('content',releases['two']['id'],timeout=20000)
            panel(tab);ready(tab)
            expect(tab.locator('#save-offline')).to_be_hidden()
            expect(tab.locator('#offline-size')).to_be_hidden()
            tab.locator('#app-status-close').click()
            hello=tab.frame_locator('[data-kernel-workbench="hello"]')
            expect(hello.get_by_role('textbox',name='CUDA source')).to_have_value(draft)
            expect(hello.locator('#program-output')).to_contain_text('7.0')
            expect(hello.locator('#status')).to_have_text('Ran main() and the kernel in GPGPU-Sim.')
            expect(hello.locator('#ptx')).to_contain_text('.entry')
            expect(hello.locator('#program-operations pre')).to_contain_text('cudaMalloc')
            urls=hello.locator('html').evaluate('()=>lab.assets.compiler.flatMap(a=>a.parts)')
            assert len(urls)>3 and all(url+'releases/'+releases['two']['id']+'/assets/v2-compiler/' in asset for asset in urls),urls
            hello.locator('#run').click()
            expect(hello.locator('#status')).to_have_text('Ran main() and the kernel in GPGPU-Sim.',timeout=90000)
            expect(hello.locator('#program-output')).to_contain_text('7.0')
            tab.goto(url+'v2/more-threads-than-elements.html')
            bounds=tab.frame_locator('[data-kernel-workbench="bounds"]');bounds.locator('#run').click()
            expect(bounds.locator('#status')).to_have_text('Ran main() and the kernel in GPGPU-Sim.',timeout=90000)
            expect(bounds.locator('#program-output')).to_contain_text('Output: [2, 4, 6, 8, 10]')
            tab.goto(url+'v2/reduction.html')
            reduction=tab.frame_locator('[data-kernel-workbench="reduction"]')
            reduction.locator('#run').click()
            expect(reduction.locator('#status')).to_have_text('Ran main() and the kernel in GPGPU-Sim.',timeout=90000)
            expect(reduction.locator('#program-output')).to_contain_text('Sum: 10.0')
            source=reduction.get_by_role('textbox',name='CUDA source')
            source.fill(source.input_value().replace('threads = 4','threads = 8'));source.press('Control+Enter')
            expect(reduction.locator('#status')).to_have_text('Ran main() and the kernel in GPGPU-Sim.',timeout=90000)
            expect(reduction.locator('#program-output')).to_contain_text('Sum: 36.0')
            # Every new V2 recap asset is included in the verified offline release.
            media = json.loads((ROOT/'content/v2-media.json').read_text())
            for slug in media:
                for name in ['recap.mp4','poster.jpg','captions.vtt']:
                    path = f'assets/media/v2/{slug}/{name}'
                    expected = next(item for item in releases['two']['files'] if item['path'] == path)
                    actual = tab.evaluate("""async path=>{
                        const response=await fetch(path);
                        if(!response.ok)throw new Error('Missing offline recap');
                        const body=await response.arrayBuffer();
                        const hash=await crypto.subtle.digest('SHA-256',body);
                        return {bytes:body.byteLength,sha256:[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('')};
                    }""", url+'releases/'+releases['two']['id']+'/'+path)
                    assert actual['bytes'] == expected['bytes'] and actual['sha256'] == expected['sha256'],path
            tab.locator('.sm-recording > summary').click()
            video=tab.locator('video')
            video.evaluate('(v)=>{v.muted=true; v.load();}')
            expect(video).to_have_js_property('readyState',4,timeout=20000)
            video.evaluate('(v)=>{v.currentTime=5; return v.play();}')
            expect(video).to_have_js_property('paused',False)
            video.evaluate('(v)=>v.pause()')
            # Older complete updates without their saved flag are recognised offline.
            tab.evaluate('''async base => {
              const cache = await caches.open(`gpu-lab:${base}:status-v1`);
              const key = new URL('__app_status_state__', base);
              const state = await (await cache.match(key)).json();
              state.saved = false;
              await cache.put(key, new Response(JSON.stringify(state)));
            }''',url)
            tab.close();tab=ctx.new_page();tab.goto(url+'v2/first-kernel.html')
            panel(tab);ready(tab);expect(tab.locator('#save-offline')).to_be_hidden()
            tab.goto(url+'lessons/hello.html');expect(tab.locator('#hello-bridge-complete-2')).to_be_visible()
            ctx.close()
            print('PASS V2 update includes offline compiler: deferred refresh/reopen, offline restart, restored source/results/PTX/CUDA trace, real edited/array/architecture compilation, no second save, older complete copies recognised offline')
            for prefix,width,theme in [('/gpu-lab/',390,'dark'),('/',1440,'light')]:
                CourseHandler.revision='one'; CourseHandler.fail=None; CourseHandler.slow=False; CourseHandler.requests=[]
                url=f'http://127.0.0.1:{server.server_port}{prefix}'
                context=foreground(browser.new_context(viewport={'width':width,'height':900},color_scheme=theme,has_touch=width<500,reduced_motion='reduce'))
                errors=[]; context.on('page',lambda page:page.on('pageerror',lambda error:errors.append(str(error))))
                page=context.new_page(); page.goto(url+'lessons/hello.html?exercise=1#idea-2'); panel(page)
                expect(page.locator('#version-status')).to_have_text('Up to date')
                page.wait_for_function('navigator.serviceWorker.controller !== null')
                expect(page.locator('#offline-status')).to_have_text('Not saved for offline use')
                expect(page.locator('#offline-size')).to_contain_text(f"{releases['one']['bytes']/1000000:.1f} MB")
                # Installation/checking/opening must not fetch other labs or CUDA assets.
                assert not any(x.startswith('releases/') and x.endswith('examples/gather.cu') for x in CourseHandler.requests)
                assert not any(x.endswith('.html') and not x.endswith('lessons/hello.html') for x in CourseHandler.requests)
                check(page); expect(page.locator('#version-status')).to_have_text('Up to date')
                assert not any(x.endswith('examples/gather.cu') for x in CourseHandler.requests)
                page.screenshot(path=str(RESULTS/f'status-{width}-{theme}-online.png'))
                page.evaluate("caches.open('sibling-app:keep'); localStorage.setItem('user-content','keep')")
                # Interrupted first download resumes verified earlier files.
                CourseHandler.slow=True
                page.locator('#save-offline').click()
                expect(page.locator('#download-progress')).to_be_visible()
                expect(page.locator('#offline-download-feedback #download-progress')).to_be_visible()
                assert page.locator('#download-progress').evaluate('el => el.closest("section").getAttribute("aria-labelledby")') == 'offline-title'
                page.wait_for_function('document.getElementById("asset-progress").value > 0')
                page.locator('#cancel-download').click()
                expect(page.locator('#save-offline')).to_have_text('Resume download')
                expect(page.locator('#offline-status')).to_have_text('Offline download incomplete')
                CourseHandler.slow=False
                before=CourseHandler.requests.count(f"releases/{releases['one']['id']}/assets/apple-touch-icon.png")
                page.locator('#save-offline').click(); ready(page)
                assert before == CourseHandler.requests.count(f"releases/{releases['one']['id']}/assets/apple-touch-icon.png")
                page.screenshot(path=str(RESULTS/f'status-{width}-{theme}-saved.png'))
                page.keyboard.press('Escape')
                # Fresh offline tabs visit every saved HTML and required asset.
                context.set_offline(True)
                for file in releases['one']['files']:
                    if file['path'].endswith('.html'):
                        tab=context.new_page(); response=tab.goto(url+file['path']); assert response.ok and response.from_service_worker
                        assert tab.locator('meta[name="gpu-release"]').get_attribute('content')==releases['one']['id']
                        if file['path']=='lessons/hello.html':
                            tab.evaluate('document.fonts.ready')
                            assert tab.evaluate("[...document.fonts].some(f=>f.family==='IBM Plex Sans'&&f.status==='loaded')")
                            assert tab.evaluate("[...document.fonts].some(f=>f.family==='IBM Plex Mono'&&f.status==='loaded')")
                        tab.close()
                assets=page.evaluate('''async files => {for (const f of files) { const r=await fetch(new URL(f.path, new URL(document.querySelector('meta[name="gpu-base"]').content,location.href))); if(!r.ok || (await r.arrayBuffer()).byteLength!==f.bytes) return f.path;} return null;}''',releases['one']['files'])
                assert assets is None, assets
                expect(page.locator('#hello-map-0 .hello-result')).to_have_text(['?']*5)
                page.locator('#lesson-complete').check()
                page.locator('#hello-run-0').click()
                page.locator('#hello-map-0 button[data-thread="2"]').click()
                expect(page.locator('#hello-output-0')).to_have_text('Output: [2.0, 4.0, 6.0, 8.0, 10.0]')
                page.locator('#hello-factor-0').fill('3')
                page.locator('#hello-position-guess').select_option('0:4')
                page.locator('#hello-values-guess').select_option('same')
                page.locator('#hello-launch-guess').select_option('1')
                page.locator('#hello-launch-run').click()
                page.locator('#hello-bounds-guess').select_option('5');page.locator('#hello-bounds-check').click()
                page.locator('#hello-coverage-guess').select_option('missing')
                page.locator('#hello-repair-blocks').select_option('2')
                page.locator('#hello-skip-guess').select_option('9');page.locator('#hello-transfer-run').click()
                second=context.new_page(); second.goto(url+'lessons/memory.html?keep=1#simulator')
                second.locator('#stride').select_option('8'); second.locator('#show-result').click()
                second.locator('#lanes button').nth(5).click()
                kernel=context.new_page(); kernel.goto(url+'lessons/kernel.html')
                kernel.locator('#kernel-index').select_option('global');kernel.locator('#run-model').click()
                kernel.get_by_role('button',name='Inspect 35',exact=True).click();kernel.locator('#trace-end').click()
                trace=kernel.locator('#kernel-event').inner_text()
                lesson=context.new_page();lesson.goto(url+'lessons/scheduling.html')
                lesson.locator('#scheduling-wait-latency').select_option('3')
                lesson.locator('#scheduling-wait [data-run]').click();lesson.locator('#scheduling-wait [data-next]').click()
                lesson.locator('#scheduling-ready-warps').select_option('4');lesson.locator('#scheduling-ready [data-run]').click()
                lesson_trace=lesson.locator('#scheduling-wait [data-visual-output]').inner_text()
                ready_trace=lesson.locator('#scheduling-ready [data-visual-output]').inner_text()
                final=context.new_page();final.goto(url+'lessons/putting-it-together.html')
                final.locator('#capstone-choice-tile').select_option('4');final.locator('#capstone-choice [data-run]').click()
                final_result=final.locator('#capstone-choice [data-visual-output]').inner_text()
                devices=context.new_page();devices.goto(url+'lessons/devices.html')
                devices.locator('#device-count-0').select_option('8');devices.locator('#device-run-0').click()
                devices.locator('#device-factor-1').fill('3');devices.locator('#device-run-1').click()
                reading=context.new_page();reading.goto(url+'lessons/reading.html')
                reading.locator('#reading-index-column').select_option('1');reading.locator('#reading-run-column').click()
                layout=context.new_page();layout.goto(url+'lessons/layout.html')
                layout.locator('#reading-index-packed').select_option('2');layout.locator('#reading-run-packed').click()
                requests=context.new_page();requests.goto(url+'lessons/requests.html')
                requests.locator('#reading-pattern-sectors').select_option('column');requests.locator('#reading-run-sectors').click()
                recordings=[]
                for route,recording_id,folder in [('inside-sm','sm','inside-sm'),('reduction-video','reduction','reduction'),('matmul-video','matmul','matmul'),('devices-video','devices','devices'),('reading-video','reading','reading'),('layout-video','layout','layout'),('requests-video','requests','requests'),('scheduling-video','scheduling','scheduling'),('divergence-video','divergence','divergence'),('tensor-cores-video','tensor-cores','tensor-cores'),('attention-video','attention','attention'),('inference-video','inference','inference'),('hello-video','hello','hello'),('launch-from-input-video','launch-from-input','launch-from-input'),('putting-it-together-video','putting-it-together','putting-it-together')]+[(r['slug']+'-video',r['slug'],r['slug']) for r in json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {parallelRecordings} from './src/parallel-recordings.mjs';console.log(JSON.stringify(parallelRecordings))"],cwd=ROOT,text=True))]:
                    tab=context.new_page();tab.goto(url+'lessons/'+route+'.html')
                    video=tab.locator('#'+recording_id+'-video')
                    video.evaluate('v=>v.load()')
                    tab.wait_for_function('id=>document.getElementById(id).readyState>=1',arg=recording_id+'-video')
                    video.evaluate('v=>{v.currentTime=45;v.playbackRate=1.25}')
                    tab.locator('#'+recording_id+'-transcript summary').click()
                    recordings.append((tab,recording_id,folder))
                lesson.locator('#scheduling-sm-explore').click()
                for _ in range(4):lesson.locator('#sm-next').click()
                concept_map=context.new_page();concept_map.goto(url+'lessons/meet-gpu.html?chapter=matmul')
                for disclosure in ['gpu','sm-0','block-a','a-warp-1','a-w1-lane-7']:
                    concept_map.locator('#'+disclosure+' > summary').click()
                page.locator('.gpu-map-link').click()
                embedded=page.frame_locator('#gpu-map-frame')
                expect(embedded.locator('.map-tools')).to_be_visible()
                for disclosure in ['gpu','sm-0','block-a','a-warp-1','a-w1-lane-7']:
                    embedded.locator('#'+disclosure+' > summary').click()
                expect(embedded.locator('#a-w1-lane-7')).to_have_attribute('open','')
                context.set_offline(False);CourseHandler.revision='two';check(page)
                expect(page.locator('#version-status')).to_have_text('Update available')
                expect(page.locator('#app-status-summary')).to_contain_text('Update available')
                # Update progress and cancellation belong next to Update, rather
                # than below the separate offline-access explanation.
                CourseHandler.slow=True
                CourseHandler.pause=(f"releases/{releases['two']['id']}/{releases['two']['files'][0]['path']}", Event())
                page.locator('#download-update').click()
                progress=page.locator('#download-progress')
                expect(page.locator('#update-download-feedback #download-progress')).to_be_visible()
                # Read both rectangles in one task; separate browser calls can
                # straddle a progress render or a completed download.
                geometry=page.wait_for_function('''() => {
                    const progress=document.getElementById('download-progress');
                    if(progress.hidden || !progress.getClientRects().length) return false;
                    const box=progress.getBoundingClientRect();
                    const button=document.getElementById('version-status').getBoundingClientRect();
                    return {section:progress.closest('section').getAttribute('aria-labelledby'),gap:box.top-button.bottom};
                }''',polling=50).json_value()
                assert geometry['section']=='version-title',geometry
                assert 0<=geometry['gap']<=40,geometry
                page.screenshot(path=str(RESULTS/f'status-{width}-{theme}-updating.png'))
                page.locator('#cancel-download').focus();page.keyboard.press('Enter')
                CourseHandler.pause[1].set();CourseHandler.pause=None
                expect(progress).to_be_hidden()
                # Cancellation refreshes the verified cache status before render.
                expect(page.locator('#version-status')).to_have_text('Update download incomplete',timeout=30000)
                ready(page)
                CourseHandler.slow=False
                # Real browser quota failure cannot overwrite a complete release.
                cdp=context.new_cdp_session(page)
                cdp.send('Storage.overrideQuotaForOrigin', {'origin':urlsplit(url).scheme+'://'+urlsplit(url).netloc,'quotaSize':1})
                page.locator('#download-update').click()
                expect(page.locator('#app-status-error')).not_to_be_empty(timeout=30000)
                ready(page);expect(page.locator('#restart-update')).to_be_hidden()
                cdp.send('Storage.overrideQuotaForOrigin', {'origin':urlsplit(url).scheme+'://'+urlsplit(url).netloc})
                cdp.detach()
                # Failed replacement keeps the complete old release available.
                # A valid candidate file may already have arrived before Cancel.
                # Remove only its replacement copy so the injected 503 exercises
                # a missing-file fetch rather than correct cache reuse.
                page.evaluate('''async ({base,id})=>{
                    const cache=await caches.open(`gpu-lab:${base}:release-${id}`);
                    await cache.delete(new URL('examples/gather.cu',base));
                }''',{'base':url,'id':releases['two']['id']})
                CourseHandler.fail='examples/gather.cu';page.locator('#download-update').click()
                # gather.cu follows the recording/compiler assets. A fresh
                # candidate can transfer the complete asset set before this 503.
                try:expect(page.locator('#app-status-error')).not_to_be_empty(timeout=DOWNLOAD_TIMEOUT)
                except AssertionError:
                    print('Failed replacement diagnostics:',{
                        'version':page.locator('#version-status').inner_text(),
                        'progress':page.locator('#progress-text').inner_text(),
                        'recentRequests':CourseHandler.requests[-10:],
                    },flush=True)
                    raise
                ready(page);expect(page.locator('#restart-update')).to_be_hidden()
                CourseHandler.fail=None;page.locator('#download-update').click()
                update_ready(page)
                page.locator('#later-update').click();expect(page.locator('#app-status-summary')).to_contain_text('Update ready')
                assert second.locator('meta[name="gpu-release"]').get_attribute('content')==releases['one']['id']
                # Input composition in ANY window blocks everyone without resetting state.
                second.evaluate("dispatchEvent(new CompositionEvent('compositionstart'))")
                panel(page);page.locator('#restart-update').click()
                # Restart verifies the full release before asking every window.
                # Allow the existing 15-second RPC budget on slower CI disks.
                expect(page.locator('#app-status-error')).to_contain_text('Finish the current input',timeout=20000)
                second.evaluate("dispatchEvent(new CompositionEvent('compositionend'))")
                expect(second.locator('#sector-count')).to_have_text('32')
                # A busy/unsaved participant or denied snapshot storage blocks all tabs.
                second.evaluate("window.updateGuard=e=>{e.detail.reason='Finish the unsaved operation first.'};addEventListener('gpu-lab:before-restart',updateGuard)")
                page.locator('#restart-update').click();expect(page.locator('#app-status-error')).to_contain_text('unsaved operation',timeout=20000)
                second.evaluate("() => {removeEventListener('gpu-lab:before-restart',updateGuard);window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Storage denied','SecurityError')};}")
                page.locator('#restart-update').click();expect(page.locator('#app-status-error')).to_contain_text('Storage denied',timeout=20000)
                second.evaluate('() => {Storage.prototype.setItem=window.originalSet;}')
                # A tab with its JS disabled never receives a forced navigation.
                blocked=context.new_page();blocked.goto(url+'index.html');blocked.wait_for_load_state('networkidle')
                blocked_cdp=context.new_cdp_session(blocked);blocked_cdp.send('Emulation.setScriptExecutionDisabled',{'value':True})
                page.locator('#restart-update').click();expect(page.locator('#app-status-error')).to_contain_text('did not respond',timeout=20000)
                blocked_cdp.detach();blocked.close()
                # Activation works offline and restores each tab's independent work/route.
                context.set_offline(True);page.locator('#restart-update').click()
                for tab in [page,second,kernel,lesson,devices,reading,layout,requests,concept_map,final]:
                    try:
                        expect(tab.locator('meta[name="gpu-release"]')).to_have_attribute('content',releases['two']['id'],timeout=20000)
                    except AssertionError:
                        print('Restart diagnostics:', {'route':tab.url,'error':page.locator('#app-status-error').inner_text(),'status':page.locator('#app-status-summary').inner_text()},flush=True)
                        raise
                    assert tab.evaluate('''id=>[...document.scripts].filter(s=>s.type==='module').every(s=>s.src.includes('/releases/'+id+'/'))''',releases['two']['id'])
                expect(concept_map.locator('#a-w1-lane-7')).to_have_attribute('open','')
                expect(concept_map.locator('#a-w1-lane-7')).to_contain_text('thread 39')
                expect(concept_map.locator('#map-chapter, .map-match, .map-highlight')).to_have_count(0)
                expect(concept_map.locator('#hardware-panel')).to_be_visible()
                expect(concept_map.locator('#a-warp-1')).to_have_attribute('open','')
                try:
                    # A release marker arrives with HTML. Wait for the reading
                    # window to run its load-time restore after the multi-tab restart.
                    page.wait_for_load_state('load', timeout=20000)
                    expect(page.locator('#gpu-map-panel')).to_be_visible(timeout=20000)
                    # The restored iframe still has to load and apply its state.
                    expect(page.locator('#gpu-map-panel .map-loading')).to_be_hidden(timeout=20000)
                    expect(page.frame_locator('#gpu-map-frame').locator('#a-w1-lane-7')).to_have_attribute('open','',timeout=20000)
                except (AssertionError, TimeoutError):
                    print('Embedded map restore diagnostics:',page.evaluate("""() => {
                      const frame=document.querySelector('#gpu-map-frame'),doc=frame?.contentDocument;
                      return {url:location.href, width:innerWidth, ready:document.readyState,
                        frameURL:frame?.src, frameReady:doc?.readyState,
                        open:doc ? [...doc.querySelectorAll('.map-node[open]')].map(n=>n.id) : [],
                        notice:document.querySelector('.restore-notice')?.textContent,
                        frameNotice:doc?.querySelector('.restore-notice')?.textContent};
                    }"""), 'Page errors:', errors, flush=True)
                    raise
                page.locator('.gpu-map-link').click()
                expect(page.locator('#gpu-map-panel')).to_be_hidden()
                expect(page).to_have_url(url+'lessons/hello.html?exercise=1#idea-2')
                expect(page.locator('#lesson-complete')).to_be_checked()
                expect(page.locator('.sidebar a[data-completion-lesson=hello]')).to_have_attribute('data-done','true')
                expect(page.locator('#hello-factor-0')).to_have_value('3')
                expect(page.locator('#hello-map-0 .hello-result')).to_have_text(['?']*5)
                expect(page.locator('#hello-output-0')).not_to_contain_text('Output:')
                expect(reading.locator('#reading-map-row .book-reads li>span:last-child strong')).to_have_text(['?']*5)
                expect(layout.locator('#reading-map-row .book-storage')).to_be_hidden()
                expect(page.locator('#hello-output-0')).to_contain_text('Run')
                expect(page.locator('#hello-map-0 button[data-thread="2"]')).to_have_attribute('aria-pressed','true')
                expect(page.locator('#hello-map-3 [data-state=invalid]')).to_have_count(1)
                expect(page.locator('#hello-transfer-diagram')).to_contain_text('Unwritten')
                expect(page.locator('#hello-launch-answer')).to_be_visible()
                expect(page.locator('#hello-launch-size')).to_have_value('8')
                expect(page.locator('#hello-launch-feedback')).to_contain_text('All three predictions match')
                expect(page.locator('#hello-launch-answer')).to_contain_text('Index = 0 × 8 + 4 = 4')
                expect(second).to_have_url(url+'lessons/memory.html?keep=1#simulator')
                expect(second.locator('#stride')).to_have_value('8');expect(second.locator('#sector-count')).to_have_text('32')
                expect(second.locator('#lanes button').nth(5)).to_have_attribute('aria-pressed','true')
                expect(lesson.locator('#sm-position')).to_have_text('Event 4 of 8')
                expect(lesson.locator('#sm-explorer [data-sm-unit=arithmetic]')).to_contain_text('1.0 × 2 → 2.0')
                for tab,recording_id,folder in recordings:
                    expect(tab.locator('meta[name="gpu-release"]')).to_have_attribute('content',releases['two']['id'],timeout=20000)
                    expect(tab.locator('#'+recording_id+'-transcript')).to_have_attribute('open','')
                    tab.wait_for_function('id=>Math.abs(document.getElementById(id).currentTime-45)<.5',arg=recording_id+'-video')
                    video=tab.locator('#'+recording_id+'-video')
                    assert video.evaluate('v=>v.paused&&v.playbackRate===1.25')
                    media=video.locator('source').get_attribute('src')
                    partial=tab.evaluate('''async media=>{const r=await fetch(media,{headers:{Range:'bytes=100-199'}});return {status:r.status,range:r.headers.get('Content-Range'),bytes:(await r.arrayBuffer()).byteLength}}''',media)
                    size=(ROOT/'assets/media'/folder/(folder+'.mp4')).stat().st_size
                    assert partial=={'status':206,'range':f'bytes 100-199/{size}','bytes':100},partial
                    video.evaluate('v=>{v.currentTime=120;v.muted=true;v.play()}')
                    tab.wait_for_function('id=>document.getElementById(id).currentTime>120.1',arg=recording_id+'-video')
                    video.evaluate('v=>v.pause()')
                expect(kernel.locator('#kernel-event')).to_have_text(trace)
                expect(lesson.locator('#scheduling-wait [data-visual-output]')).to_have_text(lesson_trace,use_inner_text=True)
                expect(lesson.locator('#scheduling-ready [data-visual-output]')).to_have_text(ready_trace,use_inner_text=True)
                expect(lesson.locator('#scheduling-wait-latency')).to_have_value('3')
                expect(lesson.locator('#scheduling-ready-warps')).to_have_value('4')
                expect(final.locator('#capstone-choice-tile')).to_have_value('4')
                expect(final.locator('#capstone-choice [data-visual-output]')).to_have_text(final_result,use_inner_text=True)
                expect(final.locator('#capstone-baseline [data-results]')).to_be_hidden()
                expect(devices.locator('#device-feedback-0')).to_contain_text('32 bytes copied')
                expect(devices.locator('#device-feedback-1')).to_contain_text('[3.0, 6.0, 9.0, 12.0, 15.0]')
                expect(reading.locator('#reading-feedback-column')).to_contain_text('[4.0, 14.0, 24.0, 34.0, 44.0]')
                expect(requests.locator('#reading-feedback-sectors')).to_contain_text('3 sectors for 20 useful bytes')
                expect(layout.locator('#reading-feedback-packed')).to_contain_text('[6.0, 16.0, 26.0, 36.0, 46.0]')
                panel(page);ready(page)
                # Eviction is detected on focus; repair retains/reuses remaining assets.
                cache=f"gpu-lab:{url}:release-{releases['two']['id']}"
                assert page.evaluate('''async ({cache,url}) => {const removed=await (await caches.open(cache)).delete(url+'examples/gather.cu');dispatchEvent(new Event('focus'));return removed;}''',{'cache':cache,'url':url}), 'Eviction must remove an existing file from the selected release'
                # Focus verifies the whole release, including its recordings. Give
                # this asynchronous scan the same budget as the ready() check.
                try:expect(page.locator('#offline-status')).to_have_text('Offline download incomplete',timeout=30000)
                except AssertionError:
                    print('Eviction check diagnostics:',page.locator('#app-status-dialog').inner_text(),flush=True)
                    raise
                context.set_offline(False);CourseHandler.corrupt='examples/gather.cu'
                assert not page.evaluate('''async url => (await fetch(url+'examples/gather.cu')).ok''',url)
                CourseHandler.corrupt=None;page.locator('#save-offline').click();ready(page)
                page.locator('#app-status-details > summary').click();page.locator('#remove-offline').click();page.locator('#cancel-remove').click();ready(page)
                page.locator('#remove-offline').click();page.locator('#confirm-remove').click()
                # REMOVE waits for any in-flight full-book cache scan. Its RPC
                # permits 15 seconds; allow that response plus UI scheduling.
                expect(page.locator('#offline-status')).to_have_text('Not saved for offline use',timeout=20000)
                assert page.evaluate('caches.keys()') == ['sibling-app:keep']
                assert page.evaluate("localStorage.getItem('user-content')") == 'keep'
                expect(page.locator('#lesson-complete')).to_be_checked()
                assert page.evaluate("localStorage.getItem('gpu-lab:v1:manual-completion:hello')") == 'true'
                expect(page.locator('#hello-factor-0')).to_have_value('3')
                expect(page.locator('#hello-map-0 .hello-result')).to_have_text(['?']*5)
                expect(page.locator('#hello-output-0')).not_to_contain_text('Output:')
                expect(reading.locator('#reading-map-row .book-reads li>span:last-child strong')).to_have_text(['?']*5)
                expect(layout.locator('#reading-map-row .book-storage')).to_be_hidden()
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                assert not errors,errors
                context.close();CourseHandler.requests=[]
                print(f'PASS {prefix} {width}px {theme}: opt-in, real bytes, cancel/resume, all offline assets/pages, failed replacement, deployed update, Later, composition guard, three-tab restart and restored experiments, eviction/repair, scoped removal')
            # A persistent installed profile: closing every window does NOT apply
            # a prepared release. Reopen completely offline, then explicitly restart.
            CourseHandler.revision='one';CourseHandler.requests=[]
            url=f'http://127.0.0.1:{server.server_port}/gpu-lab/'
            profile=temp/'profile'
            ctx=foreground(p.chromium.launch_persistent_context(str(profile),**options))
            tab=ctx.pages[0];tab.goto(url+'v1.html');panel(tab);tab.locator('#save-offline').click();ready(tab)
            manifest=ctx.new_cdp_session(tab).send('Page.getAppManifest')
            assert not manifest['errors'],manifest
            CourseHandler.revision='two';check(tab);expect(tab.locator('#version-status')).to_have_text('Update available')
            tab.locator('#download-update').click();update_ready(tab)
            tab.locator('#later-update').click();ctx.close()
            ctx=foreground(p.chromium.launch_persistent_context(str(profile),**options));ctx.set_offline(True)
            tab=ctx.pages[0];tab.goto(url+'v1.html')
            expect(tab.locator('html')).to_have_attribute('data-test-release','one')
            panel(tab);ready(tab);expect(tab.locator('#version-status')).to_have_text('Update ready')
            started=time.monotonic();tab.locator('#restart-update').click()
            try:
                # A cold restart verifies both retained and pending releases.
                # The application allows 15 s for this RPC; a 5 s assertion
                # can expire while the media hashes are still being checked.
                expect(tab.locator('html')).to_have_attribute('data-test-release','two',timeout=20000)
            except AssertionError:
                print('Cold restart diagnostics:', {
                    'elapsed':time.monotonic()-started,
                    'error':tab.locator('#app-status-error').inner_text(),
                    'status':tab.locator('#version-status').inner_text(),
                    'storage':tab.evaluate('navigator.storage.estimate()'),
                },flush=True)
                raise
            print(f'Cold offline restart completed in {time.monotonic()-started:.2f}s',flush=True)
            ctx.close()
            print('PASS persistent profile: no activation on closing all windows; cold offline reopen, deferred badge and explicit offline restart')
            # Exercise the actual former worker and its automatically saved cache.
            CourseHandler.revision='one';CourseHandler.legacy=True
            legacy_profile=temp/'legacy-profile'
            ctx=foreground(p.chromium.launch_persistent_context(str(legacy_profile),**options))
            tab=ctx.pages[0];tab.goto(url+'v1.html')
            tab.wait_for_function('navigator.serviceWorker.controller !== null')
            legacy_key=f'gpu-lab:{url}:legacy-complete'
            assert legacy_key in tab.evaluate('caches.keys()')
            CourseHandler.legacy=False;CourseHandler.revision='two'
            tab.evaluate('''async () => { const r=await navigator.serviceWorker.getRegistration();await r.update();}''')
            tab.wait_for_function('''async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting)''')
            ctx.close()
            ctx=foreground(p.chromium.launch_persistent_context(str(legacy_profile),**options))
            tab=ctx.pages[0];tab.goto(url+'v1.html');panel(tab)
            expect(tab.locator('html')).to_have_attribute('data-test-release','two')
            expect(tab.locator('#offline-status')).to_have_text('Offline download incomplete')
            assert legacy_key in tab.evaluate('caches.keys()')
            tab.locator('#save-offline').click();ready(tab)
            ctx.set_offline(True);tab.reload();panel(tab);ready(tab)
            ctx.close();CourseHandler.legacy=False
            print('PASS legacy migration: real former worker, retained cache/consent, explicit verified repair and offline reopen')
            browser.close()
    finally:server.shutdown()
