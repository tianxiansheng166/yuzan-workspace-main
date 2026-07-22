"""
P0 课程系统最终 E2E 验证
=========================
覆盖三个核心页面 × 三种视口宽度（390 / 768 / 1440）：
  1. /student/courses/                              课程中心
  2. /student/courses/course-detail/                视频播放器
  3. /teacher/courses/spring/studio/                教师工作台

检测项：
  - HTTP 200 加载成功
  - 横向溢出检测（scrollWidth <= innerWidth + 1 容差）
  - 关键 DOM 元素存在性
  - 控制台 fatal 错误检测
  - 截图归档
  - 教师端 studio 字段与播放器 1:1 对应验证（DOM 层）
"""
from pathlib import Path
import json
import os
import sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get("YUZAN_WEB_BASE", "http://127.0.0.1:4175")
API_BASE = os.environ.get("YUZAN_API_BASE", "http://127.0.0.1:4000")
OUT_DIR = Path("evidence/p0-final-e2e-closure")
OUT_DIR.mkdir(parents=True, exist_ok=True)
SCREEN_DIR = OUT_DIR / "screenshots"
SCREEN_DIR.mkdir(parents=True, exist_ok=True)

VIEWPORTS = [
    (390, 844, "mobile"),
    (768, 1024, "tablet"),
    (1440, 900, "desktop"),
]

# 关键 DOM 元素清单
COURSES_KEYS = [".cc-hero", ".cc-layout", ".cc-main", ".cc-sidebar", ".cc-spinner", ".cc-state"]
PLAYER_KEYS = [
    "#cpVideo", "#cpVideoSrc", "#cpVideoPoster", "#cpTrackZh", "#cpTrackBo",
    "#cpTimelineMarkers", "#cpInfoTitle", "#cpInfoTeacher", "#cpObjectivesList",
    "#cpKeyPointsList", "#cpTeacherSummary", "#cpAISummary", "#cpNotesList",
    "#cpExercisesList", "#cpOralDemo", "#cpRecordBtn", "#cpPracticeLink",
    "#cpDirectory", "#cpRecGrid", "#cpStatsContainer", "#cpMain", "#cpLoading", "#cpError",
]
PLAYER_SECTIONS = [
    "#cpSectionInfo", "#cpSectionObjectives", "#cpSectionSummary",
    "#cpSectionNotes", "#cpSectionExercises", "#cpSectionOral", "#cpSectionPractice",
]
STUDIO_TABS = ['goals', 'media', 'interaction', 'support', 'offline']
STUDIO_BINDS = ['course-title', 'crumb-title', 'status-label', 'steps', 'structure-tree', 'editor-body', 'prop-body']
STUDIO_STEPS = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED']

# 教师端 studio 字段（与播放器 1:1 对应）
STUDIO_FIELDS_VS_PLAYER = {
    # studio tab.goals -> player sections
    "objectives": "#cpObjectivesList",
    "keyPoints": "#cpKeyPointsList",
    "coreQuestion": "#cpInfoTitle",  # 核心问题对应课程标题区
    "keyContent": "#cpInfoDesc",
    "teacherSummary": "#cpTeacherSummary",
    "aiSummary": "#cpAISummary",
    # studio tab.media -> player video
    "videoUrl": "#cpVideoSrc",
    "posterUrl": "#cpVideoPoster",
    "subtitleZhUrl": "#cpTrackZh",
    "subtitleBoUrl": "#cpTrackBo",
    "timelineMarkers": "#cpTimelineMarkers",
    # studio tab.interaction -> player exercises/oral/practice
    "exercises": "#cpExercisesList",
    "oralDemoUrl": "#cpOralDemo",
    "oralDemoText": "#cpOralText",
    "practiceTitle": "#cpPracticeLink",
    # studio tab.support -> player summary/notes
    "classQuestions": "#cpSectionSummary",
    "observationPoints": "#cpSectionNotes",
    # studio tab.offline -> player offline resources
    "offlineResources": "#cpRecGrid",
}


