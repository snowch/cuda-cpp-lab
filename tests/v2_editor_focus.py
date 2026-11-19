# Copyright © 2026 Christopher Snow.
"""Lesson edit guidance follows source without changing the program."""
import base64
import json
import subprocess
import time
from pathlib import Path
from playwright.sync_api import expect


def assert_source_ink(editor, fragment, colour):
    # Parent-page smooth scrolling and iframe resizing can invalidate an element
    # screenshot crop. Wait for the visible position, then sample a page image.
    editor.scroll_into_view_if_needed()
    previous=None;stable=0
    for _ in range(40):
        box=editor.bounding_box()
        stable=stable+1 if box==previous else 0;previous=box
        if stable>=3:break
        time.sleep(.025)
    assert stable>=3,'The editor position must settle before its pixels are inspected.'
    metrics=editor.evaluate("(e,fragment)=>{const s=getComputedStyle(e),h=parseFloat(s.lineHeight),index=e.value.indexOf(fragment);return {height:h,top:parseFloat(s.borderTopWidth)+parseFloat(s.paddingTop)+(e.value.slice(0,index).split(String.fromCharCode(10)).length-1)*h-e.scrollTop}}",fragment)
    png=base64.b64encode(editor.page.screenshot(scale='css')).decode()
    result=editor.evaluate('''async (e,{png,box,metrics,colour})=>{
        const image=new Image();image.src='data:image/png;base64,'+png;await image.decode();
        const canvas=document.createElement('canvas');canvas.width=Math.ceil(box.width);canvas.height=Math.ceil(box.height);
        const context=canvas.getContext('2d');context.drawImage(image,box.x,box.y,box.width,box.height,0,0,box.width,box.height);
        let count=0;const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
        for(let y=Math.max(0,Math.floor(metrics.top));y<Math.min(canvas.height,Math.ceil(metrics.top+metrics.height));y++){
            for(let x=2;x<canvas.width-2;x++){
                const at=(y*canvas.width+x)*4,r=pixels[at],g=pixels[at+1],b=pixels[at+2];
                if(colour==='gold'?r>220&&g>180&&b<190:b>220&&g>160&&r<180)count++;
            }
        }
        return {count,failure:count>15?null:canvas.toDataURL('image/png')};
    }''',{'png':png,'box':box,'metrics':metrics,'colour':colour})
    if result['failure']:
        (Path(__file__).resolve().parents[1]/'test-results/editor-colour-failure.png').write_bytes(base64.b64decode(result['failure'].split(',')[1]))
    assert result['count']>15,(fragment,colour,'The intended source line must have visible coloured glyphs.',result['count'],metrics)


