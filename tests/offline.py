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
from app_status import manual_check
from playwright.sync_api import TimeoutError, sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / 'test-results'
RESULTS.mkdir(exist_ok=True)
# This is a whole-course transfer plus hash verification, not an inactivity
# deadline. The 400+ MB release can take over 30 s on persistent-profile CI disks.
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
    panel(page); manual_check(page)

def ready(page):
    expect(page.locator('#offline-status')).to_have_text('Downloaded and ready to use offline.', timeout=DOWNLOAD_TIMEOUT)

def update_ready(page):
    started = time.monotonic()
    try:
        expect(page.locator('#version-status')).to_have_text('Update downloaded and checked', timeout=DOWNLOAD_TIMEOUT)
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
    for path in ['scripts','src','content','assets','docker','examples','manifest.webmanifest']:
        item = ROOT / path
        if item.is_dir(): shutil.copytree(item, source / path)
        else: shutil.copy2(item, source / path)
    # Reuse the build cache for both releases; each build checks the pinned hashes.
    compiler = ROOT / 'vendor/v2-compiler'
    if compiler.is_dir(): shutil.copytree(compiler, source / 'vendor/v2-compiler')
    p = source / 'content/v2-view.mjs'; p.write_text(p.read_text().replace('<html ', f'<html data-test-release="{name}" ',1))
    subprocess.run(['node','scripts/build.mjs'],cwd=source,check=True,stdout=subprocess.DEVNULL)
    return source / 'dist'

