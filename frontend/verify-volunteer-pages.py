from pathlib import Path
from playwright.sync_api import sync_playwright

routes = [
    ('training', '/volunteer/training'),
    ('tasks', '/volunteer/tasks'),
    ('records', '/volunteer/records'),
    ('certificate', '/volunteer/certificate'),
    ('resources', '/volunteer/resources'),
    ('community', '/volunteer/community'),
    ('messages', '/volunteer/messages'),
    ('help', '/volunteer/help'),
]
out = Path('screenshots/volunteer-pages-playwright')
out.mkdir(parents=True, exist_ok=True)
errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
    page.on('console', lambda msg: errors.append(f'console:{msg.type}:{msg.text}') if msg.type == 'error' else None)
    page.on('pageerror', lambda exc: errors.append(f'pageerror:{exc}'))
    page.goto('http://localhost:4175/volunteer', wait_until='networkidle')
    assert page.locator('.vol-sidebar').count() == 1
    for name, route in routes:
        page.locator(f'a[href="{route}"]').click()
        page.wait_for_url(f'**{route}')
        iframe = page.locator('iframe')
        iframe.wait_for(state='visible')
        frame = page.frames[-1]
        frame.wait_for_load_state('networkidle')
        text = frame.locator('body').inner_text()
        assert len(text.strip()) > 40, route
        assert page.locator('.vol-sidebar').count() == 1
        page.screenshot(path=str(out / f'{name}-shell.png'), full_page=True)
        frame.locator('body').screenshot(path=str(out / f'{name}-integrated.png'))
        print(f'{name}|http://localhost:4175{route}|iframe={frame.url}|text={len(text)}')
    page.goto('http://localhost:4175/volunteer', wait_until='networkidle')
    page.locator('#notifications').click()
    assert page.locator('.v-modal').is_visible()
    page.locator('#v-modal-close').click()
    browser.close()
print('BROWSER_ERRORS', errors)
assert not errors, errors
