from pathlib import Path
from urllib.parse import quote

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parent
SCREENSHOTS = ROOT / "screenshots"
BASE_PATH = "/docs/项目指导/页面设计包/wireframes/index.html"
BASE_URL = "http://127.0.0.1:4176" + quote(BASE_PATH)

NORMAL_PAGES = [f"S{index:02d}" for index in range(1, 10)]
EXCEPTION_CASES = [
    ("S03", "error", None, "S03-device-blocked-1440.png"),
    ("S04", "saved-local", "LISTEN_REPEAT", "S04-saved-local-1440.png"),
    ("S04", "upload-failed", "READ_ALOUD", "S04-upload-failed-1440.png"),
    ("S06", "provider-unavailable", None, "S06-provider-unavailable-1440.png"),
    ("S07", "empty", None, "S07-data-insufficient-1440.png"),
    ("S08", "empty", None, "S08-empty-1440.png"),
    ("S09", "empty", None, "S09-empty-1440.png"),
]
MOBILE_POLICY_CASES = [
    ("S03", "normal", None, "SELF_PRACTICE", "UNSPECIFIED", "S03-self-practice-executable-390.png"),
    ("S04", "normal", "READ_ALOUD", "SELF_PRACTICE", "UNSPECIFIED", "S04-self-practice-read-aloud-390.png"),
    ("S05", "normal", None, "SELF_PRACTICE", "UNSPECIFIED", "S05-self-practice-submit-review-390.png"),
    ("S04", "normal", "READ_ALOUD", "STAGE_ASSESSMENT", "UNSPECIFIED", "S04-stage-assessment-blocked-390.png"),
]


def route(
    page_id: str,
    state: str = "normal",
    item_type: str | None = None,
    mode: str = "ASSIGNMENT",
    mobile_policy: str = "UNSPECIFIED",
) -> str:
    query = f"state={state}"
    if item_type:
        query += f"&type={item_type}"
    query += f"&mode={mode}&mobilePolicy={mobile_policy}"
    return f"{BASE_URL}#/{page_id}?{query}"


def open_case(
    page,
    page_id: str,
    state: str = "normal",
    item_type: str | None = None,
    mode: str = "ASSIGNMENT",
    mobile_policy: str = "UNSPECIFIED",
):
    target = route(page_id, state, item_type, mode, mobile_policy)
    for attempt in range(2):
        try:
            page.goto(target, wait_until="networkidle")
            break
        except PlaywrightError:
            if attempt == 1:
                raise
    page.locator("#app .page-shell").wait_for()
    assert page.locator(".prototype-banner").inner_text() == "低保真功能线框，不代表接口已实现"
    assert page.locator(".fixture-error").count() == 0
    assert page.locator(".demo-watermark").count() == 1


def screenshot(
    page,
    page_id: str,
    state: str,
    width: int,
    filename: str,
    item_type: str | None = None,
    mode: str = "ASSIGNMENT",
    mobile_policy: str = "UNSPECIFIED",
):
    page.set_viewport_size({"width": width, "height": 1000 if width > 390 else 844})
    open_case(page, page_id, state, item_type, mode, mobile_policy)
    page.evaluate("document.activeElement && document.activeElement.blur()")
    page.screenshot(path=str(SCREENSHOTS / filename), full_page=True)


