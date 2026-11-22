# Copyright © 2026 Christopher Snow.
"""Inline grouped course outline, combined breadcrumb row, keyboard and native fallback."""
from playwright.sync_api import expect


def check_v2_navigation(browser, url, root):
    cases = [('first-kernel','part-cuda-foundations'),('scheduling','part-gpu-execution'),('token-routing','part-parallel-patterns'),('matmul-investigation','part-gpu-execution'),('softmax-capstone','part-practical-work')]
    for width in [390,820,1440]:
        for theme in ['light','dark']:
            context=browser.new_context(viewport={'width':width,'height':900},color_scheme=theme)
            page=context.new_page()
            for slug,part in cases:
                page.goto(url+'v2/'+slug+'.html')
                switcher=page.locator('[data-v2-course-outline]')
                expect(switcher).to_have_attribute('data-enhanced','true')
                trigger=switcher.locator(':scope > summary')
                trigger.focus(); page.keyboard.press('Enter')
                expect(switcher).to_have_attribute('open','')
                panel=page.get_by_role('navigation',name='Course contents',exact=True)
                expect(trigger).to_contain_text('Course lessons')
                expect(panel.locator('.v2-course-part')).to_have_count(4)
                expect(panel.locator('.v2-course-part > h2')).to_have_count(4)
                expect(panel.locator('details')).to_have_count(0)
                expect(panel.locator('.v2-course-lessons a')).to_have_count(27)
                for link in panel.locator('.v2-course-lessons a').all():
                    expect(link).to_be_visible()
                expect(panel.locator('a[aria-current="page"]')).to_have_attribute('href','./'+slug+'.html')
                expect(panel.locator('a[aria-current="page"]')).to_contain_text('Current lesson')
                expect(panel.locator('[data-course-part="'+part+'"] a[aria-current="page"]')).to_have_count(1)
                rect=panel.bounding_box()
                assert rect['x']>=0 and rect['x']+rect['width']<=width+1,(slug,width,rect)
                row=page.locator('.v2-breadcrumb > ol').bounding_box()
                heading=page.locator('h1').bounding_box()
                assert rect['y']>=row['y']+row['height'],(slug,width,rect,row)
                assert heading['y']>=rect['y']+rect['height'],(slug,width,rect,heading)
                columns=panel.locator('.v2-course-grid').evaluate('e=>getComputedStyle(e).gridTemplateColumns.split(" ").length')
                assert columns=={390:1,820:2,1440:4}[width],(width,columns)
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                if slug=='scheduling':
                    panel.screenshot(path=str(root/f'test-results/v2-course-menu-{width}-{theme}.png'),style='.topbar { visibility:hidden; }')
                # Inline navigation must not collapse and move the page during an outside click.
                page.locator('h1').click()
                expect(switcher).to_have_attribute('open','')
                panel.locator('a[aria-current="page"]').focus()
                page.keyboard.press('Escape')
                expect(switcher).not_to_have_attribute('open','')
                expect(trigger).to_be_focused()
                expect(trigger).to_be_in_viewport()
                trigger.click()
                panel.get_by_role('link',name='Course overview',exact=True).click()
                expect(page).to_have_url(url)
            # Navigate to another lesson through its part without losing destinations.
            page.goto(url+'v2/first-kernel.html')
            page.locator('[data-v2-course-outline] > summary').click()
            page.locator('.v2-course-lessons a[href="./scan.html"]').click()
            expect(page).to_have_url(url+'v2/scan.html')
            context.close()
    # Opening navigation must not add positional entries to saved lesson panels.
    context=browser.new_context(viewport={'width':390,'height':900})
    page=context.new_page();page.goto(url+'v2/scheduling.html')
    model = page.locator('.v2-starter-model')
    if not model.evaluate('e=>e.open'):
        model.locator(':scope > summary').click()
    page.locator('#v2-choice').select_option('1')
    page.get_by_role('button',name='Run model',exact=True).click()
    page.locator('[data-v2-course-outline] > summary').click()
    page.evaluate('''async ()=>{
        const script=[...document.scripts].find(s=>s.src.includes('/src/offline.mjs'));
        const state=await import(new URL('experiment-state.mjs',script.src));
        state.saveReadingState();
        const saved=JSON.parse(sessionStorage.getItem('gpu-lab:restart:'+location.pathname+location.search));
        const panels=[...document.querySelectorAll('main details')].filter(e=>!e.closest('[data-transient-navigation]'));
        if(saved.details.length!==panels.length)throw new Error('Course navigation polluted lesson snapshot');
    }''')
    page.reload()
    expect(page.locator('[data-v2-course-outline]')).not_to_have_attribute('open','')
    expect(page.locator('#v2-choice')).to_have_value('1')
    expect(page.locator('#v2-result')).to_be_visible()
    context.close()
    context=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':900})
    page=context.new_page();page.goto(url+'v2/first-kernel.html')
    page.locator('[data-v2-course-outline] > summary').click()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('.v2-course-lessons a[href="./scan.html"]').click()
    expect(page).to_have_url(url+'v2/scan.html')
    context.close()
    print('PASS: combined course row, all 27 outline links, responsive 1/2/4-column flow, content pushed below navigation, stable outside interaction, Escape/focus, saved models and native fallback',flush=True)
