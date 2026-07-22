from playwright.sync_api import sync_playwright
import os

out_dir = os.path.join(os.path.dirname(__file__), 'screenshots')
os.makedirs(out_dir, exist_ok=True)

pages = [
    ('student-today', 'http://localhost:4175/student/today'),
    ('student-courses', 'http://localhost:4175/student/courses'),
    ('teacher', 'http://localhost:4175/teacher'),
    ('admin', 'http://localhost:4175/admin'),
    ('volunteer', 'http://localhost:4175/volunteer'),
    ('research', 'http://localhost:4175/research'),
    ('teacher-tools', 'http://localhost:4175/teacher-tools'),
    ('plans', 'http://localhost:4175/plans'),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 900})
    for name, url in pages:
        page = context.new_page()
        page.goto(url, wait_until='networkidle')
        page.wait_for_timeout(1200)
        page.screenshot(path=os.path.join(out_dir, f'{name}.png'), full_page=False)
        print('saved', name)
        page.close()
    browser.close()
