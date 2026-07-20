from playwright.sync_api import sync_playwright
from pathlib import Path
import base64,re,mimetypes,json
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text(encoding='utf-8')
css=(root/'styles.css').read_text(encoding='utf-8')
js=(root/'app.js').read_text(encoding='utf-8')
def uri(path):
    mime=mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    return f'data:{mime};base64,'+base64.b64encode(path.read_bytes()).decode()
css=re.sub(r'url\(([^)]+)\)', lambda m: f'url("{uri(root/m.group(1).strip(chr(34)+chr(39)))}")' if m.group(1).strip(chr(34)+chr(39)).startswith('assets/') else m.group(0), css)
html=re.sub(r'src="([^"]+)"', lambda m: 'src="'+uri(root/m.group(1))+'"' if m.group(1).startswith('assets/') else m.group(0), html)
html=re.sub(r'<link rel="stylesheet" href="styles\.css"\s*/?>', f'<style>{css}</style>', html).replace('<script src="app.js"></script>', f'<script>{js}</script>')
errors=[]
checks=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1659,'height':948})
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_content(html, wait_until='load')
    page.locator('#queueFilterBtn').click(); page.locator('#queuePopover button').nth(1).click(); checks.append('queue popover')
    page.locator('.queue-card').nth(1).click(); checks.append('queue switch')
    assert '藏文书法基础笔画' in page.locator('#articleTitle').text_content(); checks.append('title update')
    page.locator('.evidence-tab[data-tab="source"]').click(); checks.append('content tab switch')
    page.locator('.toc-subnode').nth(2).click(); checks.append('toc highlight feedback')
    page.locator('[data-action="supplement"]').click(); checks.append('action modal')
    assert page.locator('#actionModal').get_attribute('hidden') is None
    page.locator('.modal-close').click(); checks.append('modal close')
    browser.close()
report={'status':'passed' if not errors else 'failed','errors':errors,'checks':checks}
(root/'qa'/'interaction-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
