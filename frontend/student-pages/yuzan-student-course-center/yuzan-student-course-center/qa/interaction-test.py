from playwright.sync_api import sync_playwright
from pathlib import Path
import base64,re,mimetypes,json
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text(encoding='utf-8');css=(root/'styles.css').read_text(encoding='utf-8');js=(root/'app.js').read_text(encoding='utf-8')
def uri(path):
 m=mimetypes.guess_type(path.name)[0] or 'application/octet-stream';return f'data:{m};base64,'+base64.b64encode(path.read_bytes()).decode()
css=re.sub(r'url\(([^)]+)\)',lambda m:f'url("{uri(root/m.group(1).strip(chr(34)+chr(39)))}")' if m.group(1).strip(chr(34)+chr(39)).startswith('assets/') else m.group(0),css)
html=re.sub(r'src="([^"]+)"',lambda m:'src="'+uri(root/m.group(1))+'"' if m.group(1).startswith('assets/') else m.group(0),html)
html=re.sub(r'<link rel="stylesheet" href="styles\.css"\s*/?>',f'<style>{css}</style>',html).replace('<script src="app.js"></script>',f'<script>{js}</script>')
errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1659,'height':948})
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html)
 page.locator('.filter').first.click();page.locator('#filterPopover button').nth(1).click()
 page.locator('.weakness button').first.click()
 page.locator('[data-tab="ai"]').click()
 page.locator('[data-action="continue"]').click()
 assert not page.locator('#modalBackdrop').get_attribute('hidden')
 page.locator('.modal-close').click()
 assert page.locator('#modalBackdrop').get_attribute('hidden') is not None
 b.close()
report={'status':'passed' if not errors else 'failed','errors':errors,'checks':['filter menu','weakness highlight','category tab','continue modal','modal close']}
(root/'qa/interaction-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
