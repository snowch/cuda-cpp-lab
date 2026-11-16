# Copyright © 2026 Christopher Snow.
"""Native footer disclosures, navigation destinations and responsive cards."""
from playwright.sync_api import expect


def check_v2_footer(browser, url, root):
    for width in [390, 820, 1440]:
        for theme in ['light', 'dark']:
            context = browser.new_context(viewport={'width': width, 'height': 1000}, color_scheme=theme)
            page = context.new_page()
            for slug in ['first-kernel', 'scheduling', 'token-routing']:
                page.goto(url + 'v2/' + slug + '.html')
                resources = page.locator('.v2-resources')
                rows = resources.locator('.v2-resource')
                expect(rows).to_have_count(3)
                for row in rows.all():
                    expect(row).not_to_have_attribute('open', '')
                    summary = row.locator(':scope > summary')
                    assert summary.bounding_box()['height'] >= 44
                    assert summary.locator('[aria-hidden="true"] svg').first.count() == 1
                    expect(summary.locator('svg')).to_have_count(2)
                    summary.focus()
                    page.keyboard.press('Enter')
                    expect(row).to_have_attribute('open', '')
                    expect(row.locator(':scope > .v2-resource-body')).to_be_visible()
                    page.wait_for_function('(el)=>getComputedStyle(el).transform.startsWith("matrix(0, 1, -1, 0")', arg=summary.locator('.v2-resource-chevron').element_handle())
                    page.keyboard.press('Space')
                    expect(row).not_to_have_attribute('open', '')
                expect(page.locator('.v2-hardware')).to_be_visible()
                cards = page.locator('.v2-pager a')
                expect(cards).to_have_count(2)
                left, right = cards.evaluate_all('cards=>cards.map(card=>card.getBoundingClientRect().toJSON())')
                if width < 600:
                    assert right['y'] >= left['y'] + left['height'], (slug,width)
                else:
                    assert abs(left['y'] - right['y']) < 1, (slug,width)
                    assert abs(left['width'] - right['width']) < 1
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (slug,width,theme)
                if slug == 'first-kernel':
                    expect(cards.first).to_contain_text('Course overview')
                    expect(cards.last).to_have_attribute('href', './one-thread-one-element.html')
                elif slug == 'token-routing':
                    expect(cards.last).to_contain_text('Course overview')
                    expect(cards.last).to_have_attribute('href', '../')
                # Include the preceding application/transition and the following pager/footer.
                page.locator('.topbar').evaluate('el=>el.style.position="static"')
                page.evaluate('(top)=>scrollTo({top:Math.max(0,top-150),behavior:"instant"})', resources.evaluate('e=>e.getBoundingClientRect().top+scrollY'))
                page.screenshot(path=str(root / f'test-results/v2-footer-{slug}-{width}-{theme}.png'))
            page.goto(url + 'v2/scheduling.html')
            next_card = page.locator('.v2-page-next')
            next_card.focus(); page.keyboard.press('Enter')
            expect(page).to_have_url(url + 'v2/divergence.html')
            context.close()
    context = browser.new_context(java_script_enabled=False, viewport={'width':390,'height':1000})
    page = context.new_page()
    page.goto(url + 'v2/scheduling.html')
    for row in page.locator('.v2-resources .v2-resource').all():
        row.locator(':scope > summary').click()
        expect(row.locator(':scope > .v2-resource-body')).to_be_visible()
    page.locator('.v2-page-next').click()
    expect(page).to_have_url(url + 'v2/divergence.html')
    context.close()
    print('PASS: V2 footer rows, rotating chevrons, keyboard/no-script disclosures, first/last navigation and six responsive layouts', flush=True)
