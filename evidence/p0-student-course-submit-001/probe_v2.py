"""Probe course activities structure - check which have coursePractice."""
import requests, json

BASE = "http://127.0.0.1:4000/api/v1"
r = requests.post(f"{BASE}/auth/login", json={"identifier": "student.test", "password": "YuzanTest!2026"}, timeout=10)
d = r.json().get("data", r.json())
token = d.get("accessToken", "")
sid = d.get("activeSchoolId", "")
h = {"Authorization": f"Bearer {token}"}

r2 = requests.get(f"{BASE}/schools/{sid}/student/courses", headers=h)
courses = r2.json().get("data", r2.json())
items = courses if isinstance(courses, list) else courses.get("items", courses.get("courses", []))
aid = items[0].get("assignmentId", items[0].get("id", ""))
print(f"assignmentId={aid}")

r3 = requests.get(f"{BASE}/schools/{sid}/student/courses/{aid}", headers=h)
detail = r3.json().get("data", r3.json())

# Save raw detail for inspection
with open("course_probe_detail.json", "w", encoding="utf-8") as f:
    json.dump(detail, f, indent=2, ensure_ascii=False)

units = detail.get("units", [])
for u in units:
    for l in u.get("lessons", []):
        for a in l.get("activities", []):
            aid2 = a.get("activityId", a.get("id", ""))
            atype = a.get("activityType", a.get("type", ""))
            atitle = a.get("title", "")
            # Check all possible keys for coursePractice
            cp = a.get("coursePractice") or a.get("practiceReference") or a.get("practice")
            progress = a.get("progress", {})
            is_completed = a.get("isCompleted", False) or (progress and progress.get("completed", False))
            print(f"  {atype}: {aid2} - {atitle} | coursePractice={json.dumps(cp) if cp else None} | completed={is_completed}")

sub = detail.get("existingSubmission", detail.get("submission", {}))
print(f"submissionId={sub.get('id','')}")
print(f"enrollmentId={sub.get('enrollmentId','')}")
print(f"status={sub.get('status','')}")
print(f"revision={sub.get('revision',0)}")

# Also check if there's a submission already and its progress
completion = detail.get("courseCompletion", detail.get("studentProgress", {}))
print(f"completionPercent={completion.get('progressPercent', completion.get('percent', 'N/A'))}")
