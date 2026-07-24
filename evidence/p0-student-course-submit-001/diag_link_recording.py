"""
Minimal test to diagnose linkRecording 500 error.
Only does login, get course detail, create fresh recording, and try to link.
"""
import json, os, sys, time, requests

BASE = os.environ.get("YUZAN_API_BASE", "http://127.0.0.1:4000/api/v1")
IDENTIFIER = "student.test"
PASSWORD = "YuzanTest!2026"

def _req(method, url, headers, json_body=None, timeout=15):
    resp = requests.request(method, url, headers=headers, json=json_body, timeout=timeout)
    print(f"  {method} {url.split('/api/v1')[-1]} -> {resp.status_code}")
    if resp.status_code >= 400:
        print(f"    Body: {resp.text[:500]}")
    return resp

def main():
    # Login
    print("=== LOGIN ===")
    resp = _req("POST", f"{BASE}/auth/login", None, {"identifier": IDENTIFIER, "password": PASSWORD})
    data = resp.json().get("data", resp.json())
    token = data.get("accessToken", "")
    school_id = data.get("activeSchoolId", "")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # Get course detail
    print("\n=== COURSE LIST ===")
    resp = _req("GET", f"{BASE}/schools/{school_id}/student/courses", headers)
    courses_data = resp.json().get("data", resp.json())
    items = courses_data if isinstance(courses_data, list) else courses_data.get("courses", [])
    if not items:
        print("No courses found")
        return
    assignment_id = items[0]["assignmentId"]
    print(f"  assignmentId: {assignment_id}")

    print("\n=== COURSE DETAIL ===")
    resp = _req("GET", f"{BASE}/schools/{school_id}/student/courses/{assignment_id}", headers)
    detail = resp.json().get("data", resp.json())

    submission_info = detail.get("existingSubmission", {})
    submission_id = submission_info.get("id", "")
    enrollment_id = submission_info.get("enrollmentId", "")
    print(f"  submissionId: {submission_id}")
    print(f"  enrollmentId: {enrollment_id}")

    # Find SPEECH activity
    speech_activity = None
    for u in detail.get("units", []):
        for l in u.get("lessons", []):
            for a in l.get("activities", []):
                if a.get("type") == "SPEECH":
                    speech_activity = a
    if not speech_activity:
        print("No SPEECH activity found")
        return
    activity_id = speech_activity["id"]
    print(f"  SPEECH activityId: {activity_id}")

    # Check existing attempt for this activity
    print("\n=== CHECK EXISTING ATTEMPT ===")
    existing_attempt = speech_activity.get("attempt")
    existing_progress = speech_activity.get("progress")
    print(f"  existing attempt: {json.dumps(existing_attempt, ensure_ascii=False)[:300] if existing_attempt else 'None'}")
    print(f"  existing progress: {json.dumps(existing_progress, ensure_ascii=False)[:300] if existing_progress else 'None'}")

    # Check existing recordings for this enrollment/submission
    print("\n=== CHECK EXISTING RECORDINGS ===")
    # Try to list recordings for this submission
    try:
        resp = _req("GET", f"{BASE}/schools/{school_id}/recordings?submissionId={submission_id}&limit=10", headers)
        rec_data = resp.json().get("data", resp.json())
        if isinstance(rec_data, list):
            for r in rec_data[:5]:
                print(f"  recording: id={r.get('id','')} status={r.get('status','')} activityAttemptId={r.get('activityAttemptId','')}")
        elif isinstance(rec_data, dict):
            items_list = rec_data.get("items", rec_data.get("recordings", []))
            for r in items_list[:5]:
                print(f"  recording: id={r.get('id','')} status={r.get('status','')} activityAttemptId={r.get('activityAttemptId','')}")
    except Exception as e:
        print(f"  Error listing recordings: {e}")

    # Now try the full recording chain
    print("\n=== INIT RECORDING ===")
    idempotency_key = f"diag-{int(time.time()*1000)}-{os.getpid()}"
    init_payload = {
        "mimeType": "audio/webm",
        "enrollmentId": enrollment_id,
        "submissionId": submission_id,
        "idempotencyKey": idempotency_key
    }
    resp = _req("POST", f"{BASE}/schools/{school_id}/recordings/simple", headers, init_payload)
    if resp.status_code not in (200, 201):
        print("Init recording failed, aborting")
        return
    init_data = resp.json().get("data", resp.json())
    recording_id = init_data.get("recordingId", init_data.get("id", ""))
    print(f"  recordingId: {recording_id}")

    # Complete recording (skip upload for diagnosis - use objectKey directly)
    print("\n=== COMPLETE RECORDING ===")
    complete_payload = {"objectKey": f"recordings/{recording_id}/full"}
    resp = _req("POST", f"{BASE}/schools/{school_id}/recordings/{recording_id}/complete", headers, complete_payload)

    # Check recording status
    print("\n=== CHECK RECORDING STATUS ===")
    resp = _req("GET", f"{BASE}/schools/{school_id}/recordings/{recording_id}", headers)
    if resp.status_code == 200:
        rec_detail = resp.json().get("data", resp.json())
        print(f"  status: {rec_detail.get('status')}")
        print(f"  objectKey: {rec_detail.get('objectKey')}")
        print(f"  activityAttemptId: {rec_detail.get('activityAttemptId')}")

    # Try linkRecording WITHOUT prior saveActivityAttempt
    print("\n=== LINK RECORDING (direct, no prior save) ===")
    link_url = f"{BASE}/schools/{school_id}/student/courses/{assignment_id}/submissions/{submission_id}/activities/{activity_id}/recordings/{recording_id}/link"
    resp = _req("POST", link_url, headers, {})
    print(f"  Link result: {resp.status_code}")
    if resp.status_code in (200, 201):
        link_data = resp.json().get("data", resp.json())
        print(f"  SUCCESS! synced={link_data.get('synced')} completion={json.dumps(link_data.get('courseCompletion',{}))[:200]}")
    else:
        print(f"  FAILED: {resp.text[:500]}")

    # Try with prior saveActivityAttempt (completed=false)
    print("\n=== TRY AGAIN WITH SAVE ATTEMPT FIRST ===")
    # First, create a new recording
    idempotency_key2 = f"diag2-{int(time.time()*1000)}-{os.getpid()}"
    init_payload2 = {
        "mimeType": "audio/webm",
        "enrollmentId": enrollment_id,
        "submissionId": submission_id,
        "idempotencyKey": idempotency_key2
    }
    resp2 = _req("POST", f"{BASE}/schools/{school_id}/recordings/simple", headers, init_payload2)
    if resp2.status_code in (200, 201):
        init_data2 = resp2.json().get("data", resp2.json())
        recording_id2 = init_data2.get("recordingId", init_data2.get("id", ""))
        
        # Complete it
        _req("POST", f"{BASE}/schools/{school_id}/recordings/{recording_id2}/complete", headers, {"objectKey": f"recordings/{recording_id2}/full"})
        
        # Save attempt first
        save_payload = {"kind": "SPEECH", "value": {"recorded": False}, "completed": False}
        resp_save = _req("PUT", f"{BASE}/schools/{school_id}/student/courses/{assignment_id}/submissions/{submission_id}/activities/{activity_id}/attempt", headers, save_payload)
        print(f"  Save attempt: {resp_save.status_code}")
        if resp_save.status_code >= 400:
            print(f"  Save body: {resp_save.text[:300]}")
        
        # Now try link
        link_url2 = f"{BASE}/schools/{school_id}/student/courses/{assignment_id}/submissions/{submission_id}/activities/{activity_id}/recordings/{recording_id2}/link"
        resp_link2 = _req("POST", link_url2, headers, {})
        print(f"  Link result (with save first): {resp_link2.status_code}")
        if resp_link2.status_code in (200, 201):
            print("  SUCCESS with save-first approach!")
        else:
            print(f"  FAILED: {resp_link2.text[:500]}")

if __name__ == "__main__":
    main()
