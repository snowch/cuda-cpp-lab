# Copyright © 2026 Christopher Snow.
"""V2 media, semantic hardware boundaries and reading-order review captures."""
import json
from playwright.sync_api import expect

def check_v2_context(browser, url, root):
    metadata = json.loads((root / 'content/v2-media.json').read_text())
    context = browser.new_context(viewport={'width':1440,'height':1000})
    page = context.new_page()
    page.goto(url)
    routes = page.locator('.v2-list li[data-course-kind="core"] a').evaluate_all('links=>links.map(a=>a.href)')
    for route in routes:
        page.goto(route)
        slug = route.rsplit('/',1)[1][:-5]
        recording = page.locator('.sm-recording')
        recording.locator('> summary').click()
        video = recording.locator('video')
        video.evaluate('(v)=>{v.muted=true; v.load();}')
        expect(video).to_have_js_property('readyState', 4, timeout=20000)
        assert video.evaluate('(v)=>v.textTracks.length') == 1
        page.wait_for_function('document.querySelector("video").textTracks[0].cues?.length > 0')
        cues = video.evaluate('(v)=>[...v.textTracks[0].cues].map(c=>({start:c.startTime,end:c.endTime,text:c.text}))')
        duration = video.evaluate('(v)=>v.duration')
        assert all(0 <= cue['start'] < cue['end'] <= duration for cue in cues), slug
        assert all(cues[i]['end'] <= cues[i+1]['start']+.01 for i in range(len(cues)-1)), slug
        if slug in metadata:
            assert abs(duration - metadata[slug]['durationSeconds']) < 1, slug
        video.evaluate('(v)=>{v.currentTime=5; return v.play();}')
        expect(video).to_have_js_property('paused', False)
        video.evaluate('(v)=>v.pause()')
        recording.locator('.sm-transcript > summary').click()
        expect(recording.locator('.sm-transcript p').first).to_be_visible()
        if slug in ['first-kernel','scheduling','shared-memory-banks','tensor-cores','pipelines']:
            page.locator('.v2-hardware').screenshot(path=str(root / f'test-results/v2-{slug}-hardware-desktop.png'),style='.topbar { visibility:hidden; }')
            page.locator('main > section').first.screenshot(path=str(root / f'test-results/v2-{slug}-opening-desktop.png'),style='.topbar { visibility:hidden; }')
        if slug == 'tensor-cores':
            page.evaluate('''async ()=>{
                const offline=[...document.scripts].find(s=>s.src.includes('/src/offline.mjs'));
                const state=await import(new URL('experiment-state.mjs',offline.src));
                state.saveReadingState();
            }''')
            page.reload()
            restored=page.locator('video')
            page.wait_for_function('document.querySelector("video").currentTime >= 5')
            expect(restored).to_have_js_property('paused', True)
    context.close()
    # Reading-order captures in the other viewport/theme combinations.
    for width, theme in [(390,'light'),(390,'dark'),(820,'light'),(820,'dark'),(1440,'dark')]:
        context = browser.new_context(viewport={'width':width,'height':1000},color_scheme=theme)
        page=context.new_page()
        for slug in ['one-thread-one-element','coalescing','reduction','tensor-cores','pipelines']:
            page.goto(url+'v2/'+slug+'.html')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),(slug,width,theme)
            page.locator('.v2-hardware').screenshot(path=str(root / f'test-results/v2-{slug}-{width}-{theme}.png'),style='.topbar { visibility:hidden; }')
        context.close()
    print('PASS: all V2 videos play, seek and load captions; paused restart state and hardware review captures',flush=True)
