from pathlib import Path
from playwright.sync_api import sync_playwright

pages = {
    'training':'/volunteer-pages/yuzan-volunteer-training-ui/yuzan-volunteer-training-ui/index.html',
    'tasks':'/volunteer-pages/yuzan-volunteer-service-tasks-pixel-web-1-/yuzan-volunteer-service-tasks-standalone/index.html',
    'records':'/volunteer-pages/yuzan-one-to-one-support-standalone-v3/yuzan-one-to-one-support-standalone-v3/index.html',
    'certificate':'/volunteer-pages/yuzan-volunteer-training-completion-standalone-v1/yuzan-volunteer-training-completion-standalone-v1/index.html',
    'resources':'/volunteer-pages/yuzan-volunteer-assessment-pixel-web/yuzan-volunteer-assessment-standalone/index.html',
    'community':'/volunteer-pages/yuzan-volunteer-pairings-pixel-web-v2/yuzan-volunteer-pairings-standalone/index.html',
    'messages':'/volunteer-pages/yuzan-volunteer-emergency-report-standalone-v2/yuzan-volunteer-emergency-report-standalone-v2/index.html',
    'help':'/volunteer-pages/yuzan-volunteer-recruitment-pixel-web/yuzan-volunteer-recruitment-standalone/index.html',
}
out=Path('screenshots/volunteer-pages-playwright/direct'); out.mkdir(parents=True, exist_ok=True)
errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for name,path in pages.items():
        page=browser.new_page(viewport={'width':1440,'height':900})
        page.on('console',lambda msg,n=name: errors.append(f'{n}:console:{msg.type}:{msg.text}') if msg.type=='error' else None)
        page.on('pageerror',lambda exc,n=name: errors.append(f'{n}:pageerror:{exc}'))
        page.goto('http://localhost:4175'+path,wait_until='networkidle')
        page.screenshot(path=str(out/f'{name}.png'),full_page=True)
        body=page.locator('body').inner_text()
        buttons=page.locator('button').count()
        print(f'{name}|direct=http://localhost:4175{path}|text={len(body)}|buttons={buttons}')
        assert len(body.strip())>100
        page.close()
    browser.close()
print('DIRECT_BROWSER_ERRORS',errors)
assert not errors,errors
