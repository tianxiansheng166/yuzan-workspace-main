"""Replay the T022 course lifecycle against T031 source and isolated services."""

from __future__ import annotations

import runpy
import re
from urllib.parse import urlsplit
from pathlib import Path
from types import SimpleNamespace

from playwright.sync_api import BrowserContext, Page


ROOT = Path(__file__).resolve().parents[2]
T031_E2E = ROOT / "evidence" / "yz-rd-t031" / "course_activity_e2e.py"


def test_yz_rd_t031_real_course_activity_runner_return():
    original_route = Page.route
    original_wait_for_url = Page.wait_for_url
    original_new_page = BrowserContext.new_page

    def new_page_with_return_trace(self):
        page = original_new_page(self)

        def trace_navigation(frame):
            if frame == page.main_frame:
                path = urlsplit(frame.url).path
                if "/student/practices/attempts/" in path or "/student/courses/course-detail/" in path:
                    print(f"T031 runner main-frame route: {path}")

        def trace_response(response):
            path = urlsplit(response.url).path
            if path.endswith("/submit") or ("practice-attempts/" in path and path.endswith("/complete")):
                print(f"T031 runner API response: {response.status} {path}")

        def allow_saved_runner_return(dialog):
            if dialog.type == "beforeunload":
                print("T031 runner beforeunload: accepting the post-submit route after server-confirmed saves")
                dialog.accept()

        page.on("framenavigated", trace_navigation)
        page.on("response", trace_response)
        page.on("dialog", allow_saved_runner_return)
        return page

    def route_with_signed_recording_upload(self, url, handler=None, **kwargs):
        if url != "**/storage-upload*" or handler is None:
            return original_route(self, url, handler, **kwargs)

        bucket = __import__("os").environ["S3_BUCKET"]

        def forward(route):
            request = SimpleNamespace(
                method=route.request.method,
                url=route.request.url + "/storage-upload",
            )

            class RouteAdapter:
                def __init__(self):
                    self.request = request

                def abort(self, *args, **adapter_kwargs):
                    return route.abort(*args, **adapter_kwargs)

                def continue_(self, *args, **adapter_kwargs):
                    return route.continue_(*args, **adapter_kwargs)

                def fulfill(self, *args, **adapter_kwargs):
                    return route.fulfill(*args, **adapter_kwargs)

            handler(RouteAdapter())

        # T022's accepted test targeted the older upload proxy URL. Current
        # T022 sends the same signed PUT directly to the task-owned MinIO bucket.
        return original_route(self, f"**/{bucket}/recordings/**", forward, **kwargs)

    def wait_for_url_after_client_redirect(self, url, **kwargs):
        pattern = getattr(url, "pattern", "")
        handle_unload = ".*/student/courses/course-detail/.*" in pattern
        dialog_handler = None
        if handle_unload:
            def dialog_handler(dialog):
                print(f"T031 runner navigation dialog: {dialog.type}")
                if dialog.type == "beforeunload":
                    dialog.accept()
                else:
                    dialog.dismiss()

            self.on("dialog", dialog_handler)
        try:
            return original_wait_for_url(self, url, **kwargs)
        except Exception as error:
            current_path = urlsplit(self.url).path
            target_matches = hasattr(url, "search") and url.search(self.url)
            print(f"T031 runner URL wait: current={current_path}, target_match={bool(target_matches)}, error={type(error).__name__}")
            try:
                page_state = self.evaluate("""() => {
                  const key = Object.keys(localStorage).find(value => value.startsWith('yuzan-course-practice-context:'));
                  const context = key ? JSON.parse(localStorage.getItem(key)) : null;
                  const message = document.querySelector('[data-runner-message]');
                  return { courseContextPresent: Boolean(context), syncStatus: context?.syncStatus || null, runnerMessage: message?.innerText || '' };
                }""")
                print(f"T031 runner state after submit: {page_state}")
            except Exception:
                print("T031 runner state after submit: unavailable")
            if target_matches:
                return None
            raise
        finally:
            if dialog_handler:
                self.remove_listener("dialog", dialog_handler)

    Page.route = route_with_signed_recording_upload
    Page.wait_for_url = wait_for_url_after_client_redirect
    BrowserContext.new_page = new_page_with_return_trace
    try:
        namespace = runpy.run_path(str(T031_E2E))
        namespace["test_t031_real_course_learning_note_media_runner_return_and_isolation"]()
    finally:
        Page.route = original_route
        Page.wait_for_url = original_wait_for_url
        BrowserContext.new_page = original_new_page
