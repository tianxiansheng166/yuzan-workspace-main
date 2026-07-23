"""Real browser closure for a dynamically discovered course-linked practice.

Credentials are supplied only through environment variables:
  YUZAN_E2E_STUDENT_IDENTIFIER
  YUZAN_E2E_STUDENT_PASSWORD

The script intentionally contains no fixed school, assignment, submission,
activity, practice, attempt, assessment-item, or recording IDs.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright


ROOT = Path(__file__).resolve().parents[2]
EVIDENCE_DIR = Path(__file__).resolve().parent
BASE_URL = os.environ.get("YUZAN_E2E_BASE_URL", "http://127.0.0.1:4175").rstrip("/")
IDENTIFIER = os.environ.get("YUZAN_E2E_STUDENT_IDENTIFIER", "")
PASSWORD = os.environ.get("YUZAN_E2E_STUDENT_PASSWORD", "")

ORAL_TYPES = {"READING", "SPEECH", "LISTEN_REPEAT", "READ_ALOUD"}
WRITTEN_TYPES = {
    "WRITTEN",
    "CHOICE",
    "FILL_BLANK",
    "SINGLE_CHOICE",
    "MULTIPLE_CHOICE",
    "SHORT_ANSWER",
    "LISTEN_RETELL",
}


class Audit:
    def __init__(self) -> None:
        self.console_errors: list[str] = []
        self.console_warnings: list[str] = []
        self.page_errors: list[str] = []
        self.failed_requests: list[dict[str, str]] = []
        self.http_errors: list[dict[str, object]] = []
        self.api_trace: list[dict[str, object]] = []
        self.upload_bytes = 0

    def attach(self, page: Page) -> None:
        def on_console(message) -> None:
            entry = message.text
            if message.type == "error":
                self.console_errors.append(entry)
            elif message.type == "warning":
                self.console_warnings.append(entry)

        def on_page_error(error) -> None:
            self.page_errors.append(str(error))

        def on_request_failed(request) -> None:
            failure = request.failure or ""
            if "ERR_ABORTED" not in failure:
                self.failed_requests.append(
                    {"method": request.method, "url": request.url, "failure": failure}
                )

        def on_request(request) -> None:
            parsed = urlparse(request.url)
            if request.method == "PUT" and parsed.port == 59000:
                try:
                    body = request.post_data_buffer
                    if body:
                        self.upload_bytes = max(self.upload_bytes, len(body))
                except Exception:
                    pass

        def on_response(response) -> None:
            request = response.request
            parsed = urlparse(response.url)
            if "/api/v1/" in parsed.path:
                self.api_trace.append(
                    {
                        "method": request.method,
                        "path": parsed.path,
                        "status": response.status,
                    }
                )
            if response.status >= 400:
                self.http_errors.append(
                    {
                        "method": request.method,
                        "url": response.url,
                        "status": response.status,
                    }
                )

        page.on("console", on_console)
        page.on("pageerror", on_page_error)
        page.on("requestfailed", on_request_failed)
        page.on("request", on_request)
        page.on("response", on_response)


def unwrap(value):
    if isinstance(value, dict) and "data" in value:
        return value["data"]
    return value


def login(page: Page) -> None:
    page.goto(f"{BASE_URL}/login/", wait_until="networkidle")
    page.locator("#loginAccount").fill(IDENTIFIER)
    page.locator("#loginPassword").fill(PASSWORD)
    page.locator('[data-action="login"]').click()
    page.wait_for_url(lambda url: "/login" not in url, timeout=15_000)
    page.wait_for_load_state("networkidle")
    token_present = page.evaluate(
        "() => Boolean(localStorage.getItem('yuzan-access-token'))"
    )
    assert token_present, "real login did not persist an access token"


def discover_target(page: Page) -> dict:
    target = page.evaluate(
        """async () => {
          const listed = await YuzanApi.listStudentCourses();
          const courses = listed.courses || listed.items || [];
          for (const summary of courses) {
            if (summary.source !== 'TEACHER_ASSIGNED') continue;
            const detail = await YuzanApi.getStudentCourse(summary.assignmentId);
            const references = detail.practiceReferences || [];
            for (const reference of references) {
              const practice = await YuzanApi.getPractice(reference.practiceDefinitionId);
              if ((practice.oralItemCount || 0) > 0 && (practice.writtenItemCount || 0) > 0) {
                return {
                  assignmentId: summary.assignmentId,
                  activityId: reference.activityId,
                  practiceDefinitionId: reference.practiceDefinitionId,
                  courseTitle: detail.courseVersion?.title || detail.assignment?.title || summary.title,
                  practiceTitle: reference.title || practice.title,
                  source: summary.source,
                  capabilityTheme: detail.courseVersion?.capabilityTheme || summary.capabilityTheme,
                  oralItemCount: practice.oralItemCount,
                  writtenItemCount: practice.writtenItemCount
                };
              }
            }
          }
          return null;
        }"""
    )
    assert target, "no teacher-assigned course with a linked oral + written practice"
    assert target["source"] == "TEACHER_ASSIGNED"
    assert target["capabilityTheme"] == "古诗文"
    assert target["oralItemCount"] > 0
    assert target["writtenItemCount"] > 0
    return target


def wait_for_course(page: Page, target: dict) -> dict:
    page.wait_for_function(
        """([assignmentId, activityId]) => {
          const state = window.CoursePlayerState?.getState?.();
          return Boolean(
            state &&
            !state.loading &&
            !state.error &&
            state.assignmentId === assignmentId &&
            state.currentActivityId === activityId
          );
        }""",
        arg=[target["assignmentId"], target["activityId"]],
        timeout=20_000,
    )
    page.locator("#cpMain").wait_for(state="visible", timeout=10_000)
    page.locator("#cpLoading").wait_for(state="hidden", timeout=10_000)
    state = page.evaluate("() => CoursePlayerState.getState()")
    assert state["submissionId"], "course page did not create or resume a real submission"
    assert (
        state["currentActivity"]["practiceReference"]["practiceDefinitionId"]
        == target["practiceDefinitionId"]
    )
    return state


def course_url(target: dict) -> str:
    return (
        f"{BASE_URL}/student/courses/course-detail/"
        f"?id={target['assignmentId']}&activityId={target['activityId']}"
    )


def exercise_attempt(page: Page, result: dict) -> None:
    seen_item_ids: set[str] = set()
    oral_item_ids: set[str] = set()
    written_item_ids: set[str] = set()
    max_steps = 30

    for _ in range(max_steps):
        path = urlparse(page.url).path

        if path.endswith("/prepare/"):
            page.locator('[data-start-session]').wait_for(state="visible", timeout=15_000)
            page.wait_for_function(
                "() => !document.querySelector('[data-start-session]')?.disabled",
                timeout=15_000,
            )
            page.locator('[data-start-session]').click()
            page.wait_for_url(
                lambda url: not urlparse(url).path.endswith("/prepare/"),
                timeout=15_000,
            )
            page.wait_for_load_state("networkidle")
            continue

        reading_match = re.search(r"/reading/([^/]+)/?$", path)
        if reading_match:
            item_id = reading_match.group(1)
            seen_item_ids.add(item_id)
            page.locator("main.page").wait_for(state="visible", timeout=15_000)
            if page.locator("[data-listen-complete]").count():
                page.locator("[data-listen-complete]").click()
                page.wait_for_url(
                    lambda url: urlparse(url).path != path, timeout=15_000
                )
                page.wait_for_load_state("networkidle")
                continue

            oral_item_ids.add(item_id)
            page.locator("[data-skip-prompt]").wait_for(state="visible", timeout=15_000)
            page.locator("[data-skip-prompt]").click()
            page.locator("[data-stop]").wait_for(state="visible", timeout=10_000)
            time.sleep(3.2)
            page.locator("[data-stop]").click()
            page.locator("[data-upload]").wait_for(state="visible", timeout=10_000)
            page.locator("[data-upload]").click()
            page.wait_for_url(
                lambda url: urlparse(url).path != path, timeout=30_000
            )
            page.wait_for_load_state("networkidle")
            continue

        written_match = re.search(r"/written/([^/]+)/?$", path)
        if written_match:
            item_id = written_match.group(1)
            seen_item_ids.add(item_id)
            written_item_ids.add(item_id)
            page.locator("main.page").wait_for(state="visible", timeout=15_000)
            radios = page.locator('input[name="answer"]')
            if radios.count():
                radios.first.check()
            else:
                page.locator("[data-written-textarea]").fill(
                    "诗句通过沉稳的节奏与清晰的停顿，表现出边塞环境的庄重情感。"
                )
            old_path = path
            page.locator("[data-written-next]").click()
            page.wait_for_url(
                lambda url: urlparse(url).path != old_path, timeout=20_000
            )
            page.wait_for_load_state("networkidle")
            continue

        if path.endswith("/submit/"):
            page.locator("[data-submit-session]").wait_for(
                state="visible", timeout=15_000
            )
            page.wait_for_function(
                "() => !document.querySelector('[data-submit-session]')?.disabled",
                timeout=15_000,
            )
            page.set_viewport_size({"width": 1024, "height": 900})
            page.screenshot(
                path=str(EVIDENCE_DIR / "02-submit-ready-1024.png"),
                full_page=True,
            )
            page.locator("[data-submit-session]").click()
            page.wait_for_url(
                lambda url: "/student/courses/course-detail/" in url,
                timeout=30_000,
            )
            page.wait_for_load_state("networkidle")
            result["itemIds"] = sorted(seen_item_ids)
            result["oralItemIds"] = sorted(oral_item_ids)
            result["writtenItemIds"] = sorted(written_item_ids)
            return

        raise AssertionError(f"unexpected practice execution route: {path}")

    raise AssertionError("practice execution exceeded the bounded step count")


def server_snapshot(page: Page, target: dict, attempt_id: str) -> dict:
    return page.evaluate(
        """async ([assignmentId, activityId, attemptId]) => {
          const [course, attempt, items, written] = await Promise.all([
            YuzanApi.getStudentCourse(assignmentId),
            YuzanApi.getPracticeAttempt(attemptId),
            YuzanApi.getPracticeAttemptItems(attemptId),
            YuzanApi.getWrittenItems(attemptId)
          ]);
          const allItems = Array.isArray(items) ? items : (items.items || []);
          const writtenItems = Array.isArray(written) ? written : (written.items || []);
          const activity = course.units
            .flatMap(unit => unit.lessons || [])
            .flatMap(lesson => lesson.activities || [])
            .find(candidate => candidate.id === activityId || candidate.activityId === activityId);
          return {
            course: {
              completedActivityIds: course.studentProgress?.completedActivityIds || [],
              completedPracticeCount: course.studentProgress?.completedPracticeCount || 0,
              requiredPracticeCount: course.studentProgress?.requiredPracticeCount || 0,
              progressPercent: course.studentProgress?.progressPercent || 0,
              activityProgress: activity?.progress || null,
              attempt: activity?.attempt || null
            },
            attempt: {
              id: attempt.id,
              status: attempt.status,
              practiceDefinitionId: attempt.practiceDefinitionId,
              deliveryId: attempt.deliveryId,
              enrollmentId: attempt.enrollmentId
            },
            items: allItems.map(item => ({
              id: item.id,
              itemType: item.itemType,
              status: item.status,
              recordingId: item.recordingId || null
            })),
            written: writtenItems.map(item => ({
              id: item.id,
              hasNonEmptyAnswer: Boolean(
                item.answer &&
                (
                  Number.isInteger(item.answer.content?.optionIndex) ||
                  String(item.answer.content?.text || '').trim()
                )
              ),
              finalized: Boolean(item.answer?.finalSubmittedAt)
            }))
          };
        }""",
        [target["assignmentId"], target["activityId"], attempt_id],
    )


def recording_evidence(page: Page, recording_ids: list[str]) -> list[dict]:
    return page.evaluate(
        """async (recordingIds) => Promise.all(recordingIds.map(async recordingId => {
          const [recording, evidence] = await Promise.all([
            YuzanApi.getRecordingStatus(recordingId),
            YuzanApi.getRecordingEvidence(recordingId)
          ]);
          const response = await fetch(evidence.downloadUrl);
          if (!response.ok) throw new Error(`recording download failed: ${response.status}`);
          const bytes = (await response.arrayBuffer()).byteLength;
          return {
            id: recording.id,
            status: recording.status,
            durationMs: recording.durationMs,
            mimeType: recording.mimeType,
            objectKey: recording.objectKey,
            downloadedBytes: bytes
          };
        }))""",
        recording_ids,
    )


def new_context(
    browser: Browser, target: dict, attempt_id: str, audit: Audit
) -> dict:
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        permissions=["microphone"],
        base_url=BASE_URL,
    )
    page = context.new_page()
    audit.attach(page)
    try:
        login(page)
        page.goto(course_url(target), wait_until="networkidle")
        wait_for_course(page, target)
        snapshot = server_snapshot(page, target, attempt_id)
        assert target["activityId"] in snapshot["course"]["completedActivityIds"]
        assert snapshot["course"]["completedPracticeCount"] >= 1
        completed_status = page.locator(
            f'[data-activity-id="{target["activityId"]}"] .cp-dir-status'
        )
        completed_status.wait_for(state="visible", timeout=15_000)
        assert completed_status.inner_text() == "已学习"
        completed_status.scroll_into_view_if_needed()
        page.wait_for_timeout(250)
        page.screenshot(
            path=str(EVIDENCE_DIR / "03-course-completed-new-context-390.png"),
            full_page=False,
        )
        return snapshot
    finally:
        context.close()


def main() -> int:
    if not IDENTIFIER or not PASSWORD:
        print(
            "Missing YUZAN_E2E_STUDENT_IDENTIFIER or "
            "YUZAN_E2E_STUDENT_PASSWORD.",
            file=sys.stderr,
        )
        return 2

    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    result: dict[str, object] = {
        "taskId": "P0-STUDENT-COURSE-PRACTICE-001",
        "baseUrl": BASE_URL,
        "browser": "chromium-headless",
    }
    audit = Audit()

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            args=[
                "--use-fake-ui-for-media-stream",
                "--use-fake-device-for-media-stream",
            ],
        )
        context: BrowserContext = browser.new_context(
            viewport={"width": 1440, "height": 1000},
            permissions=["microphone"],
            base_url=BASE_URL,
        )
        page = context.new_page()
        audit.attach(page)
        try:
            login(page)
            target = discover_target(page)
            result["target"] = target
            page.goto(course_url(target), wait_until="networkidle")
            course_state = wait_for_course(page, target)
            result["submissionId"] = course_state["submissionId"]
            result["submissionStatusAtEntry"] = course_state["submissionStatus"]
            entry_progress = course_state["course"]["progress"]
            result["entryVerification"] = {
                "progressPercent": entry_progress["percent"],
                "completedPracticeCount": entry_progress[
                    "completedPracticeCount"
                ],
                "activityCompleted": course_state["currentActivity"][
                    "isCompleted"
                ],
            }
            assert result["entryVerification"] == {
                "progressPercent": 0,
                "completedPracticeCount": 0,
                "activityCompleted": False,
            }, "course-practice fixture did not start from an incomplete state"
            page.locator("#cpSectionPractice").scroll_into_view_if_needed()
            page.wait_for_timeout(250)
            page.screenshot(
                path=str(EVIDENCE_DIR / "01-course-practice-entry-1440.png"),
                full_page=False,
            )

            page.locator("#cpPracticeGoBtn").click()
            page.wait_for_url(
                re.compile(r"/student/practices/attempts/[^/]+/prepare/"),
                timeout=20_000,
            )
            attempt_match = re.search(
                r"/student/practices/attempts/([^/]+)/", urlparse(page.url).path
            )
            assert attempt_match
            attempt_id = attempt_match.group(1)
            result["attemptId"] = attempt_id
            page.wait_for_load_state("networkidle")

            attempt_items = page.evaluate(
                "attemptId => YuzanApi.getPracticeAttemptItems(attemptId)",
                attempt_id,
            )
            attempt_items = (
                attempt_items
                if isinstance(attempt_items, list)
                else attempt_items.get("items", [])
            )
            result["attemptSnapshotItemIds"] = [
                item["id"] for item in attempt_items
            ]
            assert any(item.get("itemType") in ORAL_TYPES for item in attempt_items)
            assert any(
                item.get("itemType") in WRITTEN_TYPES for item in attempt_items
            )

            exercise_attempt(page, result)
            wait_for_course(page, target)
            first_snapshot = server_snapshot(page, target, attempt_id)
            result["apiVerification"] = first_snapshot
            assert first_snapshot["attempt"]["status"] in {
                "SUBMITTED",
                "PROCESSING",
                "COMPLETED",
            }
            assert target["activityId"] in first_snapshot["course"][
                "completedActivityIds"
            ]
            assert first_snapshot["course"]["completedPracticeCount"] >= 1

            recordings = [
                item["recordingId"]
                for item in first_snapshot["items"]
                if item["itemType"] in ORAL_TYPES and item["recordingId"]
            ]
            assert recordings, "no oral item retained a recording ID"
            result["recordingIds"] = recordings
            recording_rows = recording_evidence(page, recordings)
            result["recordingEvidence"] = recording_rows
            assert all(
                row["status"] == "COMPLETE"
                and row["durationMs"] > 0
                and row["downloadedBytes"] > 0
                for row in recording_rows
            ), "recording evidence was incomplete or empty"
            assert all(
                item["hasNonEmptyAnswer"] and item["finalized"]
                for item in first_snapshot["written"]
            ), "written evidence was empty or not finalized"

            fresh_snapshot = new_context(browser, target, attempt_id, audit)
            result["newContextVerification"] = fresh_snapshot["course"]
        except Exception as error:
            result["status"] = "FAILED"
            result["error"] = str(error)
            try:
                page.screenshot(
                    path=str(EVIDENCE_DIR / "failure.png"), full_page=True
                )
            except Exception:
                pass
            raise
        finally:
            context.close()
            browser.close()

    result["recordingUploadBytesObservedByPlaywright"] = audit.upload_bytes
    result["downloadedRecordingBytes"] = sum(
        row["downloadedBytes"] for row in result["recordingEvidence"]
    )
    result["audit"] = {
        "consoleErrors": audit.console_errors,
        "consoleWarnings": audit.console_warnings,
        "pageErrors": audit.page_errors,
        "failedRequests": audit.failed_requests,
        "httpErrors": audit.http_errors,
        "apiTrace": audit.api_trace,
    }
    assert not audit.page_errors, f"page errors: {audit.page_errors}"
    assert not audit.console_errors, f"console errors: {audit.console_errors}"
    assert not audit.failed_requests, f"failed requests: {audit.failed_requests}"
    assert not audit.http_errors, f"HTTP errors: {audit.http_errors}"
    result["status"] = "PASSED"

    with (EVIDENCE_DIR / "browser-result.json").open(
        "w", encoding="utf-8", newline="\n"
    ) as evidence_file:
        evidence_file.write(
            json.dumps(result, ensure_ascii=False, indent=2) + "\n"
        )
    print(
        json.dumps(
            {
                "status": result["status"],
                "assignmentId": result["target"]["assignmentId"],
                "submissionId": result["submissionId"],
                "attemptId": result["attemptId"],
                "recordingCount": len(result["recordingIds"]),
                "downloadedRecordingBytes": result["downloadedRecordingBytes"],
                "screenshots": [
                    "01-course-practice-entry-1440.png",
                    "02-submit-ready-1024.png",
                    "03-course-completed-new-context-390.png",
                ],
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
