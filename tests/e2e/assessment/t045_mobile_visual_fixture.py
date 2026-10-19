#!/usr/bin/env python3
"""VISUAL_FIXTURE_ONLY: exercise-first catalog layout, NOT a native API/PG E2E."""

from __future__ import annotations

import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[3]
FRONTEND = ROOT / "frontend"
EVIDENCE = ROOT / "evidence/yz-rd-t045"
EVIDENCE.mkdir(parents=True, exist_ok=True)
HTML = (FRONTEND / "assessment/practice-shell.html").read_text().replace(
    "__ASSESSMENT_PAGE__", "catalog"
)

STUB = r"""
window.YuzanApi = {
  getToken: () => 'VISUAL_FIXTURE_ONLY',
  listAssessmentSessions: async () => ({ items: [], nextCursor: null }),
  listAssignedRemediations: async () => ({ items: [] }),
  listPractices: async ({ catalogType, requiresRecording } = {}) => {
    const rows = Array.from({length: 6}, (_, i) => ({
      id: 'visual-' + i,
      title: ['古诗文朗读与理解', '停顿与节奏专项训练',
              '朗读发音专项训练', '听辨入门', '情境口语训练', '继续阅读'][i],
      summary: '真实目录格式的视觉占位数据；不用于产品业务验收。',
      gradeBand: '七年级', difficulty: '入门', catalogType: i % 2 ? 'SPECIALIZED' : 'MOCK',
      mode: 'SELF_PRACTICE', estimatedMinutes: 18,
      requiresRecording: Boolean(i % 2),
      abilityCategories: [i % 2 ? '发音基础' : '听辨训练'],
      studentState: { completionStatus: 'NOT_STARTED', favorite: false },
    }));
    const filtered = rows.filter(row =>
      (!catalogType || row.catalogType === catalogType) &&
      (!requiresRecording || row.requiresRecording));
    return {
      items: filtered, total: filtered.length, nextCursor: null,
      facets: { abilityCategory: [
        { value: '发音基础', count: 3 }, { value: '听辨训练', count: 3 }
      ] },
    };
  }
};
"""


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND), **kwargs)

    def do_GET(self):
        if self.path.startswith("/student/practices/"):
            data = HTML.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()

    def log_message(self, *_args):
        pass


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                executable_path="/usr/bin/google-chrome",
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            try:
                readings = []
                for width in (390, 768, 1280, 1440):
                    page = browser.new_page(viewport={"width": width, "height": 844})
                    page.route("**/assets/api-client.js*", lambda route: route.fulfill(
                        status=200, content_type="application/javascript", body=STUB
                    ))
                    page.route("**/shared/student-nav.js*", lambda route: route.fulfill(
                        status=200, content_type="application/javascript", body=""
                    ))
                    page.goto(
                        f"http://127.0.0.1:{server.server_port}/student/practices/",
                        wait_until="networkidle",
                    )
                    page.locator(".practice-tile").first.wait_for(timeout=10000)
                    metrics = page.evaluate("""() => {
                      const rect = document.querySelector('.practice-tile').getBoundingClientRect();
                      const ability = document.querySelector('.catalog-mobile-abilities');
                      return {
                        viewport: innerWidth,
                        firstCardDocumentY: Math.round(rect.top + scrollY),
                        overflow: document.documentElement.scrollWidth - innerWidth,
                        mobileAbilityVisible: Boolean(ability && getComputedStyle(ability).display !== 'none'),
                        mobileAbilityExpanded: Boolean(ability && ability.open),
                        tiles: document.querySelectorAll('.practice-tile').length,
                      };
                    }""")
                    assert metrics["overflow"] <= 0, metrics
                    assert metrics["tiles"] == 6, metrics
                    if width == 390:
                        assert metrics["firstCardDocumentY"] < 844, metrics
                        assert metrics["mobileAbilityVisible"], metrics
                        summary = page.locator(".catalog-mobile-abilities summary")
                        summary.focus()
                        summary.press("Enter")
                        assert page.locator(".catalog-mobile-abilities").evaluate(
                            "(el) => el.open"
                        )
                    page.screenshot(
                        path=str(EVIDENCE / f"visual-fixture-catalog-{width}.png"),
                        full_page=True,
                    )
                    readings.append(metrics)
                    page.close()
                (EVIDENCE / "visual-fixture-summary.json").write_text(
                    json.dumps({
                        "mode": "VISUAL_FIXTURE_ONLY — no authenticated API, PostgreSQL or MinIO",
                        "readings": readings
                    }, ensure_ascii=False, indent=2)
                )
                print(json.dumps(readings, ensure_ascii=False))
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
