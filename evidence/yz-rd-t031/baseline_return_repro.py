"""Run the accepted T022 native lifecycle E2E against isolated T027 services."""

from __future__ import annotations

import runpy
import re
import json
import os
from urllib.parse import urlsplit
from pathlib import Path
from types import SimpleNamespace

from playwright.sync_api import BrowserContext, Page


ROOT = Path(__file__).resolve().parents[2]
T022_E2E = ROOT / "evidence" / "yz-rd-t022" / "course_activity_e2e.py"
E2E_NAMESPACE = {}


def test_yz_rd_t027_real_course_activity_media_note_recording_runner_regression():
    original_route = Page.route
    original_wait_for_url = Page.wait_for_url
    original_new_page = BrowserContext.new_page

    def new_page_with_return_trace(self):
        page = original_new_page(self)
        trace = {"navigationEvents": [], "networkEvents": [], "dialogs": [], "pageErrors": [], "consoleErrors": []}
        page.add_init_script("""(() => {
          window.__t031LifecycleEvents = [];
          const originalPreventDefault = Event.prototype.preventDefault;
          Event.prototype.preventDefault = function() {
            if (this.type === 'beforeunload') window.__t031LifecycleEvents.push({type:'beforeunload-preventDefault'});
            return originalPreventDefault.call(this);
          };
          addEventListener('beforeunload', event => window.__t031LifecycleEvents.push({type:'beforeunload', defaultPrevented:event.defaultPrevented}), true);
          addEventListener('pagehide', event => window.__t031LifecycleEvents.push({type:'pagehide', persisted:event.persisted}), true);
          addEventListener('pageshow', event => window.__t031LifecycleEvents.push({type:'pageshow', persisted:event.persisted}), true);
        })();""")

        def trace_navigation(frame):
            if frame == page.main_frame:
                trace["navigationEvents"].append(frame.url)
                path = urlsplit(frame.url).path
                if "/student/practices/attempts/" in path or "/student/courses/course-detail/" in path:
                    print(f"T031 baseline main-frame route: {path}")

        def trace_response(response):
            path = urlsplit(response.url).path
            if path.endswith("/submit") or ("practice-attempts/" in path and path.endswith("/complete")):
                trace["networkEvents"].append({"kind": "response", "status": response.status, "method": response.request.method, "path": path})
                print(f"T031 baseline runner API response: {response.status} {path}")

        def trace_request(request):
            path = urlsplit(request.url).path
            if "/assessments/sessions/" in path or "practice-attempts/" in path:
                trace["networkEvents"].append({"kind": "request", "method": request.method, "path": path})

        def trace_page_error(error):
            trace["pageErrors"].append(str(error))

        def trace_console(message):
            if message.type == "error":
                trace["consoleErrors"].append(message.text)

        def allow_saved_runner_return(dialog):
            if dialog.type == "beforeunload":
                trace["dialogs"].append(dialog.type)
                print("T031 baseline runner beforeunload: accepting the post-submit route")
                dialog.accept()

        page.on("framenavigated", trace_navigation)
        page.on("response", trace_response)
        page.on("request", trace_request)
        page.on("pageerror", trace_page_error)
        page.on("console", trace_console)
        page.on("dialog", allow_saved_runner_return)
        page._t031_trace = trace
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
                self._t031_trace["dialogs"].append(dialog.type)
                print(f"T031 baseline runner navigation dialog: {dialog.type}")
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
            print(f"T031 baseline runner URL wait: current={current_path}, target_match={bool(target_matches)}, error={type(error).__name__}")
            try:
                page_state = self.evaluate("""() => {
                  const key = Object.keys(localStorage).find(value => value.startsWith('yuzan-course-practice-context:'));
                  const context = key ? JSON.parse(localStorage.getItem(key)) : null;
                  const message = document.querySelector('[data-runner-message]');
                  return { courseContextPresent: Boolean(context), courseContext: context, syncStatus: context?.syncStatus || null, runnerMessage: message?.innerText || '', accessTokenPresent:Boolean(localStorage.getItem('yuzan-access-token')), schoolId:localStorage.getItem('yuzan-active-school-id') };
                }""")
                print(f"T031 baseline runner state after submit: {page_state}")
            except Exception:
                page_state = {}
                print("T031 baseline runner state after submit: unavailable")
            try:
                attempt_id = urlsplit(self.url).path.split("/")[4]
                context = page_state.get("courseContext") or {}
                activity_id = context.get("activityId") or ""
                submission_id = context.get("submissionId") or ""
                enrollment_id = E2E_NAMESPACE["sql"](f'''SELECT "enrollmentId" FROM "AssessmentSession" WHERE id='{attempt_id}';''')
                session_sql = E2E_NAMESPACE["sql"](f'''SELECT json_build_object('id',id,'status',status,'enrollmentId',"enrollmentId",'courseSubmissionId',"courseSubmissionId",'courseActivityId',"courseActivityId")::text FROM "AssessmentSession" WHERE id='{attempt_id}';''')
                progress_sql = E2E_NAMESPACE["sql"](f'''SELECT json_build_object('completed',completed,'revision',revision,'enrollmentId',"enrollmentId")::text FROM "ActivityProgress" WHERE "activityId"='{activity_id}' AND "enrollmentId"='{enrollment_id}';''') if activity_id and enrollment_id else ""
                activity_attempt_sql = E2E_NAMESPACE["sql"](f'''SELECT json_build_object('kind',kind,'value',value)::text FROM "ActivityAttempt" WHERE "submissionId"='{submission_id}' AND "activityId"='{activity_id}';''') if activity_id and submission_id else ""
                report = {
                    "taskId": "YZ-RD-T031-baseline",
                    "expectedPath": f"/student/courses/course-detail/?id={context.get('assignmentId', '')}&activityId={activity_id}&submissionId={submission_id}&practiceAttemptId={attempt_id}",
                    "observedBrowserUrlAfter60Seconds": self.url,
                    "dynamicIds": {"assignmentId": context.get("assignmentId"), "submissionId": submission_id, "activityId": activity_id, "attemptId": attempt_id},
                    "courseContext": context,
                    "navigationEvents": self._t031_trace["navigationEvents"],
                    "lifecycleEvents": self.evaluate("window.__t031LifecycleEvents || []"),
                    "dialogs": self._t031_trace["dialogs"],
                    "networkEvents": self._t031_trace["networkEvents"],
                    "pageErrors": self._t031_trace["pageErrors"],
                    "consoleErrors": self._t031_trace["consoleErrors"],
                    "sql": {"assessmentSession": json.loads(session_sql) if session_sql else None, "activityProgress": json.loads(progress_sql) if progress_sql else None, "activityAttempt": json.loads(activity_attempt_sql) if activity_attempt_sql else None},
                }
                out = Path(os.environ["YZ_T022_EVIDENCE_DIR"]) / "baseline-runner-return.json"
                out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                print(f"T031 baseline proof written: {out}")
            except Exception as proof_error:
                print(f"T031 baseline SQL/browser proof capture failed: {type(proof_error).__name__}: {proof_error}")
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
        namespace = runpy.run_path(str(T022_E2E))
        E2E_NAMESPACE.update(namespace)
        namespace["test_t022_real_course_learning_note_media_runner_and_isolation"]()
    finally:
        Page.route = original_route
        Page.wait_for_url = original_wait_for_url
        BrowserContext.new_page = original_new_page
