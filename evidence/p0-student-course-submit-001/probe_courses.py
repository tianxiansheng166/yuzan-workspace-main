"""Deep probe: discover course details for TEACHER_ASSIGNED courses."""
from __future__ import annotations
import json, os
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("YUZAN_E2E_BASE_URL", "http://127.0.0.1:4175").rstrip("/")
IDENTIFIER = os.environ.get("YUZAN_E2E_STUDENT_IDENTIFIER", "student.test")
PASSWORD = os.environ.get("YUZAN_E2E_STUDENT_PASSWORD", "YuzanTest!2026")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    # Login
    page.goto(f"{BASE_URL}/login/", wait_until="networkidle")
    page.locator("#loginAccount").fill(IDENTIFIER)
    page.locator("#loginPassword").fill(PASSWORD)
    page.locator('[data-action="login"]').click()
    page.wait_for_url(lambda url: "/login" not in url, timeout=15_000)
    page.wait_for_load_state("networkidle")

    # Probe each TEACHER_ASSIGNED course
    result = page.evaluate("""async () => {
        const listed = await YuzanApi.listStudentCourses();
        const courses = listed.courses || listed.items || [];
        const teacherCourses = courses.filter(c => c.source === 'TEACHER_ASSIGNED');
        const details = [];
        for (const c of teacherCourses) {
            const detail = await YuzanApi.getStudentCourse(c.assignmentId);
            const units = detail.units || [];
            const activities = [];
            for (const u of units) {
                for (const l of (u.lessons || [])) {
                    for (const a of (l.activities || [])) {
                        activities.push({
                            activityId: a.activityId || a.id,
                            activityType: a.activityType || a.type,
                            title: a.title,
                            required: a.required,
                            isCompleted: !!(a.progress && a.progress.completed),
                            hasPractice: !!a.coursePractice
                        });
                    }
                }
            }
            details.push({
                assignmentId: c.assignmentId,
                title: detail.courseVersion?.title || c.title,
                source: c.source,
                activityCount: activities.length,
                activities: activities,
                submissionId: detail.submissionId || detail.studentProgress?.submissionId || null,
                submissionStatus: detail.studentProgress?.submissionStatus || null,
                progressPercent: detail.studentProgress?.progressPercent || 0,
            });
        }
        return details;
    }""")

    for course in result:
        print(f"\n=== Course: {course['title']} ===")
        print(f"  assignmentId: {course['assignmentId']}")
        print(f"  submissionId: {course['submissionId']}")
        print(f"  submissionStatus: {course['submissionStatus']}")
        print(f"  progressPercent: {course['progressPercent']}")
        print(f"  Activities ({course['activityCount']}):")
        for a in course['activities']:
            type_str = a['activityType'] or 'UNKNOWN'
            req = 'REQ' if a['required'] else 'opt'
            done = 'DONE' if a['isCompleted'] else 'todo'
            practice = '+P' if a['hasPractice'] else ''
            print(f"    {a['activityId']}: {type_str} [{req}] [{done}]{practice} - {a['title']}")

    # Save full result
    with open("course_probe_result.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print("\nFull result saved to course_probe_result.json")

    browser.close()
