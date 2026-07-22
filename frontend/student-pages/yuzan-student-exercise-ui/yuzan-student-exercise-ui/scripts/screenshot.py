from pathlib import Path
from base64 import b64encode
from playwright.sync_api import sync_playwright
import re

root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text(encoding='utf-8')
css=(root/'styles.css').read_text(encoding='utf-8')
js=(root/'app.js').read_text(encoding='utf-8')

def data_uri(path: Path):
    ext=path.suffix.lower()
    mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml'}[ext]
    return f'data:{mime};base64,'+b64encode(path.read_bytes()).decode()

for name in ['logo-symbol.png','header-ridge.png','student-avatar.jpg','teacher-avatar.jpg','paper-noise.png','grass.svg']:
    uri=data_uri(root/'assets'/name)
    css=css.replace(f'assets/{name}',uri)
    html=html.replace(f'assets/{name}',uri)
html=re.sub(r'<link rel="stylesheet" href="styles\.css"\s*/?>',f'<style>{css}</style>',html)
html=html.replace('<script src="app.js"></script>',f'<script>{js}</script>')

shots=[('desktop.png',1659,948),('tablet.png',768,1200),('mobile.png',390,1300)]
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    for name,w,h in shots:
        page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
        page.set_content(html,wait_until='load')
        page.wait_for_timeout(350)
        page.screenshot(path=str(root/'qa'/name),full_page=(name != 'desktop.png'))
        page.close()
    browser.close()
print('screenshots created')
