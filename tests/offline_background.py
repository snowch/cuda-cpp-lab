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
    revision='one';roots={};requests=[];pause=None;corrupt=False
    def log_message(self,*args):pass
    def do_GET(self):
        path=unquote(urlsplit(self.path).path).removeprefix('/gpu-lab/').lstrip('/') or 'index.html'
        if path.endswith('/'):path+='index.html'
        root=self.roots[self.revision]
        if path.startswith('releases/'):
            root=next((p for p in self.roots.values() if (p/path).is_file()),root)
        file=(root/path).resolve()
        if not file.is_relative_to(root) or not file.is_file():self.send_error(404);return
        self.requests.append(path);data=file.read_bytes()
        if self.corrupt and path.endswith('zz-payload.bin'):data=b'bad'+data[3:]
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
    binary=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
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
        page.close();Handler.pause.set()
        page=c.new_page();page.goto(url);page.wait_for_function('navigator.serviceWorker.controller!==null')
        page.locator('#app-status-open').click();expect(page.locator('#offline-status')).to_have_text('Available offline',timeout=30000)
        assert page.locator('#draft').input_value()=='learner work retained';assert job(page)['state']=='ready'
        page.screenshot(path=str(RESULTS/'native-after-page-close.png'))
    Handler.pause=None;print('PASS native Background Fetch completes across page closure; drafts retained; no unsolicited download',flush=True)

def fallback_resume(browser,url):
    Handler.revision='one';Handler.requests=[];Handler.pause=None
    with browser.new_context(viewport={'width':390,'height':844}) as c:
        c.add_init_script("Object.defineProperty(ServiceWorkerRegistration.prototype,'backgroundFetch',{get:()=>undefined})")
        page=open_page(c,url);page.locator('#save-offline').click();expect(page.locator('#offline-status')).to_have_text('Available offline',timeout=30000)
        page.locator('#app-status-close').click();page.locator('#draft').fill('saved during update');page.locator('#app-status-open').click();Handler.revision='two';Handler.pause=Event();page.locator('#check-update').click();expect(page.locator('#download-update')).to_be_visible();page.locator('#download-update').click()
        until(lambda:payload_requests()>=2)
        current=job(page);assert current['wanted'] and current['bytes']>0
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

def main():
    with TemporaryDirectory(prefix='gpu-download-lifecycle-') as tmp:
        Handler.roots={name:fixture(Path(tmp),name) for name in ['one','two']}
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/gpu-lab/'
        try:
            with sync_playwright() as p:
                browser=launch(p)
                try:native_closed_page(browser,url);fallback_resume(browser,url)
                finally:browser.close()
        finally:
            if Handler.pause:Handler.pause.set()
            server.shutdown()

if __name__=='__main__':main()
