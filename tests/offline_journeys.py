# Copyright © 2026 Christopher Snow.
"""Learner journeys through online reading, offline saving and recovery.

Uses independently built real releases, workers, CacheStorage and HTTP. Existing
offline/background suites cover the production compiler, quota, native page
closure, cold profiles and older-client migration.
"""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread,Event
from http.server import ThreadingHTTPServer
from playwright.sync_api import sync_playwright,expect
from offline_background import Handler,fixture,launch,open_page,rpc,until,payload_requests
from app_status import manual_check

ROOT=Path(__file__).resolve().parents[1]
RESULTS=ROOT/'test-results/offline-journeys';RESULTS.mkdir(parents=True,exist_ok=True)
UNSAVED='Up to date online. Not saved for offline use.'

def start(browser,url,width=390,theme='dark'):
    Handler.revision='one';Handler.unreachable=False;Handler.fail_metadata=False;Handler.pause=None;Handler.pause_path='zz-payload.bin';Handler.requests=[]
    context=browser.new_context(viewport={'width':width,'height':1000},color_scheme=theme)
    context.add_init_script("""Object.defineProperty(ServiceWorkerRegistration.prototype,'backgroundFetch',{get:()=>undefined});
        self.persistRequests=0;const persist=navigator.storage.persist.bind(navigator.storage);
        navigator.storage.persist=()=>{++self.persistRequests;return persist()};""")
    page=open_page(context,url)
    page.evaluate('theme=>{document.documentElement.dataset.theme=theme;localStorage.setItem("gpu-lab-theme",theme)}',theme)
    until(lambda:rpc(page,'STATUS').get('visited')==page.locator('meta[name="gpu-release"]').get_attribute('content'))
    return context,page

def offline(context,value):
    Handler.unreachable=value;context.set_offline(value)

def save(page):
    before=page.evaluate('self.persistRequests')
    page.locator('#download-update').click()
    expect(page.locator('#offline-status')).to_have_text('Downloaded and ready to use offline.',timeout=30000)
    expect(page.locator('#download-update')).to_be_hidden()
    assert page.evaluate('self.persistRequests')==before+1

def close_panel(page):
    if page.locator('#app-status-dialog').is_visible():page.keyboard.press('Escape')

def next_page(page):
    with page.expect_navigation() as result:page.get_by_role('link',name='Next lesson',exact=True).click()
    return result.value

def no_saved_copy(browser,url):
    for width in [390,820,1440]:
        for theme in ['light','dark']:
            context,page=start(browser,url,width,theme)
            try:
                expect(page.locator('#version-status')).to_have_text(UNSAVED)
                expect(page.get_by_role('button',name='Save offline copy',exact=True)).to_be_enabled()
                expect(page.locator('#course-ready-icon')).to_be_hidden()
                page.locator('#app-status-details > summary').click()
                expect(page.locator('#remove-offline')).to_have_text('Clear saved files')
                expect(page.locator('#release-detail')).to_contain_text('Offline copy size:')
                assert 'Complete download:' not in page.locator('#release-detail').inner_text()
                assert 'MiB' not in page.locator('#release-detail').inner_text()
                page.locator('#app-status-details > summary').click()
                page.screenshot(path=str(RESULTS/f'unsaved-{width}-{theme}.png'))
                close_panel(page);page.locator('#draft').fill('keep my lesson work')
                page.frame_locator('iframe').locator('#frame-draft').fill('keep my editor work')
                offline(context,True);page.locator('#app-status-open').click()
                expect(page.locator('#offline-status')).to_be_visible()
                expect(page.locator('#offline-status')).to_have_text('Not downloaded for offline use')
                page.screenshot(path=str(RESULTS/f'offline-status-{width}-{theme}.png'))
                close_panel(page);response=next_page(page)
                assert response.status==503
                expect(page.locator('h1')).to_have_text('This lesson isn’t saved offline')
                expect(page.locator('.instruction')).to_contain_text('Choose Save offline copy')
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                page.screenshot(path=str(RESULTS/f'unsaved-next-{width}-{theme}.png'))
                page.locator('#recovery-back').focus();page.keyboard.press('Enter')
                expect(page.locator('#draft')).to_have_value('keep my lesson work')
                expect(page.frame_locator('iframe').locator('#frame-draft')).to_have_value('keep my editor work')
                response=next_page(page);assert response.status==503
                offline(context,False)
                with page.expect_navigation() as result:page.get_by_role('link',name='Try again',exact=True).click()
                assert result.value.ok
                expect(page.locator('h1')).to_have_text('Next lesson')
                page.get_by_role('link',name='Previous lesson',exact=True).click()
                expect(page.locator('#draft')).to_have_value('keep my lesson work')
                expect(page.frame_locator('iframe').locator('#frame-draft')).to_have_value('keep my editor work')
                page.locator('#app-status-open').click();expect(page.locator('#version-status')).to_have_text(UNSAVED)
                assert payload_requests()==0,'Reading/reconnecting must never consent to a course download'
                assert page.evaluate('self.persistRequests')==0
            finally:offline(context,False);context.close()
    print('PASS unsaved/reconnect/Next/Back/retry: explicit availability, retained edits and six layouts/themes; no automatic download',flush=True)

