"""Test the full recording upload chain via API to isolate the failure step.
Uses known enrollmentId from database.
"""
import json, os, sys, time, requests

BASE = os.environ.get("YUZAN_API_BASE", "http://127.0.0.1:4000/api/v1")
IDENTIFIER = "student.test"
PASSWORD = "YuzanTest!2026"
ENROLLMENT_ID = "f1111111-1111-4111-8111-111111111111"
ASSIGNMENT_ID = "85000000-0000-4000-8000-000000000004"
SPEECH_ACTIVITY_ID = "84000000-0000-4000-8000-000000000404"

def main():
    # Step 1: Login
    print("=== STEP 1: LOGIN ===")
    resp = requests.post(f"{BASE}/auth/login", json={"identifier": IDENTIFIER, "password": PASSWORD})
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"  Error: {resp.text[:300]}")
        return
    data = resp.json().get("data", resp.json())
    token = data.get("accessToken", "")
    school_id = data.get("activeSchoolId", "")
    print(f"  Token: {token[:30]}...")
    print(f"  School: {school_id}")

    if not token or not school_id:
        print("  No token or school_id, aborting")
        return

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # Step 2: Get submission ID
    print("\n=== STEP 2: GET COURSE DETAIL ===")
    resp = requests.get(f"{BASE}/schools/{school_id}/student/courses/{ASSIGNMENT_ID}", headers=headers)
    print(f"  Status: {resp.status_code}")
    detail = resp.json().get("data", resp.json())
    submission_id = detail.get("existingSubmission", {}).get("id", detail.get("submissionId", ""))
    print(f"  SubmissionId: {submission_id}")

    if not submission_id:
        print("  No submissionId, aborting")
        return

    # Step 3: initRecording
    print("\n=== STEP 3: INIT RECORDING ===")
    init_payload = {
        "mimeType": "audio/webm",
        "enrollmentId": ENROLLMENT_ID,
        "submissionId": submission_id,
        "idempotencyKey": f"chain-test-{int(time.time())}-{os.getpid()}"
    }
    resp = requests.post(f"{BASE}/schools/{school_id}/recordings/simple", headers=headers, json=init_payload)
    print(f"  Status: {resp.status_code}")
    resp_text = resp.text[:500]
    print(f"  Response: {resp_text}")
    if resp.status_code not in (200, 201):
        print("  initRecording FAILED, aborting")
        return

    init_data = resp.json().get("data", resp.json())
    recording_id = init_data.get("recordingId", init_data.get("id", ""))
    raw_upload_url = init_data.get("uploadUrl", "")
    # uploadUrl can be an object {url: "..."} or a string
    if isinstance(raw_upload_url, dict):
        upload_url = raw_upload_url.get("url", "")
    else:
        upload_url = str(raw_upload_url)
    print(f"  RecordingId: {recording_id}")
    print(f"  UploadUrl: {upload_url[:100]}..." if upload_url else "  UploadUrl: EMPTY!")

    if not upload_url:
        print("  No uploadUrl returned, aborting")
        return

    # Step 4: Upload fake audio to presigned URL
    print("\n=== STEP 4: UPLOAD TO PRESIGNED URL ===")
    # Create 8KB of non-zero fake audio data
    fake_audio = bytes(range(256)) * 32  # 8KB
    upload_headers = {"Content-Type": "audio/webm"}
    try:
        resp = requests.put(upload_url, data=fake_audio, headers=upload_headers, timeout=15)
        print(f"  Status: {resp.status_code}")
        print(f"  Response headers (relevant): Content-Length={resp.headers.get('Content-Length')}, ETag={resp.headers.get('ETag')}")
        if resp.status_code not in (200, 201, 204):
            print("  Upload FAILED!")
            print(f"  Full response: {resp.text[:500]}")
            print(f"  All headers: {dict(resp.headers)}")
        else:
            print("  Upload SUCCESS!")
    except requests.exceptions.ConnectionError as e:
        print(f"  Upload CONNECTION ERROR: {e}")
        print("  This likely means MinIO is not accessible or presigned URL is invalid")
        return
    except Exception as e:
        print(f"  Upload EXCEPTION: {type(e).__name__}: {e}")
        return

    # Step 5: Complete recording
    print("\n=== STEP 5: COMPLETE RECORDING ===")
    complete_payload = {"objectKey": f"recordings/{recording_id}/full"}
    resp = requests.post(
        f"{BASE}/schools/{school_id}/recordings/{recording_id}/complete",
        headers=headers, json=complete_payload
    )
    print(f"  Status: {resp.status_code}")
    print(f"  Response: {resp.text[:500]}")

    if resp.status_code not in (200, 201):
        print("  completeRecording FAILED")
        # Continue anyway to see linkRecording result
    else:
        complete_data = resp.json().get("data", resp.json())
        print(f"  Recording status: {complete_data.get('status', 'unknown')}")
        print(f"  Duration: {complete_data.get('durationMs', 'N/A')}")

    # Step 6: Link recording to activity
    print("\n=== STEP 6: LINK RECORDING TO ACTIVITY ===")
    link_url = f"{BASE}/schools/{school_id}/student/courses/{ASSIGNMENT_ID}/submissions/{submission_id}/activities/{SPEECH_ACTIVITY_ID}/recordings/{recording_id}/link"
    resp = requests.post(link_url, headers=headers, json={})
    print(f"  URL: {link_url}")
    print(f"  Status: {resp.status_code}")
    print(f"  Response: {resp.text[:500]}")

    # Step 7: Save activity attempt
    print("\n=== STEP 7: SAVE ACTIVITY ATTEMPT ===")
    attempt_payload = {
        "kind": "SPEECH",
        "value": {"recorded": True},
        "completed": True
    }
    attempt_url = f"{BASE}/schools/{school_id}/student/courses/{ASSIGNMENT_ID}/submissions/{submission_id}/activities/{SPEECH_ACTIVITY_ID}/attempt"
    resp = requests.put(attempt_url, headers=headers, json=attempt_payload)
    print(f"  URL: {attempt_url}")
    print(f"  Status: {resp.status_code}")
    print(f"  Response: {resp.text[:500]}")

    # Step 8: Verify recording evidence
    print("\n=== STEP 8: VERIFY RECORDING EVIDENCE ===")
    resp = requests.get(
        f"{BASE}/schools/{school_id}/recordings/{recording_id}",
        headers=headers
    )
    print(f"  Status: {resp.status_code}")
    if resp.status_code == 200:
        rec_data = resp.json().get("data", resp.json())
        print(f"  Status: {rec_data.get('status')}")
        print(f"  ObjectKey: {rec_data.get('objectKey')}")
        print(f"  Duration: {rec_data.get('durationMs')}")
        print(f"  MimeType: {rec_data.get('mimeType')}")

    print("\n=== CHAIN TEST COMPLETE ===")


if __name__ == "__main__":
    main()
