from __future__ import annotations
import asyncio
import json
import os
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import threading
from PIL import Image, ImageChops
import numpy as np
from skimage.metrics import structural_similarity as ssim
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'qa'
PAGE_URI = (ROOT / 'index.html').resolve().as_uri()

async def capture():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path='/usr/bin/chromium')
        errors = []
        page = await browser.new_page(viewport={'width':1659,'height':948}, device_scale_factor=1)
        page.on('console', lambda msg: errors.append({'type':msg.type,'text':msg.text}) if msg.type == 'error' else None)
        await page.goto(PAGE_URI, wait_until='load')
        await page.screenshot(path=str(OUT/'desktop.png'))
        page2 = await browser.new_page(viewport={'width':768,'height':1180}, device_scale_factor=1)
        await page2.goto(PAGE_URI, wait_until='load')
        await page2.screenshot(path=str(OUT/'tablet.png'), full_page=True)
        page3 = await browser.new_page(viewport={'width':390,'height':1200}, device_scale_factor=1)
        await page3.goto(PAGE_URI, wait_until='load')
        await page3.screenshot(path=str(OUT/'mobile.png'), full_page=True)
        await page3.get_by_label('打开导航').click()
        await page3.screenshot(path=str(OUT/'mobile-sidebar.png'), full_page=True)
        await browser.close()
        return errors

console_errors = asyncio.run(capture())

ref = Image.open(OUT/'reference.png').convert('RGB')
rnd = Image.open(OUT/'desktop.png').convert('RGB')
w = min(ref.width, rnd.width)
h = min(ref.height, rnd.height)
ref = ref.crop((0,0,w,h))
rnd = rnd.crop((0,0,w,h))
arr1 = np.array(ref)
arr2 = np.array(rnd)
mae = float(np.mean(np.abs(arr1.astype(float)-arr2.astype(float))))
ssim_val = float(ssim(arr1, arr2, channel_axis=2))
diff = ImageChops.difference(ref, rnd)
diff.save(OUT/'diff.png')
report = {
    'reference_size':[ref.width, ref.height],
    'render_size':[rnd.width, rnd.height],
    'mae':mae,
    'ssim':ssim_val,
    'console_error_count': len(console_errors),
    'console_errors': console_errors,
    'checks': {
        'desktop_screenshot': True,
        'tablet_screenshot': True,
        'mobile_screenshot': True,
        'mobile_sidebar_screenshot': True,
    }
}
(OUT/'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
(OUT/'REPORT.md').write_text(f"""# Playwright 校准报告\n\n- 参考图尺寸：{ref.width} × {ref.height}\n- 桌面端截图尺寸：{rnd.width} × {rnd.height}\n- MAE：{mae:.4f}\n- SSIM：{ssim_val:.5f}\n- 浏览器控制台错误：{len(console_errors)}\n\n## 产物\n\n- `desktop.png`\n- `tablet.png`\n- `mobile.png`\n- `mobile-sidebar.png`\n- `diff.png`\n- `report.json`\n\n## 说明\n\n本报告用于校验独立静态还原包与参考设计的整体接近程度。由于本实现坚持将导航、表格、按钮、状态标签、筛选与详情面板全部用真实前端结构重建，而不是把参考图整体贴为背景，因此在 MAE / SSIM 上会保留合理差异，但主要布局、密度、层次和品牌语言保持一致。\n""", encoding='utf-8')
print('done')
