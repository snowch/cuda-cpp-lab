# Shared course progress must not be owned by stale snapshots or editor instances.
from playwright.sync_api import expect
import json

def check_v2_progress(browser,url,root):
    context=browser.new_context(viewport={'width':390,'height':1000})
    page=context.new_page();page.goto(url+'v2/first-kernel.html')
    mark=page.get_by_role('checkbox',name='Mark lesson complete',exact=True)
    expect(mark).to_be_enabled();mark.check()
    expect(page.locator('.v2-course-progress')).to_have_text('1 / 27 complete')
    page.locator('#v2-code-prediction').fill('The CPU prints 7.0 after the edit.')
    sibling=context.new_page();sibling.goto(url+'v2/one-thread-one-element.html')
    other=sibling.get_by_role('checkbox',name='Mark lesson complete',exact=True)
    expect(other).to_be_enabled();other.check()
    expect(page.locator('.v2-course-progress')).to_have_text('2 / 27 complete')
    page.evaluate('''async()=>{
      const script=[...document.scripts].find(s=>s.src.includes('/src/offline.mjs'));
      const state=await import(new URL('experiment-state.mjs',script.src));state.saveReadingState();
      const saved=JSON.parse(sessionStorage.getItem('gpu-lab:restart:'+location.pathname));
      if(saved.controls.some(e=>e.id==='v2-complete'))throw Error('Durable progress entered a tab snapshot');
    }''')
    mark.uncheck();page.reload();expect(mark).to_be_enabled();expect(mark).not_to_be_checked()
    expect(page.locator('#v2-code-prediction')).to_have_value('The CPU prints 7.0 after the edit.')
    expect(page.locator('.v2-course-progress')).to_have_text('1 / 27 complete')
    # Migrate first-lesson reference answers from the preceding two-topic layout.
    references=page.locator('[data-v2-resource="references"]')
    references.locator(':scope > summary').click()
    references.locator('.chapter-reference-list > li').nth(1).locator('summary').click()
    old_snapshot=page.evaluate('''async()=>{
      const script=[...document.scripts].find(s=>s.src.includes('/src/offline.mjs'));
      (await import(new URL('experiment-state.mjs',script.src))).saveReadingState();
      const key='gpu-lab:restart:'+location.pathname,saved=JSON.parse(sessionStorage.getItem(key));
      delete saved.detailsVersion;saved.details.splice(3,1);saved.details.pop();return {key,value:JSON.stringify(saved)};
    }''')
    page.add_init_script('sessionStorage.setItem('+json.dumps(old_snapshot['key'])+','+json.dumps(old_snapshot['value'])+');')
    page.reload();expect(references).to_have_attribute('open','')
    expect(references.locator('.chapter-reference-list > li').nth(0).locator('details')).not_to_have_attribute('open','')
    expect(references.locator('.chapter-reference-list > li').nth(1).locator('details')).to_have_attribute('open','')
    page.goto(url);expect(page.locator('.v2-overview-progress')).to_have_text('1 / 27 complete')
    expect(page.locator('[data-v2-completion-link="one-thread-one-element"] .v2-done-tick')).to_be_visible()
    context.close()
    blocked=browser.new_context()
    blocked.add_init_script("Storage.prototype.setItem=function(){throw new DOMException('Blocked','SecurityError')}")
    page=blocked.new_page();page.goto(url+'v2/first-kernel.html');mark=page.get_by_role('checkbox',name='Mark lesson complete',exact=True)
    expect(mark).to_be_enabled();mark.check();expect(page.locator('#v2-completion-note')).to_contain_text('could not be saved')
    reason=lambda:page.evaluate("()=>{const detail={reason:''};dispatchEvent(new CustomEvent('gpu-lab:before-restart',{detail}));return detail.reason}")
    assert reason();mark.uncheck();assert not reason();blocked.close()
    print('PASS: V2 progress namespace, cross-tab sync, reload, prediction, snapshot exclusion/migration and unsaved-mark guard',flush=True)
