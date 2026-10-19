"""New T050 cross-branch Chrome/API/PostgreSQL/MinIO integration acceptance."""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

import pytest
from playwright.sync_api import expect, sync_playwright

import test_yz_rd_t011_web_review_feedback as t011
import test_yz_rd_t032_roster_csv_export as t032
import test_yz_rd_t037_today_showcase as t037
import test_yz_rd_t045_practice_catalog as t045
import test_yz_rd_t048_teacher_speech_review as t048


BASE = os.environ.get("YZ_T050_BASE_URL", "")
DATABASE_URL = os.environ.get("YZ_T050_DATABASE_URL", "")
PASSWORD = os.environ.get("YZ_T050_PASSWORD", "")
EVIDENCE_DIR = Path(os.environ.get("YZ_T050_EVIDENCE_DIR", ""))
SCHOOL_ID = t048.SCHOOL_ID
CLASS_ID = t048.CLASS_ID
API = f"{BASE}/api/v1"

pytestmark = pytest.mark.skipif(
    not BASE or not DATABASE_URL or not PASSWORD,
    reason="requires the isolated YZ-RD-T050 native Chrome/API/PostgreSQL/MinIO runtime",
)


def q(value: object) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def sql(statement: str, *, capture: bool = False) -> str:
    return t048.sql(statement, capture=capture)


def sql_rows(statement: str) -> list[list[str]]:
    return [line.split("|") for line in sql(statement, capture=True).splitlines() if line]


def sql_scalar(statement: str) -> str:
    value = sql(statement, capture=True)
    assert value, "expected a PostgreSQL scalar result"
    return value


def payload(response):
    return t048.payload(response)


def save_viewports(page, prefix: str, *, heights=(844, 1024, 900, 1000)) -> list[dict[str, object]]:
    result = []
    for (width, height) in zip((390, 768, 1280, 1440), heights):
        page.set_viewport_size({"width": width, "height": height})
        page.wait_for_timeout(150)
        dimensions = page.evaluate("""() => ({
          viewport: document.documentElement.clientWidth,
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
        })""")
        assert max(dimensions["document"], dimensions["body"]) <= width + 1, {"width": width, **dimensions}
        EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(EVIDENCE_DIR / f"{prefix}-{width}.png"), full_page=True)
        result.append({"width": width, "height": height, **dimensions, "horizontalOverflow": False})
    return result


def browser_login_student(page, identifier: str) -> dict:
    session = t037.login_in_browser(page, identifier)
    assert session["activeSchoolId"] == SCHOOL_ID
    return session


def browser_login_teacher(page, identifier: str) -> dict:
    page.goto(f"{BASE}/login/", wait_until="domcontentloaded")
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="domcontentloaded")
    page.locator("#loginAccount").fill(identifier)
    page.locator("#loginPassword").fill(PASSWORD)
    page.locator('#loginPanel button[type="submit"]').click()
    page.wait_for_url(re.compile(r".*/teacher/?$"), timeout=30_000)
    session = page.evaluate("""() => ({
      accessToken: localStorage.getItem('yuzan-access-token'),
      activeSchoolId: localStorage.getItem('yuzan-active-school-id'),
      user: JSON.parse(localStorage.getItem('yuzan-current-user') || 'null'),
    })""")
    assert session["accessToken"] and session["activeSchoolId"] == SCHOOL_ID
    return session


def login_api_context(request_context, identifier: str) -> dict:
    response = request_context.post(
        f"{BASE}/api/v1/auth/login",
        data={"identifier": identifier, "password": PASSWORD},
    )
    assert response.ok, response.text()
    return payload(response)


def attach_seed_teacher_to_class(class_id: str) -> None:
    enrollment_id = str(uuid.uuid4())
    t048.sql(
        f'''INSERT INTO "Enrollment" ("id", "schoolId", "classId", "userId", "role", "status", "joinedAt")
            VALUES ({q(enrollment_id)}, {q(SCHOOL_ID)}, {q(class_id)}, {q(t048.TEACHER_SEED_ID)}, 'TEACHER', 'ACTIVE', NOW());'''
    )


def create_open_course_assignment(page, teacher_session: dict, class_id: str) -> tuple[str, dict[str, str]]:
    """Create a real dynamic class Assignment through the existing teacher API."""
    t011.sql = t048.sql
    t037.sql = t048.sql
    t011.ensure_test_course()
    now = datetime.now(timezone.utc)
    response = page.request.post(
        f"{API}/schools/{SCHOOL_ID}/assignments",
        headers=t048.headers(teacher_session),
        data={
            "title": f"TEST_FIXTURE_ONLY T050 课程学习任务 {uuid.uuid4().hex[:8]}",
            "courseVersionId": t011.COURSE_VERSION_ID,
            "startsAt": (now - timedelta(minutes=5)).isoformat(),
            "dueAt": (now + timedelta(days=7)).isoformat(),
            "targets": [{"targetType": "CLASS", "classId": class_id}],
        },
    )
    assert response.status in (200, 201), response.text()
    assignment = payload(response)
    assignment_id = assignment["id"]
    scheduled = page.request.post(
        f"{API}/schools/{SCHOOL_ID}/assignments/{assignment_id}/schedule",
        headers=t048.headers(teacher_session),
        data={"expectedRevision": assignment["revision"]},
    )
    assert scheduled.ok, scheduled.text()
    opened = page.request.post(
        f"{API}/schools/{SCHOOL_ID}/assignments/{assignment_id}/open",
        headers=t048.headers(teacher_session),
        data={"expectedRevision": payload(scheduled)["revision"]},
    )
    assert opened.ok and payload(opened)["status"] == "OPEN", opened.text()
    t037.sql = t048.sql
    course = t037.add_test_course_activity(assignment_id)
    return assignment_id, course


