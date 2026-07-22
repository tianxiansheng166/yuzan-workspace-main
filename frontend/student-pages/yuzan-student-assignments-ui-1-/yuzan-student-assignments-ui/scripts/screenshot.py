from pathlib import Path
import base64, mimetypes, re
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text(encoding='utf-8')
css=(root/'styles.css').read_text(encoding='utf-8')
js=(root/'app.js').read_text(encoding='utf-8')

def data_uri(path: Path) -> str:
    mime=mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"

for path in (root/'assets').iterdir():
    if path.is_file():
        key=f'assets/{path.name}'
        value=data_uri(path)
        html=html.replace(key,value)
        css=css.replace(key,value)
html=re.sub(r'<link rel="stylesheet" href="styles\.css"\s*/?>', f'<style>{css}</style>', html)
html=html.replace('<script src="app.js"></script>', f'<script>{js}</script>')

shots=[('desktop.png',1659,948),('tablet.png',768,1280),('mobile.png',390,1400)]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium')
    for name,w,h in shots:
        page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
        page.set_content(html,wait_until='load')
        page.wait_for_timeout(250)
        page.screenshot(path=str(root/'qa'/name),full_page=True)
        page.close()
    browser.close()
print('screenshots created')