with TemporaryDirectory(prefix='gpu-status-releases-') as tmp:
    temp = Path(tmp)
    CourseHandler.roots = {name: built(temp, name) for name in ['one','two']}
    releases = {name: json.loads((root/'release.json').read_text()) for name,root in CourseHandler.roots.items()}
    assert releases['one']['id'] != releases['two']['id']
    # Incognito quota depends on runner free space and can be smaller than two
    # complete recordings/compiler releases. Reserve a deterministic test budget;
    # the explicit one-byte override below still exercises real quota failure.
    course_quota=4*max(release['bytes'] for release in releases.values())
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
            expect(tab.locator('#offline-status')).to_have_text('Not downloaded for offline use')
            expect(tab.locator('#download-update')).to_be_visible()
            CourseHandler.revision='two';check(tab);expect(tab.locator('#version-status')).to_have_text('Update available')
            tab.locator('#download-update').click();update_ready(tab)
            expect(tab.locator('#offline-status')).to_have_text('Downloaded update is ready after restarting.')
            expect(tab.locator('#download-update')).to_be_hidden()
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
            panel(tab);expect(tab.locator('#version-status')).to_have_text('Update downloaded and checked')
            ctx.set_offline(True);tab.locator('#restart-update').click()
            expect(tab.locator('meta[name="gpu-release"]')).to_have_attribute('content',releases['two']['id'],timeout=20000)
            panel(tab);ready(tab)
            expect(tab.locator('#download-update')).to_be_hidden()
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
            panel(tab);ready(tab);expect(tab.locator('#download-update')).to_be_hidden()
            ctx.close()
            print('PASS V2 update includes offline compiler: deferred refresh/reopen, offline restart, restored source/results/PTX/CUDA trace, real edited/array/architecture compilation, no second save, older complete copies recognised offline')
            for prefix,width,theme in [('/gpu-lab/',390,'dark'),('/',1440,'light')]:
                CourseHandler.revision='one';CourseHandler.fail=None;CourseHandler.slow=False;CourseHandler.requests=[]
                url=f'http://127.0.0.1:{server.server_port}{prefix}'
                context=foreground(browser.new_context(viewport={'width':width,'height':1000},color_scheme=theme,has_touch=width<500))
                errors=[];context.on('page',lambda p:p.on('pageerror',lambda e:errors.append(str(e))))
                route=url+'v2/one-thread-one-element.html?exercise=1#v2-activity'
                page=context.new_page();page.goto(route)
                quota=context.new_cdp_session(page);budget={'origin':urlsplit(url).scheme+'://'+urlsplit(url).netloc,'quotaSize':course_quota}
                quota.send('Storage.overrideQuotaForOrigin',budget)
                panel(page);expect(page.locator('#download-update')).to_be_visible();expect(page.locator('#course-ready-icon')).to_be_hidden()
                assert not any(x.endswith('examples/first-kernel.cu') for x in CourseHandler.requests),'Opening App status must not download the course.'
                page.evaluate("caches.open('sibling-app:keep');localStorage.setItem('user-content','keep')")
                CourseHandler.slow=True;page.locator('#download-update').click()
                expect(page.locator('#download-progress')).to_be_visible()
                assert page.locator('#download-progress').evaluate('e=>e.closest("section").id')=='course-status'
                page.wait_for_function('document.getElementById("asset-progress").value>0')
                page.locator('#cancel-download').click();expect(page.locator('#download-update')).to_have_text('Update course')
                CourseHandler.slow=False
                before=CourseHandler.requests.count(f"releases/{releases['one']['id']}/assets/apple-touch-icon.png")
                page.locator('#download-update').click();ready(page);expect(page.locator('#course-ready-icon')).to_be_visible()
                assert before==CourseHandler.requests.count(f"releases/{releases['one']['id']}/assets/apple-touch-icon.png")
                page.keyboard.press('Escape');context.set_offline(True)
                for file in releases['one']['files']:
                    assert file['path']!='v1.html' and '/hello/' not in file['path']
                    if file['path'].endswith('.html'):
                        tab=context.new_page();response=tab.goto(url+file['path']);assert response.ok and response.from_service_worker
                        expect(tab.locator('meta[name="gpu-release"]')).to_have_attribute('content',releases['one']['id']);tab.close()
                missing=page.evaluate('''async files=>{for(const f of files){const r=await fetch(new URL(f.path,new URL(document.querySelector('meta[name="gpu-base"]').content,location.href)));if(!r.ok||(await r.arrayBuffer()).byteLength!==f.bytes)return f.path;}return null;}''',releases['one']['files'])
                assert missing is None,missing
                page.locator('.v2-starter-model > summary').click();page.locator('#v2-choice').select_option('3');page.locator('#v2-run').click()
                model_result=page.locator('#v2-result').inner_text()
                frame=page.frame_locator('[data-kernel-workbench="scale"]');editor=frame.locator('#source')
                draft=editor.input_value().replace('2.0f','4.0f');editor.fill(draft)
                second=context.new_page();second.goto(url+'v2/more-threads-than-elements.html?keep=1#v2-activity')
                second.locator('.v2-starter-model > summary').click();second.locator('#v2-choice').select_option('8');second.locator('#v2-run').click()
                bounds_result=second.locator('#v2-result').inner_text()
                schedule=context.new_page();schedule.goto(url+'v2/scheduling.html')
                schedule.locator('.v2-starter-model > summary').click();schedule.locator('#v2-choice').select_option('1')
                schedule.locator('#v2-prediction').fill('7');schedule.get_by_role('button',name='Run model',exact=True).click()
                schedule.get_by_role('button',name='Next step',exact=True).click()
                scheduling_trace=schedule.locator('[data-trace]').inner_text()
                recording_pages=[]
                # All media bytes are checked above; distinct current players
                # cover paused native media state without opening retired pages.
                for slug in ['reduction','tensor-cores','pipelines']:
                    tab=context.new_page();tab.goto(url+'v2/'+slug+'.html')
                    tab.locator('#v2-video > summary').click();video=tab.locator('video');video.evaluate('v=>v.load()')
                    expect(video).to_have_js_property('readyState',4,timeout=30000)
                    video.evaluate('v=>{v.currentTime=5;v.playbackRate=1.25;v.pause()}')
                    tab.locator('.sm-transcript > summary').click();recording_pages.append(tab)
                context.set_offline(False);CourseHandler.revision='two';check(page)
                expect(page.locator('#download-update')).to_be_visible()
                CourseHandler.slow=True;CourseHandler.pause=(f"releases/{releases['two']['id']}/{releases['two']['files'][0]['path']}",Event())
                start=len(CourseHandler.requests);page.locator('#download-update').click()
                deadline=time.monotonic()+30
                while CourseHandler.pause[0] not in CourseHandler.requests[start:] and time.monotonic()<deadline:time.sleep(.05)
                assert CourseHandler.pause[0] in CourseHandler.requests[start:]
                progress=page.locator('#download-progress');expect(page.locator('#update-download-feedback #download-progress')).to_be_visible()
                page.locator('#cancel-download').focus();page.keyboard.press('Enter');CourseHandler.pause[1].set();CourseHandler.pause=None
                expect(progress).to_be_hidden();expect(page.locator('#download-update')).to_be_enabled(timeout=30000);ready(page)
                CourseHandler.slow=False
                quota.send('Storage.overrideQuotaForOrigin',{**budget,'quotaSize':1});page.locator('#download-update').click()
                expect(page.locator('#app-status-error')).not_to_be_empty(timeout=30000);ready(page)
                expect(page.locator('#restart-update')).to_be_hidden();quota.send('Storage.overrideQuotaForOrigin',budget)
                target=f"gpu-lab:{url}:release-{releases['two']['id']}"
                page.evaluate('''async ({cache,url})=>{await(await caches.open(cache)).delete(url+'examples/first-kernel.cu')}''',{'cache':target,'url':url})
                CourseHandler.fail='examples/first-kernel.cu';page.locator('#download-update').click()
                expect(page.locator('#app-status-error')).not_to_be_empty(timeout=DOWNLOAD_TIMEOUT);ready(page)
                expect(page.locator('#restart-update')).to_be_hidden()
                CourseHandler.fail=None;page.locator('#download-update').click();update_ready(page)
                page.locator('#later-update').click();expect(page.locator('#app-status-summary')).to_contain_text('Update ready')
                second.evaluate("dispatchEvent(new CompositionEvent('compositionstart'))")
                panel(page);page.locator('#restart-update').click()
                expect(page.locator('#app-status-error')).to_contain_text('Finish the current input',timeout=DOWNLOAD_TIMEOUT)
                second.evaluate("dispatchEvent(new CompositionEvent('compositionend'))")
                second.evaluate("window.updateGuard=e=>{e.detail.reason='Finish the unsaved operation first.'};addEventListener('gpu-lab:before-restart',updateGuard)")
                page.locator('#restart-update').click();expect(page.locator('#app-status-error')).to_contain_text('unsaved operation',timeout=DOWNLOAD_TIMEOUT)
                second.evaluate('''()=>{removeEventListener('gpu-lab:before-restart',updateGuard);window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Storage denied','SecurityError')}}''')
                page.locator('#restart-update').click();expect(page.locator('#app-status-error')).to_contain_text('Storage denied',timeout=DOWNLOAD_TIMEOUT)
                second.evaluate('()=>{Storage.prototype.setItem=window.originalSet}')
                blocked=context.new_page();blocked.goto(url);blocked.wait_for_load_state('networkidle')
                blocked_cdp=context.new_cdp_session(blocked);blocked_cdp.send('Emulation.setScriptExecutionDisabled',{'value':True})
                page.locator('#restart-update').click();expect(page.locator('#app-status-error')).to_contain_text('did not respond',timeout=DOWNLOAD_TIMEOUT)
                blocked_cdp.detach();blocked.close()
                context.set_offline(True);page.locator('#restart-update').click()
                for tab in [page,second,schedule,*recording_pages]:
                    expect(tab.locator('meta[name="gpu-release"]')).to_have_attribute('content',releases['two']['id'],timeout=30000)
                    tab.wait_for_load_state('load')
                expect(page).to_have_url(route);expect(editor).to_have_value(draft)
                expect(page.locator('#v2-choice')).to_have_value('3');expect(page.locator('#v2-result')).to_have_text(model_result,use_inner_text=True)
                expect(page.locator('.v2-starter-model')).to_have_attribute('open','')
                expect(second.locator('#v2-choice')).to_have_value('8');expect(second.locator('#v2-result')).to_have_text(bounds_result,use_inner_text=True)
                expect(schedule.locator('[data-trace]')).to_have_text(scheduling_trace,use_inner_text=True)
                expect(schedule.locator('[data-position]')).to_contain_text('Step 2 of')
                for tab in recording_pages:
                    video=tab.locator('video');expect(tab.locator('#v2-video')).to_have_attribute('open','')
                    expect(video).to_have_js_property('paused',True)
                    expect(video).to_have_js_property('playbackRate',1.25)
                    tab.wait_for_function('()=>{const v=document.querySelector("video");return !v.seeking&&v.readyState>=1&&Math.abs(v.currentTime-5)<.4}',timeout=30000)
                    expect(tab.locator('.sm-transcript')).to_have_attribute('open','')
                panel(page);ready(page)
                active=f"gpu-lab:{url}:release-{releases['two']['id']}"
                page.evaluate('''async ({cache,url})=>{await(await caches.open(cache)).delete(url+'examples/first-kernel.cu');dispatchEvent(new Event('focus'))}''',{'cache':active,'url':url})
                expect(page.locator('#offline-status')).to_have_text('Offline download incomplete',timeout=DOWNLOAD_TIMEOUT)
                context.set_offline(False);CourseHandler.corrupt='examples/first-kernel.cu'
                assert not page.evaluate('async url=>(await fetch(url+"examples/first-kernel.cu")).ok',url)
                CourseHandler.corrupt=None;page.locator('#download-update').click();ready(page)
                page.locator('#app-status-details > summary').click();page.locator('#remove-offline').click();page.locator('#cancel-remove').click();ready(page)
                page.locator('#remove-offline').click();page.locator('#confirm-remove').click()
                expect(page.locator('#offline-status')).to_have_text('Not downloaded for offline use',timeout=30000)
                assert page.evaluate('caches.keys()')==['sibling-app:keep']
                assert page.evaluate('localStorage.getItem("user-content")')=='keep'
                expect(editor).to_have_value(draft);expect(page.locator('#v2-choice')).to_have_value('3')
                assert not errors,errors
                context.close();CourseHandler.requests=[]
                print(f'PASS current course {prefix} {width}px {theme}: opt-in, byte verification, interruption/resume, all offline routes/assets, quota/failed update, Later, composition/unsaved/storage/unresponsive-window guards, independent models/source/video restoration, eviction/repair and scoped removal',flush=True)
            # A persistent installed profile: closing every window does NOT apply
            # a prepared release. Reopen completely offline, then explicitly restart.
            CourseHandler.revision='one';CourseHandler.requests=[]
            url=f'http://127.0.0.1:{server.server_port}/gpu-lab/'
            profile=temp/'profile'
            ctx=foreground(p.chromium.launch_persistent_context(str(profile),**options))
            tab=ctx.pages[0];tab.goto(url+'index.html');panel(tab);tab.locator('#download-update').click();ready(tab)
            manifest=ctx.new_cdp_session(tab).send('Page.getAppManifest')
            assert not manifest['errors'],manifest
            CourseHandler.revision='two';check(tab);expect(tab.locator('#version-status')).to_have_text('Update available')
            tab.locator('#download-update').click();update_ready(tab)
            tab.locator('#later-update').click();ctx.close()
            ctx=foreground(p.chromium.launch_persistent_context(str(profile),**options));ctx.set_offline(True)
            tab=ctx.pages[0];tab.goto(url+'index.html')
            expect(tab.locator('html')).to_have_attribute('data-test-release','one')
            panel(tab);ready(tab);expect(tab.locator('#version-status')).to_have_text('Update downloaded and checked')
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
            tab=ctx.pages[0];tab.goto(url+'index.html')
            tab.wait_for_function('navigator.serviceWorker.controller !== null')
            legacy_key=f'gpu-lab:{url}:legacy-complete'
            assert legacy_key in tab.evaluate('caches.keys()')
            CourseHandler.legacy=False;CourseHandler.revision='two'
            tab.evaluate('''async () => { const r=await navigator.serviceWorker.getRegistration();await r.update();}''')
            deadline=time.monotonic()+30
            while not tab.evaluate('async()=>Boolean((await navigator.serviceWorker.getRegistration()).waiting)'):
                assert time.monotonic()<deadline,'The replacement worker did not finish installing.'
                time.sleep(.1)
            ctx.close()
            ctx=foreground(p.chromium.launch_persistent_context(str(legacy_profile),**options))
            tab=ctx.pages[0];tab.goto(url+'index.html');panel(tab)
            expect(tab.locator('html')).to_have_attribute('data-test-release','two')
            expect(tab.locator('#offline-status')).to_have_text('Offline download incomplete')
            assert legacy_key in tab.evaluate('caches.keys()')
            tab.locator('#download-update').click();ready(tab)
            ctx.set_offline(True);tab.reload();panel(tab);ready(tab)
            ctx.close();CourseHandler.legacy=False
            print('PASS legacy migration: real former worker, retained cache/consent, explicit verified repair and offline reopen')
            browser.close()
    finally:server.shutdown()
