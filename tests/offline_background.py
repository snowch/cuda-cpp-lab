# Copyright © 2026 Christopher Snow.
"""Small real-release lifecycle checks, including native Background Fetch.

Uses the production builder, worker, UI and CacheStorage. Mobile OS suspension
is not emulated: page closure and worker termination are tested in Chromium.
"""
import json,os,shutil,subprocess,time
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Event,Thread
from urllib.parse import unquote,urlsplit
from playwright.sync_api import sync_playwright,expect

ROOT=Path(__file__).resolve().parents[1]
RESULTS=ROOT/'test-results/background-updates';RESULTS.mkdir(parents=True,exist_ok=True)
class Handler(BaseHTTPRequestHandler):
    revision='one';roots={};requests=[];pause=None;corrupt=False;previous_worker=False
    def log_message(self,*args):pass
    def do_GET(self):
        path=unquote(urlsplit(self.path).path).removeprefix('/gpu-lab/').lstrip('/') or 'index.html'
        if path.endswith('/'):path+='index.html'
        root=self.roots[self.revision]
        if path.startswith('releases/'):
            root=next((p for p in self.roots.values() if (p/path).is_file()),root)
        file=(root/path).resolve()
        if not file.is_relative_to(root) or not file.is_file():self.send_error(404);return
        self.requests.append(path);data=(ROOT/'tests/fixtures/previous-download-worker.js').read_bytes() if path=='sw.js' and self.previous_worker else file.read_bytes()
        if self.corrupt and path.endswith(self.corrupt):data=b'bad'+data[3:]
        mime={'.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.html':'text/html'}.get(file.suffix,'application/octet-stream')
        self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(data)));self.end_headers()
        pause=self.pause
        if pause and path.endswith('zz-payload.bin'):pause.wait(12)
        try:self.wfile.write(data)
        except (BrokenPipeError,ConnectionResetError):pass