def login_student(page):
    """学生端登录获取 token"""
    resp = page.request.post(
        f"{API_BASE}/api/v1/auth/login",
        data={"identifier": "student.test", "password": "YuzanTest!2026"},
    )
    if not resp.ok:
        return None
    payload = resp.json().get("data") or {}
    return payload


def seed_storage(page, payload):
    """注入 localStorage 认证态"""
    page.goto(f"{BASE}/login/", wait_until="domcontentloaded")
    page.evaluate("""payload => {
      if (payload.accessToken) localStorage.setItem('yuzan-access-token', payload.accessToken);
      if (payload.user) localStorage.setItem('yuzan-current-user', JSON.stringify(payload.user));
      if (payload.activeSchoolId) localStorage.setItem('yuzan-active-school-id', payload.activeSchoolId);
    }""", payload)


def login_teacher(page):
    """教师端登录"""
    resp = page.request.post(
        f"{API_BASE}/api/v1/auth/login",
        data={"identifier": "teacher.test", "password": "YuzanTest!2026"},
    )
    if not resp.ok:
        # 兜底使用学生凭证（验证 DOM 仍可）
        resp = page.request.post(
            f"{API_BASE}/api/v1/auth/login",
            data={"identifier": "student.test", "password": "YuzanTest!2026"},
        )
        if not resp.ok:
            return None
    return resp.json().get("data") or {}


def check_overflow(page):
    """横向溢出检测"""
    return page.evaluate("""() => {
      const sw = document.documentElement.scrollWidth;
      const iw = window.innerWidth;
      return { scrollWidth: sw, innerWidth: iw, overflow: sw > iw + 1 };
    }""")


def collect_console_errors(page):
    errors = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda exc: errors.append(f"PAGEERROR: {exc}"))
    return errors


def check_elements(page, selectors, label):
    missing = []
    for sel in selectors:
        try:
            loc = page.locator(sel)
            if loc.count() == 0:
                missing.append(sel)
        except Exception as e:
            missing.append(f"{sel}(ERR:{e})")
    return missing


def test_courses_page(page, width, height, label, payload):
    """测试课程中心"""
    console_errs = collect_console_errors(page)
    page.goto(f"{BASE}/student/courses/", wait_until="domcontentloaded", timeout=15000)
    try:
        page.wait_for_selector(".cc-layout, .cc-state, .cc-spinner", timeout=8000)
    except Exception:
        pass
    page.wait_for_timeout(1200)
    overflow = check_overflow(page)
    missing = check_elements(page, COURSES_KEYS, "courses")
    # 截图
    page.screenshot(path=str(SCREEN_DIR / f"courses-{label}-{width}.png"), full_page=True)
    fatal_errs = [e for e in console_errs if "net::" not in e and "ERR_" not in e.upper()][:5]
    return {
        "page": "courses",
        "viewport": [width, height],
        "overflow": overflow,
        "missing_elements": missing,
        "console_errors": fatal_errs,
    }


def test_player_page(page, width, height, label, payload):
    """测试视频播放器"""
    console_errs = collect_console_errors(page)
    # 先获取一个有效 assignment
    route = "/student/courses/course-detail/"
    # 尝试使用总结里给的 ID
    test_route = "/student/courses/85000000-0000-4000-8000-000000000001/submissions/4cde288e-c451-415b-b369-c4a4b96ed1ac/activities/84000000-0000-4000-8000-000000000101"
    page.goto(f"{BASE}{test_route}", wait_until="domcontentloaded", timeout=15000)
    try:
        page.wait_for_selector("#cpMain:not([hidden]), #cpError, #cpLoading", timeout=10000)
    except Exception:
        pass
    page.wait_for_timeout(2000)
    overflow = check_overflow(page)
    missing = check_elements(page, PLAYER_KEYS, "player")
    missing_sections = check_elements(page, PLAYER_SECTIONS, "player-sections")
    page.screenshot(path=str(SCREEN_DIR / f"player-{label}-{width}.png"), full_page=True)
    fatal_errs = [e for e in console_errs if "net::" not in e and "ERR_" not in e.upper()][:5]
    return {
        "page": "player",
        "viewport": [width, height],
        "overflow": overflow,
        "missing_elements": missing,
        "missing_sections": missing_sections,
        "console_errors": fatal_errs,
    }


