from playwright.sync_api import sync_playwright

routes = ['/volunteer/training','/volunteer/tasks','/volunteer/records','/volunteer/certificate','/volunteer/resources','/volunteer/community','/volunteer/messages','/volunteer/help']
errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.on('console', lambda msg: errors.append(f'console:{msg.type}:{msg.text}') if msg.type == 'error' else None)
    page.on('pageerror', lambda exc: errors.append(f'pageerror:{exc}'))
    page.goto('http://127.0.0.1:4175/volunteer', wait_until='networkidle')
    page.screenshot(path='screenshots/volunteer-workbench-playwright.png', full_page=True)
    assert page.locator('.vol-sidebar').count() == 1
    for route in routes:
        page.locator(f'a[href="{route}"]').click()
        page.wait_for_url(f'**{route}')
        page.locator('iframe').wait_for(state='visible')
        frame = page.frames[-1]
        frame.wait_for_load_state('domcontentloaded')
        assert len(frame.locator('body').inner_text()) > 40, route
        print(route, 'OK', frame.url)
    page.goto('http://127.0.0.1:4175/volunteer', wait_until='networkidle')
    page.locator('#notifications').click()
    assert page.locator('.v-modal').is_visible()
    page.locator('#v-modal-close').click()
    page.screenshot(path='screenshots/volunteer-final-playwright.png', full_page=True)
    browser.close()
print('BROWSER_ERRORS', errors)
assert not errors, errors
