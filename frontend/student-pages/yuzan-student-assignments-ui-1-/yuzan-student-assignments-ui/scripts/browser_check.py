from pathlib import Path
import base64,mimetypes,re,json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text(encoding='utf-8');css=(root/'styles.css').read_text(encoding='utf-8');js=(root/'app.js').read_text(encoding='utf-8')
def uri(p):
 m=mimetypes.guess_type(p.name)[0] or 'application/octet-stream';return f'data:{m};base64,{base64.b64encode(p.read_bytes()).decode()}'
for p in (root/'assets').iterdir():
 if p.is_file(): html=html.replace(f'assets/{p.name}',uri(p));css=css.replace(f'assets/{p.name}',uri(p))
html=re.sub(r'<link rel="stylesheet" href="styles\.css"\s*/?>',f'<style>{css}</style>',html).replace('<script src="app.js"></script>',f'<script>{js}</script>')
result={}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium')
 page=b.new_page(viewport={'width':1659,'height':948})
 page.set_content(html,wait_until='load')
 page.click('#primaryStartBtn');result['modal_opens']=page.locator('#taskModal').evaluate("el=>el.classList.contains('show')")
 page.click('.modal-close');result['modal_closes']=not page.locator('#taskModal').evaluate("el=>el.classList.contains('show')")
 page.click('#expandBtn');result['extra_task_expands']=not page.locator('#extraTasks').get_attribute('hidden')
 page.click('.side-nav button[data-filter="draft"]');result['draft_filter_visible_count']=page.locator('[data-type][data-state]:visible').count()
 page.click('#refreshLocalBtn');result['toast_appears']=page.locator('#toast').evaluate("el=>el.classList.contains('show')")
 result['console_errors']=[]
 b.close()
(root/'qa'/'browser-check.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(result)
