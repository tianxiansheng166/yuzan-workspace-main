import asyncio
import base64
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
ASSETS = [
    'assets/logo-symbol.png',
    'assets/hero-banner.png',
    'assets/task-read.png',
    'assets/task-write.png',
    'assets/task-study.png',
    'assets/task-test.png',
    'assets/task-later.png',
    'assets/profile-avatar.png',
    'assets/left-bottom-art.png',
]
OUTPUTS = [
    ('desktop.png', 1660, 948),
    ('tablet.png', 1024, 1280),
    ('mobile.png', 390, 1400),
]


def data_uri(path: Path) -> str:
    mime = 'image/png' if path.suffix.lower() == '.png' else 'image/jpeg'
    encoded = base64.b64encode(path.read_bytes()).decode('ascii')
    return f'data:{mime};base64,{encoded}'


def build_html() -> str:
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    css = (ROOT / 'styles.css').read_text(encoding='utf-8')
    js = (ROOT / 'app.js').read_text(encoding='utf-8')
    for rel in ASSETS:
      uri = data_uri(ROOT / rel)
      html = html.replace(rel, uri)
      css = css.replace(rel, uri)
      js = js.replace(rel, uri)
    html = html.replace('<link rel="stylesheet" href="styles.css" />', f'<style>{css}</style>')
    html = html.replace('<script src="app.js"></script>', f'<script>{js}</script>')
    return html


async def main():
    markup = build_html()
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
        for name, width, height in OUTPUTS:
            page = await browser.new_page(viewport={'width': width, 'height': height}, device_scale_factor=1)
            await page.set_content(markup, wait_until='load')
            await page.wait_for_timeout(300)
            await page.screenshot(path=str(ROOT / 'qa' / name), full_page=True)
            await page.close()
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