def check_v2_editor_focus(browser, url, root):
    for width in [390, 820, 1440]:
        for theme in ['light', 'dark']:
            with browser.new_context(viewport={'width': width, 'height': 1000}, color_scheme=theme) as context:
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(url + 'v2/first-kernel.html')
                frame = page.frame_locator('[data-kernel-workbench="hello"]')
                editor = frame.get_by_role('textbox', name='CUDA source')
                show = frame.get_by_role('button', name='Show target line')
                show_launch = frame.get_by_role('button', name='Show launch', exact=True)
                expect(editor).to_have_class('has-source-focus')
                expect(frame.locator('#source-focus-help')).to_contain_text('stay unchanged for now')
                expect(frame.locator('#source-focus-help')).to_contain_text('copy and print calls')
                expect(editor).to_have_attribute('aria-describedby', 'source-focus-help source-focus-missing')
                starter = editor.input_value()
                assert editor.evaluate('''e => {
                    const px = name => parseFloat(e.style.getPropertyValue('--' + name));
                    const style = getComputedStyle(e), h = parseFloat(style.lineHeight), p = parseFloat(style.paddingTop);
                    const lineTop = offset => p + (e.value.slice(0, offset).split('\\n').length - 1) * h;
                    return Math.abs(px('kernel-focus-top') - lineTop(e.value.indexOf('__global__'))) < 1 &&
                        Math.abs(px('kernel-focus-bottom') - (px('kernel-focus-top') + 3 * h)) < 1 &&
                        px('kernel-focus-top') < px('source-focus-top') &&
                        px('kernel-focus-bottom') > px('source-focus-bottom') &&
                        Math.abs(px('launch-focus-top') - lineTop(e.value.indexOf('hello<<<'))) < 1 &&
                        Math.abs(px('launch-focus-bottom') - px('launch-focus-top') - h) < 1 &&
                        !e.value.includes('void check(') &&
                        lineTop(e.value.indexOf('cudaError_t result = cudaMalloc')) < px('launch-focus-top');
                }'''), 'Highlight the complete three-line kernel and launch, keeping setup code neutral.'
                target_visible = '''e => {
                    const top = parseFloat(e.style.getPropertyValue('--source-focus-top'));
                    const height = parseFloat(getComputedStyle(e).lineHeight);
                    return top >= e.scrollTop && top + height <= e.scrollTop + e.clientHeight;
                }'''
                assert editor.evaluate(target_visible), (width, theme, 'initial target')
                assert editor.evaluate('''e => {
                    const s=getComputedStyle(e);
                    const ink=e.parentElement.querySelector('.source-ink');
                    return s.backgroundImage === 'none' && s.color === 'rgba(0, 0, 0, 0)' &&
                        ink.getAttribute('aria-hidden') === 'true' &&
                        getComputedStyle(ink.querySelector('.source-lesson-ink')).color === 'rgb(143, 203, 255)' &&
                        getComputedStyle(ink.querySelector('.source-target-ink')).color === 'rgb(255, 224, 154)' &&
                        s.caretColor === 'rgb(237, 248, 241)' &&
                        getComputedStyle(e.parentElement).backgroundColor === 'rgb(15, 33, 29)';
                }'''), 'Colour the code glyphs on one uniform background, with a visible native caret.'
                assert show.evaluate('e => e.getBoundingClientRect().height >= 44')
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                assert frame.locator('html').evaluate('e => e.scrollWidth <= innerWidth')
                page.wait_for_function('''() => {
                    const frame = document.querySelector('[data-kernel-workbench]');
                    return frame.clientHeight >= frame.contentDocument.querySelector('main').offsetHeight;
                }''')
                # Review preceding task, guidance/editor and following output in context.
                page.locator('[aria-labelledby="v2-first-kernel"]').screenshot(
                    path=str(root / f'test-results/v2-editor-focus-{width}-{theme}.png'))
                assert_source_ink(editor,'__global__','blue')
                assert_source_ink(editor,'output[0]','gold')
                editor.screenshot(path=str(root / f'test-results/v2-editor-font-kernel-{width}-{theme}.png'))
                show_launch.focus()
                show_launch.press('Enter')
                expect(editor).to_be_focused()
                assert editor.evaluate('''e => {
                    const top = parseFloat(e.style.getPropertyValue('--launch-focus-top'));
                    const bottom = parseFloat(e.style.getPropertyValue('--launch-focus-bottom'));
                    return top >= e.scrollTop && bottom <= e.scrollTop + e.clientHeight;
                }'''), 'The launch should be reachable from the keyboard.'
                assert_source_ink(editor,'hello<<<','blue')
                editor.screenshot(path=str(root / f'test-results/v2-editor-launch-{width}-{theme}.png'))
                show.click()

                # Moving the assignment and changing its value must move the highlight.
                edited = starter.replace('    output[0] = 42.0f;', '\n' * 18 + '    output[0] = 7.0f;')
                initial_top = editor.evaluate('e => parseFloat(e.style.getPropertyValue("--source-focus-top"))')
                editor.fill(edited)
                assert editor.evaluate('e => parseFloat(e.style.getPropertyValue("--source-focus-top"))') > initial_top
                editor.evaluate('e => e.scrollTop = e.scrollHeight')
                show.focus()
                show.press('Enter')
                expect(editor).to_be_focused()
                assert editor.evaluate(target_visible), (width, theme, 'keyboard target')
                assert editor.evaluate('e => e.selectionStart === e.selectionEnd'), 'Finding a line must not select code for accidental replacement.'
                assert editor.input_value() == edited
                frame.get_by_text('Editor tools', exact=True).click()
                with page.expect_download() as info:
                    frame.get_by_role('button', name='Export .cu').click()
                assert info.value.suggested_filename == 'hello.cu'
                assert info.value.path().read_text() == edited

                # A missing target must not leave a highlight on unrelated setup code.
                editor.fill(edited.replace('output[0] = 7.0f;', 'return;'))
                expect(editor).to_have_class('has-source-focus')
                assert editor.evaluate('e => e.style.getPropertyValue("--source-focus-top") === "0px" && e.style.getPropertyValue("--source-focus-bottom") === "0px"')
                expect(show).to_be_disabled()
                expect(show_launch).to_be_enabled()
                expect(frame.locator('#source-focus-missing')).to_be_visible()
                frame.get_by_role('button', name='Restore starter').click()
                expect(editor).to_have_value(starter)
                expect(editor).to_have_class('has-source-focus')
                expect(frame.locator('#source-focus-missing')).to_be_hidden()
                assert editor.evaluate(target_visible), 'Reset should reveal the assignment again.'
                # Keep the whole kernel when its body gains nested braces, and
                # ignore braces and fake launches inside comments/string literals.
                nested = starter.replace('    output[0] = 42.0f;',
                    '    // } hello<<<8, 8>>>(output);\n    const char* label = "} hello<<<7, 7>>>(output);";\n    if (output) {\n        output[0] = 7.0f;\n    }')
                nested = '// hello<<<9, 9>>>(output);\n' + nested
                editor.fill(nested)
                assert editor.evaluate('''e => {
                    const h = parseFloat(getComputedStyle(e).lineHeight);
                    const top = parseFloat(e.style.getPropertyValue('--kernel-focus-top'));
                    const bottom = parseFloat(e.style.getPropertyValue('--kernel-focus-bottom'));
                    const launch = parseFloat(e.style.getPropertyValue('--launch-focus-top'));
                    const actual = e.value.indexOf('hello<<<1, 1>>>');
                    const expected = parseFloat(getComputedStyle(e).paddingTop) + (e.value.slice(0, actual).split('\\n').length - 1) * h;
                    return Math.abs(bottom - top - 7 * h) < 1 && Math.abs(launch - expected) < 1;
                }''')
                editor.fill(starter.replace('hello<<<1, 1>>>(output);', 'hello<<<1,\n        1>>>(\n        output);'))
                assert editor.evaluate('''e => Math.abs(parseFloat(e.style.getPropertyValue('--launch-focus-bottom')) -
                    parseFloat(e.style.getPropertyValue('--launch-focus-top')) - 3 * parseFloat(getComputedStyle(e).lineHeight)) < 1''')
                editor.fill(starter.replace('hello<<<1, 1>>>(output);', '// launch removed'))
                expect(show_launch).to_be_disabled()
                expect(show).to_be_enabled()
                expect(frame.locator('#source-focus-missing')).to_contain_text('kernel launch')
                assert editor.evaluate('e => e.style.getPropertyValue("--launch-focus-top") === "0px" && e.style.getPropertyValue("--launch-focus-bottom") === "0px"')

                # Reload restores edited source and refinds its line.
                editor.fill(edited)
                page.reload()
                expect(editor).to_have_value(edited)
                expect(editor).to_have_class('has-source-focus')
                assert editor.evaluate(target_visible)
                # Snapshot restoration can differ from localStorage; it must update the cue.
                editor.evaluate('''async e => {
                    const script = [...document.scripts].find(s => s.src.includes('/src/v2-workbench-state.mjs'));
                    const {saveReadingState} = await import(new URL('experiment-state.mjs', script.src));
                    e.value = e.value.replace('7.0f', '9.0f').replace('    output[0]', '\\n\\n\\n\\n    output[0]');
                    saveReadingState();
                }''')
                page.reload()
                expect(editor).to_have_value(edited.replace('7.0f', '9.0f').replace('    output[0]', '\n\n\n\n    output[0]'))
                expect(editor).to_have_class('has-source-focus')
                assert editor.evaluate(target_visible)
                assert editor.evaluate('''e => {
                    const line = e.value.slice(0, e.value.indexOf('    output[0]')).split('\\n').length - 1;
                    const style = getComputedStyle(e);
                    return Math.abs(parseFloat(e.style.getPropertyValue('--source-focus-top')) -
                        (parseFloat(style.paddingTop) + line * parseFloat(style.lineHeight))) < 1;
                }''')
                assert not errors, errors
                page.goto(url + 'v2/one-thread-one-element.html')
                expect(page.frame_locator('[data-kernel-workbench]').locator('.source-focus')).to_have_count(1)
    with browser.new_context(viewport={'width':390,'height':1000}, forced_colors='active') as context:
        page=context.new_page()
        page.goto(url+'v2/cuda-source-workbench.html?embed=hello')
        expect(page.locator('#source-focus-help')).not_to_contain_text('copy and print calls')
        expect(page.locator('#source-focus-help')).not_to_contain_text('experiment above')
        editor=page.get_by_role('textbox',name='CUDA source')
        expect(editor).to_have_class('has-source-focus')
        assert editor.evaluate('''e=>{
            const style=getComputedStyle(e);
            return style.backgroundImage==='none' && style.color!=='rgba(0, 0, 0, 0)' &&
                style.caretColor!=='rgba(0, 0, 0, 0)';
        }'''), 'High-contrast mode must retain readable source and caret with the paint layer hidden.'
        page.get_by_role('button',name='Show target line').press('Enter')
        expect(editor).to_be_focused()
        editor.screenshot(path=str(root/'test-results/v2-editor-forced-colours.png'))
    with browser.new_context(viewport={'width':390,'height':1000}) as context:
        page=context.new_page()
        page.goto(url+'v2/cuda-source-workbench.html?embed=hello')
        editor=page.get_by_role('textbox',name='CUDA source')
        starter=editor.input_value()
        edited=starter.replace('    output[0] = 42.0f;', '    output[0] = 42.0f; // '+'horizontal text '*30+'rightEdgeFocus')
        editor.fill(edited)
        page.get_by_role('button',name='Show target line').press('Enter')
        editor.evaluate('e=>e.scrollLeft=e.scrollWidth-e.clientWidth')
        assert editor.evaluate('e=>e.scrollLeft>1000')
        assert_source_ink(editor,'output[0]','gold')
        editor.screenshot(path=str(root/'test-results/v2-editor-font-horizontal.png'))
        page.get_by_role('button',name='Show target line').press('Enter')
        assert editor.evaluate('e=>e.scrollLeft===0')
        editor.evaluate('''e=>{
            const start=e.value.indexOf('output[0]');
            e.focus();e.setSelectionRange(start,start+'output[0] = 42.0f;'.length);
        }''')
        editor.screenshot(path=str(root/'test-results/v2-editor-font-selection.png'))
        assert editor.input_value()==edited
        editor.evaluate("e=>{e.setSelectionRange(e.selectionStart,e.selectionStart);e.style.height='520px'}")
        page.wait_for_function("()=>{const e=document.querySelector('#source'),p=e.parentElement.querySelector('.source-ink');return p.clientHeight===e.clientHeight}")
        page.get_by_role('button',name='Show target line').click();assert_source_ink(editor,'output[0]','gold')
    print('PASS: first-kernel font colours, six layouts, native selection/scrolling, forced colours, edits, export, reset and restart restoration')
    check_all_lesson_focus(browser,url,root)


