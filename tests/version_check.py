# Copyright © 2026 Christopher Snow.
"""App status checks deployed metadata, never a source branch."""
import json
from pathlib import Path
from app_status import manual_check
from playwright.sync_api import expect

RELEASE = json.loads((Path(__file__).resolve().parents[1] / 'dist/release.json').read_text())

def mock_version(context):
    # All version requests are local. The normal static server supplies metadata.
    context.route('https://api.github.com/**', lambda route: route.abort())

def check_version(browser, base_url):
    context = browser.new_context(service_workers='block', viewport={'width': 360, 'height': 800})
    state = {'release': RELEASE, 'status': 200, 'age': '0', 'cache_control':'no-store'}
    context.route('**/release.json?*', lambda route: route.fulfill(status=state['status'], json=state['release'], headers={'Age':state['age'],'Cache-Control':state['cache_control']}))
    page = context.new_page(); page.goto(base_url); page.locator('#app-status-open').click()
    indicator = page.locator('#version-status')
    expect(page.get_by_role('heading',name='Course status',exact=True)).to_have_count(1)
    expect(page.locator('#check-update')).to_be_hidden()
    expect(page.locator('#retry-update')).to_be_hidden()
    expect(indicator).to_have_text('Up to date')
    expect(page.locator('#offline-status')).to_have_text('Offline downloads are unavailable')
    expect(page.locator('#running-version')).to_be_hidden()
    page.locator('#app-status-details > summary').click()
    original = page.locator('#running-version').inner_text()
    page.locator('#app-status-details > summary').click()
    context.set_offline(True); expect(indicator).to_have_text('Cannot check for updates')
    state['release'] = {**RELEASE, 'id':'0'*64}
    context.set_offline(False); expect(indicator).to_have_text('Update available')
    expect(page.locator('#running-version')).to_have_text(original)
    state.update(age='17',cache_control='max-age=600')
    manual_check(page); expect(indicator).to_have_text('Update available')
    expect(page.locator('#release-detail')).to_contain_text('10 minutes')
    expect(page.locator('#download-update')).to_be_visible()
    state.update(age='600')
    manual_check(page);expect(indicator).to_have_text('Couldn’t check for updates')
    expect(page.locator('#download-update')).to_be_hidden()
    expect(page.locator('#release-detail')).to_be_empty()
    expect(page.locator('#retry-update')).to_be_visible()
    expect(page.locator('#check-update')).to_be_hidden()
    state.update(age='0',cache_control='no-store')
    for bad in ['http', 'malformed', 'cached']:
        state.update(status=503 if bad=='http' else 200, release={} if bad=='malformed' else RELEASE, age='10' if bad=='cached' else '0')
        page.locator('#retry-update').click(); expect(indicator).to_have_text('Couldn’t check for updates')
        expect(page.locator('#retry-update')).to_be_enabled()
    state.update(status=200, release=RELEASE, age='0')
    # Hold a real fetch beyond the page's deadline, then deliver a stale success.
    held=[]
    context.unroute('**/release.json?*')
    context.route('**/release.json?*', lambda route: held.append(route))
    page.locator('#retry-update').focus();page.locator('#retry-update').press('Enter')
    expect(page.locator('#retry-update')).to_have_text('Checking…')
    expect(page.locator('#retry-update')).to_be_disabled()
    expect(indicator).to_have_text('Couldn’t check for updates',timeout=12000)
    expect(page.locator('#retry-update')).to_have_text('Retry')
    for route in held:
        try: route.fulfill(json=RELEASE)
        except Exception: pass  # Chromium may already have disposed the aborted request.
    expect(indicator).to_have_text('Couldn’t check for updates')
    context.unroute('**/release.json?*')
    context.route('**/release.json?*', lambda route:route.fulfill(json=RELEASE))
    page.locator('#retry-update').click(); expect(indicator).to_have_text('Up to date')
    expect(page.locator('#retry-update')).to_be_hidden()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.keyboard.press('Escape'); expect(page.locator('#app-status-open')).to_be_focused()
    context.close()
    check_background_abort(browser,base_url)
    print('PASS: deployed identity, mismatch, offline/reconnect, failure, malformed/cached metadata, immutable running identity, keyboard focus')


def check_background_abort(browser,base_url):
    context=browser.new_context(service_workers='block')
    candidate={**RELEASE,'id':'0'*64}
    context.route('**/release.json?*',lambda route:route.fulfill(json=candidate))
    page=context.new_page();page.goto(base_url);page.locator('#app-status-open').click()
    expect(page.locator('#version-status')).to_have_text('Update available')
    held=[]
    context.unroute('**/release.json?*')
    context.route('**/release.json?*',lambda route:held.append(route))
    manual_check(page)
    expect(page.locator('#version-status')).to_have_text('Checking for updates')
    page.evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'))")
    expect(page.locator('#version-status')).to_have_text('Update available')
    expect(page.locator('#download-update')).to_be_visible()
    for route in held:
        try:route.fulfill(json=RELEASE)
        except Exception:pass
    expect(page.locator('#version-status')).to_have_text('Update available')
    context.unroute('**/release.json?*')
    context.route('**/release.json?*',lambda route:route.fulfill(json=RELEASE))
    page.evaluate("delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'))")
    expect(page.locator('#version-status')).to_have_text('Up to date')
    context.close()
