# Copyright © 2026 Christopher Snow.
"""Small real-release lifecycle checks, including native Background Fetch.

Uses the production builder, worker, UI and CacheStorage. Mobile OS suspension
is not emulated: page closure and worker termination are tested in Chromium.
"""
import json,os,re,shutil,subprocess,time
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Event,Thread
from urllib.parse import unquote,urlsplit
from app_status import manual_check
from playwright.sync_api import sync_playwright,expect

ROOT=Path(__file__).resolve().parents[1]
RESULTS=ROOT/'test-results/background-updates';RESULTS.mkdir(parents=True,exist_ok=True)
class Handler(BaseHTTPRequestHandler):
    revision='one';roots={};requests=[];pause=None;pause_path='zz-payload.bin';unreachable=False;corrupt=False;previous_worker=False;previous_native_worker=False;fail_metadata=False
    def log_message(self,*args):pass
    def do_GET(self):
        path=unquote(urlsplit(self.path).path).removeprefix('/cuda-cpp-lab/').lstrip('/') or 'index.html'
        if self.unreachable:self.close_connection=True;return
        if self.fail_metadata and (path=='release.json' or path.endswith('/release.json')):self.send_error(503);return
        if path.endswith('/'):path+='index.html'
        root=self.roots[self.revision]
        if path.startswith('releases/'):
            root=next((p for p in self.roots.values() if (p/path).is_file()),root)
        file=(root/path).resolve()
        if not file.is_relative_to(root) or not file.is_file():self.send_error(404);return
        self.requests.append(path);worker_fixture='previous-native-download-worker.js' if self.previous_native_worker else 'previous-download-worker.js'
        data=(ROOT/'tests/fixtures'/worker_fixture).read_bytes() if path=='sw.js' and (self.previous_worker or self.previous_native_worker) else file.read_bytes()
        if self.corrupt and path.endswith(self.corrupt):data=b'bad'+data[3:]
        mime={'.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.html':'text/html'}.get(file.suffix,'application/octet-stream')
        self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(data)));self.end_headers()
        pause=self.pause
        if pause and path.endswith(self.pause_path):pause.wait(12)
        try:self.wfile.write(data)
        except (BrokenPipeError,ConnectionResetError):pass

