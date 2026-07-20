from pathlib import Path
from base64 import b64encode
from playwright.sync_api import sync_playwright
import re, json
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text(encoding='utf-8')
css=(root/'styles.css').read_text(encoding='utf-8')
js=(root/'app.js').read_text(encoding='utf-8')
def uri(path):
    ext=path.suffix.lower(); mime={'.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'}[ext]
    return f'data:{mime};base64,'+b64encode(path.read_bytes()).decode()
for name in ['logo-symbol.png','header-ridge.png','student-avatar.jpg','teacher-avatar.jpg','paper-noise.png','grass.svg']:
    u=uri(root/'assets'/name); html=html.replace(f'assets/{name}',u); css=css.replace(f'assets/{name}',u)
html=re.sub(r'<link rel="stylesheet" href="styles\.css"\s*/?>',f'<style>{css}</style>',html)
html=html.replace('<script src="app.js"></script>',f'<script>{js}</script>')
report={'page_errors':[],'checks':{}}
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    context=browser.new_context(viewport={'width':1659,'height':948})
    page=context.new_page()
    page.on('pageerror',lambda err: report['page_errors'].append(str(err)))
    page.set_content(html,wait_until='load')
    page.locator('#answerInput').fill('短文按照冰雪消融、溪流欢唱、野花开放的顺序描写高原春天。')
    page.wait_for_timeout(700)
    stored=page.evaluate("JSON.parse(window.__exerciseStorage.getItem('yuzan-student-exercise-answers') || '{}')['0']")
    report['checks']['answer_saved_locally']=stored.startswith('短文按照')
    page.locator('#nextBtn').click()
    report['checks']['next_question_changes_content']='修辞手法' in page.locator('#questionText').inner_text()
    page.locator('#stepper .step').nth(3).click()
    page.locator('#nextBtn').click()
    report['checks']['submit_modal_opens']=page.locator('#submitModal').evaluate("e=>e.classList.contains('show')")
    report['checks']['incomplete_items_shown']=page.locator('#incompleteList span').count() >= 1
    page.locator('#confirmSubmit').click()
    report['checks']['pending_sync_status_shown']='待同步' in page.locator('#saveState').inner_text()
    page.locator('#offlineManage').click()
    page.locator('#toggleOffline').click()
    report['checks']['offline_state_shown']='离线' in page.locator('#onlineState').inner_text()
    browser.close()
report['passed']=not report['page_errors'] and all(report['checks'].values())
(root/'qa'/'interaction-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