def check_all_lesson_focus(browser, url, root):
    lessons=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {v2Course} from './content/v2-course.mjs';console.log(JSON.stringify(v2Course.filter(l=>!l.practical||l.program).map(l=>l.slug)))"],cwd=root,text=True))
    assert len(lessons)==25
    for width,theme in [(390,'dark'),(1440,'light')]:
        for slug in lessons:
            with browser.new_context(viewport={'width':width,'height':1000},color_scheme=theme) as context:
                page=context.new_page();page.goto(url+'v2/'+slug+'.html')
                frame=page.frame_locator('[data-kernel-workbench]');editor=frame.get_by_role('textbox',name='CUDA source')
                expect(editor).to_have_class('has-source-focus');source=editor.input_value()
                frame.get_by_role('button',name='Show target line').press('Enter')
                target=editor.evaluate("e=>e.value.slice(e.selectionStart).split(String.fromCharCode(10))[0].trim()")
                assert_source_ink(editor,target,'gold')
                kernel=frame.locator('.source-lesson-ink').first.text_content().strip().split('\n')[0]
                editor.evaluate("(e,text)=>{const line=e.value.slice(0,e.value.indexOf(text)).split('\\n').length-1;e.scrollTop=Math.max(0,line*parseFloat(getComputedStyle(e).lineHeight)-30);e.scrollLeft=0}",kernel)
                assert_source_ink(editor,kernel,'blue')
                assert editor.evaluate("e=>e.parentElement.querySelector('.source-ink').textContent.slice(0,-1)===e.value")
                assert editor.input_value()==source
                # Check the actual rendered excerpts against the actual paint
                # spans, including CPU-side code outside kernels and launches.
                audit=editor.evaluate('''async e=>{
                    const script=[...document.scripts].find(s=>s.src.includes('/v2-editor-focus.mjs'));
                    const {cudaTokens,locateCudaExcerpt}=await import(new URL('./cuda-excerpts.mjs',script.src));
                    const excerpts=[...frameElement.ownerDocument.querySelectorAll('[data-editor-excerpt] code')].map(c=>c.textContent);
                    const untracked=[...frameElement.ownerDocument.querySelectorAll('[data-language="cuda"] pre')]
                        .filter(pre=>!pre.closest('details')&&!pre.hasAttribute('data-editor-excerpt')).map(pre=>pre.id);
                    let offset=0;const painted=[];
                    for(const node of e.parentElement.querySelector('.source-ink').childNodes){
                        const end=offset+node.textContent.length;
                        if(node.nodeType===1&&node.matches('.source-lesson-ink,.source-target-ink'))painted.push({index:offset,end});
                        offset=end;
                    }
                    const missing=[],unpainted=[];const tokens=cudaTokens(e.value);
                    for(const excerpt of excerpts){
                        const match=locateCudaExcerpt(e.value,excerpt,tokens);missing.push(...match.missing);
                        for(const range of match.ranges)for(const token of tokens.filter(t=>t.index>=range.index&&t.end<=range.end))
                            if(!painted.some(p=>p.index<=token.index&&p.end>=token.end))unpainted.push(token);
                    }
                    return {count:excerpts.length,missing,unpainted,untracked};
                }''')
                assert audit['count']>0 and not audit['missing'] and not audit['unpainted'] and not audit['untracked'],(slug,audit)
                if slug in HOST_EXCERPTS:
                    reveal_excerpt(editor,HOST_EXCERPTS[slug]);assert_source_ink(editor,HOST_EXCERPTS[slug],'blue')
                    editor.screenshot(path=str(root/f'test-results/editor-excerpt-{slug}-{width}-{theme}.png'))
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        print(f'PASS: all 25 editors, 48 rendered starter excerpts, edit targets and visible code colours: {width}px/{theme}',flush=True)
    for slug in ['first-kernel','pipelines','from-cpu-array-to-gpu-result','matmul','histograms','softmax-capstone']:
        with browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2.75) as context:
            page=context.new_page();page.goto(url+'v2/'+slug+'.html');frame=page.frame_locator('[data-kernel-workbench]');editor=frame.get_by_role('textbox',name='CUDA source')
            frame.get_by_role('button',name='Show target line').click();target=editor.evaluate("e=>e.value.slice(e.selectionStart).split(String.fromCharCode(10))[0].trim()");assert_source_ink(editor,target,'gold')
            if slug in HOST_EXCERPTS:
                reveal_excerpt(editor,HOST_EXCERPTS[slug]);assert_source_ink(editor,HOST_EXCERPTS[slug],'blue')
            editor.screenshot(path=str(root/f'test-results/editor-touch-{slug}.png'))
    print('PASS: six touch/mobile/DPR rendering checks (Chromium emulation, not a physical Android device)',flush=True)


HOST_EXCERPTS={
    'first-kernel':'result = cudaMemcpy(&value',
    'from-cpu-array-to-gpu-result':'CUDA_CHECK(cudaMalloc(&d_x',
    'pipelines':'check(cudaEventRecord(ready[s], copy))',
}

def reveal_excerpt(editor,text):
    editor.evaluate("""(e,text)=>{
        const at=e.value.indexOf(text);if(at<0)throw Error('Missing excerpt '+text);
        e.setSelectionRange(at,at);e.scrollLeft=0;
        e.scrollTop=Math.max(0,(e.value.slice(0,at).split('\\n').length-1)*parseFloat(getComputedStyle(e).lineHeight)-30);
    }""",text)
