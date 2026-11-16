# Copyright © 2026 Christopher Snow.
"""Course breadcrumb disclosure, keyboard dismissal and native fallback."""
from playwright.sync_api import expect


def check_v2_navigation(browser, url, root):
    cases = [('first-kernel','part-cuda-foundations'),('scheduling','part-gpu-execution'),('token-routing','part-parallel-patterns'),('matmul-investigation','part-gpu-execution')]
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
                expect(panel.locator('.v2-course-lessons a')).to_have_count(21)
                expect(panel.locator('a[aria-current="page"]')).to_have_attribute('href','./'+slug+'.html')
                expect(panel.locator('a[aria-current="page"]')).to_contain_text('Current lesson')
                expect(panel.locator('a[aria-current="page"]')).to_be_in_viewport()
                for group in panel.locator('.v2-course-part').all():
                    if group.get_attribute('open') is None: group.locator(':scope > summary').click()
                rect=panel.bounding_box()
                assert rect['x']>=0 and rect['x']+rect['width']<=width+1,(slug,width,rect)
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
    context=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':900})
    page=context.new_page();page.goto(url+'v2/first-kernel.html')
    page.locator('[data-v2-course-switcher] > summary').click()
    page.locator('[data-course-part="part-parallel-patterns"] > summary').click()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('.v2-course-lessons a[href="./scan.html"]').click()
    expect(page).to_have_url(url+'v2/scan.html')
    context.close()
    print('PASS: course breadcrumbs, current part/lesson, all links, keyboard/outside dismissal, bounded panels, native fallback and six layouts',flush=True)
