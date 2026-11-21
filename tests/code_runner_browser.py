# Copyright © 2026 Christopher Snow.
"""Real WASM runs across lessons, history, stop/restart, idle release and versions."""
import json,time
from pathlib import Path
from playwright.sync_api import expect

def check_code_runner(browser,url,root):
    results=root/'test-results/code-runner';results.mkdir(parents=True,exist_ok=True)
    context=browser.new_context(viewport={'width':390,'height':1000},color_scheme='dark')
    page=context.new_page();errors=[];requests=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    context.on('request',lambda request:requests.append(request.url))
    page.clock.install()
    page.goto(url+'v2/first-kernel.html');origin=page.evaluate('window.__runnerDocumentToken=crypto.randomUUID()')
    frame=lambda:page.frame_locator('[data-kernel-workbench]')
    editor=lambda:frame().get_by_role('textbox',name='CUDA source')
    timings=[]
    def run(expected,label):
        expect(editor()).to_be_editable(timeout=30000)
        start=time.perf_counter();frame().get_by_role('button',name='Compile and run',exact=True).click()
        expect(frame().locator('#run')).to_be_enabled(timeout=120000)
        expect(frame().locator('#status')).to_have_attribute('data-error','false')
        expect(frame().locator('#program-output')).to_contain_text(expected)
        expect(page.locator('#code-runner-summary')).to_have_text('Ready')
        timings.append({'case':label,'seconds':round(time.perf_counter()-start,3)})
        print('PASS runner',label,timings[-1]['seconds'],flush=True)
    def navigate(slug):
        switcher=page.locator('[data-v2-course-switcher]')
        if not switcher.evaluate('e=>e.open'):switcher.locator(':scope>summary').click()
        link=switcher.locator('a[href$="/'+slug+'.html"]')
        part=link.locator('xpath=ancestor::details[contains(@class,"v2-course-part")]')
        if not part.evaluate('e=>e.open'):part.locator(':scope>summary').click()
        link.click();page.wait_for_url('**/'+slug+'.html')
        expect(editor()).to_be_editable(timeout=30000)
        assert page.evaluate('window.__runnerDocumentToken')==origin,'Warm navigation must retain the worker owner.'
    expect(editor()).to_be_editable();source=editor().input_value();edited=source.replace('42.0f','7.0f',1)
    run('42.0','first run')
    expect(frame().locator('#code-runner-intro')).to_contain_text('five idle minutes')
    frame().get_by_role('button',name='Code runner',exact=True).click()
    expect(page.locator('#code-runner-dialog')).to_be_visible()
    page.keyboard.press('Escape');expect(page.locator('#code-runner-open')).to_be_focused()
    editor().fill(edited);run('7.0','same lesson repeat')
    compiler_requests=lambda:len([r for r in requests if '/assets/v2-compiler/' in r])
    count=compiler_requests();assert count>0
    video=page.locator('video[data-recording]')
    video.evaluate('v=>{v.muted=true;v.load()}');expect(video).to_have_js_property('readyState',4,timeout=30000)
    video.evaluate('async v=>{v.currentTime=3;await v.play()}');page.evaluate('window.__outgoingRecording=document.querySelector("video[data-recording]")')
    page.locator('.v2-page-next').click();page.wait_for_url('**/one-thread-one-element.html')
    assert page.evaluate('window.__runnerDocumentToken')==origin
    expect(frame().locator('#program-output')).to_be_empty()
    assert page.evaluate('window.__outgoingRecording.paused'),'An outgoing recording must stop on lesson navigation.'
    run('[2, 4, 6, 8, 10]','next lesson')
    assert compiler_requests()==count,'Warm navigation must not reload compiler binary/data parts.'
    assert page.evaluate('gpuLabCodeRunner.boots')==1
    expect(frame().locator('#code-runner-intro')).to_have_count(0)
    navigate('scheduling');run('128.0','advanced adapter first run')
    assert compiler_requests()==count,'The advanced adapter shares the existing Clang instance.'
    navigate('first-kernel');expect(page.locator('video[data-recording]')).to_have_js_property('paused',True);expect(editor()).to_have_value(edited);expect(frame().locator('#program-output')).to_have_text('7.0\n')
    run('7.0','return to opening adapter');assert page.evaluate('gpuLabCodeRunner.boots')==1
    page.go_back();page.wait_for_url('**/scheduling.html');expect(frame().locator('#program-output')).to_contain_text('128.0')
    assert page.evaluate('window.__runnerDocumentToken')==origin
    page.go_forward();page.wait_for_url('**/first-kernel.html');expect(editor()).to_have_value(edited)
    # The course overview shares the same owner; rebased header URLs stay correct.
    page.locator('.v2-brand').click();page.wait_for_url(url)
    assert page.evaluate('window.__runnerDocumentToken')==origin
    assert page.locator('.v2-brand').get_attribute('href')==url
    page.locator('.v2-list a[href$="/first-kernel.html"]').click();page.wait_for_url('**/first-kernel.html')
    expect(editor()).to_have_value(edited);assert page.evaluate('gpuLabCodeRunner.boots')==1
    # Actual header actions preserve the editor and result while destroying/restarting WASM.
    page.locator('#code-runner-open').click();page.get_by_role('button',name='Free memory',exact=True).click()
    expect(page.locator('#code-runner-summary')).to_have_text('Stopped');expect(editor()).to_have_value(edited)
    expect(frame().locator('#program-output')).to_have_text('7.0\n')
    page.get_by_role('button',name='Start code runner',exact=True).click()
    expect(page.locator('#code-runner-summary')).to_have_text('Ready',timeout=120000)
    assert page.evaluate('gpuLabCodeRunner.boots')==2
    expect(frame().locator('#program-output')).to_have_text('7.0\n')
    page.keyboard.press('Escape');run('7.0','run after manual warmup')
    page.clock.fast_forward(300001);expect(page.locator('#code-runner-summary')).to_have_text('Stopped')
    expect(editor()).to_have_value(edited);expect(frame().locator('#program-output')).to_have_text('7.0\n')
    run('7.0','automatic restart after idle');assert page.evaluate('gpuLabCodeRunner.boots')==3
    # Both themes / six sizes keep the new controls usable without overflow.
    for width in [390,820,1440]:
        for theme in ['light','dark']:
            page.set_viewport_size({'width':width,'height':1000});page.evaluate('v=>document.documentElement.dataset.theme=v',theme)
            page.locator('#code-runner-open').click();dialog=page.locator('#code-runner-dialog')
            assert dialog.bounding_box()['width']<=width
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.screenshot(path=str(results/f'controls-{width}-{theme}.png'))
            page.keyboard.press('Escape')
    # A cold startup held at a real compiler request can be stopped through the UI.
    page.locator('#code-runner-open').click();page.get_by_role('button',name='Free memory',exact=True).click();page.keyboard.press('Escape')
    pending=[]
    context.route('**/assets/v2-compiler/Compiler.js-0.bin',lambda route:pending.append(route))
    frame().locator('#run').click();expect(page.locator('#code-runner-summary')).to_have_text('Starting')
    page.locator('#code-runner-open').click();page.get_by_role('button',name='Stop run',exact=True).click()
    expect(frame().locator('#run')).to_be_enabled();expect(editor()).to_have_value(edited)
    expect(frame().locator('#status')).to_have_attribute('data-error','false')
    expect(page.locator('#code-runner-summary')).to_have_text('Stopped')
    page.keyboard.press('Escape');context.unroute('**/assets/v2-compiler/Compiler.js-0.bin')
    for route in pending:
        try:route.abort()
        except Exception:pass # A terminated worker has already cancelled the request.
    # An installed worker without the explicit routing acknowledgement must use
    # native navigation; its cached HTML cannot silently become a new live lesson.
    run('7.0','restart after cancellation')
    page.wait_for_function('()=>!!navigator.serviceWorker.controller')
    page.evaluate("""() => {const original=fetch;window.fetch=async(...args)=>{const response=await original(...args);if(args[1]?.headers?.['X-Lab-Navigation']==='1'){const headers=new Headers(response.headers);headers.delete('X-Lab-Navigation');return new Response(await response.arrayBuffer(),{status:response.status,headers});}return response;};}""")
    page.locator('.v2-page-next').click();page.wait_for_url('**/one-thread-one-element.html')
    assert page.evaluate('window.__runnerDocumentToken')!=origin
    assert page.evaluate('gpuLabCodeRunner.boots')==0
    # Simulate a new-release HTML response: the client must load a full page,
    # rather than adopt its markup into an older execution environment.
    run('[2, 4, 6, 8, 10]','fresh document after older-worker fallback')
    previous=page.evaluate('window.__runnerDocumentToken=crypto.randomUUID()')
    page.evaluate("""() => {const original=fetch;window.fetch=async(...args)=>{const response=await original(...args);if(args[1]?.headers?.['X-Lab-Navigation']==='1'){const doc=new DOMParser().parseFromString(await response.text(),'text/html');doc.querySelector('meta[name="gpu-release"]').content='e'.repeat(64);return new Response('<!doctype html>'+doc.documentElement.outerHTML,{headers:response.headers});}return response;};}""")
    page.locator('.v2-page-next').click();page.wait_for_url('**/more-threads-than-elements.html')
    assert page.evaluate('window.__runnerDocumentToken')!=previous
    assert page.evaluate('gpuLabCodeRunner.boots')==0
    page.goto(url+'v2/first-kernel.html');expect(editor()).to_have_value(edited)
    assert not errors,errors
    (results/'timings.json').write_text(json.dumps(timings,indent=2)+'\n')
    context.close()
    print('PASS: one real worker across basic/advanced lessons and Back/Forward; no repeated compiler download; editor/results retained through manual and idle release; stop during startup; first-use guidance; six layouts/themes.',flush=True)

if __name__=='__main__':
    from v2_editor import serve
    from playwright.sync_api import sync_playwright
    with serve() as url,sync_playwright() as p:
        browser=p.chromium.launch()
        try:check_code_runner(browser,url,Path(__file__).resolve().parents[1])
        finally:browser.close()