def interrupted_save(browser,url):
    context,page=start(browser,url)
    try:
        Handler.pause_path='next.html';Handler.pause=Event()
        page.locator('#download-update').click()
        until(lambda:any(path.endswith('/next.html') for path in Handler.requests))
        page.locator('#cancel-download').focus();page.keyboard.press('Enter')
        expect(page.locator('#download-update')).to_be_visible(timeout=30000)
        Handler.pause.set();Handler.pause=None
        expect(page.locator('#download-update')).to_have_text('Save offline copy')
        expect(page.locator('#course-ready-icon')).to_be_hidden()
        expect(page.locator('#version-status')).to_contain_text('incomplete')
        first=next(path for path in Handler.requests if path.endswith('/assets/apple-touch-icon.png'))
        before=Handler.requests.count(first)
        close_panel(page);offline(context,True);assert next_page(page).status==503
        expect(page.locator('h1')).to_have_text('This lesson isn’t saved offline')
        page.locator('#recovery-back').click();offline(context,False)
        page.locator('#app-status-open').click();expect(page.locator('#download-update')).to_be_enabled();save(page)
        assert Handler.requests.count(first)==before,'Resuming must keep verified partial files'
        close_panel(page);offline(context,True);assert next_page(page).ok
        expect(page.locator('h1')).to_have_text('Next lesson');assert page.reload().ok
        companion=context.new_page();assert companion.goto(url.replace('index.html','next.html')).ok
    finally:
        if Handler.pause:Handler.pause.set();Handler.pause=None
        Handler.pause_path='zz-payload.bin';offline(context,False);context.close()
    print('PASS cancellation before Next is saved, offline recovery, keyboard resume without redownloading verified files, reload and second tab',flush=True)

def missing_saved_lesson(browser,url):
    for corrupt in [False,True]:
        context,page=start(browser,url)
        try:
            save(page);close_panel(page);page.locator('#draft').fill('work survives repair')
            page.evaluate('''async corrupt=>{
                const base=new URL('./',location.href),id=document.querySelector('meta[name="gpu-release"]').content;
                const cache=await caches.open('gpu-lab:'+base.href+':release-'+id),path=new URL('next.html',base);
                if(corrupt)await cache.put(path,new Response('damaged saved HTML'));else await cache.delete(path);
            }''',corrupt)
            offline(context,True);assert next_page(page).status==503
            expect(page.locator('h1')).to_have_text('This offline copy needs repair')
            page.screenshot(path=str(RESULTS/f'repair-{corrupt}.png'))
            page.locator('#recovery-back').click();expect(page.locator('#draft')).to_have_value('work survives repair')
            offline(context,False);page.locator('#app-status-open').click()
            try:expect(page.get_by_role('button',name='Repair offline copy',exact=True)).to_be_enabled()
            except AssertionError:
                state=rpc(page,'STATUS')
                print('Repair diagnostics:',corrupt,page.locator('#version-status').inner_text(),page.locator('#app-status-error').inner_text(),page.locator('#download-update').text_content(),{key:state.get(key) for key in ['active','saved','offlineReady','partial','pending','busy']},Handler.requests[-12:],flush=True)
                raise
            expect(page.locator('#course-ready-icon')).to_be_hidden();save(page)
            close_panel(page);offline(context,True);assert next_page(page).ok
            expect(page.locator('h1')).to_have_text('Next lesson')
        finally:offline(context,False);context.close()
    print('PASS missing/corrupt saved lesson: honest readiness, usable recovery and explicit repair without losing edits',flush=True)

def pending_copy_and_multiple_windows(browser,url):
    context,page=start(browser,url)
    try:
        close_panel(page);page.locator('#draft').fill('draft before restart')
        page.frame_locator('iframe').locator('#frame-draft').fill('editor before restart')
        Handler.revision='two';page.locator('#app-status-open').click();manual_check(page)
        expect(page.locator('#download-update')).to_have_text('Save offline copy')
        page.locator('#download-update').click();expect(page.locator('#restart-update')).to_be_visible(timeout=30000)
        old=page.locator('meta[name="gpu-release"]').get_attribute('content')
        offline(context,True)
        recovery=context.new_page();response=recovery.goto(url.replace('index.html','next.html'),referer=url)
        assert response.status==503;expect(recovery.locator('h1')).to_have_text('Your saved update is ready')
        expect(recovery.locator('.instruction')).to_contain_text('Choose Restart to update')
        recovery.screenshot(path=str(RESULTS/'pending-restart.png'))
        page.locator('#restart-update').click()
        expect(page.locator('html')).to_have_attribute('data-test-release','two',timeout=30000)
        expect(recovery.locator('h1')).to_have_text('Next lesson')
        expect(recovery.locator('html')).to_have_attribute('data-test-release','two')
        expect(page.locator('#draft')).to_have_value('draft before restart')
        expect(page.frame_locator('iframe').locator('#frame-draft')).to_have_value('editor before restart')
        assert rpc(page,'STATUS')['active']!=old
    finally:offline(context,False);context.close()
    print('PASS saved pending first copy opens offline through guarded restart; a recovery tab participates and both windows retain work',flush=True)

