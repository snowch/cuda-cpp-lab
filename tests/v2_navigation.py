# Copyright © 2026 Christopher Snow.
"""Course breadcrumb disclosure, keyboard dismissal and native fallback."""
from playwright.sync_api import expect


def check_v2_navigation(browser, url, root):
    cases = [('first-kernel','part-cuda-foundations'),('scheduling','part-gpu-execution'),('token-routing','part-parallel-patterns'),('matmul-investigation','part-gpu-execution'),('softmax-capstone','part-practical-work')]
    for width in [390,820,1440]:
        for theme in ['light','dark']:
            context=browser.new_context(viewport={'width':width,'height':900},color_scheme=theme)
            page=context.new_page()
            for slug,part in cases:
                page.goto(url+'v2/'+slug+'.html')
                switcher=page.locator('[data-v2-course-switcher]')
                expect(switcher).to_have_attribute('data-enhanced','true')
                trigger=switcher.locator(':scope > summary')
                trigger.focus(); page.keyboard.press('Enter')
                expect(switcher).to_have_attribute('open','')
                panel=page.get_by_role('navigation',name='Course contents',exact=True)
                expect(panel.locator('.v2-course-part[open]')).to_have_count(1)
                expect(panel.locator('.v2-course-part[open]')).to_have_attribute('data-course-part',part)
                expect(panel.locator('.v2-course-lessons a')).to_have_count(27)
                expect(panel.locator('a[aria-current="page"]')).to_have_attribute('href','./'+slug+'.html')
                expect(panel.locator('a[aria-current="page"]')).to_contain_text('Current lesson')
                expect(panel.locator('a[aria-current="page"]')).to_be_in_viewport()
                for group in panel.locator('.v2-course-part').all():
                    if group.get_attribute('open') is None: group.locator(':scope > summary').click()
                rect=panel.bounding_box()
                assert rect['x']>=0 and rect['x']+rect['width']<=width+1,(slug,width,rect)
                crumb=page.locator('.v2-breadcrumb').bounding_box()
                if switcher.get_attribute('data-placement') == 'above':
                    assert rect['y']+rect['height']<=crumb['y'],(slug,width,rect)
                else:
                    assert rect['y']>=crumb['y']+crumb['height'],(slug,width,rect)
                assert rect['y']>=0 and rect['y']+rect['height']<=900,(slug,width,rect)
                assert panel.evaluate('e=>e.scrollHeight>=e.clientHeight')
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                if slug=='scheduling':
                    panel.screenshot(path=str(root/f'test-results/v2-course-menu-{width}-{theme}.png'),style='.topbar { visibility:hidden; }')
                panel.locator('a[aria-current="page"]').focus()
                page.keyboard.press('Escape')
                expect(switcher).not_to_have_attribute('open','')
                expect(trigger).to_be_focused()
                trigger.click(); page.mouse.click(width-4,4)
                expect(switcher).not_to_have_attribute('open','')
                trigger.click()
                panel.get_by_role('link',name='Course overview',exact=True).click()
                expect(page).to_have_url(url)
            # Navigate to another lesson through its part without losing destinations.
            page.goto(url+'v2/first-kernel.html')
            page.locator('[data-v2-course-switcher] > summary').click()
            page.locator('[data-course-part="part-parallel-patterns"] > summary').click()
            page.locator('.v2-course-lessons a[href="./scan.html"]').click()
            expect(page).to_have_url(url+'v2/scan.html')
            context.close()
    # Opening navigation must not add positional entries to saved lesson panels.
    context=browser.new_context(viewport={'width':390,'height':900})
    page=context.new_page();page.goto(url+'v2/scheduling.html')
    page.locator('.v2-starter-model > summary').click()
    page.locator('#v2-choice').select_option('1')
    page.get_by_role('button',name='Run model',exact=True).click()
    page.locator('[data-v2-course-switcher] > summary').click()
    page.evaluate('''async ()=>{
        const script=[...document.scripts].find(s=>s.src.includes('/src/offline.mjs'));
        const state=await import(new URL('experiment-state.mjs',script.src));
        state.saveReadingState();
        const saved=JSON.parse(sessionStorage.getItem('gpu-lab:restart:'+location.pathname+location.search));
        const panels=[...document.querySelectorAll('main details')].filter(e=>!e.closest('[data-transient-navigation]'));
        if(saved.details.length!==panels.length)throw new Error('Course navigation polluted lesson snapshot');
    }''')
    page.reload()
    expect(page.locator('[data-v2-course-switcher]')).not_to_have_attribute('open','')
    expect(page.locator('#v2-choice')).to_have_value('1')
    expect(page.locator('#v2-result')).to_be_visible()
    context.close()
    context=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':900})
    page=context.new_page();page.goto(url+'v2/first-kernel.html')
    page.locator('[data-v2-course-switcher] > summary').click()
    page.locator('[data-course-part="part-parallel-patterns"] > summary').click()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('.v2-course-lessons a[href="./scan.html"]').click()
    expect(page).to_have_url(url+'v2/scan.html')
    context.close()
    print('PASS: course breadcrumbs, current part/lesson, all links, keyboard/outside dismissal, bounded panels, native fallback and six layouts',flush=True)
