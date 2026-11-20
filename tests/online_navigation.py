# Copyright © 2026 Christopher Snow.
"""Fresh online pages, stable open editors and an independently saved offline copy."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread,Event
from http.server import ThreadingHTTPServer
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright,expect
from offline_background import Handler,fixture,launch,open_page,rpc,until,payload_requests
from app_status import manual_check

ROOT=Path(__file__).resolve().parents[1]
RESULTS=ROOT/'test-results/online-navigation';RESULTS.mkdir(exist_ok=True)

def version(page,name):
    expect(page.locator('html')).to_have_attribute('data-test-release',name,timeout=20000)
    frame=page.frame_locator('iframe')
    expect(frame.locator('html')).to_have_attribute('data-test-release',name)
    expect(frame.locator('html')).to_have_attribute('data-executed-version',name)
    release=page.locator('meta[name="gpu-release"]').get_attribute('content')
    assert 'gpu-release='+release in page.locator('iframe').get_attribute('src')
    return release

def online_cases(browser,url,saved):
    Handler.revision='one';Handler.requests=[];Handler.pause=None
    with browser.new_context(viewport={'width':390,'height':1000},color_scheme='dark') as context:
        context.add_init_script("Object.defineProperty(ServiceWorkerRegistration.prototype,'backgroundFetch',{get:()=>undefined})")
        old=open_page(context,url);one=version(old,'one')
        if saved:
            old.locator('#download-update').click()
            expect(old.locator('#offline-status')).to_have_text('Downloaded and ready to use offline.',timeout=30000)
        old.locator('#app-status-close').click();old.locator('#draft').fill('keep my edits')
        old.frame_locator('iframe').locator('#frame-draft').fill('keep editor state')
        before=payload_requests();Handler.revision='two'
        fresh=context.new_page();fresh.goto(url);two=version(fresh,'two')
        assert one!=two;version(old,'one')
        fresh.locator('#app-status-open').click()
        expect(fresh.locator('#version-status')).to_have_text('Up to date online. The offline copy is a different version.' if saved else 'Up to date online. Not saved for offline use.')
        assert rpc(fresh,'STATUS')['active']==one
        until(lambda:rpc(fresh,'STATUS').get('visited')==two)
        assert payload_requests()==before,'Online navigation must not download an unvisited course payload'
        if saved:
            # Simulate a removed immutable file. The identical live entry module
            # must retain its release context for a version-specific dependency.
            module=Handler.roots['two']/'releases'/two/'src/frame-version.mjs'
            unavailable=module.with_suffix('.unavailable');module.rename(unavailable)
            try:
                fresh.evaluate('''async id=>{const base=new URL('./',location.href),cache=await caches.open('gpu-lab:'+base.href+':release-'+id);await cache.delete(new URL('src/frame-version.mjs',base));}''',two)
                fresh.locator('iframe').evaluate('f=>new Promise(resolve=>{f.addEventListener("load",()=>resolve(),{once:true});f.contentWindow.location.reload()})')
                version(fresh,'two')
            finally:unavailable.rename(module)
        fresh.screenshot(path=str(RESULTS/f'online-two-saved-{saved}.png'))
        if saved:
            for width in [390,820,1440]:
                for theme in ['light','dark']:
                    fresh.set_viewport_size({'width':width,'height':1000})
                    fresh.evaluate('theme=>document.documentElement.dataset.theme=theme',theme)
                    assert fresh.evaluate('document.documentElement.scrollWidth<=innerWidth')
                    expect(fresh.get_by_role('button',name='Update offline copy',exact=True)).to_have_count(1)
                    fresh.screenshot(path=str(RESULTS/f'online-offline-copy-{width}-{theme}.png'))
            fresh.set_viewport_size({'width':390,'height':1000})
        old.reload();version(old,'two')
        expect(old.locator('#draft')).to_have_value('keep my edits')
        expect(old.frame_locator('iframe').locator('#frame-draft')).to_have_value('keep editor state')
        assert payload_requests()==before
        if saved:
            context.set_offline(True);fresh.reload();version(fresh,'one')
            expect(fresh.locator('#draft')).to_have_value('keep my edits')
            fresh.screenshot(path=str(RESULTS/'offline-one.png'))
            context.set_offline(False);fresh.goto(url);version(fresh,'two')
            # Neither an ordinary visit nor a newer-version check replaces the
            # saved release. Update remains explicit and Restart remains guarded.
            Handler.revision='three';old.locator('#app-status-open').click();manual_check(old)
            expect(old.locator('#version-status')).to_have_text('Update available')
            old.locator('#download-update').click()
            expect(old.locator('#restart-update')).to_be_visible(timeout=30000)
            prepared=rpc(old,'STATUS')['pending']
            Handler.revision='two' # The host now differs from the prepared three.
            fresh.locator('#app-status-open').click();manual_check(fresh)
            expect(fresh.locator('#restart-update')).to_be_hidden()
            expect(fresh.get_by_role('button',name='Update offline copy',exact=True)).to_be_visible()
            expect(fresh.locator('#version-status')).to_have_text('Up to date online. The offline copy is a different version.')
            old.locator('#restart-update').click();version(old,'three');version(fresh,'three')
            assert rpc(old,'STATUS')['active']==prepared
            old.reload();version(old,'two')
            expect(old.frame_locator('iframe').locator('#frame-draft')).to_have_value('keep editor state')
            assert rpc(old,'STATUS')['active']==prepared,'Reading online must not downgrade the saved offline version'
        print(f'PASS online latest without full download; open parent/editor stable; reload restores edits; saved offline copy={saved}',flush=True)

def installed_worker(browser,url):
    Handler.revision='one';Handler.previous_native_worker=True;Handler.requests=[]
    with browser.new_context() as context:
        context.add_init_script("Object.defineProperty(ServiceWorkerRegistration.prototype,'backgroundFetch',{get:()=>undefined})")
        old=open_page(context,url);one=version(old,'one');old.locator('#download-update').click()
        expect(old.locator('#offline-status')).to_have_text('Downloaded and ready to use offline.',timeout=30000)
        Handler.previous_native_worker=False;Handler.revision='two'
        old.evaluate('async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()}')
        until(lambda:old.evaluate('async()=>Boolean((await navigator.serviceWorker.getRegistration()).waiting)'),timeout=30)
        # Observe registration outside the app scope so the observer cannot keep
        # the former worker alive. A CSS document executes no application code.
        observer=context.new_page();observer.goto(urlsplit(url)._replace(path='/src/style.css').geturl())
        old.close()
        until(lambda:observer.evaluate('''async()=>{const r=await navigator.serviceWorker.getRegistration('/gpu-lab/');return r&&!r.waiting&&r.active?.state==='activated'}'''),timeout=30)
        before=payload_requests();fresh=context.new_page();fresh.goto(url);version(fresh,'two')
        fresh.locator('#app-status-open').click();assert rpc(fresh,'STATUS')['active']==one
        assert payload_requests()==before,'Installing the navigation fix does not consent to another course download'
        print('PASS installed former worker activates after its tabs close; next online visit is fresh and prior offline copy remains saved',flush=True)
    Handler.previous_native_worker=False

def recognition_after_busy_startup(browser,url):
    Handler.revision='one';Handler.pause=None;Handler.requests=[]
    with browser.new_context() as context:
        context.add_init_script("Object.defineProperty(ServiceWorkerRegistration.prototype,'backgroundFetch',{get:()=>undefined})")
        old=open_page(context,url);old.locator('#download-update').click()
        expect(old.locator('#offline-status')).to_have_text('Downloaded and ready to use offline.',timeout=30000)
        release=json.loads((Handler.roots['one']/'release.json').read_text());job_id=rpc(old,'STATUS')['download']['id']
        Handler.pause=Event();before=payload_requests()
        old.evaluate('''async release=>{
            const base=new URL('./',location.href),meta=await caches.open('gpu-lab:'+base.href+':status-v1'),key=new URL('__app_status_state__',base),state=await(await meta.match(key)).json();
            state.saved=false;await meta.put(key,new Response(JSON.stringify(state)));
            await(await caches.open('gpu-lab:'+base.href+':release-'+release.id)).delete(new URL('zz-payload.bin',base));
            self.retentionFinished=false;
            const r=await navigator.serviceWorker.ready,c=new MessageChannel();
            c.port1.onmessage=({data})=>{if(!data.progress){self.retentionFinished=true;self.retentionError=data.error;}};
            r.active.postMessage({type:'REMEMBER_PAGE',release,paths:['zz-payload.bin'],running:release.id},[c.port2]);
        }''',release)
        until(lambda:payload_requests()>before)
        Handler.fail_metadata=True
        try:
            reopened=open_page(context,url)
            assert rpc(reopened,'STATUS')['busy'],'The recognition test must meet a genuinely busy worker'
            Handler.pause.set();Handler.pause=None
            expect(reopened.locator('#offline-status')).to_have_text('Downloaded and ready to use offline.',timeout=30000)
            until(lambda:old.evaluate('self.retentionFinished'))
            assert not old.evaluate('self.retentionError')
            assert rpc(reopened,'STATUS')['download']['id']==job_id
            assert payload_requests()==before+1,'Recognition verifies the completed cache; it cannot fetch the course again'
            print('PASS complete-copy recognition retries after busy startup with unavailable metadata; no new download or consent',flush=True)
        finally:
            Handler.fail_metadata=False
            if Handler.pause:Handler.pause.set();Handler.pause=None

def explicit_update_during_retention(browser,url):
    for native in [False,True]:
        Handler.revision='one';Handler.pause=None;Handler.requests=[]
        with browser.new_context() as context:
            if not native:context.add_init_script("Object.defineProperty(ServiceWorkerRegistration.prototype,'backgroundFetch',{get:()=>undefined})")
            old=open_page(context,url);old.locator('#download-update').click()
            expect(old.locator('#offline-status')).to_have_text('Downloaded and ready to use offline.',timeout=30000)
            one=rpc(old,'STATUS')['active'];Handler.revision='two';manual_check(old)
            expect(old.locator('#version-status')).to_have_text('Update available')
            release=json.loads((Handler.roots['two']/'release.json').read_text());Handler.pause=Event();before=payload_requests()
            try:
                old.evaluate('''async release=>{
                    const r=await navigator.serviceWorker.ready,c=new MessageChannel();
                    self.retentionDone=false;c.port1.onmessage=()=>self.retentionDone=true;
                    r.active.postMessage({type:'REMEMBER_PAGE',release,paths:['zz-payload.bin'],running:document.querySelector('meta[name="gpu-release"]').content},[c.port2]);
                }''',release)
                until(lambda:payload_requests()>before)
                old.locator('#download-update').click()
                expect(old.locator('#download-progress')).to_be_visible()
                first='releases/'+release['id']+'/'+release['files'][0]['path']
                until(lambda:first in Handler.requests,timeout=10)
                expect(old.locator('#app-status-error')).to_be_empty()
                Handler.pause.set();Handler.pause=None
                expect(old.locator('#restart-update')).to_be_visible(timeout=30000)
                state=rpc(old,'STATUS');assert state['active']==one and state['pending']==release['id'] and state['pendingReady']
                assert state['download']['state']=='ready'
                until(lambda:old.evaluate('self.retentionDone'))
            finally:
                if Handler.pause:Handler.pause.set();Handler.pause=None
        print(f'PASS explicit update pre-empts optional visited-page retention; saved copy unchanged; native={native}',flush=True)

if __name__=='__main__':
    with TemporaryDirectory(prefix='gpu-online-navigation-') as tmp:
        Handler.roots={name:fixture(Path(tmp),name,embed=True) for name in ['one','two','three']}
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/gpu-lab/index.html'
        try:
            with sync_playwright() as p:
                browser=launch(p)
                try:
                    online_cases(browser,url,False);online_cases(browser,url,True);recognition_after_busy_startup(browser,url);explicit_update_during_retention(browser,url);installed_worker(browser,url)
                finally:browser.close()
        finally:server.shutdown()
