# Copyright © 2026 Christopher Snow.
"""Shared setup/profiling pages belong to the current course after V1 retirement."""
from playwright.sync_api import expect

def check_current_appendices(browser,url,root):
    assert sorted(p.name for p in (root/'dist/lessons').glob('*.html'))==['desktop.html','profiling.html']
    assert not (root/'dist/v1.html').exists()
    for width,theme in [(390,'light'),(390,'dark'),(820,'light'),(820,'dark'),(1440,'light'),(1440,'dark')]:
        with browser.new_context(viewport={'width':width,'height':1000},color_scheme=theme) as context:
            page=context.new_page()
            for slug in ['desktop','profiling']:
                page.goto(url+'lessons/'+slug+'.html')
                expect(page.get_by_role('link',name='GPU Lab home',exact=True)).to_have_attribute('href','../')
                expect(page.locator('.sidebar')).to_have_count(0)
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                expect(page.get_by_role('navigation',name='Breadcrumb')).to_contain_text('Course overview')
                page.screenshot(path=str(root/f'test-results/current-{slug}-{width}-{theme}.png'))
                for href in page.locator('main a[href]').evaluate_all('links=>links.map(a=>a.href)'):
                    if not href.startswith(url):continue
                    response=context.request.get(href.split('#')[0]);assert response.ok,href
            page.goto(url+'lessons/desktop.html')
            expect(page.locator('#desktop-first-kernel')).to_contain_text('nvcc -O2 first-kernel.cu')
            page.get_by_role('link',name='Inspect PyTorch GPU launches',exact=True).first.click()
            expect(page.locator('#dimensions')).to_be_visible()
    with browser.new_context(java_script_enabled=False) as context:
        page=context.new_page();page.goto(url+'lessons/profiling.html')
        expect(page.locator('#profiling-capture')).to_be_visible()
        expect(page.locator('#dimensions')).to_contain_text('inspect-pytorch-trace.py')
    print('PASS: retained setup/profiling appendices, current links, six layouts/themes and static reading',flush=True)
