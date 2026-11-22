# Copyright © 2026 Christopher Snow.
"""Real WASM runs across lessons, history, stop/restart, idle release and versions."""
import json,time
from pathlib import Path
from playwright.sync_api import expect

def hold_compiler_requests(context):
    """Keep interception stable while the compiler's parallel chunks finish."""
    pattern='**/assets/v2-compiler/Compiler.js-0.bin'
    held=[];released=False
    def handle(route):
        if released:route.continue_()
        else:held.append(route)
    context.route(pattern,handle)
    def release():
        nonlocal released
        released=True
        for route in held:route.continue_()
        # Removing interception here can strand another in-flight chunk in
        # Chromium. Keep this pass-through handler until the context closes.
    return held,release

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
        start=time.perf_counter();frame().get_by_role('button',name='Compile and run',exact=True).click();editor().focus()
        expect(frame().locator('#run')).to_be_enabled(timeout=120000)
        expect(frame().locator('#status')).to_have_attribute('data-error','false')
        expect(frame().locator('#program-output')).to_contain_text(expected)
        expect(page.locator('#code-runner-summary')).to_have_text('Ready')
        timings.append({'case':label,'seconds':round(time.perf_counter()-start,3)})
        print('PASS runner',label,timings[-1]['seconds'],flush=True)
    def navigate(slug):
        switcher=page.locator('[data-v2-course-outline]')
        if not switcher.evaluate('e=>e.open'):switcher.locator(':scope>summary').click()
        link=page.locator('.v2-course-panel a[href$="/'+slug+'.html"]')
        link.click();page.wait_for_url('**/'+slug+'.html')
        expect(editor()).to_be_editable(timeout=30000)
        assert page.evaluate('window.__runnerDocumentToken')==origin,'Warm navigation must retain the worker owner.'
    expect(editor()).to_be_editable();page.set_viewport_size({'width':1440,'height':1000})
    editor().focus();page.locator('#code-runner-open').click();page.locator('#code-runner-open').click()
    expect(page.locator('#code-runner-dialog')).not_to_be_visible()
    page.keyboard.press('Enter');expect(page.locator('#code-runner-dialog')).to_be_visible();page.keyboard.press('Escape')
    expect(page.locator('#code-runner-open')).to_be_focused()
    page.locator('#code-runner-open').click();editor().click()
    expect(page.locator('#code-runner-dialog')).not_to_be_visible();expect(editor()).to_be_focused()
    page.set_viewport_size({'width':390,'height':1000})
    source=editor().input_value();edited=source.replace('42.0f','7.0f',1)
    # Hold real startup: onboarding must appear before compilation can finish.
    held,release_compiler=hold_compiler_requests(context)
    start=time.perf_counter();frame().locator('#run').click()
    intro=page.locator('#code-runner-intro-dialog');expect(intro).to_be_visible()
    assert intro.evaluate("e=>e.matches(':modal')"),'The introduction must dim and disable the page behind it.'
    assert intro.evaluate("e=>parseFloat(getComputedStyle(e,'::backdrop').backgroundColor.split(',').at(-1))>0.4")
    expect(page.locator('#code-runner-summary')).to_have_text('Starting');expect(frame().locator('#program-output')).to_be_empty()
    assert page.evaluate('gpuLabCodeRunner.completedRuns')==0
    expect(intro.get_by_role('heading')).to_be_focused()
    page.keyboard.press('Tab');expect(intro.get_by_role('button',name='Back to lesson')).to_be_focused()
    page.keyboard.press('Shift+Tab');expect(intro.get_by_role('button',name='Runner settings')).to_be_focused()
    page.keyboard.press('Tab');expect(intro.get_by_role('button',name='Back to lesson')).to_be_focused()
    assert page.evaluate("localStorage.getItem('gpu-lab:code-runner-intro:3')") is None
    for width in [390,820,1440]:
        for theme in ['light','dark']:
            page.set_viewport_size({'width':width,'height':1000});page.evaluate('v=>document.documentElement.dataset.theme=v',theme)
            assert intro.bounding_box()['width']<=width
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.screenshot(path=str(results/f'intro-{width}-{theme}.png'))
    page.set_viewport_size({'width':390,'height':360});assert intro.bounding_box()['height']<=328
    page.set_viewport_size({'width':390,'height':1000});page.mouse.click(3,3);expect(intro).to_be_visible()
    page.clock.fast_forward(60000);expect(intro).to_be_visible()
    for _ in range(50):
        if held:break
        page.wait_for_timeout(100)
    assert held,'The compiler request must still be blocked while the introduction is visible.'
    release_compiler()
    expect(frame().locator('#run')).to_be_enabled(timeout=120000)
    expect(frame().locator('#program-output')).to_contain_text('42.0');expect(intro).to_be_visible()
    expect(intro.locator('[data-intro-status]')).to_contain_text('inspect the result')
    assert page.evaluate('gpuLabCodeRunner.wasmBytes')>0
    assert page.evaluate('gpuLabCodeRunner.lastRunMs')>0
    timings.append({'case':'first run with intro open','seconds':round(time.perf_counter()-start,3)})
    intro.get_by_role('button',name='Runner settings',exact=True).click();expect(intro).not_to_be_visible()
    expect(page.locator('#code-runner-dialog')).to_be_visible()
    expect(page.locator('#code-runner-timeout')).to_have_value('30')
    expect(page.locator('[data-runner-memory]')).to_contain_text('MiB')
    assert page.evaluate("localStorage.getItem('gpu-lab:code-runner-intro:3')")=='1'
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
    expect(page.locator('#code-runner-intro-dialog')).not_to_be_visible()
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
    # Native fragment navigation retains browser scrolling/history and the
    # warm document; Back must not reload the lesson or lose the edited source.
    page.get_by_role('link',name='Skip to content',exact=True).focus();page.keyboard.press('Enter')
    expect(page).to_have_url(url+'v2/first-kernel.html#main')
    page.go_back();page.wait_for_url(url+'v2/first-kernel.html')
    assert page.evaluate('window.__runnerDocumentToken')==origin;expect(editor()).to_have_value(edited)
    page.locator('#code-runner-open').click();page.locator('#code-runner-timeout').select_option('15')
    sibling=context.new_page();sibling.goto(url+'v2/first-kernel.html');sibling.locator('#code-runner-open').click();expect(sibling.locator('#code-runner-timeout')).to_have_value('15')
    sibling.locator('#code-runner-timeout').select_option('60');expect(page.locator('#code-runner-timeout')).to_have_value('60');sibling.close()
    page.locator('#code-runner-timeout').select_option('5');page.keyboard.press('Escape')
    # Actual header actions preserve the editor and result while destroying/restarting WASM.
    page.locator('#code-runner-open').click();page.get_by_role('button',name='Free memory',exact=True).click()
    expect(page.locator('#code-runner-summary')).to_have_text('Stopped');expect(editor()).to_have_value(edited)
    expect(page.locator('[data-runner-memory]')).to_have_text('0.0 MiB')
    expect(page.locator('[data-runner-time]')).not_to_have_text('No completed run')
    expect(frame().locator('#program-output')).to_have_text('7.0\n')
    page.get_by_role('button',name='Start code runner',exact=True).click()
    expect(page.locator('#code-runner-summary')).to_have_text('Starting')
    expect(frame().locator('#program-output')).to_have_text('7.0\n')
    page.keyboard.press('Escape');run('7.0','compile requested during manual startup')
    assert page.evaluate('gpuLabCodeRunner.boots')==2
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
    expect(page.locator('#code-runner-intro-dialog')).not_to_be_visible()
    page.locator('#code-runner-open').click();expect(page.locator('#code-runner-timeout')).to_have_value('5');page.keyboard.press('Escape')
    previous=page.evaluate('window.__runnerDocumentToken=crypto.randomUUID()')
    page.evaluate("""() => {const original=fetch;window.fetch=async(...args)=>{const response=await original(...args);if(args[1]?.headers?.['X-Lab-Navigation']==='1'){const doc=new DOMParser().parseFromString(await response.text(),'text/html');doc.querySelector('meta[name="gpu-release"]').content='e'.repeat(64);return new Response('<!doctype html>'+doc.documentElement.outerHTML,{headers:response.headers});}return response;};}""")
    page.locator('.v2-page-next').click();page.wait_for_url('**/more-threads-than-elements.html')
    assert page.evaluate('window.__runnerDocumentToken')!=previous
    assert page.evaluate('gpuLabCodeRunner.boots')==0
    page.goto(url+'v2/first-kernel.html');expect(editor()).to_have_value(edited)
    # Reload while a selected lesson is still arriving: cancel the abandoned
    # request, rather than allowing its continuation to redirect a later page.
    run('7.0','before interrupted lesson navigation')
    aborted=[];page.expose_function('__reportNavigationAbort',lambda:aborted.append(True))
    page.evaluate("""() => {const original=fetch;window.fetch=(...args)=>{if(args[1]?.headers?.['X-Lab-Navigation']==='1')return new Promise((resolve,reject)=>{window.__navigationHeld=true;args[1].signal.addEventListener('abort',()=>{window.__reportNavigationAbort().catch(()=>{});reject(new DOMException('aborted','AbortError'));});});return original(...args);};}""")
    page.locator('.v2-page-next').click();page.wait_for_function('()=>window.__navigationHeld')
    page.reload();expect(editor()).to_have_value(edited);assert aborted
    assert not errors,errors
    (results/'timings.json').write_text(json.dumps(timings,indent=2)+'\n')
    context.close()
    # Exact reported journey: header startup introduces the runner; Ready is not a completed program.
    fresh=browser.new_context(viewport={'width':390,'height':700});page=fresh.new_page();page.goto(url+'v2/first-kernel.html')
    expect(editor()).to_be_editable()
    # Keep another tab open before acknowledgement to verify its initial stale flag is refreshed.
    sibling=fresh.new_page();sibling.goto(url+'v2/first-kernel.html');expect(sibling.frame_locator('[data-kernel-workbench]').locator('#source')).to_be_editable()
    held,release_compiler=hold_compiler_requests(fresh)
    page.locator('#code-runner-open').click();page.get_by_role('button',name='Start code runner',exact=True).click()
    intro=page.locator('#code-runner-intro-dialog');expect(intro).to_be_visible()
    expect(intro.locator('[data-intro-status]')).to_contain_text('does not run your program')
    expect(frame().locator('#program-output')).to_be_empty()
    for _ in range(50):
        if held:break
        page.wait_for_timeout(100)
    assert held
    release_compiler()
    expect(page.locator('#code-runner-summary')).to_have_text('Ready',timeout=120000)
    expect(intro).to_be_visible();expect(intro.locator('[data-intro-status]')).to_contain_text('then Compile and run')
    assert page.evaluate('gpuLabCodeRunner.completedRuns')==0
    assert page.evaluate('gpuLabCodeRunner.lastRunMs') is None
    expect(frame().locator('#program-output')).to_be_empty()
    page.screenshot(path=str(results/'manual-start-ready-intro.png'))
    intro.get_by_role('button',name='Back to lesson',exact=True).click();expect(intro).not_to_be_visible()
    expect(page.locator('#code-runner-open')).to_be_focused()
    # Its existing tab must also honour browser-wide acknowledgement without a reload.
    sibling.locator('#code-runner-open').click();sibling.get_by_role('button',name='Start code runner',exact=True).click()
    expect(sibling.locator('#code-runner-intro-dialog')).not_to_be_visible()
    sibling.get_by_role('button',name='Stop startup',exact=True).click();sibling.close()
    run('42.0','header startup to Ready then Compile: no second dialog');expect(intro).not_to_be_visible()
    assert page.evaluate('gpuLabCodeRunner.boots')==1
    page.reload();expect(editor()).to_be_editable()
    run('42.0','introduction stays acknowledged after reload');expect(intro).not_to_be_visible()
    # Blocked settings storage still allows an in-tab choice and explains its scope.
    page.evaluate("() => {Storage.prototype.setItem=function(){throw new DOMException('Blocked','SecurityError')};}")
    page.locator('#code-runner-open').click();page.locator('#code-runner-timeout').select_option('60')
    expect(page.locator('#runner-timeout-help')).to_contain_text('Applies to this tab')
    assert page.evaluate('gpuLabCodeRunner.idleMs')==3600000
    page.set_viewport_size({'width':390,'height':360});panel=page.locator('#code-runner-dialog');assert panel.bounding_box()['height']<=344
    page.keyboard.press('Escape');expect(panel).not_to_be_visible();fresh.close()
    queued=browser.new_context(viewport={'width':390,'height':700});page=queued.new_page();page.goto(url+'v2/first-kernel.html')
    expect(editor()).to_be_editable();held,release_compiler=hold_compiler_requests(queued)
    page.locator('#code-runner-open').click();page.get_by_role('button',name='Start code runner',exact=True).click()
    intro=page.locator('#code-runner-intro-dialog');expect(intro).to_be_visible()
    page.keyboard.press('Escape');expect(intro).not_to_be_visible();expect(page.locator('#code-runner-open')).to_be_focused()
    frame().locator('#run').click();assert page.evaluate('!!gpuLabCodeRunner.pending')
    expect(intro).not_to_be_visible()
    for _ in range(50):
        if held:break
        page.wait_for_timeout(100)
    assert held
    release_compiler()
    expect(frame().locator('#run')).to_be_enabled(timeout=120000)
    expect(frame().locator('#status')).to_have_attribute('data-error','false')
    expect(frame().locator('#program-output')).to_contain_text('42.0')
    expect(intro).not_to_be_visible();assert page.evaluate('gpuLabCodeRunner.boots')==1
    queued.close()
    # Seeing the old passive notice is not acknowledgement of the new introduction.
    # Reloading an unread dialog must offer it again on the next Run, keeping edits.
    unread=browser.new_context(viewport={'width':390,'height':700})
    unread.add_init_script("localStorage.setItem('gpu-lab:code-runner-intro:2','1')")
    fail_assets={'enabled':True}
    unread.route('**/assets/v2-compiler/Compiler.js-0.bin',lambda route:route.abort() if fail_assets['enabled'] else route.continue_())
    page=unread.new_page();page.goto(url+'v2/first-kernel.html');expect(editor()).to_be_editable()
    draft=editor().input_value().replace('42.0f','7.0f',1);editor().fill(draft);frame().locator('#run').click()
    intro=page.locator('#code-runner-intro-dialog')
    recovery=page.get_by_role('alertdialog');expect(recovery).to_be_visible();expect(intro).not_to_be_visible()
    assert page.evaluate("localStorage.getItem('gpu-lab:code-runner-intro:3')") is None
    page.keyboard.press('Escape');expect(recovery).not_to_be_visible();fail_assets['enabled']=False
    page.reload();expect(editor()).to_have_value(draft);expect(intro).not_to_be_visible()
    frame().locator('#run').click();expect(intro).to_be_visible()
    intro.get_by_role('button',name='Back to lesson',exact=True).click();expect(intro).not_to_be_visible();expect(editor()).to_be_focused()
    assert page.evaluate("localStorage.getItem('gpu-lab:code-runner-intro:2')")=='1'
    assert page.evaluate("localStorage.getItem('gpu-lab:code-runner-intro:3')")=='1'
    unread.close()
    print('PASS: one real worker across basic/advanced lessons and Back/Forward; no repeated compiler download; editor/results retained through manual and idle release; stop during startup; one introduction at first header/automatic startup, no repeat after Ready or queued Run, acknowledgement in already-open tabs, dimmed/inert background, focus containment, no expiry, explicit return/settings/Escape, acknowledgement and saved edits; six layouts/themes.',flush=True)

if __name__=='__main__':
    from v2_editor import serve
    from playwright.sync_api import sync_playwright
    with serve() as url,sync_playwright() as p:
        browser=p.chromium.launch()
        try:check_code_runner(browser,url,Path(__file__).resolve().parents[1])
        finally:browser.close()
