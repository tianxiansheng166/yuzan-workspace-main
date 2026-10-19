#!/usr/bin/env python3
"""VISUAL_FIXTURE_ONLY: native Chrome layout check, NOT an API/PG E2E."""

from __future__ import annotations

import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[3]
FRONTEND = ROOT / "frontend"
EVIDENCE = ROOT / "evidence" / "yz-rd-t043"
EVIDENCE.mkdir(parents=True, exist_ok=True)

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND), **kwargs)

    def log_message(self, *_args):
        pass


API_STUB = """
window.YuzanApi = {
  getToken: () => 'VISUAL_FIXTURE_ONLY',
  getStoredUser: () => ({ id: 'visual-student' }),
  getActiveSchoolId: () => 'visual-school',
  getStudentProfile: async () => ({ profile: {
    userId: 'visual-student', displayName: '视觉校验学生', schoolName: '测试学校',
    gradeBand: '七年级', className: '甲班',
  }}),
  getStudentToday: async () => ({
    version: 'student-today-v1', waiting: [], legacyTasks: [],
    summary: { latestFormalAssessment: null },
    primaryAction: {
      kind: 'TEACHER_REMEDIATION',
      title: '继续老师布置的朗读巩固',
      reason: '按照你的当前课堂任务继续学习，录音与反馈会保留在你的学习记录中。',
      cta: '继续本次练习',
      target: { href: '/student/practices/attempts/visual-attempt/runner/' }
    },
  }),
  listStudentCourses: async () => ({ courses: [
    { assignmentId: 'visual-course', title: '高原文化 · 诗歌听读',
      nextActivity: { title: '跟读一首诗' } }
  ] }),
  listPractices: async () => ({ items: [
    { id: 'visual-oral', title: '听后跟读 · 节奏专项', requiresRecording: true,
      abilityCategories: [], studentState: { completionStatus: 'NOT_STARTED' } }
  ] }),
  listAssessmentSessions: async () => ({ items: [], hasMore: false, nextCursor: null }),
};
"""


def main() -> None:
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                executable_path="/usr/bin/google-chrome", headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            try:
                observations = []
                for width in (390, 768, 1280, 1440):
                    page = browser.new_page(viewport={"width": width, "height": 844},
                                            device_scale_factor=1)
                    page.route("**/assets/api-client.js", lambda r: r.fulfill(
                        status=200, content_type="application/javascript", body=API_STUB))
                    page.route("**/assets/app-core.js", lambda r: r.fulfill(
                        status=200, content_type="application/javascript", body=""))
                    page.route("**/shared/student-nav.js", lambda r: r.fulfill(
                        status=200, content_type="application/javascript", body=""))
                    page.on("pageerror", lambda error: print("PAGE_JS_ERROR:", str(error)))
                    page.goto(f"http://127.0.0.1:{httpd.server_port}/student/today/",
                              wait_until="networkidle")
                    page.locator(".today-overview").wait_for(timeout=12000)
                    result = page.evaluate("""() => {
                      const q = (s) => document.querySelector(s)?.getBoundingClientRect();
                      const main = q('.today-primary');
                      const hint = q('.today-discover');
                      return {
                        width: window.innerWidth,
                        overflow: document.documentElement.scrollWidth - window.innerWidth,
                        primaryTop: main?.top,
                        optionalTop: hint?.top,
                        optionalCount: document.querySelectorAll('.today-discover').length,
                        fourCardCount: document.querySelectorAll('.today-skill-card').length,
                        primaryTitle: document.querySelector('.today-primary h2')?.textContent,
                      };
                    }""")
                    assert result["fourCardCount"] == 0, result
                    assert result["optionalCount"] <= 1, result
                    assert result["primaryTop"] < result["optionalTop"], result
                    assert result["overflow"] <= 0, result
                    page.screenshot(path=str(EVIDENCE / f"visual-fixture-{width}.png"),
                                    full_page=True)
                    observations.append(result)
                    page.close()
                (EVIDENCE / "visual-fixture-proof.json").write_text(
                    json.dumps({"verification": "VISUAL_FIXTURE_ONLY, NO BACKEND E2E",
                                "results": observations}, indent=2, ensure_ascii=False))
                print(json.dumps(observations, ensure_ascii=False))
            finally:
                browser.close()
    finally:
        httpd.shutdown()
        httpd.server_close()


if __name__ == "__main__":
    main()
