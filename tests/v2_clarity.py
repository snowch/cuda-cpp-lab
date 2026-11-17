# Copyright © 2026 Christopher Snow.
"""Exercise editor tools, compiler messages and program-check outcomes as a learner."""
from playwright.sync_api import expect


def check_v2_clarity(browser, url, root):
    context = browser.new_context(viewport={'width': 390, 'height': 1000}, color_scheme='dark')
    page = context.new_page()
    page.goto(url + 'v2/first-kernel.html')
    frame = page.frame_locator('[data-kernel-workbench="hello"]')
    editor = frame.get_by_role('textbox', name='CUDA source')
    run = frame.get_by_role('button', name='Compile and run', exact=True)
    messages = frame.locator('#compiler-messages')
    output = frame.locator('#program-output')
    starter = editor.input_value()
    expect(frame.get_by_role('button', name='Export .cu')).to_be_hidden()
    expect(frame.get_by_role('button', name='Restore starter')).to_be_hidden()

    def execute():
        run.click()
        expect(run).to_be_enabled(timeout=120000)

    execute()
    expect(output).to_have_text('42.0\n')
    edited = '#warning learner-review-warning\n' + starter.replace('42.0f', '7.0f')
    editor.fill(edited)
    execute()
    expect(output).to_have_text('7.0\n')
    expect(frame.locator('#status')).to_have_attribute('data-error', 'false')
    expect(messages).to_be_visible()
    expect(messages).not_to_have_attribute('open', '')
    expect(frame.locator('#diagnostics')).to_contain_text('learner-review-warning')
    assert '\x1b' not in frame.locator('#diagnostics').text_content()
    messages.locator(':scope > summary').press('Enter')
    expect(messages).to_have_attribute('open', '')
    # Preserve the draft, output and inspected warning through the existing snapshot.
    editor.evaluate('''async () => {
      const script = [...document.scripts].find(s => s.src.includes('/src/v2-workbench-state.mjs'));
      const {saveReadingState} = await import(new URL('experiment-state.mjs', script.src));
      saveReadingState();
    }''')
    page.reload()
    expect(editor).to_have_value(edited)
    expect(output).to_have_text('7.0\n')
    expect(frame.locator('#diagnostics')).to_contain_text('learner-review-warning')
    expect(messages).to_have_attribute('open', '')

    editor.fill(starter + '\nthis is not CUDA;\n')
    execute()
    expect(frame.locator('#status')).to_have_attribute('data-error', 'true')
    expect(messages).to_have_attribute('open', '')
    expect(frame.locator('#diagnostics')).to_be_visible()
    error_text = frame.locator('#diagnostics').text_content()
    assert 'error:' in error_text and '\x1b' not in error_text
    assert editor.input_value().endswith('this is not CUDA;\n')
    messages.screenshot(path=str(root / 'test-results/clarity-compile-error.png'))

    # A valid pointer spelling can fall outside the assignment highlight pattern.
    alternate = starter.replace('output[0] = 42.0f;', '*output = 7.0f;')
    editor.fill(alternate)
    expect(frame.locator('#source-focus-missing')).to_contain_text('You can still compile and run')
    execute()
    expect(output).to_have_text('7.0\n')
    expect(frame.locator('#status')).to_have_attribute('data-error', 'false')
    expect(messages).to_be_hidden()
    # A program's exit is reported separately from compiler/runtime errors.
    prefix, ending = alternate.rsplit('}', 1)
    nonzero = prefix + '    return 3;\n}' + ending
    editor.fill(nonzero)
    execute()
    expect(frame.locator('#status')).to_have_attribute('data-error', 'false')
    expect(frame.locator('#status')).to_have_attribute('data-outcome', 'program-exit')
    expect(frame.locator('#status')).to_contain_text('exit code 3')
    expect(output).to_have_text('7.0\n')
    tools = frame.get_by_text('Editor tools', exact=True)
    tools.press('Enter')
    with page.expect_download() as info:
        frame.get_by_role('button', name='Export .cu').press('Enter')
    assert info.value.path().read_text() == nonzero
    assert editor.input_value() == nonzero
    frame.get_by_role('button', name='Restore starter').click()
    expect(editor).to_have_value(starter)
    expect(output).to_be_empty()
    context.close()
    print('PASS: optional editor tools/warnings, visible compile errors, saved draft/output/diagnostics, valid changed assignment and separate program exit', flush=True)
