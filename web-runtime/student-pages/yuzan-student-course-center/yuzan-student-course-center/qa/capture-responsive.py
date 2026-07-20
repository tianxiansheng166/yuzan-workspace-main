from playwright.sync_api import sync_playwright
from pathlib import Path
import base64,re,mimetypes
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text(encoding='utf-8');css=(root/'styles.css').read_text(encoding='utf-8');js=(root/'app.js').read_text(encoding='utf-8')
def uri(path):
    mime=mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    return f'data:{mime};base64,'+base64.b64encode(path.read_bytes()).decode()
css=re.sub(r'url\(([^)]+)\)',lambda m:f'url("{uri(root/m.group(1).strip(chr(34)+chr(39)))}")' if m.group(1).strip(chr(34)+chr(39)).startswith('assets/') else m.group(0),css)
html=re.sub(r'src="([^"]+)"',lambda m:'src="'+uri(root/m.group(1))+'"' if m.group(1).startswith('assets/') else m.group(0),html)
html=re.sub(r'<link rel="stylesheet" href="styles\.css"\s*/?>',f'<style>{css}</style>',html).replace('<script src="app.js"></script>',f'<script>{js}</script>')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for name,w,h in [('tablet',768,1024),('mobile',390,844)]:
        page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
        page.set_content(html,wait_until='load');page.wait_for_timeout(350)
        page.screenshot(path=str(Path(__file__).with_name(name+'.png')),full_page=True)
        page.close()
    browser.close()