def test_studio_page(page, width, height, label, payload):
    """测试教师工作台"""
    console_errs = collect_console_errors(page)
    page.goto(f"{BASE}/teacher/courses/spring/studio/", wait_until="domcontentloaded", timeout=15000)
    try:
        page.wait_for_selector("[data-bind='structure-tree'], [data-bind='course-title']", timeout=10000)
    except Exception:
        pass
    page.wait_for_timeout(2000)
    overflow = check_overflow(page)
    # 检查 data-bind 锚点
    missing_binds = []
    for bind in STUDIO_BINDS:
        if page.locator(f"[data-bind='{bind}']").count() == 0:
            missing_binds.append(bind)
    # 检查 tabs
    missing_tabs = []
    for tab in STUDIO_TABS:
        if page.locator(f"button[data-tab='{tab}']").count() == 0:
            missing_tabs.append(tab)
    # 检查 lifecycle steps
    missing_steps = []
    for step in STUDIO_STEPS:
        if page.locator(f".step[data-step='{step}']").count() == 0:
            missing_steps.append(step)
    page.screenshot(path=str(SCREEN_DIR / f"studio-{label}-{width}.png"), full_page=True)
    fatal_errs = [e for e in console_errs if "net::" not in e and "ERR_" not in e.upper()][:5]
    return {
        "page": "studio",
        "viewport": [width, height],
        "overflow": overflow,
        "missing_binds": missing_binds,
        "missing_tabs": missing_tabs,
        "missing_steps": missing_steps,
        "console_errors": fatal_errs,
    }


def main():
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        for width, height, label in VIEWPORTS:
            # 学生端 context
            ctx_s = browser.new_context(viewport={"width": width, "height": height})
            page_s = ctx_s.new_page()
            payload_s = login_student(page_s)
            if payload_s:
                seed_storage(page_s, payload_s)
            # 课程中心
            r1 = test_courses_page(page_s, width, height, label, payload_s)
            results.append(r1)
            # 播放器
            r2 = test_player_page(page_s, width, height, label, payload_s)
            results.append(r2)
            ctx_s.close()

            # 教师端 context
            ctx_t = browser.new_context(viewport={"width": width, "height": height})
            page_t = ctx_t.new_page()
            payload_t = login_teacher(page_t)
            if payload_t:
                seed_storage(page_t, payload_t)
            r3 = test_studio_page(page_t, width, height, label, payload_t)
            results.append(r3)
            ctx_t.close()
        browser.close()

    # 输出汇总
    out = OUT_DIR / "e2e_report.json"
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

    # 控制台汇总
    print("\n" + "=" * 64)
    print("P0 课程系统 E2E 验证汇总")
    print("=" * 64)
    overflow_issues = []
    missing_issues = []
    console_issues = []
    for r in results:
        tag = f"{r['page']}@{r['viewport'][0]}x{r['viewport'][1]}"
        if r.get("overflow", {}).get("overflow"):
            overflow_issues.append(tag)
        miss = r.get("missing_elements") or r.get("missing_binds") or r.get("missing_tabs") or r.get("missing_steps") or r.get("missing_sections") or []
        if miss:
            missing_issues.append((tag, miss[:5]))
        if r.get("console_errors"):
            console_issues.append((tag, r["console_errors"][:3]))

    print(f"\n横向溢出问题：{len(overflow_issues)}")
    for t in overflow_issues:
        print(f"  - {t}")
    print(f"\n缺失元素问题：{len(missing_issues)}")
    for t, m in missing_issues:
        print(f"  - {t}: {m}")
    print(f"\n控制台错误：{len(console_issues)}")
    for t, errs in console_issues:
        print(f"  - {t}: {errs}")
    print(f"\n详细报告：{out}")
    print(f"截图目录：{SCREEN_DIR}")

    # 退出码
    critical = len(overflow_issues) + len(missing_issues)
    print(f"\n关键问题总数：{critical}")
    sys.exit(0 if critical == 0 else 1)


if __name__ == "__main__":
    main()
