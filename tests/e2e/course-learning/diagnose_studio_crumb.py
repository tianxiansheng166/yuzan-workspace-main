"""诊断 studio crumb-title 在 Playwright 中为何检测失败"""
import os
from playwright.sync_api import sync_playwright

BASE = os.environ.get("YUZAN_WEB_BASE", "http://127.0.0.1:4175")
API_BASE = os.environ.get("YUZAN_API_BASE", "http://127.0.0.1:4000")

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()

    # 登录
    resp = page.request.post(
        f"{API_BASE}/api/v1/auth/login",
        data={"identifier": "student.test", "password": "YuzanTest!2026"},
    )
    payload = resp.json().get("data") or {} if resp.ok else {}

    # 注入 localStorage
    page.goto(f"{BASE}/login/", wait_until="domcontentloaded")
    page.evaluate("""payload => {
      if (payload.accessToken) localStorage.setItem('yuzan-access-token', payload.accessToken);
      if (payload.user) localStorage.setItem('yuzan-current-user', JSON.stringify(payload.user));
      if (payload.activeSchoolId) localStorage.setItem('yuzan-active-school-id', payload.activeSchoolId);
    }""", payload)

    # 捕获控制台
    errors = []
    page.on("console", lambda msg: errors.append(f"{msg.type}: {msg.text}"))
    page.on("pageerror", lambda exc: errors.append(f"PAGEERROR: {exc}"))

    # 打开 studio 页面
    resp = page.goto(f"{BASE}/teacher/courses/spring/studio/", wait_until="domcontentloaded", timeout=15000)
    print(f"HTTP status: {resp.status if resp else 'None'}")

    # 等待核心元素
    try:
        page.wait_for_selector("[data-bind='structure-tree'], [data-bind='course-title']", timeout=10000)
        print("✓ structure-tree/course-title 已出现")
    except Exception as e:
        print(f"✗ 等待元素失败: {e}")

    page.wait_for_timeout(3000)  # 给 studio.js 充分时间渲染

    # 全面诊断
    diag = page.evaluate("""() => {
      const result = {};
      // 找所有 data-bind 元素
      const allBinds = document.querySelectorAll('[data-bind]');
      result.all_data_binds = Array.from(allBinds).map(el => ({
        bind: el.dataset.bind,
        tag: el.tagName,
        text: (el.textContent || '').substring(0, 50)
      }));
      // 特别看 crumb-title
      const crumb = document.querySelector('[data-bind="crumb-title"]');
      result.crumb_title = crumb ? {
        exists: true,
        tag: crumb.tagName,
        parent_tag: crumb.parentElement?.tagName,
        parent_class: crumb.parentElement?.className,
        html: crumb.outerHTML.substring(0, 200)
      } : { exists: false };
      // 看 crumb 容器
      const crumbContainer = document.querySelector('.crumb');
      result.crumb_container = crumbContainer ? {
        exists: true,
        innerHTML: crumbContainer.innerHTML.substring(0, 300)
      } : { exists: false };
      // 看 topbar
      const topbar = document.querySelector('.topbar');
      result.topbar = topbar ? {
        exists: true,
        innerHTML: topbar.innerHTML.substring(0, 500)
      } : { exists: false };
      // 看 .design 元素
      const design = document.querySelector('.design');
      result.design = design ? {
        exists: true,
        classList: Array.from(design.classList),
        dataWidth: design.dataset.width,
        dataHeight: design.dataset.height,
        childCount: design.children.length,
        transform: design.style.transform
      } : { exists: false };
      // body 类
      result.bodyClass = document.body.className;
      result.url = location.href;
      result.title = document.title;
      return result;
    }""")
    print("\n=== 诊断结果 ===")
    import json
    print(json.dumps(diag, ensure_ascii=False, indent=2))

    # 看控制台错误
    print(f"\n=== 控制台错误（前10条） ===")
    for e in errors[:10]:
        print(f"  - {e}")

    # 直接尝试用脚本中的方式查找
    count = page.locator("[data-bind='crumb-title']").count()
    print(f"\nlocator(\"[data-bind='crumb-title']\").count() = {count}")

    # 尝试用双引号
    count2 = page.locator('[data-bind="crumb-title"]').count()
    print(f'locator(\'[data-bind="crumb-title"]\').count() = {count2}')

    # 截图
    page.screenshot(path="evidence/p0-final-e2e-closure/screenshots/diagnose-studio.png", full_page=True)
    print("\n截图已保存: diagnose-studio.png")

    browser.close()