def newer_online_with_saved_copy(browser,url):
    context,page=start(browser,url)
    try:
        save(page);close_panel(page);old=rpc(page,'STATUS')['active'];before=payload_requests()
        Handler.revision='two';fresh=context.new_page();fresh.goto(url)
        expect(fresh.locator('html')).to_have_attribute('data-test-release','two')
        fresh.frame_locator('iframe').locator('#frame-draft').fill('edited while reading online')
        fresh.locator('#app-status-open').click()
        expect(fresh.locator('#version-status')).to_have_text('Up to date online. The offline copy is a different version.')
        expect(fresh.get_by_role('button',name='Update offline copy',exact=True)).to_be_enabled()
        expect(fresh.locator('#offline-size')).to_contain_text('Your saved offline copy remains available.')
        offline(context,True)
        expect(fresh.locator('#offline-status')).to_be_visible()
        expect(fresh.locator('#offline-status')).to_have_text('A different version is saved and ready to use offline.')
        close_panel(fresh);assert next_page(fresh).ok
        expect(fresh.locator('html')).to_have_attribute('data-test-release','one')
        fresh.get_by_role('link',name='Previous lesson',exact=True).click()
        expect(fresh.frame_locator('iframe').locator('#frame-draft')).to_have_value('edited while reading online')
        offline(context,False);fresh.reload()
        expect(fresh.locator('html')).to_have_attribute('data-test-release','two')
        expect(fresh.frame_locator('iframe').locator('#frame-draft')).to_have_value('edited while reading online')
        fresh.locator('#draft').fill('keep page work when opening status')
        fresh.goto(url+'?download=1');expect(fresh.locator('#app-status-dialog')).to_be_visible()
        expect(fresh.locator('#draft')).to_have_value('keep page work when opening status')
        expect(fresh.frame_locator('iframe').locator('#frame-draft')).to_have_value('edited while reading online')
        assert 'download=' not in fresh.url
        assert rpc(fresh,'STATUS')['active']==old and payload_requests()==before
        expect(page.locator('html')).to_have_attribute('data-test-release','one')
    finally:offline(context,False);context.close()
    print('PASS newer online lesson → saved older Next/Back offline → latest online again; no automatic update, stable other tab and retained editor work',flush=True)

def unavailable_metadata(browser,url):
    Handler.revision='one';Handler.unreachable=False;Handler.fail_metadata=True;Handler.pause=None;Handler.requests=[]
    context=browser.new_context(viewport={'width':390,'height':1000})
    context.add_init_script("Object.defineProperty(ServiceWorkerRegistration.prototype,'backgroundFetch',{get:()=>undefined})")
    try:
        page=context.new_page();page.goto(url);page.wait_for_function('navigator.serviceWorker.controller!==null')
        page.locator('#app-status-open').click()
        expect(page.locator('#version-status')).to_have_text('Couldn’t check for updates')
        expect(page.locator('#download-update')).to_be_hidden();expect(page.locator('#retry-update')).to_be_visible()
        close_panel(page);page.locator('#draft').fill('work during metadata outage')
        offline(context,True);assert next_page(page).status==503
        expect(page.locator('h1')).to_have_text('This lesson isn’t saved offline')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        Handler.fail_metadata=False;offline(context,False)
        with page.expect_navigation() as result:page.get_by_role('link',name='Try again',exact=True).click()
        assert result.value.ok
        page.get_by_role('link',name='Previous lesson',exact=True).click()
        expect(page.locator('#draft')).to_have_value('work during metadata outage')
        page.locator('#app-status-open').click();expect(page.locator('#version-status')).to_have_text(UNSAVED)
        expect(page.get_by_role('button',name='Save offline copy',exact=True)).to_be_enabled()
        assert payload_requests()==0
    finally:Handler.fail_metadata=False;offline(context,False);context.close()
    print('PASS unavailable metadata blocks saving honestly; asset-independent recovery and reconnect keep reading/editing possible without a download',flush=True)

if __name__=='__main__':
    with TemporaryDirectory(prefix='gpu-offline-journeys-') as tmp:
        Handler.roots={name:fixture(Path(tmp),name,embed=True) for name in ['one','two']}
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start()
        url=f'http://127.0.0.1:{server.server_port}/gpu-lab/index.html'
        try:
            with sync_playwright() as p:
                browser=launch(p)
                try:
                    no_saved_copy(browser,url);interrupted_save(browser,url);missing_saved_lesson(browser,url);pending_copy_and_multiple_windows(browser,url);newer_online_with_saved_copy(browser,url);unavailable_metadata(browser,url)
                finally:browser.close()
        finally:server.shutdown()
