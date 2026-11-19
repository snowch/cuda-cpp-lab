# Copyright © 2026 Christopher Snow.
"""Use the optional manual version check through its actual disclosure."""

def manual_check(page):
    details=page.locator('#app-status-details')
    opened=details.get_attribute('open') is None
    if opened:page.locator('#app-status-details > summary').click()
    page.locator('#check-update').click()
    if opened and details.is_visible() and details.get_attribute('open') is not None:
        page.locator('#app-status-details > summary').click()
