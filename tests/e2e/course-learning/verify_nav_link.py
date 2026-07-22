"""
P0 课程中心 → 视频播放器 导航链路验证
=====================================
1. 登录学生账号，注入 localStorage
2. 打开课程中心，等待 .cc-card 渲染
3. 抓取第一张课程卡片的 data-assignment-id
4. 点击该卡片，验证 URL 跳转到 /student/courses/course-detail/?id=...
5. 等待播放器 #cpMain 出现（或 #cpError / #cpLoading）
6. 报告跳转结果与播放器加载状态
"""
from pathlib import Path
import json
import os
from playwright.sync_api import sync_playwright

BASE = os.environ.get("YUZAN_WEB_BASE", "http://127.0.0.1:4175")
API_BASE = os.environ.get("YUZAN_API_BASE", "http://127.0.0.1:4000")
OUT_DIR = Path("evidence/p0-final-e2e-closure")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def login_student(page):
    resp = page.request.post(
        f"{API_BASE}/api/v1/auth/login",
        data={"identifier": "student.test", "password": "YuzanTest!2026"},
    )
    if not resp.ok:
        return None
    return resp.json().get("data") or {}


def seed_storage(page, payload):
    page.goto(f"{BASE}/login/", wait_until="domcontentloaded")
    page.evaluate("""payload => {
      if (payload.accessToken) localStorage.setItem('yuzan-access-token', payload.accessToken);
      if (payload.user) localStorage.setItem('yuzan-current-user', JSON.stringify(payload.user));
      if (payload.activeSchoolId) localStorage.setItem('yuzan-active-school-id', payload.activeSchoolId);
    }""", payload)


def main():
    result = {
        "scenario": "courses -> player navigation",
        "steps": [],
        "success": False,
    }
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()

        # Step 1: login
        payload = login_student(page)
        if not payload:
            result["steps"].append({"step": "login", "ok": False, "reason": "login failed"})
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return
        seed_storage(page, payload)
        result["steps"].append({"step": "login", "ok": True, "user": payload.get("user", {}).get("displayName")})

        # Step 2: open courses page
        page.goto(f"{BASE}/student/courses/", wait_until="domcontentloaded", timeout=15000)
        try:
            page.wait_for_selector(".cc-card", timeout=10000)
        except Exception:
            pass
        page.wait_for_timeout(1500)
        card_count = page.locator(".cc-card").count()
        first_id = page.evaluate("""() => {
          const c = document.querySelector('.cc-card');
          return c ? c.dataset.assignmentId : null;
        }""")
        result["steps"].append({
            "step": "courses_loaded",
            "ok": card_count > 0,
            "card_count": card_count,
            "first_assignment_id": first_id,
        })
        page.screenshot(path=str(OUT_DIR / "nav-courses-before-click.png"), full_page=True)

        if card_count == 0 or not first_id:
            result["steps"].append({"step": "no_card_to_click", "ok": False})
            print(json.dumps(result, ensure_ascii=False, indent=2))
            browser.close()
            return

        # Step 3: click first card (avoid action buttons)
        clicked = page.evaluate("""() => {
          const card = document.querySelector('.cc-card');
          if (!card) return false;
          // simulate click on cover area, not action buttons
          const cover = card.querySelector('.cc-card-cover') || card;
          cover.click();
          return true;
        }""")
        result["steps"].append({"step": "click_card", "ok": clicked})

        # Step 4: verify URL jump
        page.wait_for_timeout(1500)
        try:
            page.wait_for_load_state("domcontentloaded", timeout=10000)
        except Exception:
            pass
        current_url = page.url
        expected_prefix = f"{BASE}/student/courses/course-detail/"
        url_ok = current_url.startswith(expected_prefix) and ("id=" in current_url)
        result["steps"].append({
            "step": "url_jump",
            "ok": url_ok,
            "current_url": current_url,
            "expected_prefix": expected_prefix,
        })

        # Step 5: wait for player main element
        player_state = "unknown"
        try:
            page.wait_for_selector("#cpMain:not([hidden]), #cpError, #cpLoading", timeout=12000)
            page.wait_for_timeout(2000)
        except Exception:
            pass

        cp_main_visible = page.locator("#cpMain:not([hidden])").count() > 0
        cp_error_visible = page.locator("#cpError:not([hidden])").count() > 0
        cp_loading_visible = page.locator("#cpLoading:not([hidden])").count() > 0
        cp_video_present = page.locator("#cpVideo").count() > 0
        cp_info_title = page.evaluate("""() => {
          const el = document.querySelector('#cpInfoTitle');
          return el ? (el.textContent || '').trim() : null;
        }""")

        if cp_main_visible:
            player_state = "main_loaded"
        elif cp_error_visible:
            player_state = "error_shown"
        elif cp_loading_visible:
            player_state = "still_loading"
        else:
            player_state = "no_state"

        result["steps"].append({
            "step": "player_load",
            "ok": cp_main_visible,
            "player_state": player_state,
            "cp_video_present": cp_video_present,
            "cp_info_title": cp_info_title,
        })
        page.screenshot(path=str(OUT_DIR / "nav-player-after-click.png"), full_page=True)

        result["success"] = url_ok and cp_main_visible
        browser.close()

    print(json.dumps(result, ensure_ascii=False, indent=2))
    (OUT_DIR / "nav_link_report.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
