# Copyright © 2026 Christopher Snow.
"""Real browser compiler/simulator checks, including deliberately failing output."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
from v2_editor import serve, serve_compiler, lesson_context
ROOT = Path(__file__).resolve().parents[1]
CASES = [
 ('verify-every-output', None, 'mismatches: 0'),
 ('verify-every-output', [('correctIndex = true','correctIndex = false')], 'mismatches: 33'),
 ('grid-stride-loops', [('output[i] = input[i] * 2.5f;', 'if (i != 6) output[i] = input[i] * 2.5f;')], 'mismatches: 1'),
 ('grid-stride-loops', [('count = 70','count = 0')], 'no allocation or launch'),
 ('grid-stride-loops', [('count = 70','count = 31')], 'mismatches: 0'),
 ('grid-stride-loops', [('count = 70','count = 33')], 'mismatches: 0'),
 ('grid-stride-loops', [('count = 70','count = 129'),('blocks = 2','blocks = 1')], 'mismatches: 0'),
 ('multi-block-scan', [('if (i < n) offsets[i] =', 'if (i < n && i != 0) offsets[i] =')], 'mismatches: 1'),
 ('multi-block-scan', [('count = 70','count = 0')], 'no allocation or launch'),
 ('multi-block-scan', [('count = 70','count = 65')], 'mismatches: 0'),
 ('multi-block-scan', [('count = 70','count = 31')], 'mismatches: 0'),
 ('multi-block-scan', [('count = 70','count = 33')], 'mismatches: 0'),
 ('multi-block-scan', [('count = 70','count = 1024')], 'mismatches: 0'),
 ('softmax-capstone', None, 'mismatches: 102'),
 ('softmax-capstone', 'reference', 'mismatches: 0'),
 ('softmax-capstone', [('rows = 3','rows = 2'),('columns = 33','columns = 7')], 'mismatches: 0'),
 ('softmax-capstone', [('columns = 33','columns = 31')], 'mismatches: 0'),
 ('softmax-capstone', [('rows = 3','rows = 5'),('columns = 33','columns = 65')], 'mismatches: 0'),
 ('softmax-capstone', [('rows = 3','rows = 1'),('columns = 33','columns = 3'),('float input[count], actual[count], expected[count];', 'float input[count], actual[count], expected[count];\n    const float test[] = {-2.0f, 0.0f, 1.0f};'),('input[i] = shift + static_cast<float>((i * 7 + i / columns) % 17 - 8) * 0.25f;', 'input[i] = test[i];')], 'Row 0: 0.035'),
 ('softmax-capstone', [('input[i] = shift + static_cast<float>((i * 7 + i / columns) % 17 - 8) * 0.25f;', 'input[i] = shift;')], 'mismatches: 0'),
 ('softmax-capstone', [('rows = 3','rows = 1'),('columns = 33','columns = 1')], 'mismatches: 0'),
 ('softmax-capstone', [('columns = 33','columns = 65'),('shift = 1000.0f','shift = 0.0f')], 'mismatches: 0'),
 ('softmax-capstone', [('rows = 3','rows = 128'),('columns = 33','columns = 1')], 'mismatches: 0'),
]
def check(browser,url,compiler):
    context=lesson_context(browser,compiler)
    page=context.new_page()
    for slug,changes,expected in CASES:
        page.goto(url+'v2/cuda-source-workbench.html?embed='+slug)
        editor=page.get_by_role('textbox',name='CUDA source')
        # A fresh draft per case; the local reference is the same source rendered in the solution.
        if slug=='softmax-capstone' and changes is not None:
            source=(ROOT/'examples/v2-practical/softmax-reference.cu').read_text()
        else:
            source=(ROOT/('examples/v2-practical/'+slug+'.cu')).read_text() if slug!='softmax-capstone' else None
        if source is not None:
            if isinstance(changes,list):
                for before,after in changes:
                    assert before in source,(slug,before)
                    source=source.replace(before,after,1)
            editor.fill(source)
        page.get_by_role('button',name='Compile and run',exact=True).click()
        page.locator('#run:enabled').wait_for(timeout=120000)
        output=page.locator('#program-output').inner_text()
        assert expected in output,(slug,changes,page.locator('#status').inner_text(),page.locator('#diagnostics').inner_text(),output)
        # Deliberately failing programs must also report a non-zero process exit.
        if expected in ['mismatches: 33','mismatches: 102','mismatches: 1']:
            assert 'Ran main() and the kernel' not in page.locator('#status').inner_text()
            assert page.locator('#status').get_attribute('data-error') == 'false'
            assert page.locator('#status').get_attribute('data-outcome') == 'program-exit'
        elif expected == 'no allocation or launch':
            assert page.locator('#status').inner_text() == 'Ran main(). No kernel was launched.'
            assert page.locator('#program-operations').is_hidden()
            assert page.locator('#ptx-panel').is_visible()
        else:
            assert page.locator('#status').inner_text()=='Ran main() and the kernel in GPGPU-Sim.'
        print('PASS practical CUDA',slug,changes,flush=True)
    context.close()
if __name__=='__main__':
    with serve() as url, serve_compiler(os.environ.get('CUDA_TEST_COMPILER_DIR')) as compiler, sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'))
        try: check(browser,url,compiler)
        finally: browser.close()