def main():
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    console_errors: list[str] = []
    page_errors: list[str] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda error: page_errors.append(str(error)))

        # Route and control checks.
        open_case(page, "S01")
        skip_top = page.locator(".skip-link").evaluate("(element) => getComputedStyle(element).top")
        assert float(skip_top.removesuffix("px")) < 0, f"Skip link should be off-canvas, got top={skip_top}"
        assert "卓玛措" in page.locator("#student-context").inner_text()
        assert "古诗文朗读与理解训练" in page.locator("#app").inner_text()
        assert page.locator(".primary-nav a").all_inner_texts() == [
            "今日学习", "课程学习", "练习与测评", "成长档案"
        ]
        assert page.locator(".mobile-nav a").all_inner_texts() == [
            "今日学习", "课程学习", "练习与测评", "成长档案"
        ]
        assert page.locator(".primary-nav a.active").inner_text() == "练习与测评"
        assert page.locator(".mobile-nav a.active").inner_text() == "练习与测评"
        open_case(page, "S03", mode="SELF_PRACTICE")
        page.locator(".design-panel summary").click()
        assert "/student/practices/attempts/:attemptId/prepare" in page.locator(".design-panel").inner_text()
        page.locator("#page-select").select_option("S04")
        page.wait_for_url("**#/S04?state=normal&type=READ_ALOUD&mode=SELF_PRACTICE&mobilePolicy=UNSPECIFIED")
        page.locator("#type-select").select_option("FILL_BLANK")
        page.wait_for_url("**type=FILL_BLANK**")
        assert "当前设计 Fixture 无此题型实例" in page.locator("#app").inner_text()
        page.locator("#type-select").select_option("LISTEN_ANSWER")
        page.wait_for_url("**type=LISTEN_ANSWER**")
        assert "当前设计 Fixture 无此题型实例" in page.locator("#app").inner_text()
        page.locator("#type-select").select_option("READ_ALOUD")
        page.locator("#state-select").select_option("recording")
        page.wait_for_url("**state=recording&type=READ_ALOUD**")
        assert "录音中" in page.locator("#app").inner_text()
        page.locator(".design-panel summary").click()
        assert "统一执行聚合 PARTIAL" in page.locator(".design-panel").inner_text()

        # Every executor type must render through the same shell.
        for item_type in (
            "LISTEN_ONLY", "LISTEN_REPEAT", "READ_ALOUD", "LISTEN_RETELL",
            "LISTEN_ANSWER", "SINGLE_CHOICE", "FILL_BLANK", "SHORT_ANSWER",
            "MULTIPLE_CHOICE",
        ):
            page.set_viewport_size({"width": 1440, "height": 1000})
            open_case(page, "S04", "normal", item_type)
            assert page.locator(".executor-shell").count() == 1
            if item_type in {"LISTEN_ANSWER", "FILL_BLANK"}:
                assert "当前设计 Fixture 无此题型实例" in page.locator("#app").inner_text()

        # Negative-state UI must not leak protected evidence or stale success scores.
        open_case(page, "S08", "permission")
        assert "跟读《静夜思》" not in page.locator("#app").inner_text()
        open_case(page, "S07", "error")
        assert "76.7" not in page.locator("#app").inner_text()
        open_case(page, "S06", "provider-unavailable")
        assert "76.7" not in page.locator("#app").inner_text()

        # Delivery-aware mobile execution checks.
        page.set_viewport_size({"width": 390, "height": 844})
        open_case(page, "S03", mode="SELF_PRACTICE")
        assert page.locator(".device-loop").is_visible()
        assert page.locator(".device-loop .action-row .primary").is_visible()
        assert "手机可执行" in page.locator(".mobile-policy-note").inner_text()

        open_case(page, "S04", item_type="READ_ALOUD", mode="SELF_PRACTICE")
        assert page.locator(".executor-shell").is_visible()
        assert page.locator(".record-control").is_visible()
        record_box = page.locator(".record-control").bounding_box()
        assert record_box and record_box["width"] > record_box["height"] * 3
        assert "完整听音、录音、作答和本地保存" in page.locator(".mobile-policy-note").inner_text()

        open_case(page, "S05", mode="SELF_PRACTICE")
        assert page.locator(".review-layout").is_visible()
        assert page.locator(".submit-gate .primary").is_visible()

        open_case(page, "S04", item_type="READ_ALOUD", mode="STAGE_ASSESSMENT")
        assert not page.locator(".executor-shell").is_visible()
        assert "本次阶段测评需要使用电脑或平板" in page.locator(".mobile-policy-note").inner_text()

        open_case(page, "S04", item_type="READ_ALOUD", mode="COURSE_PRACTICE")
        assert page.locator(".executor-shell").is_visible()
        open_case(page, "S04", item_type="READ_ALOUD", mode="ASSIGNMENT", mobile_policy="BLOCK")
        assert not page.locator(".executor-shell").is_visible()
        assert "建议使用电脑或平板" in page.locator(".mobile-policy-note").inner_text()

        # Validate all pages at 1440 and 390 without replacing the frozen existing screenshots.
        for page_id in NORMAL_PAGES:
            page.set_viewport_size({"width": 1440, "height": 1000})
            open_case(page, page_id, item_type="READ_ALOUD" if page_id == "S04" else None)
            page.set_viewport_size({"width": 390, "height": 844})
            open_case(page, page_id, item_type="READ_ALOUD" if page_id == "S04" else None)

        # Validate the required 1024 layouts without replacing the frozen screenshots.
        for page_id in ("S01", "S04", "S07"):
            page.set_viewport_size({"width": 1024, "height": 1000})
            open_case(page, page_id, item_type="READ_ALOUD" if page_id == "S04" else None)

        # Validate existing exceptional states without replacing the frozen screenshots.
        for page_id, state, item_type, filename in EXCEPTION_CASES:
            assert (SCREENSHOTS / filename).exists()
            page.set_viewport_size({"width": 1440, "height": 1000})
            open_case(page, page_id, state, item_type)

        # Required Delivery-aware 390 screenshots.
        for page_id, state, item_type, mode, mobile_policy, filename in MOBILE_POLICY_CASES:
            screenshot(page, page_id, state, 390, filename, item_type, mode, mobile_policy)

        browser.close()

    if console_errors:
        raise AssertionError("Console errors:\n" + "\n".join(console_errors))
    if page_errors:
        raise AssertionError("Page errors:\n" + "\n".join(page_errors))

    files = sorted(path.name for path in SCREENSHOTS.glob("*.png"))
    expected_count = len(NORMAL_PAGES) * 2 + 3 + len(EXCEPTION_CASES) + len(MOBILE_POLICY_CASES)
    assert len(files) == expected_count, (len(files), expected_count, files)
    print(f"PASS pages={len(NORMAL_PAGES)} preserved_existing=28 mobile_policy=4 total={len(files)}")
    print("PASS fixture_fetch=true fallback_business_data=false console_errors=0 page_errors=0")


if __name__ == "__main__":
    main()