def fixture(temp,name,previous_client=False,embed=False):
    folder=temp/name;folder.mkdir();(folder/'src').mkdir();(folder/'assets').mkdir()
    for module in ['offline.mjs','header-controls.mjs','header-controls.LICENSE.txt','experiment-state.mjs','release-metadata.mjs','release-contract.mjs','style.css']:
        shutil.copy2(ROOT/'src'/module,folder/'src'/module)
    if previous_client:
        client_fixture='previous-native-download-client.mjs' if previous_client=='native' else 'previous-download-client.mjs'
        shutil.copy2(ROOT/'tests/fixtures'/client_fixture,folder/'src/offline.mjs')
    shutil.copytree(ROOT/'assets/fonts',folder/'assets/fonts')
    for icon in ['icon.svg','icon-192.png','icon-512.png','apple-touch-icon.png']:shutil.copy2(ROOT/'assets'/icon,folder/'assets'/icon)
    shutil.copy2(ROOT/'manifest.webmanifest',folder/'manifest.webmanifest')
    (folder/'zz-payload.bin').write_bytes((b'one' if name=='one' else b'two')*350000)
    (folder/'index.html').write_text(f'''<!doctype html><html lang="en-GB" data-test-release="{name}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="./src/style.css"><title>CUDA C++ Lab lifecycle test</title></head><body><header class="topbar"><a class="brand" href="./">CUDA C++ Lab</a><div class="top-actions"></div></header><main><h1>Course {name}</h1><label for="draft">Saved learner draft</label><input id="draft" value="7"><p>The current lesson stays open while an update downloads.</p></main><footer><span class="build-info"><a href="#">{name}</a></span></footer><script>const d=document.querySelector('#draft');d.value=localStorage.getItem('fixture-draft')||d.value;d.addEventListener('input',()=>localStorage.setItem('fixture-draft',d.value));</script></body></html>''')
    if embed:
        page=folder/'index.html'
        page.write_text(page.read_text().replace('</main>','<iframe data-kernel-workbench="fixture" src="./editor.html?embed=test" title="Versioned editor"></iframe></main>'))
        (folder/'src/frame-version.mjs').write_text("import {version} from './frame-dependency.mjs';document.documentElement.dataset.executedVersion=version;")
        (folder/'src/frame-dependency.mjs').write_text('export const version='+json.dumps(name)+';')
        (folder/'editor.html').write_text(f'''<!doctype html><html lang="en-GB" data-test-release="{name}"><head><meta charset="utf-8"><title>Editor {name}</title><script type="module" src="./src/frame-version.mjs"></script></head><body><header><div class="top-actions"></div></header><main><label>Editor state<input id="frame-draft" value="prepared {name}"></label></main><footer><span class="build-info">{name}</span></footer></body></html>''')
        page.write_text(page.read_text().replace('</main>','<a href="./next.html">Next lesson</a></main>'))
        (folder/'next.html').write_text(f'''<!doctype html><html lang="en-GB" data-test-release="{name}"><head><meta charset="utf-8"><title>Next lesson</title><link rel="stylesheet" href="./src/style.css"></head><body><header class="topbar"><a class="brand" href="./">CUDA C++ Lab</a><div class="top-actions"></div></header><main><h1>Next lesson</h1><a href="./index.html">Previous lesson</a></main><footer><span class="build-info">{name}</span></footer></body></html>''')
    if previous_client:
        # Recreate the removed control before a frozen older controller runs.
        # This parser-ordered module precedes the controller injected in <head>.
        # The frozen historical controller predates the disabled-until-mounted
        # guard. Recreate its enabled header before that controller executes.
        legacy_action='''<script type="module">document.querySelector('#app-status-open').disabled=false;document.querySelector('.status-actions').insertAdjacentHTML('beforeend','<button id="save-offline" type="button">Download for offline use</button>');</script>'''
        page=folder/'index.html'
        page.write_text(page.read_text().replace('</head>',legacy_action+'</head>'))
    subprocess.run(['node','--input-type=module','-e',"import {buildOffline} from './scripts/offline.mjs';await buildOffline(process.argv[1]);",str(folder)],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
    return folder

def launch(p):
    binary=os.environ.get('CHROMIUM_PATH')
    return p.chromium.launch(**({'executable_path':binary} if binary else {'channel':'chromium'}))

def open_page(context,url):
    page=context.new_page();page.goto(url);page.wait_for_function('navigator.serviceWorker.controller!==null')
    page.locator('#app-status-open').click()
    # Frozen older clients still expose their original first-save control.
    action=page.locator('#save-offline') if page.locator('#save-offline').count() else page.locator('#download-update')
    expect(action).to_be_enabled();return page

def rpc(page,type,**data):
    return page.evaluate('''async data=>{const r=await navigator.serviceWorker.ready,c=new MessageChannel();return new Promise((resolve,reject)=>{c.port1.onmessage=({data})=>{if(data.progress)return;data.error?reject(Error(data.error)):resolve(data.result)};r.active.postMessage(data,[c.port2]);})}''',{'type':type,**data})

def job(page):return rpc(page,'STATUS').get('download')
def payload_requests():return sum(p.endswith('zz-payload.bin') for p in Handler.requests)
def until(predicate,timeout=15):
    end=time.monotonic()+timeout
    while time.monotonic()<end:
        if predicate():return
        time.sleep(.05)
    raise AssertionError('Timed out waiting for the real download lifecycle')

def native_closed_page(browser,url):
    Handler.revision='one';Handler.requests=[];Handler.pause=Event()
    with browser.new_context(viewport={'width':390,'height':844}) as c:
        page=open_page(c,url)
        assert page.evaluate('(async()=>!!(await navigator.serviceWorker.ready).backgroundFetch)()'),'Native Background Fetch requires full Chromium for this check.'
        assert payload_requests()==0,'Visiting a page must not consent to a course download.'
        page.locator('#app-status-close').click();page.locator('#draft').fill('learner work retained');expect(page.locator('#draft')).to_have_value('learner work retained');page.locator('#app-status-open').click();page.locator('#download-update').click();until(lambda:payload_requests()>0)
        page.wait_for_function("document.querySelector('#download-behaviour').textContent.includes('background')")
        page.screenshot(path=str(RESULTS/'native-downloading.png'));page.close();Handler.pause.set()
        page=c.new_page();page.goto(url);page.wait_for_function('navigator.serviceWorker.controller!==null')
        page.locator('#app-status-open').click();expect(page.locator('#offline-status')).to_have_text('Downloaded and ready to use offline.',timeout=30000)
        assert page.locator('#draft').input_value()=='learner work retained';assert job(page)['state']=='ready'
        page.screenshot(path=str(RESULTS/'native-after-page-close.png'))
        page.close();page=c.new_page();page.goto(url+'?download=1');expect(page.locator('#app-status-dialog')).to_be_visible();assert 'download=' not in page.url
    Handler.pause=None;print('PASS native Background Fetch completes across page closure; drafts retained; no unsolicited download',flush=True)

def fallback_resume(browser,url):
    Handler.revision='one';Handler.requests=[];Handler.pause=None
    with browser.new_context(viewport={'width':390,'height':844}) as c:
        c.add_init_script("if(typeof ServiceWorkerRegistration!=='undefined')Object.defineProperty(ServiceWorkerRegistration.prototype,'backgroundFetch',{get:()=>undefined})")
        page=open_page(c,url);page.locator('#download-update').click();expect(page.locator('#offline-status')).to_have_text('Downloaded and ready to use offline.',timeout=30000)
        page.locator('#app-status-close').click();page.locator('#draft').fill('saved during update');page.locator('#app-status-open').click();Handler.revision='two';Handler.pause=Event();manual_check(page);expect(page.locator('#download-update')).to_be_visible();page.locator('#download-update').click()
        until(lambda:payload_requests()>=2)
        current=job(page);assert current['wanted'] and current['bytes']>0
        candidate=json.loads((Handler.roots['two']/'release.json').read_text())
        css=next(file for file in candidate['files'] if file['path']=='src/style.css')
        assert page.evaluate('''async ({id,sha})=>{
            const base=new URL('./',location.href),cache=await caches.open('gpu-lab:'+base.href+':release-'+id);
            const response=await cache.match(new URL('src/style.css',base));if(!response)return false;
            const digest=await crypto.subtle.digest('SHA-256',await response.arrayBuffer());
            return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('')===sha;
        }''',{'id':candidate['id'],'sha':css['sha256']}),'The candidate stylesheet must be verified in CacheStorage before worker termination.'
        page.screenshot(path=str(RESULTS/'fallback-downloading.png'))
        before=list(Handler.requests);session=c.new_cdp_session(page);session.send('ServiceWorker.enable');session.send('ServiceWorker.stopAllWorkers');page.close();Handler.pause.set();Handler.pause=None
        page=open_page(c,url);expect(page.locator('#version-status')).to_have_text('Update downloaded and checked',timeout=30000)
        assert page.locator('html').get_attribute('data-test-release')=='two','A new online visit reads the published version; the prior open page was not reloaded automatically.'
        assert page.locator('#draft').input_value()=='saved during update'
        resumed=Handler.requests[len(before):]
        assert sum(p.endswith('zz-payload.bin') for p in resumed)==1
        assert 'releases/'+candidate['id']+'/src/style.css' not in resumed,('The completed candidate stylesheet must be reused.',resumed)
        page.screenshot(path=str(RESULTS/'fallback-resumed-ready.png'))
        page.locator('#restart-update').click();expect(page.locator('html')).to_have_attribute('data-test-release','two');expect(page.locator('#draft')).to_have_value('saved during update')
    print('PASS unsupported-browser fallback resumes after worker termination, reuses verified files and waits for explicit restart',flush=True)


def cancelled_request(browser,url,native=True,browser_cancel=False):
    Handler.revision='one';Handler.requests=[];Handler.pause=None;Handler.corrupt=False
    with browser.new_context(viewport={'width':390,'height':844}) as c:
        if not native:c.add_init_script("if(typeof ServiceWorkerRegistration!=='undefined')Object.defineProperty(ServiceWorkerRegistration.prototype,'backgroundFetch',{get:()=>undefined})")
        page=open_page(c,url);page.locator('#download-update').click();expect(page.locator('#offline-status')).to_have_text('Downloaded and ready to use offline.',timeout=30000)
        Handler.revision='two';Handler.pause=Event();manual_check(page);expect(page.locator('#download-update')).to_be_visible();page.locator('#download-update').click();until(lambda:payload_requests()>=2)
        expect(page.locator('#update-download-feedback #download-progress')).to_be_visible()
        expect(page.locator('#version-status')).to_have_text('Downloading update')
        if native and not browser_cancel:page.screenshot(path=str(RESULTS/'update-downloading.png'))
        if browser_cancel:
            current=job(page);page.evaluate('async id=>(await (await navigator.serviceWorker.ready).backgroundFetch.get(id)).abort()',current['id'])
        else:
            page.locator('#cancel-download').focus();page.locator('#cancel-download').press('Enter')
            expect(page.locator('#download-progress')).to_be_hidden()
        Handler.pause.set();Handler.pause=None
        until(lambda:not job(page)['wanted'] and not job(page)['busy'])
        count=payload_requests();page.close();page=open_page(c,url);page.wait_for_timeout(300)
        assert payload_requests()==count,'Cancel must not turn into an automatic retry when returning.'
        assert not job(page)['wanted'];assert page.locator('html').get_attribute('data-test-release')=='two'
        if native and not browser_cancel:page.screenshot(path=str(RESULTS/'cancelled-update.png'))
        page.locator('#download-update').click();expect(page.locator('#version-status')).to_have_text('Update downloaded and checked',timeout=30000)
        assert page.locator('html').get_attribute('data-test-release')=='two'
    print(f'PASS Cancel survives reopening: {"native" if native else "fallback"}, {"browser control" if browser_cancel else "app control"}; explicit resume succeeds',flush=True)


def rejected_response(browser,url):
    Handler.revision='one';Handler.requests=[];Handler.pause=None;Handler.corrupt=False
    with browser.new_context(viewport={'width':820,'height':1100},color_scheme='dark') as c:
        page=open_page(c,url);page.locator('#download-update').click();expect(page.locator('#offline-status')).to_have_text('Downloaded and ready to use offline.',timeout=30000)
        Handler.revision='two';Handler.corrupt='src/experiment-state.mjs';manual_check(page);expect(page.locator('#download-update')).to_be_visible();page.locator('#download-update').click()
        expect(page.locator('#app-status-error')).to_contain_text('did not match the release',timeout=30000)
        assert not job(page)['wanted'];assert not rpc(page,'STATUS')['pendingReady'];assert page.locator('html').get_attribute('data-test-release')=='one'
        expect(page.locator('#offline-status')).to_have_text('Downloaded and ready to use offline.')
        assert page.locator('#app-status-error').evaluate("e=>e.parentElement.id==='update-download-feedback'")
        page.screenshot(path=str(RESULTS/'rejected-file.png'))
        count=payload_requests();Handler.corrupt=False;page.locator('#download-update').click();expect(page.locator('#version-status')).to_have_text('Update downloaded and checked',timeout=30000)
        assert payload_requests()==count,'Valid files after a rejected response must remain cached, including the large payload.'
        page.screenshot(path=str(RESULTS/'verified-repair-ready.png'))
    print('PASS native hash rejection keeps the old course, never reports ready, and repairs only the rejected file',flush=True)


def previous_worker_recovery(browser,url):
    Handler.revision='one';Handler.requests=[];Handler.pause=None;Handler.corrupt=False;Handler.previous_worker=True
    with browser.new_context(viewport={'width':390,'height':844}) as c:
        c.add_init_script("if(typeof ServiceWorkerRegistration!=='undefined')Object.defineProperty(ServiceWorkerRegistration.prototype,'backgroundFetch',{get:()=>undefined})")
        page=open_page(c,url);assert rpc(page,'STATUS').get('downloadVersion') is None
        page.locator('#download-update').click();expect(page.locator('#offline-status')).to_have_text('Downloaded and ready to use offline.',timeout=30000)
        Handler.revision='two';Handler.pause=Event();manual_check(page);expect(page.locator('#download-update')).to_be_visible();page.locator('#download-update').click();until(lambda:payload_requests()>=2)
        page.locator('#cancel-download').click()
        # Keep the body gated until the older worker has acknowledged Cancel.
        # Otherwise the server can win the abort race and legitimately leave a
        # complete cached file, so the next transfer would have nothing to fetch.
        until(lambda:(s:=rpc(page,'STATUS')).get('active')==page.locator('meta[name="gpu-release"]').get_attribute('content') and not s['busy'])
        Handler.pause.set();Handler.pause=None
        count=payload_requests();page.close();page=open_page(c,url);page.wait_for_timeout(200);assert payload_requests()==count
        Handler.pause=Event();page.locator('#download-update').click();until(lambda:payload_requests()>=count+1)
        Handler.previous_worker=False
        page.evaluate('async()=>{const r=await navigator.serviceWorker.ready;await r.update()}')
        page.wait_for_function('navigator.serviceWorker.getRegistration().then(r=>!!r.waiting)')
        session=c.new_cdp_session(page);session.send('ServiceWorker.enable');session.send('ServiceWorker.stopAllWorkers');page.close();Handler.pause.set();Handler.pause=None
        page=open_page(c,url);expect(page.locator('#version-status')).to_have_text('Update downloaded and checked',timeout=30000)
        assert rpc(page,'STATUS')['downloadVersion']==1
        assert page.locator('html').get_attribute('data-test-release')=='two'
    Handler.previous_worker=False
    print('PASS an actual previous-production worker honours Cancel and hands a durable partial request to the naturally activated new worker',flush=True)

def full_course_native(browser,update_root):
    """Exercise the real production download, not only small lifecycle fixtures."""
    assert (ROOT/'dist/release.json').is_file(),'Build the course before this check.'
    Handler.roots={'one':ROOT/'dist','two':update_root};Handler.revision='one';Handler.requests=[]
    Handler.pause=None;Handler.corrupt=False;Handler.previous_worker=False
    server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
    Thread(target=server.serve_forever,daemon=True).start()
    url=f'http://127.0.0.1:{server.server_port}/cuda-cpp-lab/v2/first-kernel.html'
    try:
        with browser.new_context(viewport={'width':390,'height':1000},color_scheme='dark') as c:
            page=c.new_page();page.goto(url)
            page.wait_for_function('''async()=>{
                const base=new URL('../',location.href),id=document.querySelector('meta[name="gpu-release"]').content;
                const name=`gpu-lab:${base.href}:release-${id}`;
                if(!await caches.has(name))return false;
                const cache=await caches.open(name);
                return await cache.match(new URL('src/v2-editor-focus.mjs',base)) && await cache.match(new URL('v2/cuda-source-workbench.html',base));
            }''')
            assert not any(path.endswith('examples/gather.cu') for path in Handler.requests),'Retaining the visited editor must not download the rest of the course.'
            page.locator('#app-status-open').click()
            # Click as soon as the control allows it: startup retention and the
            # explicit download must share connection work without racing.
            page.locator('#download-update').dblclick()
            try:page.wait_for_function("document.querySelector('#download-behaviour').textContent.includes('background')")
            except Exception:
                print('Full native startup diagnostics:',page.locator('#app-status-dialog').inner_text(),flush=True)
                print('Full native job:',job(page),flush=True)
                raise
            page.locator('#app-status-close').click()
            editor=page.frame_locator('[data-kernel-workbench="hello"]').locator('#source')
            expect(editor).to_be_editable()
            expect(editor).to_have_value(re.compile(r'output\[0\] = 42\.0f;'))
            draft=editor.input_value().replace('42.0f','7.0f');editor.fill(draft)
            page.close()
            page=c.new_page();page.goto(url);page.locator('#app-status-open').click()
            expect(page.locator('#offline-status')).to_have_text('Downloaded and ready to use offline.',timeout=120000)
            expect(page.locator('#app-status-error')).to_be_empty()
            assert job(page)['state']=='ready'
            expect(page.frame_locator('[data-kernel-workbench="hello"]').locator('#source')).to_have_value(draft)
            page.screenshot(path=str(RESULTS/'full-course-native-ready.png'))
            c.set_offline(True);page.reload();page.locator('#app-status-open').click()
            expect(page.locator('#offline-status')).to_have_text('Downloaded and ready to use offline.',timeout=30000)
            expect(page.frame_locator('[data-kernel-workbench="hello"]').locator('#source')).to_have_value(draft)
            # Cancellation must also release the page's request lock when its
            # existing complete cache contains every recording/compiler asset.
            c.set_offline(False);Handler.revision='two';Handler.pause=Event()
            page.evaluate("if(typeof ServiceWorkerRegistration!=='undefined')Object.defineProperty(ServiceWorkerRegistration.prototype,'backgroundFetch',{get:()=>undefined})")
            manual_check(page);expect(page.locator('#download-update')).to_be_visible()
            before=payload_requests();page.locator('#download-update').click()
            until(lambda:payload_requests()>before)
            page.locator('#cancel-download').focus();page.locator('#cancel-download').press('Enter')
            expect(page.locator('#download-progress')).to_be_hidden()
            page.screenshot(path=str(RESULTS/'full-course-stopping.png'))
            until(lambda:not job(page)['wanted'] and not job(page)['busy'],timeout=30)
            Handler.pause.set();Handler.pause=None
            expect(page.locator('#download-update')).to_be_enabled(timeout=30000)
            expect(page.locator('#offline-status')).to_have_text('Downloaded and ready to use offline.',timeout=30000)
    finally:server.shutdown()
    print('PASS the complete production course downloads across page closure, reopens offline with its CUDA draft, and releases Update after cancelling a replacement',flush=True)

def quota_startup_error(browser,url):
    Handler.revision='one';Handler.requests=[];Handler.pause=None;Handler.corrupt=False
    with browser.new_context() as c:
        c.add_init_script("if(typeof ServiceWorkerRegistration!=='undefined')Object.defineProperty(ServiceWorkerRegistration.prototype,'backgroundFetch',{get:()=>undefined})")
        page=open_page(c,url);page.locator('#download-update').click()
        expect(page.locator('#offline-status')).to_have_text('Downloaded and ready to use offline.',timeout=30000)
        assert job(page)['state']=='ready'
        Handler.revision='two';manual_check(page)
        expect(page.locator('#download-update')).to_be_visible()
        cdp=c.new_cdp_session(page)
        cdp.send('Storage.overrideQuotaForOrigin',{'origin':url.removesuffix('/cuda-cpp-lab/'),'quotaSize':1})
        page.locator('#download-update').click()
        expect(page.locator('#app-status-error')).not_to_be_empty(timeout=30000)
        expect(page.locator('#app-status-error')).to_be_visible()
        assert page.locator('#app-status-error').evaluate("e=>e.parentElement.id==='update-download-feedback'")
        assert page.locator('html').get_attribute('data-test-release')=='one'
        expect(page.locator('#offline-status')).to_have_text('Downloaded and ready to use offline.')
        expect(page.locator('#restart-update')).to_be_hidden()
        cdp.send('Storage.overrideQuotaForOrigin',{'origin':url.removesuffix('/cuda-cpp-lab/')});cdp.detach()
        page.locator('#download-update').click()
        expect(page.locator('#version-status')).to_have_text('Update downloaded and checked',timeout=30000)
        expect(page.locator('#app-status-error')).to_be_empty()
    print('PASS a new request reports real quota failure beside Update despite a previous completed job; the old course remains available and retry succeeds',flush=True)

def previous_client_upgrade(browser,url,old_root):
    """The actual 72c5e0e page protocol, not just its worker under a new UI."""
    original=Handler.roots['one'];Handler.roots['one']=old_root
    try:
        for previous_worker,missing_state in [(True,False),(True,True),(False,True)]:
            Handler.previous_worker=previous_worker;Handler.revision='one';Handler.pause=None
            with browser.new_context(viewport={'width':390,'height':844}) as c:
                page=open_page(c,url)
                # Join the old page's optional retention before evicting only its
                # cache metadata; the lesson and the learner's work remain open.
                until(lambda:(s:=rpc(page,'STATUS')).get('active')==page.locator('meta[name="gpu-release"]').get_attribute('content') and not s['busy'])
                page.locator('#app-status-close').click();page.locator('#draft').fill('old client draft');page.locator('#app-status-open').click()
                if missing_state:
                    page.evaluate("async()=>{const name=(await caches.keys()).find(n=>n.endsWith('status-v1'));const cache=await caches.open(name);await cache.delete(new URL('__app_status_state__',location.href))}")
                Handler.revision='two';manual_check(page)
                expect(page.locator('#download-update')).to_be_visible();page.locator('#download-update').click()
                candidate=json.loads((Handler.roots['two']/'release.json').read_text())
                until(lambda:(s:=rpc(page,'STATUS')).get('partial') is None and (s.get('active')==candidate['id'] or s.get('pending')==candidate['id']))
                if previous_worker and missing_state:
                    # Reproduce the old defect: a complete candidate was marked
                    # active despite this page still running the previous course.
                    state=rpc(page,'STATUS');assert state['active']==candidate['id'] and state.get('pending') is None
                    expect(page.locator('#restart-update')).to_be_hidden()
                else:
                    expect(page.locator('#restart-update')).to_be_visible(timeout=30000)
                    assert page.locator('html').get_attribute('data-test-release')=='old-client'
                    page.locator('#restart-update').click()
                    expect(page.locator('html')).to_have_attribute('data-test-release','two',timeout=30000)
                    expect(page.locator('#draft')).to_have_value('old client draft')
        print('PASS the actual older client upgrades normally; its missing-state defect is reproduced with the old worker and fixed by the new worker without losing drafts',flush=True)
    finally:Handler.roots['one']=original;Handler.previous_worker=False

def missing_state_native(browser,url):
    Handler.revision='one';Handler.pause=None
    with browser.new_context(viewport={'width':390,'height':844}) as c:
        page=open_page(c,url);until(lambda:(s:=rpc(page,'STATUS')).get('active')==page.locator('meta[name="gpu-release"]').get_attribute('content') and not s['busy'])
        page.evaluate("async()=>{const name=(await caches.keys()).find(n=>n.endsWith('status-v1'));const cache=await caches.open(name);await cache.delete(new URL('__app_status_state__',location.href))}")
        Handler.revision='two';manual_check(page);expect(page.locator('#download-update')).to_be_visible();page.locator('#download-update').click()
        expect(page.locator('#version-status')).to_have_text('Update downloaded and checked',timeout=30000)
        expect(page.locator('#restart-update')).to_be_visible();expect(page.locator('#offline-section')).to_be_hidden()
        expect(page.locator('#version-detail')).to_have_text('')
        assert page.locator('html').get_attribute('data-test-release')=='one'
        # Recover an already complete cache with the old worker's incorrect
        # active selection. Status recovery must need no new transfer.
        candidate=json.loads((Handler.roots['two']/'release.json').read_text())
        page.evaluate("async id=>{const name=(await caches.keys()).find(n=>n.endsWith('status-v1'));await (await caches.open(name)).put(new URL('__app_status_state__',location.href),new Response(JSON.stringify({active:id,saved:true}))) }",candidate['id'])
        before=payload_requests();manual_check(page)
        until(lambda:rpc(page,'STATUS').get('pending')==candidate['id'])
        expect(page.locator('#version-status')).to_have_text('Update downloaded and checked',timeout=30000)
        assert payload_requests()==before,'A verified existing candidate needs no payload download to recover Restart.'
        page.locator('#restart-update').click();expect(page.locator('html')).to_have_attribute('data-test-release','two',timeout=30000)
    print('PASS native downloads keep updates pending after lost metadata and recover Restart for an already verified candidate without downloading its payload again',flush=True)

def completed_native_update_recovery(browser,url,old_root):
    """A current page may still use the installed 7ee4913 native worker."""
    original=Handler.roots['one']
    try:
        cases=[(True,390,'dark',True),(True,390,'light',False)]
        cases += [(False,width,theme,theme=='dark') for width in [390,820,1440] for theme in ['light','dark']]
        for old_client,width,theme,native in cases:
            Handler.roots['one']=old_root if old_client else original
            Handler.previous_native_worker=True;Handler.revision='one';Handler.pause=None;Handler.requests=[]
            with browser.new_context(viewport={'width':width,'height':900},color_scheme=theme) as c:
                if not native:c.add_init_script("Object.defineProperty(ServiceWorkerRegistration.prototype,'backgroundFetch',{get:()=>undefined})")
                page=open_page(c,url)
                until(lambda:(s:=rpc(page,'STATUS')).get('active') is not None and not s['busy'])
                page.locator('#app-status-close').click();page.locator('#draft').fill('saved through completed-update recovery');page.locator('#app-status-open').click()
                companion=None
                if not old_client and width==1440 and theme=='light':
                    companion=c.new_page();companion.goto(url);companion.locator('#draft').fill('the other tab draft')
                    page.bring_to_front()
                page.evaluate("async()=>{const name=(await caches.keys()).find(n=>n.endsWith('status-v1'));await (await caches.open(name)).delete(new URL('__app_status_state__',location.href))}")
                Handler.revision='two';manual_check(page);expect(page.locator('#download-update')).to_be_visible();page.locator('#download-update').click()
                candidate=json.loads((Handler.roots['two']/'release.json').read_text())
                until(lambda:(rpc(page,'STATUS').get('download') or {}).get('state')=='ready',30)
                if old_client:
                    # Exact ace5867 client + old native worker: finishing the
                    # transfer, and pressing Update again, never offers Restart.
                    expect(page.locator('#download-update')).to_be_visible();expect(page.locator('#restart-update')).to_be_hidden()
                    before=payload_requests();page.locator('#download-update').click()
                    expect(page.locator('#download-progress')).to_be_hidden(timeout=30000)
                    expect(page.locator('#download-update')).to_be_visible();expect(page.locator('#restart-update')).to_be_hidden()
                    assert payload_requests()==before
                    page.screenshot(path=str(RESULTS/f'completed-update-before-{native}.png'))
                    # One-time recovery for already-pinned old code: keep its
                    # draft/caches, close every app page and reopen the course.
                    Handler.previous_native_worker=False
                    page.evaluate('async()=>{const r=await navigator.serviceWorker.ready;await r.update()}')
                    page.wait_for_function('navigator.serviceWorker.getRegistration().then(r=>!!r.waiting)')
                    page.close();page=c.new_page();page.goto(url)
                    expect(page.locator('html')).to_have_attribute('data-test-release','two')
                    expect(page.locator('#draft')).to_have_value('saved through completed-update recovery')
                    continue
                expect(page.locator('#restart-update')).to_be_visible(timeout=30000)
                expect(page.locator('#version-status')).to_have_text('Update downloaded and checked')
                expect(page.locator('#download-update')).to_be_hidden();expect(page.locator('#app-status-error')).to_be_empty()
                assert page.locator('html').get_attribute('data-test-release')=='one'
                state=rpc(page,'STATUS');assert state['pending']==candidate['id'] and state['pendingReady'] and state['pendingSaved']
                before=payload_requests();manual_check(page)
                expect(page.locator('#restart-update')).to_be_visible();assert payload_requests()==before
                page.evaluate("theme=>document.documentElement.dataset.theme=theme",theme)
                page.screenshot(path=str(RESULTS/f'completed-update-ready-{width}-{theme}.png'))
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                # Restart still uses the all-window save guard and needs no network.
                c.set_offline(True)
                if companion:
                    companion.evaluate("window.recoveryGuard=e=>{e.detail.reason='Keep the other tab open for now.'};addEventListener('gpu-lab:before-restart',recoveryGuard)")
                    page.locator('#restart-update').click();expect(page.locator('#app-status-error')).to_contain_text('Keep the other tab')
                    assert page.locator('html').get_attribute('data-test-release')=='one'
                    assert companion.locator('html').get_attribute('data-test-release')=='one'
                    companion.evaluate("removeEventListener('gpu-lab:before-restart',recoveryGuard)")
                page.locator('#restart-update').focus();page.locator('#restart-update').press('Enter')
                expect(page.locator('html')).to_have_attribute('data-test-release','two',timeout=30000)
                expect(page.locator('#draft')).to_have_value('saved through completed-update recovery')
                if companion:
                    expect(companion.locator('html')).to_have_attribute('data-test-release','two',timeout=30000)
                    expect(companion.locator('#draft')).to_have_value('the other tab draft')
                assert payload_requests()==before
        print('PASS exact old native worker/client update loop reproduced; close/reopen retains drafts; new client recovers Restart without another payload in six layouts/themes and both download paths',flush=True)
    finally:Handler.roots['one']=original;Handler.previous_native_worker=False

def cancel_completed_update_recovery(browser,url):
    Handler.previous_native_worker=True;Handler.revision='one';Handler.pause=None;Handler.requests=[]
    try:
        with browser.new_context(viewport={'width':390,'height':844}) as c:
            c.add_init_script("""{
                Object.defineProperty(ServiceWorkerRegistration.prototype,'backgroundFetch',{get:()=>undefined});
                const send=ServiceWorker.prototype.postMessage;
                ServiceWorker.prototype.postMessage=function(data,...args){
                    const result=send.call(this,data,...args);
                    if(data.type==='PREPARE'&&data.save===false){
                        window.recoveryRequests=(window.recoveryRequests||0)+1;
                        if(window.cancelRecoveryOnce){window.cancelRecoveryOnce=false;setTimeout(()=>document.querySelector('#cancel-download').click(),0);}
                    }
                    return result;
                };
            }""")
            page=open_page(c,url);until(lambda:(s:=rpc(page,'STATUS')).get('active') is not None and not s['busy'])
            page.evaluate("async()=>{window.cancelRecoveryOnce=true;const name=(await caches.keys()).find(n=>n.endsWith('status-v1'));await (await caches.open(name)).delete(new URL('__app_status_state__',location.href))}")
            Handler.revision='two';manual_check(page);expect(page.locator('#download-update')).to_be_visible();page.locator('#download-update').click()
            page.wait_for_function('window.cancelRecoveryOnce===false')
            expect(page.locator('#download-update')).to_be_visible(timeout=30000);expect(page.locator('#download-update')).to_be_enabled()
            expect(page.locator('#download-progress')).to_be_hidden();expect(page.locator('#restart-update')).to_be_hidden()
            expect(page.locator('#app-status-error')).to_be_empty()
            count=page.evaluate('window.recoveryRequests');before=payload_requests()
            for _ in range(2):manual_check(page);expect(page.locator('#download-update')).to_be_enabled()
            assert page.evaluate('window.recoveryRequests')==count,'Cancel must not restart cache verification automatically.'
            page.locator('#download-update').click();expect(page.locator('#restart-update')).to_be_visible(timeout=30000)
            assert payload_requests()==before
        print('PASS Cancel stops completed-update recovery, keeps Update usable, and an explicit retry recovers Restart without another payload',flush=True)
    finally:Handler.previous_native_worker=False

def no_completed_cache_downgrade(browser,url):
    for mode in ['offline','update']:
        Handler.revision='one';Handler.pause=None;Handler.requests=[]
        with browser.new_context(viewport={'width':390,'height':844}) as c:
            page=open_page(c,url);until(lambda:(s:=rpc(page,'STATUS')).get('active') is not None and not s['busy'])
            running=page.locator('meta[name="gpu-release"]').get_attribute('content')
            candidate=json.loads((Handler.roots['two']/'release.json').read_text())
            # A verified older save/update can remain selected when a hard
            # refresh opens the currently published page. It is no new consent
            # to restart that page into the different cached release.
            rpc(page,'PREPARE',release=candidate,save=True,requestDownload=True,mode=mode,running=running if mode=='offline' else '0'*64)
            page.evaluate("async id=>{const name=(await caches.keys()).find(n=>n.endsWith('status-v1'));await (await caches.open(name)).put(new URL('__app_status_state__',location.href),new Response(JSON.stringify({active:id,saved:true}))) }",candidate['id'])
            before=payload_requests();manual_check(page)
            expect(page.locator('#version-status')).to_have_text('Up to date online. The offline copy is a different version.',timeout=30000)
            expect(page.locator('#restart-update')).to_be_hidden()
            expect(page.locator('#download-update')).to_have_text('Update offline copy')
            expect(page.locator('#download-update')).to_be_visible()
            expect(page.locator('#offline-status')).to_have_text('A different version is saved and ready to use offline.')
            assert rpc(page,'STATUS').get('pending') is None
            assert payload_requests()==before
            assert page.locator('meta[name="gpu-release"]').get_attribute('content')==running
            page.locator('#download-update').click()
            # Saving the open version prepares it for every window when an old
            # complete course is still selected. Keep the coordinated restart.
            expect(page.locator('#version-status')).to_have_text('Update downloaded and checked',timeout=30000)
            expect(page.locator('#restart-update')).to_be_visible()
            assert rpc(page,'STATUS')['pending']==running
            page.locator('#restart-update').click()
            expect(page.locator('#app-status-dialog')).to_be_hidden(timeout=30000)
            page.locator('#app-status-open').click()
            expect(page.locator('#version-status')).to_have_text('Up to date. Downloaded and ready to use offline.',timeout=30000)
            assert rpc(page,'STATUS')['active']==running
            expect(page.locator('#restart-update')).to_be_hidden()
    print('PASS a completed offline copy or unrelated older update never restarts the currently published page into that cached release',flush=True)

def dialog_states(browser,url):
    for width in [390,820,1440]:
        for theme in ['light','dark']:
            Handler.revision='one';Handler.pause=None
            with browser.new_context(viewport={'width':width,'height':900},color_scheme=theme) as c:
                c.add_init_script("if(typeof ServiceWorkerRegistration!=='undefined')Object.defineProperty(ServiceWorkerRegistration.prototype,'backgroundFetch',{get:()=>undefined})")
                page=open_page(c,url);dialog=page.locator('#app-status-dialog')
                # This minimal fixture has no theme controller. Apply the course
                # theme explicitly; preferred colour scheme alone does not set it.
                page.evaluate('theme=>document.documentElement.dataset.theme=theme',theme)
                assert dialog.evaluate('e=>getComputedStyle(e).backgroundColor')==('rgb(28, 46, 49)' if theme=='dark' else 'rgb(255, 255, 255)')
                expect(dialog.get_by_role('heading',name='Course status',exact=True)).to_have_count(1)
                expect(dialog.get_by_role('heading',name='Offline access',exact=True)).to_have_count(0)
                expect(dialog.get_by_role('heading',name='Updates',exact=True)).to_have_count(0)
                expect(page.locator('#check-update')).to_be_hidden()
                expect(page.locator('#download-update')).to_be_visible()
                expect(dialog.get_by_role('button',name='Save offline copy',exact=True)).to_have_count(1)
                expect(page.locator('#save-offline')).to_have_count(0)
                expect(page.locator('#retry-update')).to_be_hidden()
                expect(page.locator('#version-status')).to_have_text('Up to date online. Not saved for offline use.')
                expect(page.locator('#app-status-details')).not_to_have_attribute('open','')
                expect(page.locator('#running-version')).to_be_hidden()
                expect(page.locator('#offline-size')).to_contain_text('MB')
                page.screenshot(path=str(RESULTS/f'dialog-{width}-{theme}-idle.png'))
                page.locator('#download-update').click();expect(page.locator('#offline-status')).to_have_text('Downloaded and ready to use offline.',timeout=30000)
                expect(page.locator('#version-status')).to_have_text('Up to date. Downloaded and ready to use offline.')
                expect(page.locator('#version-status')).to_be_visible();expect(page.locator('#offline-section')).to_be_hidden()
                expect(page.locator('#check-update')).to_be_hidden();expect(page.locator('#download-update')).to_be_hidden()
                assert page.locator('#app-status-dialog > section').count()==1
                page.screenshot(path=str(RESULTS/f'dialog-{width}-{theme}-downloaded.png'))
                Handler.revision='two';Handler.pause=Event();manual_check(page);expect(page.locator('#download-update')).to_be_visible()
                expect(page.locator('#download-update')).to_have_text('Update offline copy')
                expect(page.locator('#offline-status')).to_be_visible()
                expect(page.locator('#offline-status')).to_have_text('Downloaded and ready to use offline.')
                expect(page.locator('#version-detail')).to_contain_text('complete course for offline use')
                before=payload_requests();page.locator('#download-update').focus();page.keyboard.press('Enter')
                expect(page.locator('#download-progress')).to_be_visible();expect(page.locator('#cancel-download')).to_be_focused()
                for control in ['check-update','download-update','offline-section','app-status-details','install-help']:expect(page.locator('#'+control)).to_be_hidden()
                assert dialog.evaluate('e=>e.scrollWidth<=e.clientWidth+1')
                assert page.locator('#cancel-download').evaluate('e=>{const r=e.getBoundingClientRect();return r.bottom<=innerHeight&&r.top>=0}')
                page.screenshot(path=str(RESULTS/f'dialog-{width}-{theme}-downloading.png'))
                until(lambda:payload_requests()>before);page.keyboard.press('Enter');Handler.pause.set();Handler.pause=None
                expect(page.locator('#download-update')).to_be_visible(timeout=30000)
                expect(page.locator('#version-status')).to_have_text('Update download incomplete')
                expect(page.locator('#restart-update')).to_be_hidden()
                page.locator('#download-update').click();expect(page.locator('#version-status')).to_have_text('Update downloaded and checked',timeout=30000)
                expect(page.locator('#restart-update')).to_be_visible();expect(page.locator('#offline-section')).to_be_hidden()
                expect(page.locator('#download-progress')).to_be_hidden()
                page.screenshot(path=str(RESULTS/f'dialog-{width}-{theme}-ready.png'))
                page.keyboard.press('Escape');expect(dialog).to_be_hidden();expect(page.locator('#app-status-open')).to_be_focused()
    print('PASS dialog idle, downloading, cancelled/incomplete and verified-ready states in six width/theme layouts; Cancel and modal close remain keyboard accessible',flush=True)

def early_cancel(browser,url):
    Handler.revision='one';Handler.pause=None
    with browser.new_context() as c:
        page=open_page(c,url);Handler.revision='two';manual_check(page)
        expect(page.locator('#download-update')).to_be_visible()
        before=payload_requests()
        # Both clicks in one task cancel before the first awaited startup step.
        page.evaluate("()=>{document.getElementById('download-update').click();document.getElementById('cancel-download').click()}")
        expect(page.locator('#download-update')).to_be_visible();expect(page.locator('#download-update')).to_be_enabled()
        expect(page.locator('#download-progress')).to_be_hidden();expect(page.locator('#restart-update')).to_be_hidden()
        expect(page.locator('#version-status')).to_have_text('Update available')
        assert payload_requests()==before
    print('PASS cancelling during startup keeps Update usable and offers no Restart or unsolicited transfer',flush=True)

def main():
    with TemporaryDirectory(prefix='gpu-download-lifecycle-') as tmp:
        Handler.roots={name:fixture(Path(tmp),name) for name in ['one','two']}
        old_root=fixture(Path(tmp),'old-client',previous_client=True)
        native_old_root=fixture(Path(tmp),'old-native-client',previous_client='native')
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/cuda-cpp-lab/'
        try:
            with sync_playwright() as p:
                browser=launch(p)
                try:
                    native_closed_page(browser,url);fallback_resume(browser,url)
                    cancelled_request(browser,url);cancelled_request(browser,url,browser_cancel=True);cancelled_request(browser,url,native=False)
                    early_cancel(browser,url)
                    rejected_response(browser,url);previous_worker_recovery(browser,url)
                    quota_startup_error(browser,url)
                    previous_client_upgrade(browser,url,old_root);missing_state_native(browser,url)
                    completed_native_update_recovery(browser,url,native_old_root)
                    cancel_completed_update_recovery(browser,url)
                    no_completed_cache_downgrade(browser,url)
                    dialog_states(browser,url)
                    full_course_native(browser,Handler.roots['two'])
                finally:browser.close()
        finally:
            if Handler.pause:Handler.pause.set()
            server.shutdown()

if __name__=='__main__':main()