def expired_signed_url(url: str) -> str:
    parts = urlsplit(url)
    query = parse_qs(parts.query, keep_blank_values=True)
    assert query.get("X-Amz-Date"), "authorized MinIO URL is missing its signed timestamp"
    query["X-Amz-Date"] = ["20000101T000000Z"]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query, doseq=True), parts.fragment))


def test_t050_integrated_student_course_audio_teacher_review_report_history():
    """Exercise T047 Today/course + T048 review on the same fresh T050 runtime and Attempt."""
    t048.verify_runtime_identity()
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    student_a = t048.create_student_fixture("T050复核学生", CLASS_ID)
    student_b = t048.create_student_fixture("T050隔离学生", CLASS_ID)
    teacher_other = t048.create_teacher_fixture("T050跨班")
    foreign_teacher = t048.create_cross_school_teacher()
    browser_errors: list[str] = []
    proof: dict[str, object] = {"task": "YZ-RD-T050", "fixturePolicy": "TEST_FIXTURE_ONLY; no real student records"}

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path="/usr/bin/google-chrome",
            args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
        )
        context = browser.new_context(
            viewport={"width": 1440, "height": 1000},
            permissions=["microphone"],
            has_touch=True,
            accept_downloads=True,
        )
        context.add_init_script("window.__yuzanRunnerMicrophoneSource = 'SIMULATED_MIC';")
        page = context.new_page()
        page.on("pageerror", lambda error: browser_errors.append(type(error).__name__))
        try:
            teacher_api = t048.login_api(page, "teacher.test")
            assignment_id, course = create_open_course_assignment(page, teacher_api, CLASS_ID)
            student = browser_login_student(page, student_a["login"])
            student_headers = t048.headers(student)
            assert student["user"]["id"] == student_a["user"]
            today = t037.open_today(page)
            assert today and today["version"] == "student-today-v1"
            assert today["primaryAction"], today
            assert page.locator(".today-primary").count() == 1
            assert page.locator(".today-skill-card").count() == 0
            course_link = page.locator(f".today-course-item a[href*='{assignment_id}']")
            course_link.wait_for(timeout=30_000)
            course_href = course_link.get_attribute("href")
            assert course_href == f"/student/courses/course-detail/?id={assignment_id}"
            today_layout = save_viewports(page, "student-today")

            course_api = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/student/courses/{assignment_id}",
                headers=student_headers,
            )
            assert course_api.ok, course_api.text()
            detail = payload(course_api)
            activities = [
                activity
                for unit in detail["units"]
                for lesson in unit["lessons"]
                for activity in lesson["activities"]
            ]
            assert any(activity["id"] == course["activity"] for activity in activities), activities
            course_link.click()
            page.wait_for_url(f"**/student/courses/course-detail/?id={assignment_id}", timeout=30_000)
            page.locator("#cpMain").wait_for(state="visible", timeout=30_000)
            expect(page.locator("#cpHeroTitle")).to_contain_text(course["courseTitle"])
            expect(page.locator("body")).to_contain_text(course["activityTitle"])
            ack_button = page.locator(".cp-exercise-text .cp-exercise-submit")
            ack_button.wait_for(timeout=20_000)
            ack_button.click()
            page.locator(".cp-exercise-text .cp-exercise-feedback.correct").wait_for(timeout=20_000)
            progress = sql_rows(
                f'''SELECT completed::text FROM "ActivityProgress"
                    WHERE "schoolId"={q(SCHOOL_ID)} AND "enrollmentId"={q(student_a['enrollment'])}
                      AND "activityId"={q(course['activity'])};'''
            )
            assert progress == [["true"]], progress
            course_layout = save_viewports(page, "student-course-detail")

            today_after_course = t037.open_today(page)
            assert today_after_course["primaryAction"] and page.locator(".today-primary").count() == 1
            practice_nav = page.locator('[data-student-nav][href="/student/practices/"]')
            if not practice_nav.is_visible():
                page.locator(".sn-menu-toggle").click()
                practice_nav.wait_for(state="visible", timeout=10_000)
            practice_nav.click()
            page.wait_for_url("**/student/practices/", timeout=20_000)
            page.locator(".catalog-oral-toolbar").wait_for(timeout=20_000)
            page.locator('.catalog-tabs button[data-tab="MOCK"]').click()
            page.wait_for_function("document.querySelector('.catalog-tabs button[data-tab=MOCK]')?.getAttribute('aria-pressed') === 'true'")
            oral_button = page.locator("[data-journey-oral]")
            oral_button.wait_for(timeout=10_000)
            oral_button.focus()
            with page.expect_request(lambda request: t045.catalog_request(request, key="requiresRecording", value="true")) as oral_request:
                page.keyboard.press("Enter")
            oral_response = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/practices?requiresRecording=true", headers=student_headers
            )
            assert oral_response.ok, oral_response.text()
            oral_items = payload(oral_response)["items"]
            assert oral_items and all(item["requiresRecording"] is True for item in oral_items)
            rhythm = oral_items[0]
            first_oral_card = page.locator(f'[data-practice-detail="{rhythm["id"]}"] h2 a')
            first_oral_card.wait_for(timeout=20_000)
            first_oral_card.click()
            page.wait_for_url(f"**/student/practices/{rhythm['id']}/", timeout=20_000)
            page.locator("[data-start]").click()
            page.wait_for_url("**/student/practices/attempts/*/runner/", timeout=30_000)
            page.locator(".question-shell").wait_for(timeout=20_000)
            attempt_id = page.url.split("/attempts/")[1].split("/")[0]
            runner_layout = save_viewports(page, "student-runner")
            page.set_viewport_size({"width": 1440, "height": 1000})
            completion = t048.complete_t048_attempt(page, student_headers, attempt_id)
            assert completion["itemCount"] == 20, completion
            assert completion["recordedAudio"] >= 2 and completion["uploadRetries"] == completion["recordedAudio"], completion
            attempt_rows = sql_rows(
                f'''SELECT s.status::text,s."schoolId",e."userId",e.id
                    FROM "AssessmentSession" s JOIN "Enrollment" e ON e.id=s."enrollmentId"
                    WHERE s.id={q(attempt_id)};'''
            )
            assert len(attempt_rows) == 1 and attempt_rows[0][0:3] == ["PROCESSING", SCHOOL_ID, student_a["user"]], attempt_rows
            assert sql_scalar(f'''SELECT COUNT(*) FROM "AssessmentReport" WHERE "sessionId"={q(attempt_id)};''') == "0"
            assert sql_scalar(
                f'''SELECT COUNT(*) FROM "AssessmentItem" WHERE "sessionId"={q(attempt_id)}
                    AND "recordingId" IS NOT NULL AND "scoredScore" IS NOT NULL;'''
            ) == "0"
            recording_rows = sql_rows(
                f'''SELECT i.id,r.id,r."objectKey",r."mimeType",r.status::text
                    FROM "AssessmentItem" i JOIN "Recording" r ON r.id=i."recordingId"
                    WHERE i."sessionId"={q(attempt_id)} ORDER BY i."sortOrder";'''
            )
            assert len(recording_rows) == completion["recordedAudio"]
            minio_objects = []
            for item_id, recording_id, object_key, mime_type, state in recording_rows:
                assert object_key.startswith(f"recordings/{recording_id}/")
                assert mime_type.startswith("audio/") and state in {"READY", "PROCESSING", "COMPLETE"}
                head = t048.minio_head_object(object_key)
                assert head.get("bytes", 0) > 0 and head.get("contentType", "").startswith("audio/"), head
                minio_objects.append({"itemId": item_id, "recordingId": recording_id, "bytes": head["bytes"], "contentType": head["contentType"]})
            no_report = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{attempt_id}/report",
                headers=student_headers,
            )
            assert no_report.ok and payload(no_report) is None

            anonymous = playwright.request.new_context()
            try:
                no_auth = anonymous.get(f"{API}/schools/{SCHOOL_ID}/assessment-reviews")
                assert no_auth.status == 401
            finally:
                anonymous.dispose()
            student_queue = page.request.get(f"{API}/schools/{SCHOOL_ID}/assessment-reviews", headers=student_headers)
            assert student_queue.status == 403

            teacher_api = t048.login_api(page, "teacher.test")
            teacher_headers = t048.headers(teacher_api)
            initial_queue = t048.item_queue(page.request, teacher_headers, student_a["name"])
            assert len(initial_queue) >= 2, initial_queue
            item_ids = [item["itemId"] for item in initial_queue]
            audio_item = next(item for item in initial_queue if item["strategy"] == "SPEECH_READING")
            audio_id = audio_item["itemId"]
            pending_before_review = [item for item in initial_queue if item["itemId"] != audio_id]
            assert pending_before_review
            pending_sample = pending_before_review[0]["itemId"]
            assert sql_scalar(
                f'''SELECT COUNT(*) FROM "AssessmentItem" WHERE id={q(audio_id)} AND "scoredScore" IS NULL;'''
            ) == "1"
            assert sql_scalar(
                f'''SELECT COUNT(*) FROM "AssessmentItem" WHERE id={q(pending_sample)} AND "scoredScore" IS NULL;'''
            ) == "1"

            student_write = page.request.put(
                f"{API}/schools/{SCHOOL_ID}/assessment-reviews/{audio_id}",
                headers=student_headers,
                data={"score": 0, "comment": "TEST_FIXTURE_ONLY 学生无权写复核"},
            )
            assert student_write.status == 403
            missing_detail = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/assessment-reviews/{uuid.uuid4()}", headers=teacher_headers
            )
            assert missing_detail.status == 404
            over_score = page.request.put(
                f"{API}/schools/{SCHOOL_ID}/assessment-reviews/{audio_id}",
                headers=teacher_headers,
                data={"score": float(audio_item["maxScore"]) + 1, "comment": "TEST_FIXTURE_ONLY"},
            )
            negative_score = page.request.put(
                f"{API}/schools/{SCHOOL_ID}/assessment-reviews/{audio_id}",
                headers=teacher_headers,
                data={"score": -1, "comment": "TEST_FIXTURE_ONLY"},
            )
            assert over_score.status == negative_score.status == 400
            other_teacher_session = t048.login_api(page, teacher_other["login"])
            cross_class_detail = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/assessment-reviews/{audio_id}",
                headers=t048.headers(other_teacher_session),
            )
            foreign_teacher_session = t048.login_api(page, foreign_teacher["login"])
            cross_school_detail = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/assessment-reviews/{audio_id}",
                headers=t048.headers(foreign_teacher_session),
            )
            assert cross_class_detail.status == cross_school_detail.status == 403

            browser_login_teacher(page, "teacher.test")
            page.goto(f"{BASE}/teacher/reviews/", wait_until="networkidle")
            page.locator("[data-student-filter]").fill(student_a["name"])
            audio_row = page.locator(f'.review-row[href^="/teacher/reviews/{audio_id}"]')
            audio_row.wait_for(timeout=20_000)
            t048.save_responsive_screenshots(page, "teacher-review-queue")

            audio_row.click()
            t048.wait_for_review_item(page, audio_id)
            page.wait_for_function("document.querySelector('[data-review-audio]')?.readyState >= 3", timeout=30_000)
            audio_player = page.locator("[data-review-audio]")
            authorized_url = audio_player.get_attribute("src") or ""
            assert authorized_url and authorized_url.startswith("http://127.0.0.1:")

            stale_url = expired_signed_url(authorized_url)
            expired_request: list[str] = []
            refresh_requests: list[str] = []
            detail_api_url = f"{API}/schools/{SCHOOL_ID}/assessment-reviews/{audio_id}"
            page.on(
                "request",
                lambda request: refresh_requests.append(request.url)
                if request.method == "GET" and request.url == detail_api_url else None,
            )

            def reject_expired_url(route):
                if route.request.url == stale_url:
                    expired_request.append(route.request.url)
                    route.fulfill(status=403, content_type="text/plain", body="ExpiredToken")
                else:
                    route.continue_()

            page.route("**/*", reject_expired_url)
            audio_player.evaluate("(audio, url) => { audio.pause(); audio.src = url; audio.load(); }", stale_url)
            page.locator("[data-audio-retry]").wait_for(state="visible", timeout=20_000)
            expect(page.locator("[data-audio-state]")).to_contain_text("未确认播放成功")
            assert expired_request == [stale_url], expired_request
            page.locator("[data-audio-retry]").click()
            page.wait_for_function("document.querySelector('[data-review-audio]')?.readyState >= 3", timeout=30_000)
            refreshed_url = audio_player.get_attribute("src") or ""
            assert refreshed_url and refreshed_url != stale_url and refresh_requests, {
                "stale": stale_url, "refreshed": refreshed_url, "detailRefreshes": refresh_requests,
            }
            page.unroute("**/*", reject_expired_url)

            t048.save_responsive_screenshots(page, "teacher-review-detail", detail=True)
            audio_player.evaluate("audio => { audio.muted = true; return audio.play(); }")
            page.wait_for_function("document.querySelector('[data-review-audio]')?.currentTime > 0.2", timeout=20_000)
            audio_player.evaluate("audio => audio.pause()")
            expect(page.locator("[data-audio-state]")).to_contain_text("录音已暂停")
            page.locator("[data-audio-replay]").click()
            page.wait_for_function("document.querySelector('[data-review-audio]')?.currentTime > 0.2", timeout=20_000)
            audio_player.evaluate("audio => audio.pause()")
            playback = {
                "play": True,
                "pause": True,
                "replayFromStart": True,
                "expiredSignedUrlRejected": True,
                "authorizedUrlRefreshed": True,
                "detailRefreshes": len(refresh_requests),
            }

            score_input = page.locator("[data-review-score]")
            expect(score_input).to_have_value("")
            submit_url = f"{API}/schools/{SCHOOL_ID}/assessment-reviews/{audio_id}"
            put_requests: list[str] = []
            page.on("request", lambda request: put_requests.append(request.url) if request.method == "PUT" and request.url == submit_url else None)
            score_input.press("Enter")
            page.get_by_text("请先输入得分").wait_for(timeout=10_000)
            assert put_requests == []
            assert sql_scalar(f'''SELECT COUNT(*) FROM "AssessmentItem" WHERE id={q(audio_id)} AND "scoredScore" IS NULL;''') == "1"
            score_input.fill("0")
            expect(page.locator("[data-score-preview]")).to_have_text("当前选择：0 分")
            comment = "具体观察：这次朗读停顿自然，句尾收得清楚。\n下一步练习：把第二句放慢半拍，留出句间停顿。"
            page.locator("[data-review-comment]").fill(comment)
            expect(page.locator("[data-feedback-preview-text]")).to_have_text(comment)
            page.route(submit_url, lambda route: route.abort("internetdisconnected") if route.request.method == "PUT" else route.continue_())
            page.locator("[data-review-submit]").click()
            page.get_by_text("输入内容已保留").wait_for(timeout=20_000)
            assert score_input.input_value() == "0"
            assert page.locator("[data-review-comment]").input_value() == comment
            assert len(put_requests) == 1
            page.unroute(submit_url)
            page.locator("[data-review-submit]").click()
            page.get_by_text("服务器已保存正式得分 0 分").wait_for(timeout=20_000)
            assert len(put_requests) == 2
            saved_zero = sql_rows(
                f'''SELECT "scoredScore"::text,"reviewerUserId",encode(convert_to("reviewerComment",'UTF8'),'hex'),"revision"::text,status::text
                    FROM "AssessmentItem" WHERE id={q(audio_id)};'''
            )[0]
            saved_zero[2] = bytes.fromhex(saved_zero[2]).decode("utf-8")
            assert saved_zero == ["0", t048.TEACHER_SEED_ID, comment, "2", "REVIEWED"], saved_zero
            assert sql_scalar(f'''SELECT COUNT(*) FROM "AssessmentReport" WHERE "sessionId"={q(attempt_id)};''') == "0"
            assert sql_scalar(
                f'''SELECT COUNT(*) FROM "AssessmentItem" WHERE "sessionId"={q(attempt_id)}
                    AND "scoredScore" IS NULL;'''
            ) == str(len(initial_queue) - 1)
            same_retry = page.request.put(submit_url, headers=teacher_headers, data={"score": 0, "comment": comment})
            changed_duplicate = page.request.put(
                submit_url,
                headers=teacher_headers,
                data={"score": float(audio_item["maxScore"]), "comment": "TEST_FIXTURE_ONLY 不得覆盖"},
            )
            assert same_retry.status == 200 and changed_duplicate.status == 409

            comments = {audio_id: comment}
            remaining_items = [item for item in initial_queue if item["itemId"] != audio_id]
            for index, queue_item in enumerate(remaining_items):
                item_id = queue_item["itemId"]
                item_detail_response = page.request.get(
                    f"{API}/schools/{SCHOOL_ID}/assessment-reviews/{item_id}", headers=teacher_headers
                )
                assert item_detail_response.ok, item_detail_response.text()
                item_detail = payload(item_detail_response)
                item_comment = f"TEST_FIXTURE_ONLY T050 人工复核 {item_id[:8]}。"
                saved = page.request.put(
                    f"{API}/schools/{SCHOOL_ID}/assessment-reviews/{item_id}",
                    headers=teacher_headers,
                    data={"score": 0, "comment": item_comment},
                )
                assert saved.ok, saved.text()
                comments[item_id] = item_comment
                if index < len(remaining_items) - 1:
                    assert sql_scalar(f'''SELECT COUNT(*) FROM "AssessmentReport" WHERE "sessionId"={q(attempt_id)};''') == "0"
                else:
                    assert sql_scalar(f'''SELECT COUNT(*) FROM "AssessmentReport" WHERE "sessionId"={q(attempt_id)};''') == "1"

            reviewed = sql_rows(
                f'''SELECT "scoredScore"::text,"reviewerUserId",status::text FROM "AssessmentItem"
                    WHERE id IN ({','.join(q(item_id) for item_id in item_ids)}) ORDER BY "sortOrder";'''
            )
            assert reviewed and all(row == ["0", t048.TEACHER_SEED_ID, "REVIEWED"] for row in reviewed), reviewed
            report = sql_rows(
                f'''SELECT r.id,r."overallScore"::text,s.status::text,s.purpose::text
                    FROM "AssessmentReport" r JOIN "AssessmentSession" s ON s.id=r."sessionId"
                    WHERE r."sessionId"={q(attempt_id)};'''
            )
            assert len(report) == 1 and report[0][2:] == ["COMPLETED", "STANDARD"], report
            awarded, maximum = sql_rows(
                f'''SELECT SUM("scoredScore")::text,SUM("maxScore")::text FROM "AssessmentItem"
                    WHERE "sessionId"={q(attempt_id)};'''
            )[0]
            assert float(report[0][1]) == pytest.approx(float(awarded) / float(maximum) * 100)
            report_id = report[0][0]

            student_browser = browser_login_student(page, student_a["login"])
            page.goto(f"{BASE}/student/practices/history/", wait_until="networkidle")
            history_row = page.locator(f'[data-history-session="{attempt_id}"]')
            history_row.wait_for(timeout=20_000)
            expect(history_row).to_contain_text("已完成")
            report_link = history_row.get_by_role("link", name="查看正式报告")
            report_href = report_link.get_attribute("href")
            assert report_href and attempt_id in report_href and report_href.endswith("/report/")
            report_link.click()
            page.wait_for_url(f"**{report_href}", timeout=20_000)
            page.locator("[data-report-teacher-feedback]").wait_for(timeout=20_000)
            feedback = page.locator(".teacher-feedback-item").filter(has_text="具体观察：")
            expect(feedback).to_have_count(1)
            assert feedback.evaluate("node => node.childNodes[0].textContent") == comment
            assert feedback.evaluate("node => getComputedStyle(node).whiteSpace") == "pre-wrap"
            student_report_response = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{attempt_id}/report",
                headers=t048.headers(student_browser),
            )
            assert student_report_response.ok
            student_report = payload(student_report_response)
            assert student_report["id"] == report_id
            assert student_report["overallScore"] == pytest.approx(float(report[0][1]))
            assert {entry["comment"] for entry in student_report["teacherFeedback"]} == set(comments.values())
            report_layout = save_viewports(page, "student-formal-report")

            other_student = t048.login_api(page, student_b["login"])
            foreign_report = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/assessments/sessions/{attempt_id}/report",
                headers=t048.headers(other_student),
            )
            foreign_history = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/assessments/history?enrollmentId={student_a['enrollment']}",
                headers=t048.headers(other_student),
            )
            assert foreign_report.status in (403, 404) and foreign_history.status == 403
            assert browser_errors == [], browser_errors
            proof.update({
                "studentUserId": student_a["user"],
                "studentLogin": student_a["login"],
                "studentEnrollmentId": student_a["enrollment"],
                "courseAssignmentId": assignment_id,
                "reviewClassId": CLASS_ID,
                "courseActivityId": course["activity"],
                "courseActivityPersisted": True,
                "todayPersonalizedPrimaryPreserved": today["primaryAction"]["kind"],
                "fourCardFallbackCount": 0,
                "todayViewports": today_layout,
                "courseViewports": course_layout,
                "todayPostCoursePrimaryAction": today_after_course["primaryAction"]["kind"],
                "oralCatalogFilterRequest": oral_request.value.url,
                "studentFirstOralPracticeId": rhythm["id"],
                "runnerViewports": runner_layout,
                "attemptId": attempt_id,
                "recordingsInMinIO": minio_objects,
                "uiSubmitPosts": completion["submitPosts"],
                "idempotentSubmitReplayAttemptId": completion["duplicateSubmitId"],
                "sessionBeforeReview": "PROCESSING",
                "reportCountBeforeReview": 0,
                "manualReviewItemIds": item_ids,
                "blankScore": {"PUTRequests": 0, "databaseScore": None},
                "explicitZero": saved_zero,
                "unscoredItemsAfterZero": len(initial_queue) - 1,
                "teacherAudioPlayback": playback,
                "multilineFeedback": comment,
                "changedDuplicateStatus": changed_duplicate.status,
                "reportId": report_id,
                "reportSource": "AssessmentReport generated by API after every queued manual item was reviewed",
                "reportOverallScore": student_report["overallScore"],
                "historyHref": report_href,
                "studentReportViewports": report_layout,
                "permissions": {
                    "anonymousQueue": no_auth.status,
                    "studentQueue": student_queue.status,
                    "studentWriteReview": student_write.status,
                    "missingReview": missing_detail.status,
                    "overScore": over_score.status,
                    "negativeScore": negative_score.status,
                    "crossClassTeacherReview": cross_class_detail.status,
                    "crossSchoolTeacherReview": cross_school_detail.status,
                    "otherStudentReport": foreign_report.status,
                    "otherStudentHistory": foreign_history.status,
                },
            })
            (EVIDENCE_DIR / "t050-integrated-proof.json").write_text(json.dumps(proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(json.dumps({"integration": "student Today → course → oral recording → teacher review → same Attempt report from History", "attemptId": attempt_id, "reportId": report_id, "overallScore": student_report["overallScore"]}, ensure_ascii=False))
        finally:
            context.close()
            browser.close()


def test_t050_retained_mock_specialized_catalog_and_mobile_first_card():
    """Check the T050 catalog modes and the actual first oral card at four widths."""
    t048.verify_runtime_identity()
    student_proof = json.loads((EVIDENCE_DIR / "t050-integrated-proof.json").read_text(encoding="utf-8"))
    original_class_id = t045.CLASS_ID
    t045.CLASS_ID = str(student_proof["reviewClassId"])
    t045.sql = t048.sql
    mock_fixture = t045.create_mock_catalog_fixture(uuid.uuid4().hex[:8])
    specialized_fixture = t045.create_practice(
        f"TEST_FIXTURE_ONLY T050-{uuid.uuid4().hex[:4]}",
        catalog_type="SPECIALIZED",
        requires_recording=False,
        item_versions=[(t045.SEED_CHOICE_VERSION_ID, "CHOICE")],
        description="TEST_FIXTURE_ONLY：验证专项分类筛选，不参与口语录音筛选。",
    )
    t048.sql(
        f'''UPDATE "PracticeDefinition" SET "requiresRecording"=false
             WHERE "schoolId"={q(SCHOOL_ID)}
               AND title LIKE {q('TEST_FIXTURE_ONLY T050%')};'''
    )
    page_errors: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        page.on("pageerror", lambda error: page_errors.append(type(error).__name__))
        try:
            student = browser_login_student(page, student_proof["studentLogin"])
            student_headers = t048.headers(student)
            page.goto(f"{BASE}/student/practices/", wait_until="networkidle")
            page.locator(".catalog-oral-toolbar").wait_for(timeout=20_000)
            expect(page.locator('.catalog-tabs button[data-tab="MOCK"]')).to_be_visible()
            expect(page.locator('.catalog-tabs button[data-tab="SPECIALIZED"]')).to_be_visible()
            assert page.locator(".practice-journey, .practice-journey-card, [data-promotion-card]").count() == 0

            with page.expect_request(lambda request: t045.catalog_request(request, key="catalogType", value="MOCK")) as mock_request:
                page.locator('.catalog-tabs button[data-tab="MOCK"]').click()
            mock_request_url = mock_request.value.url
            mock_response = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/practices?catalogType=MOCK", headers=student_headers
            )
            assert mock_response.ok, mock_response.text()
            mock_items = payload(mock_response)["items"]
            assert mock_items and all(item["catalogType"] == "MOCK" for item in mock_items)
            assert any(item["id"] == mock_fixture["definitionId"] for item in mock_items)

            with page.expect_request(lambda request: t045.catalog_request(request, key="catalogType", value="SPECIALIZED")) as specialized_request:
                page.locator('.catalog-tabs button[data-tab="SPECIALIZED"]').click()
            specialized_request_url = specialized_request.value.url
            specialized_response = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/practices?catalogType=SPECIALIZED", headers=student_headers
            )
            assert specialized_response.ok, specialized_response.text()
            specialized_items = payload(specialized_response)["items"]
            assert specialized_items and all(item["catalogType"] == "SPECIALIZED" for item in specialized_items)
            assert any(item["id"] == specialized_fixture["definitionId"] for item in specialized_items)

            page.locator('.catalog-tabs button[data-tab="MOCK"]').click()
            page.wait_for_function("document.querySelector('.catalog-tabs button[data-tab=MOCK]')?.getAttribute('aria-pressed') === 'true'")
            oral_button = page.locator("[data-journey-oral]")
            oral_button.wait_for(timeout=10_000)
            oral_button.focus()
            with page.expect_request(lambda request: t045.catalog_request(request, key="requiresRecording", value="true")) as oral_request:
                page.keyboard.press("Enter")
            oral_request_url = oral_request.value.url
            assert "catalogType" not in parse_qs(urlsplit(oral_request_url).query)
            oral_response = page.request.get(
                f"{API}/schools/{SCHOOL_ID}/practices?requiresRecording=true", headers=student_headers
            )
            assert oral_response.ok, oral_response.text()
            oral_items = payload(oral_response)["items"]
            assert oral_items and all(item["requiresRecording"] is True for item in oral_items)

            responsive = []
            for width, height in ((390, 844), (768, 1024), (1280, 900), (1440, 1000)):
                page.set_viewport_size({"width": width, "height": height})
                page.evaluate("window.scrollTo(0, 0)")
                page.wait_for_timeout(150)
                layout = page.evaluate("""() => {
                  const card = document.querySelector('.practice-grid .practice-tile');
                  const title = card?.querySelector('h2');
                  return {
                    viewport: document.documentElement.clientWidth,
                    scrollWidth: document.documentElement.scrollWidth,
                    firstCardId: card?.getAttribute('data-practice-detail') ?? null,
                    firstCardTitle: title?.textContent.trim() ?? null,
                    firstCardY: card ? Math.round(card.getBoundingClientRect().top + scrollY) : null,
                    firstTitleBottom: title?.getBoundingClientRect().bottom ?? null,
                    firstTitleVisible: Boolean(title && title.getBoundingClientRect().bottom <= innerHeight),
                  };
                }""")
                assert layout["scrollWidth"] <= width + 1, {"width": width, **layout}
                assert layout["firstCardId"] == oral_items[0]["id"], layout
                assert layout["firstCardId"] and any(
                    item["id"] == layout["firstCardId"] and item["requiresRecording"] for item in oral_items
                ), layout
                EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(EVIDENCE_DIR / f"student-catalog-{width}.png"), full_page=True)
                if width == 390:
                    assert layout["firstCardY"] < height and layout["firstTitleVisible"], layout
                responsive.append({"width": width, "height": height, **layout})
            assert page_errors == [], page_errors
        finally:
            context.close()
            browser.close()

    catalog_proof = {
        "mockRequest": mock_request_url,
        "mockFixtureId": mock_fixture["definitionId"],
        "mockItemCount": len(mock_items),
        "specializedRequest": specialized_request_url,
        "specializedItemCount": len(specialized_items),
        "specializedFixtureId": specialized_fixture["definitionId"],
        "oralFilterRequest": oral_request_url,
        "oralItemCount": len(oral_items),
        "fourViewports": responsive,
    }
    (EVIDENCE_DIR / "t050-catalog-modes-proof.json").write_text(
        json.dumps(catalog_proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    t045.CLASS_ID = original_class_id


def test_t050_same_class_roster_csv_zero_null_and_permission_regression():
    """Verify the same class roster still exports all 35 rows with zero separate from null."""
    t048.verify_runtime_identity()
    t032.sql = lambda statement: t048.sql(statement, capture=True)
    main_flow = json.loads((EVIDENCE_DIR / "t050-integrated-proof.json").read_text(encoding="utf-8"))
    assert main_flow["explicitZero"][0] == "0" and main_flow["blankScore"]["databaseScore"] is None
    roster_teacher = t048.create_teacher_fixture("T050名单35")
    roster_class_id = str(roster_teacher["class"])
    attach_seed_teacher_to_class(roster_class_id)
    roster_students = [
        t048.create_student_fixture(f"T050名单{index + 1:02d}", roster_class_id)
        for index in range(35)
    ]
    assert sql_scalar(
        f'''SELECT COUNT(*) FROM "Enrollment" WHERE "schoolId"={q(SCHOOL_ID)} AND "classId"={q(roster_class_id)}
            AND role='STUDENT' AND status='ACTIVE';'''
    ) == "35"

    with sync_playwright() as playwright:
        request = playwright.request.new_context()
        try:
            teacher = login_api_context(request, "teacher.test")
            teacher_headers = t048.headers(teacher)
            roster_path = f"{API}/schools/{SCHOOL_ID}/classes/{roster_class_id}/student-summaries"
            response = request.get(roster_path, headers=teacher_headers)
            assert response.ok, response.text()
            summaries = payload(response)
            assert isinstance(summaries, list) and len(summaries) == 35, len(summaries) if isinstance(summaries, list) else type(summaries).__name__
            assert all(item["latestAssessmentScore"] is None for item in summaries)
            expected_rows = t032.sql_expected_roster(roster_class_id, SCHOOL_ID)
            assert len(expected_rows) == 35

            other_teacher = t048.create_teacher_fixture("T050名单跨班")
            foreign_teacher = t048.create_cross_school_teacher()
            same_class_student = login_api_context(request, roster_students[0]["login"])
            other_class_api = request.get(roster_path, headers=t048.headers(login_api_context(request, other_teacher["login"])))
            cross_school_api = request.get(roster_path, headers=t048.headers(login_api_context(request, foreign_teacher["login"])))
            student_api = request.get(roster_path, headers=t048.headers(same_class_student))
            anonymous_api = request.get(roster_path)
            assert other_class_api.status in (403, 404)
            assert cross_school_api.status == student_api.status == 403
            assert anonymous_api.status in (401, 403)

            errors: list[str] = []
            confirmations: list[str] = []
            browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
            context = browser.new_context(
                viewport={"width": 1440, "height": 1000},
                accept_downloads=True,
                timezone_id="Asia/Shanghai",
                reduced_motion="reduce",
            )
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(type(error).__name__))
            try:
                browser_login_teacher(page, "teacher.test")
                dashboard = page.request.get(
                    f"{API}/schools/{SCHOOL_ID}/classes/{roster_class_id}/dashboard",
                    headers=teacher_headers,
                )
                assert dashboard.ok
                class_name = payload(dashboard)["className"]
                page.goto(f"{BASE}/teacher/classes/{roster_class_id}?schoolId={SCHOOL_ID}", wait_until="domcontentloaded")
                page.get_by_role("heading", name=class_name).wait_for(timeout=30_000)
                expect(page.locator("#rosterTable .roster-row:not(.header)")).to_have_count(35, timeout=30_000)
                layout = save_viewports(page, "teacher-roster-csv")
                export_button = page.locator(".roster-export-button")
                expect(export_button).to_have_attribute("aria-label", "导出名单/学情CSV")
                page.once("dialog", lambda dialog: (confirmations.append(dialog.message), dialog.accept()))
                with page.expect_download(timeout=30_000) as download_info:
                    export_button.click()
                download = download_info.value
                raw = Path(download.path()).read_bytes()
                parity = t032.compare_csv_with_sql(raw, class_name, expected_rows)
                headers, rows = t032.parse_csv_bytes(raw)
                assert len(rows) == 35
                assert all(row[5] == "" for row in rows)
                assert len(confirmations) == 1 and "35 名在读学生" in confirmations[0]
                assert errors == [], errors
            finally:
                context.close()
                browser.close()
        finally:
            request.dispose()

    csv_proof = {
        "classId": roster_class_id,
        "activeRosterCount": 35,
        "apiStudentSummaries": len(summaries),
        "csvUnscoredRowsRemainBlank": True,
        "sameRunScoreZeroVersusNull": {
            "explicitZero": main_flow["explicitZero"][0],
            "blankPendingScore": main_flow["blankScore"]["databaseScore"],
            "result": "PASS",
        },
        "csvSqlParity": parity,
        "viewports": layout,
        "apiStatuses": {
            "crossClassTeacher": other_class_api.status,
            "crossSchoolTeacher": cross_school_api.status,
            "student": student_api.status,
            "anonymous": anonymous_api.status,
        },
        "personalDataConfirmation": confirmations[0],
    }
    (EVIDENCE_DIR / "t050-roster-csv-proof.json").write_text(json.dumps(csv_proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"classRosterRows": 35, "csvSqlParity": parity, "zeroAndNullSeparate": True, "viewports": [390, 768, 1280, 1440]}, ensure_ascii=False))