def fixture(temp,name):
    folder=temp/name;folder.mkdir();(folder/'src').mkdir();(folder/'assets').mkdir()
    for module in ['offline.mjs','experiment-state.mjs','release-metadata.mjs','release-contract.mjs','install.mjs','style.css']:
        shutil.copy2(ROOT/'src'/module,folder/'src'/module)
    shutil.copytree(ROOT/'assets/fonts',folder/'assets/fonts')
    for icon in ['icon.svg','icon-192.png','icon-512.png','apple-touch-icon.png']:shutil.copy2(ROOT/'assets'/icon,folder/'assets'/icon)
    shutil.copy2(ROOT/'manifest.webmanifest',folder/'manifest.webmanifest')
    (folder/'zz-payload.bin').write_bytes((b'one' if name=='one' else b'two')*350000)
    (folder/'index.html').write_text(f'''<!doctype html><html lang="en-GB" data-test-release="{name}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="./src/style.css"><title>GPU Lab lifecycle test</title></head><body><header class="topbar"><a class="brand" href="./">GPU Lab</a><div class="top-actions"></div></header><main><h1>Course {name}</h1><label for="draft">Saved learner draft</label><input id="draft" value="7"><p>The current lesson stays open while an update downloads.</p></main><footer><span class="build-info"><a href="#">{name}</a></span></footer><script>const d=document.querySelector('#draft');d.value=localStorage.getItem('fixture-draft')||d.value;d.addEventListener('input',()=>localStorage.setItem('fixture-draft',d.value));</script></body></html>''')
    subprocess.run(['node','--input-type=module','-e',"import {buildOffline} from './scripts/offline.mjs';await buildOffline(process.argv[1]);",str(folder)],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
    return folder

def launch(p):
    binary=os.environ.get('CHROMIUM_PATH')
    return p.chromium.launch(**({'executable_path':binary} if binary else {'channel':'chromium'}))

def open_page(context,url):
    page=context.new_page();page.goto(url);page.wait_for_function('navigator.serviceWorker.controller!==null')
    page.locator('#app-status-open').click();expect(page.locator('#save-offline')).to_be_enabled();return page

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
        page.locator('#app-status-close').click();page.locator('#draft').fill('learner work retained');expect(page.locator('#draft')).to_have_value('learner work retained');page.locator('#app-status-open').click();page.locator('#save-offline').click();until(lambda:payload_requests()>0)
        page.wait_for_function("document.querySelector('#download-behaviour').textContent.includes('background')")
        page.screenshot(path=str(RESULTS/'native-downloading.png'));page.close();Handler.pause.set()
        page=c.new_page();page.goto(url);page.wait_for_function('navigator.serviceWorker.controller!==null')
        page.locator('#app-status-open').click();expect(page.locator('#offline-status')).to_have_text('Available offline',timeout=30000)
        assert page.locator('#draft').input_value()=='learner work retained';assert job(page)['state']=='ready'
        page.screenshot(path=str(RESULTS/'native-after-page-close.png'))
        page.close();page=c.new_page();page.goto(url+'?download=1');expect(page.locator('#app-status-dialog')).to_be_visible();assert 'download=' not in page.url
    Handler.pause=None;print('PASS native Background Fetch completes across page closure; drafts retained; no unsolicited download',flush=True)

def fallback_resume(browser,url):
    Handler.revision='one';Handler.requests=[];Handler.pause=None
    with browser.new_context(viewport={'width':390,'height':844}) as c:
        c.add_init_script("if(typeof ServiceWorkerRegistration!=='undefined')Object.defineProperty(ServiceWorkerRegistration.prototype,'backgroundFetch',{get:()=>undefined})")
        page=open_page(c,url);page.locator('#save-offline').click();expect(page.locator('#offline-status')).to_have_text('Available offline',timeout=30000)
        page.locator('#app-status-close').click();page.locator('#draft').fill('saved during update');page.locator('#app-status-open').click();Handler.revision='two';Handler.pause=Event();page.locator('#check-update').click();expect(page.locator('#download-update')).to_be_visible();page.locator('#download-update').click()
        until(lambda:payload_requests()>=2)
        current=job(page);assert current['wanted'] and current['bytes']>0
        page.screenshot(path=str(RESULTS/'fallback-downloading.png'))
        before=list(Handler.requests);session=c.new_cdp_session(page);session.send('ServiceWorker.enable');session.send('ServiceWorker.stopAllWorkers');page.close();Handler.pause.set();Handler.pause=None
        page=open_page(c,url);expect(page.locator('#version-status')).to_have_text('Update ready',timeout=30000)
        assert page.locator('html').get_attribute('data-test-release')=='one','A finished download must not reload the learner.'
        assert page.locator('#draft').input_value()=='saved during update'
        resumed=Handler.requests[len(before):]
        assert sum(p.endswith('zz-payload.bin') for p in resumed)==1
        assert not any(p.endswith('/src/style.css') for p in resumed),'Completed verified files must be reused.'
        page.screenshot(path=str(RESULTS/'fallback-resumed-ready.png'))
        page.locator('#restart-update').click();expect(page.locator('html')).to_have_attribute('data-test-release','two');expect(page.locator('#draft')).to_have_value('saved during update')
    print('PASS unsupported-browser fallback resumes after worker termination, reuses verified files and waits for explicit restart',flush=True)


def cancelled_request(browser,url,native=True,browser_cancel=False):
    Handler.revision='one';Handler.requests=[];Handler.pause=None;Handler.corrupt=False
    with browser.new_context(viewport={'width':390,'height':844}) as c:
        if not native:c.add_init_script("if(typeof ServiceWorkerRegistration!=='undefined')Object.defineProperty(ServiceWorkerRegistration.prototype,'backgroundFetch',{get:()=>undefined})")
        page=open_page(c,url);page.locator('#save-offline').click();expect(page.locator('#offline-status')).to_have_text('Available offline',timeout=30000)
        Handler.revision='two';Handler.pause=Event();page.locator('#check-update').click();expect(page.locator('#download-update')).to_be_visible();page.locator('#download-update').click();until(lambda:payload_requests()>=2)
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
        assert not job(page)['wanted'];assert page.locator('html').get_attribute('data-test-release')=='one'
        if native and not browser_cancel:page.screenshot(path=str(RESULTS/'cancelled-update.png'))
        page.locator('#download-update').click();expect(page.locator('#version-status')).to_have_text('Update ready',timeout=30000)
        assert page.locator('html').get_attribute('data-test-release')=='one'
    print(f'PASS Cancel survives reopening: {"native" if native else "fallback"}, {"browser control" if browser_cancel else "app control"}; explicit resume succeeds',flush=True)


def rejected_response(browser,url):
    Handler.revision='one';Handler.requests=[];Handler.pause=None;Handler.corrupt=False
    with browser.new_context(viewport={'width':820,'height':1100},color_scheme='dark') as c:
        page=open_page(c,url);page.locator('#save-offline').click();expect(page.locator('#offline-status')).to_have_text('Available offline',timeout=30000)
        Handler.revision='two';Handler.corrupt='src/install.mjs';page.locator('#check-update').click();expect(page.locator('#download-update')).to_be_visible();page.locator('#download-update').click()
        expect(page.locator('#app-status-error')).to_contain_text('did not match the release',timeout=30000)
        assert not job(page)['wanted'];assert not rpc(page,'STATUS')['pendingReady'];assert page.locator('html').get_attribute('data-test-release')=='one'
        expect(page.locator('#offline-status')).to_have_text('Available offline')
        assert page.locator('#app-status-error').evaluate("e=>e.parentElement.id==='update-download-feedback'")
        page.screenshot(path=str(RESULTS/'rejected-file.png'))
        count=payload_requests();Handler.corrupt=False;page.locator('#download-update').click();expect(page.locator('#version-status')).to_have_text('Update ready',timeout=30000)
        assert payload_requests()==count,'Valid files after a rejected response must remain cached, including the large payload.'
        page.screenshot(path=str(RESULTS/'verified-repair-ready.png'))
    print('PASS native hash rejection keeps the old course, never reports ready, and repairs only the rejected file',flush=True)


def previous_worker_recovery(browser,url):
    Handler.revision='one';Handler.requests=[];Handler.pause=None;Handler.corrupt=False;Handler.previous_worker=True
    with browser.new_context(viewport={'width':390,'height':844}) as c:
        c.add_init_script("if(typeof ServiceWorkerRegistration!=='undefined')Object.defineProperty(ServiceWorkerRegistration.prototype,'backgroundFetch',{get:()=>undefined})")
        page=open_page(c,url);assert rpc(page,'STATUS').get('downloadVersion') is None
        page.locator('#save-offline').click();expect(page.locator('#offline-status')).to_have_text('Available offline',timeout=30000)
        Handler.revision='two';Handler.pause=Event();page.locator('#check-update').click();expect(page.locator('#download-update')).to_be_visible();page.locator('#download-update').click();until(lambda:payload_requests()>=2)
        page.locator('#cancel-download').click()
        # Keep the body gated until the older worker has acknowledged Cancel.
        # Otherwise the server can win the abort race and legitimately leave a
        # complete cached file, so the next transfer would have nothing to fetch.
        until(lambda:not rpc(page,'STATUS')['busy'])
        Handler.pause.set();Handler.pause=None
        count=payload_requests();page.close();page=open_page(c,url);page.wait_for_timeout(200);assert payload_requests()==count
        Handler.pause=Event();page.locator('#download-update').click();until(lambda:payload_requests()>=count+1)
        Handler.previous_worker=False
        page.evaluate('async()=>{const r=await navigator.serviceWorker.ready;await r.update()}')
        page.wait_for_function('navigator.serviceWorker.getRegistration().then(r=>!!r.waiting)')
        session=c.new_cdp_session(page);session.send('ServiceWorker.enable');session.send('ServiceWorker.stopAllWorkers');page.close();Handler.pause.set();Handler.pause=None
        page=open_page(c,url);expect(page.locator('#version-status')).to_have_text('Update ready',timeout=30000)
        assert rpc(page,'STATUS')['downloadVersion']==1
        assert page.locator('html').get_attribute('data-test-release')=='one'
    Handler.previous_worker=False
    print('PASS an actual previous-production worker honours Cancel and hands a durable partial request to the naturally activated new worker',flush=True)

def full_course_native(browser,update_root):
    """Exercise the real production download, not only small lifecycle fixtures."""
    assert (ROOT/'dist/release.json').is_file(),'Build the course before this check.'
    Handler.roots={'one':ROOT/'dist','two':update_root};Handler.revision='one';Handler.requests=[]
    Handler.pause=None;Handler.corrupt=False;Handler.previous_worker=False
    server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
    Thread(target=server.serve_forever,daemon=True).start()
    url=f'http://127.0.0.1:{server.server_port}/gpu-lab/v2/first-kernel.html'
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
            page.locator('#save-offline').dblclick()
            try:page.wait_for_function("document.querySelector('#download-behaviour').textContent.includes('background')")
            except Exception:
                print('Full native startup diagnostics:',page.locator('#app-status-dialog').inner_text(),flush=True)
                print('Full native job:',job(page),flush=True)
                raise
            page.locator('#app-status-close').click()
            editor=page.frame_locator('[data-kernel-workbench="hello"]').locator('#source')
            draft=editor.input_value().replace('42.0f','7.0f');editor.fill(draft)
            page.close()
            page=c.new_page();page.goto(url);page.locator('#app-status-open').click()
            expect(page.locator('#offline-status')).to_have_text('Available offline',timeout=120000)
            expect(page.locator('#app-status-error')).to_be_empty()
            assert job(page)['state']=='ready'
            assert page.frame_locator('[data-kernel-workbench="hello"]').locator('#source').input_value()==draft
            page.screenshot(path=str(RESULTS/'full-course-native-ready.png'))
            c.set_offline(True);page.reload();page.locator('#app-status-open').click()
            expect(page.locator('#offline-status')).to_have_text('Available offline',timeout=30000)
            assert page.frame_locator('[data-kernel-workbench="hello"]').locator('#source').input_value()==draft
            # Cancellation must also release the page's request lock when its
            # existing complete cache contains every recording/compiler asset.
            c.set_offline(False);Handler.revision='two';Handler.pause=Event()
            page.evaluate("if(typeof ServiceWorkerRegistration!=='undefined')Object.defineProperty(ServiceWorkerRegistration.prototype,'backgroundFetch',{get:()=>undefined})")
            page.locator('#check-update').click();expect(page.locator('#download-update')).to_be_visible()
            before=payload_requests();page.locator('#download-update').click()
            until(lambda:payload_requests()>before)
            page.locator('#cancel-download').focus();page.locator('#cancel-download').press('Enter')
            expect(page.locator('#download-progress')).to_be_hidden()
            page.screenshot(path=str(RESULTS/'full-course-stopping.png'))
            until(lambda:not job(page)['wanted'] and not job(page)['busy'],timeout=30)
            Handler.pause.set();Handler.pause=None
            expect(page.locator('#download-update')).to_be_enabled(timeout=30000)
            expect(page.locator('#offline-status')).to_have_text('Available offline',timeout=30000)
    finally:server.shutdown()
    print('PASS the complete production course downloads across page closure, reopens offline with its CUDA draft, and releases Update after cancelling a replacement',flush=True)

def quota_startup_error(browser,url):
    Handler.revision='one';Handler.requests=[];Handler.pause=None;Handler.corrupt=False
    with browser.new_context() as c:
        c.add_init_script("if(typeof ServiceWorkerRegistration!=='undefined')Object.defineProperty(ServiceWorkerRegistration.prototype,'backgroundFetch',{get:()=>undefined})")
        page=open_page(c,url);page.locator('#save-offline').click()
        expect(page.locator('#offline-status')).to_have_text('Available offline',timeout=30000)
        assert job(page)['state']=='ready'
        Handler.revision='two';page.locator('#check-update').click()
        expect(page.locator('#download-update')).to_be_visible()
        cdp=c.new_cdp_session(page)
        cdp.send('Storage.overrideQuotaForOrigin',{'origin':url.removesuffix('/gpu-lab/'),'quotaSize':1})
        page.locator('#download-update').click()
        expect(page.locator('#app-status-error')).not_to_be_empty(timeout=30000)
        assert page.locator('#app-status-error').evaluate("e=>e.parentElement.id==='update-download-feedback'")
        assert page.locator('html').get_attribute('data-test-release')=='one'
        expect(page.locator('#offline-status')).to_have_text('Available offline')
        expect(page.locator('#restart-update')).to_be_hidden()
        cdp.send('Storage.overrideQuotaForOrigin',{'origin':url.removesuffix('/gpu-lab/')});cdp.detach()
        page.locator('#download-update').click()
        expect(page.locator('#version-status')).to_have_text('Update ready',timeout=30000)
        expect(page.locator('#app-status-error')).to_be_empty()
    print('PASS a new request reports real quota failure beside Update despite a previous completed job; the old course remains available and retry succeeds',flush=True)

def main():
    with TemporaryDirectory(prefix='gpu-download-lifecycle-') as tmp:
        Handler.roots={name:fixture(Path(tmp),name) for name in ['one','two']}
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/gpu-lab/'
        try:
            with sync_playwright() as p:
                browser=launch(p)
                try:
                    native_closed_page(browser,url);fallback_resume(browser,url)
                    cancelled_request(browser,url);cancelled_request(browser,url,browser_cancel=True);cancelled_request(browser,url,native=False)
                    rejected_response(browser,url);previous_worker_recovery(browser,url)
                    quota_startup_error(browser,url)
                    full_course_native(browser,Handler.roots['two'])
                finally:browser.close()
        finally:
            if Handler.pause:Handler.pause.set()
            server.shutdown()

if __name__=='__main__':main()
