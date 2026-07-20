from pathlib import Path
from base64 import b64encode
from playwright.sync_api import sync_playwright
import re

ROOT=Path(__file__).resolve().parents[1]

def data_uri(path: Path):
    ext=path.suffix.lower()
    mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'}[ext]
    return f'data:{mime};base64,'+b64encode(path.read_bytes()).decode()

html=(ROOT/'index.html').read_text(encoding='utf-8')
css=(ROOT/'styles.css').read_text(encoding='utf-8')
js=(ROOT/'app.js').read_text(encoding='utf-8')
for asset in (ROOT/'assets').iterdir():
    if asset.suffix.lower() in {'.png','.jpg','.jpeg','.webp'}:
        key='assets/'+asset.name
        uri=data_uri(asset)
        css=css.replace(key,uri)
        html=html.replace(key,uri)
html=re.sub(r'<link rel="stylesheet" href="styles\.css"\s*/?>',f'<style>{css}</style>',html)
html=html.replace('<script src="app.js"></script>',f'<script>{js}</script>')
shots=[('desktop.png',1659,948,False),('tablet.png',1024,1200,True),('mobile.png',390,1200,True)]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium')
    for name,w,h,full in shots:
        page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
        page.set_content(html,wait_until='load')
        page.wait_for_timeout(300)
        page.screenshot(path=str(ROOT/'qa'/name),full_page=full)
        page.close()
    browser.close()
(ROOT/'qa'/'current.png').write_bytes((ROOT/'qa'/'desktop.png').read_bytes())
print('screenshots generated')
