# Copyright © 2026 Christopher Snow.
"""Exercise the completed CUDA-first course through its built entry point."""
import re

from playwright.sync_api import expect


def check_v2(browser, url):
    for width, theme in [(390, 'light'), (820, 'dark'), (1440, 'light'),
                         (390, 'dark'), (820, 'light'), (1440, 'dark')]:
        context = browser.new_context(viewport={'width': width, 'height': 950}, color_scheme=theme)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url)
        expect(page.locator('h1')).to_have_text('Learn the GPU through CUDA')
        expect(page.locator('html')).to_have_attribute('data-theme', theme)
        expect(page.get_by_role('link', name='Contents', exact=True)).to_be_visible()
        page.get_by_role('link', name='GPU Lab V1', exact=True).click()
        expect(page).to_have_url(url + 'v1.html')
        expect(page.locator('.roadmap h3')).to_have_count(14)
        page.get_by_role('link', name='Go to GPU Lab V2').click()
        expect(page).to_have_url(url)
        routes = page.locator('.v2-list li a').evaluate_all('links => links.map(link => link.href)')
        assert len(routes) == 21
        expect(page.get_by_role('link', name='Start with your first kernel')).to_have_attribute('href', './v2/first-kernel.html')
        assert routes[0] == url + 'v2/first-kernel.html'
        assert routes[1] == url + 'v2/one-thread-one-element.html'
        for route, mode in zip(routes[:5], ('hello', 'scale', 'bounds', 'copies', 'coalescing')):
            page.goto(route)
            workbench = page.frame_locator(f'[data-kernel-workbench="{mode}"]')
            expect(workbench.get_by_role('button', name='Export .cu')).to_be_visible()
            if mode == 'hello':
                expect(workbench.get_by_role('textbox', name='CUDA source')).to_have_value(re.compile(r'output\[0\] = 42\.0f'))
                expect(workbench.get_by_role('textbox', name='CUDA source')).to_have_value(re.compile(r'hello<<<1, 1>>>'))
                expect(page.locator('.v2-pager a').last).to_have_attribute('href', './one-thread-one-element.html')
            else:
                expect(workbench.get_by_role('textbox', name='CUDA source')).to_have_value(re.compile('runKernel'))
            expect(workbench.get_by_role('textbox', name='CUDA source')).to_have_value(re.compile(r'int main\(\)'))
            expect(workbench.get_by_text('Software licences', exact=True)).to_be_hidden()
            expect(page.get_by_role('link', name='Software licences', exact=True)).to_have_count(1)
        for route in routes[1:]:
            page.goto(route)
            model = page.get_by_text('Explore a model of the starter program', exact=True)
            if model.count():
                model.click()
            activity = page.locator('.v2-experiment')
            run = activity.get_by_role('button', name='Run model')
            choice = activity.locator('#v2-choice')
            result = activity.locator('#v2-result')
            source = activity.locator('#v2-source code')
            expect(result).to_be_hidden()
            initial_source = source.text_content()
            run.click()
            expect(result).to_be_visible()
            initial_value = choice.input_value()
            for value in choice.locator('option').evaluate_all('options => options.map(o => o.value)'):
                if value == initial_value:
                    continue
                choice.select_option(value)
                expect(result).to_be_hidden()
                expect(source).not_to_have_text(initial_source)
                run.click()
                expect(result).to_be_visible()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), route
            expect(page.get_by_text('Compare your explanation')).to_be_visible()

        page.goto(url + 'v2/reduction.html')
        expect(page.locator('.v2-diagram')).to_contain_text('All threads arrive before any partner read.')
        choice = page.locator('#v2-choice')
        choice.select_option('0')
        choice.select_option('1')
        page.locator('#v2-prediction').fill('2')
        page.get_by_role('button', name='Run model').press('Enter')
        expect(page.locator('#v2-feedback')).to_contain_text('You predicted 2. The model gives 4.')
        page.locator('#v2-prediction').fill('4')
        expect(page.locator('#v2-result')).to_be_hidden()
        page.get_by_role('button', name='Run model').press('Enter')
        page.get_by_role('button', name='Next step').press('Enter')
        expect(page.locator('[data-position]')).to_contain_text('Step 2 of')
        page.reload()
        expect(page.locator('#v2-choice')).to_have_value('1')
        expect(page.locator('#v2-feedback')).to_contain_text('matches the model result of 4')
        expect(page.locator('[data-position]')).to_contain_text('Step 2 of')
        assert not errors, errors
        context.close()

    context = browser.new_context(java_script_enabled=False)
    page = context.new_page()
    page.goto(url + 'v2/')
    expect(page.locator('h1')).to_have_text('Learn the GPU through CUDA')
    page.get_by_role('link', name='GPU Lab V1', exact=True).click()
    expect(page).to_have_url(url + 'v1.html')
    page.goto(url + 'v2/reduction.html')
    expect(page.locator('#v2-source')).to_be_visible()
    expect(page.get_by_role('button', name='Run model')).to_be_disabled()
    expect(page.locator('#v2-result')).to_be_hidden()
    page.get_by_text('Compare your explanation').click()
    expect(page.get_by_text('Indices 0, 4, 2 and 6.', exact=False)).to_be_visible()
    context.close()
    print('PASS: V2 routes and variants, prediction feedback, step recovery, keyboard, fallback and six viewport/theme combinations')
