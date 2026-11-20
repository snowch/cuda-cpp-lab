# Copyright © 2026 Christopher Snow.
"""Practical lesson state, references, navigation and reading-order captures."""
from playwright.sync_api import expect

SLUGS = ['verify-every-output', 'grid-stride-loops', 'multi-block-scan',
         'resource-tradeoffs', 'measure-a-kernel', 'softmax-capstone']

def check_v2_practical(browser, url, root):
    errors = []
    for width in [390, 820, 1440]:
        for theme in ['light', 'dark']:
            context = browser.new_context(viewport={'width': width, 'height': 1000}, color_scheme=theme)
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            for slug in SLUGS:
                page.goto(url + 'v2/' + slug + '.html')
                practice = page.locator('.v2-practice-model')
                if practice.count():
                    expect(practice).not_to_have_attribute('open', '')
                    practice.locator(':scope > summary').click()
                activity = page.locator('[data-practical]')
                result = activity.locator('[data-practical-result]')
                expect(result).to_be_hidden()
                submit = activity.locator('button[type=submit]')
                expect(submit).to_be_enabled()
                if slug == 'softmax-capstone':
                    activity.locator('textarea').fill('0 0 1')
                elif slug == 'measure-a-kernel':
                    activity.locator('textarea').fill('bad JSON')
                if activity.locator('[name=prediction]').count():
                    activity.locator('[name=prediction]').fill('0')
                submit.focus(); page.keyboard.press('Enter')
                feedback = activity.locator('[role=status]')
                if slug == 'measure-a-kernel':
                    expect(feedback).to_contain_text('Invalid JSON')
                    activity.locator('textarea').fill('{"schema":1,"scope":"kernel-only","gpu":"test fixture, not measured","elements":3,"checked_elements":3,"warmup":10,"repetitions":200,"samples_ms":{"separate":[3,2,1],"fused":[1,0.5,1.5]}}')
                    submit.focus(); page.keyboard.press('Enter')
                    expect(result).to_be_visible()
                    expect(feedback).to_contain_text('ratio: 2.000')
                elif slug == 'softmax-capstone':
                    expect(feedback).to_contain_text('Row comparison')
                    activity.locator('textarea').fill('0.0351190 0.2594965 0.7053845')
                    expect(result).to_be_hidden()
                    submit.focus(); page.keyboard.press('Enter')
                    expect(feedback).to_contain_text('This row passes')
                    if width == 390 and theme == 'light':
                        activity.locator('textarea').fill('0.0351190 0.2594965 0.7053845 0')
                        submit.click()
                        expect(feedback).to_contain_text('4 values for 3 columns')
                        expect(result).to_contain_text('No column')
                        activity.locator('textarea').fill('0.0351190 0.2594965')
                        submit.click()
                        expect(result).to_contain_text('Missing')
                        activity.locator('textarea').fill('0.0351190 0.2594965 0.7053845')
                        submit.click()
                else:
                    expect(result).to_be_visible()
                    if slug == 'resource-tradeoffs':
                        expect(activity.locator('[name=threads]')).to_have_value('256')
                        expect(activity.locator('[name=registers]')).to_have_value('32')
                        expect(feedback).to_contain_text('4 resident blocks, 32 warps, 50%')
                        activity.locator('[name=registers]').select_option('96')
                        expect(result).to_be_hidden()
                        activity.locator('[name=prediction]').fill('2')
                        submit.focus(); page.keyboard.press('Enter')
                        expect(feedback).to_contain_text('2 resident blocks, 16 warps, 25%')
                        expect(feedback).to_contain_text('Your prediction matches.')
                # Actual preceding explanation -> controls/results -> application.
                for label, target in [('opening',page.locator('.intro')), ('activity',activity), ('references',page.locator('.v2-resources'))]:
                    target.evaluate('el=>scrollTo({top:Math.max(0,el.getBoundingClientRect().top+scrollY-140),behavior:"instant"})')
                    page.screenshot(path=str(root / f'test-results/practical-{slug}-{width}-{theme}-{label}.png'))
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (slug,width,theme)
                page.reload()
                if practice.count() and not practice.evaluate('el => el.open'):
                    practice.locator(':scope > summary').click()
                expect(page.locator('[data-practical-result]')).to_be_visible()
                if width == 390 and theme == 'light':
                    page.evaluate('''async slug=>{
                        const offline=[...document.scripts].find(s=>s.src.includes('/src/offline.mjs'));
                        const state=await import(new URL('experiment-state.mjs',offline.src));
                        state.saveReadingState();
                        localStorage.removeItem('gpu-lab:practical:1:'+slug);
                    }''', slug)
                    page.reload()
                    if practice.count() and not practice.evaluate('el => el.open'):
                        practice.locator(':scope > summary').click()
                    expect(page.locator('[data-practical-result]')).to_be_visible()
                activity = page.locator('[data-practical]')
                control = activity.locator('select').first if activity.locator('select').count() else activity.locator('textarea').first if activity.locator('textarea').count() else activity.locator('input').first
                control.dispatch_event('input')
                expect(page.locator('[data-practical-result]')).to_be_hidden()
                activity.locator('button[type=reset]').click()
                expect(page.locator('[data-practical-result]')).to_be_hidden()
                if slug == 'softmax-capstone':
                    expect(page.locator('.v2-page-next')).to_contain_text('Course overview')
                    solution = page.get_by_text('Reference solution · compare after your own attempt', exact=True)
                    solution.click()
                    expect(page.locator('#practical-solution')).to_be_visible()
            context.close()
    context = browser.new_context(java_script_enabled=False, viewport={'width':390,'height':1000})
    page = context.new_page()
    for slug in SLUGS:
        page.goto(url+'v2/'+slug+'.html')
        expect(page.locator('.chapter-opening-code')).to_be_visible()
        references = page.locator('[data-v2-resource=references]')
        references.locator(':scope > summary').click()
        expect(references.locator('.v2-reference-question')).to_have_count(2)
        for item in references.locator('li').all():
            item.locator('summary').click()
            expect(item.locator('details p')).to_be_visible()
    context.close()
    assert not errors, errors
    print('PASS: six practical lessons, six layouts, invalidation, saved results, reset, keyboard, reference solution and no-JavaScript reading', flush=True)
