from playwright.sync_api import sync_playwright
from pathlib import Path
import base64,re,mimetypes
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text(encoding='utf-8')
css=(root/'styles.css').read_text(encoding='utf-8')
js=(root/'app.js').read_text(encoding='utf-8')

def data_uri(path: Path):
    mime=mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    return f"data:{mime};base64,"+base64.b64encode(path.read_bytes()).decode()
# Embed CSS asset URLs.
def css_repl(m):
    raw=m.group(1).strip('"\'')
    if raw.startswith('assets/'):
        return f'url("{data_uri(root/raw)}")'
    return m.group(0)
css=re.sub(r'url\(([^)]+)\)',css_repl,css)
# Embed img src values.
def src_repl(m):
    raw=m.group(1)
    if raw.startswith('assets/'):
        return 'src="'+data_uri(root/raw)+'"'
    return m.group(0)
html=re.sub(r'src="([^"]+)"',src_repl,html)
html=re.sub(r'<link rel="stylesheet" href="styles\.css"\s*/?>',f'<style>{css}</style>',html)
html=html.replace('<script src="app.js"></script>',f'<script>{js}</script>')
out=Path(__file__).with_name('current.png')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1659,'height':948}, device_scale_factor=1)
    page.set_content(html, wait_until='load')
    page.wait_for_timeout(600)
    page.screenshot(path=str(out), full_page=False)
    browser.close()
print(out)
