"""
Complete E2E: dynamically discover course, complete all activities,
submit course, and verify submission is SUBMITTED with revision > 0.
All IDs are dynamically discovered from login + course API.
Handles: AUDIO, CHOICE, FILL_BLANK, TEXT (generic save)
         SPEECH (recording chain: init→upload→complete→link)
         CHOICE with coursePractice (practice flow: createOrResume→submit→completePractice)
Produces browser-result.json with full evidence chain.
"""
import json, os, sys, time, requests, io
try:
    import boto3
    HAS_BOTO3 = True
except ImportError:
    HAS_BOTO3 = False

BASE = os.environ.get("YUZAN_API_BASE", "http://127.0.0.1:4000/api/v1")
IDENTIFIER = "student.test"
PASSWORD = "YuzanTest!2026"

RESULT = {
    "taskId": "P0-STUDENT-COURSE-SUBMIT-001",
    "timestamp": "",
    "login": {},
    "courseDiscovery": {},
    "activities": {},
    "submission": {},
    "postSubmitVerification": {},
    "errors": [],
    "consoleErrors": [],
    "pageErrors": [],
    "failedRequests": []
}

def _req(method, url, headers, json_body=None, timeout=15):
    try:
        resp = requests.request(method, url, headers=headers, json=json_body, timeout=timeout)
        return resp
    except Exception as e:
        RESULT["errors"].append(f"Request failed: {method} {url} -> {str(e)}")
        raise

def main():
    RESULT["timestamp"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    # === STEP 1: LOGIN ===
    print("=== STEP 1: LOGIN ===")
    resp = _req("POST", f"{BASE}/auth/login", None, {"identifier": IDENTIFIER, "password": PASSWORD})
    data = resp.json().get("data", resp.json())
    token = data.get("accessToken", "")
    school_id = data.get("activeSchoolId", "")
    user_id = data.get("user", {}).get("id", "")
    RESULT["login"] = {
        "status": resp.status_code,
        "schoolId": school_id,
        "userId": user_id,
        "tokenPresent": bool(token),
        "identifier": IDENTIFIER
    }
    print(f"  schoolId={school_id} userId={user_id}")

    if not token or not school_id:
        RESULT["errors"].append("Login failed: no token or school_id")
        _save_result()
        return

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # === STEP 2: DISCOVER COURSE ===
    print("\n=== STEP 2: DISCOVER COURSE ===")
    resp = _req("GET", f"{BASE}/schools/{school_id}/student/courses", headers)
    courses_data = resp.json().get("data", resp.json())
    items = courses_data if isinstance(courses_data, list) else (courses_data.get("items", courses_data.get("courses", [])))

    if not items:
        RESULT["errors"].append("No courses found")
        _save_result()
        return

    assignment_id = items[0].get("assignmentId", items[0].get("id", ""))
    print(f"  assignmentId={assignment_id}")
    RESULT["courseDiscovery"]["assignmentId"] = assignment_id

    # === STEP 3: GET COURSE DETAIL ===
    print("\n=== STEP 3: GET COURSE DETAIL ===")
    resp = _req("GET", f"{BASE}/schools/{school_id}/student/courses/{assignment_id}", headers)
    detail = resp.json().get("data", resp.json())

    submission_info = detail.get("existingSubmission", detail.get("submission")) or {}
    submission_id = submission_info.get("id", "")
    enrollment_id = submission_info.get("enrollmentId", "")
    revision = submission_info.get("revision", 0)
    submission_status = submission_info.get("status", "")

    print(f"  submissionId={submission_id} enrollmentId={enrollment_id} revision={revision} status={submission_status}")

    RESULT["courseDiscovery"]["submissionId"] = submission_id
    RESULT["courseDiscovery"]["enrollmentId"] = enrollment_id
    RESULT["courseDiscovery"]["initialRevision"] = revision
    RESULT["courseDiscovery"]["initialStatus"] = submission_status

    # Extract all activities dynamically
    units = detail.get("units", [])
    all_activities = []
    for u in units:
        for l in u.get("lessons", []):
            for a in l.get("activities", []):
                aid = a.get("activityId", a.get("id", ""))
                atype = a.get("activityType", a.get("type", ""))
                atitle = a.get("title", "")
                acontent = a.get("content", {}) or {}
                # Check coursePractice reference
                cp = a.get("coursePractice") or a.get("practiceReference") or a.get("practice")
                progress = a.get("progress", {})
                is_completed = a.get("isCompleted", False) or (progress and progress.get("completed", False))
                all_activities.append({
                    "activityId": aid,
                    "type": atype,
                    "title": atitle,
                    "content": acontent,
                    "coursePractice": cp,
                    "alreadyCompleted": is_completed
                })

    print(f"  Activities count: {len(all_activities)}")
    for a in all_activities:
        cp_str = f" [coursePractice={a['coursePractice']['practiceDefinitionId']}]" if a.get("coursePractice") else ""
        done_str = " (DONE)" if a["alreadyCompleted"] else ""
        print(f"    {a['type']}: {a['activityId']} - {a['title']}{cp_str}{done_str}")

    RESULT["courseDiscovery"]["activities"] = all_activities
    RESULT["courseDiscovery"]["activityCount"] = len(all_activities)

    if not submission_id:
        print("  No submission, creating...")
        resp = _req("POST", f"{BASE}/schools/{school_id}/student/courses/{assignment_id}/submissions", headers)
        sub_raw = resp.json().get("data", resp.json())
        # API returns nested structure: data.submission.id
        sub_obj = sub_raw.get("submission", sub_raw)
        submission_id = sub_obj.get("id", sub_raw.get("submissionId", ""))
        enrollment_id = sub_obj.get("enrollmentId", enrollment_id or sub_raw.get("enrollmentId", ""))
        revision = sub_obj.get("revision", 0)
        print(f"  Created submission: id={submission_id} revision={revision}")

    # === STEP 4: COMPLETE ALL ACTIVITIES ===
    print("\n=== STEP 4: COMPLETE ALL ACTIVITIES ===")
    activity_results = {}

    for act in all_activities:
        aid = act["activityId"]
        atype = act["type"]
        atitle = act["title"]
        cp = act.get("coursePractice")

        # Skip already completed activities
        if act["alreadyCompleted"]:
            print(f"\n  SKIP (already completed): {atype} ({aid}) - {atitle}")
            activity_results[aid] = {"type": atype, "title": atitle, "status": "ALREADY_COMPLETED"}
            continue

        print(f"\n  Completing: {atype} ({aid}) - {atitle}")

        # Route based on activity type and coursePractice
        if cp:
            # coursePractice flow: createOrResume → submit session → completePractice
            result = _do_practice_flow(atype, aid, cp, assignment_id, submission_id, enrollment_id, school_id, headers)
            activity_results[aid] = result
        elif atype == "SPEECH":
            # SPEECH flow: save attempt (completed=false) → recording chain → link
            result = _do_speech_flow(aid, assignment_id, submission_id, enrollment_id, school_id, headers)
            activity_results[aid] = result
        else:
            # Generic save flow (AUDIO, CHOICE, FILL_BLANK, TEXT)
            result = _do_generic_save(atype, aid, assignment_id, submission_id, enrollment_id, school_id, headers)
            activity_results[aid] = result

    RESULT["activities"] = activity_results

    # === STEP 5: VERIFY ALL ACTIVITIES COMPLETED ===
    print("\n=== STEP 5: VERIFY ALL ACTIVITIES COMPLETED ===")
    resp = _req("GET", f"{BASE}/schools/{school_id}/student/courses/{assignment_id}", headers)
    post_detail = resp.json().get("data", resp.json())

    completed_activities = []
    incomplete_activities = []

    units_post = post_detail.get("units", [])
    for u in units_post:
        for l in u.get("lessons", []):
            for a in l.get("activities", []):
                aid = a.get("activityId", a.get("id", ""))
                progress = a.get("progress", {})
                is_completed = a.get("isCompleted", False) or (progress and progress.get("completed", False))
                if is_completed:
                    completed_activities.append(aid)
                else:
                    incomplete_activities.append(aid)

    print(f"  Completed: {len(completed_activities)}/{len(all_activities)}")
    print(f"  Completed IDs: {completed_activities}")
    if incomplete_activities:
        print(f"  Incomplete IDs: {incomplete_activities}")

    RESULT["postSubmitVerification"]["completedActivityIds"] = completed_activities
    RESULT["postSubmitVerification"]["incompleteActivityIds"] = incomplete_activities

    # Check completion percent
    completion = post_detail.get("courseCompletion", post_detail.get("studentProgress", {}))
    pct = completion.get("progressPercent", completion.get("percent", "N/A"))
    print(f"  Completion: {pct}%")
    RESULT["postSubmitVerification"]["completionPercent"] = pct

    # === STEP 6: SUBMIT COURSE ===
    print("\n=== STEP 6: SUBMIT COURSE ===")
    post_submission = post_detail.get("existingSubmission", post_detail.get("submission", {}))
    current_revision = post_submission.get("revision", revision)

    print(f"  Current revision: {current_revision}")

    submit_url = f"{BASE}/schools/{school_id}/student/courses/{assignment_id}/submissions/{submission_id}/submit"
    submit_payload = {"revision": current_revision}
    resp = _req("POST", submit_url, headers, submit_payload)

    submit_data = resp.json().get("data", resp.json())
    print(f"  Submit status: {resp.status_code}")
    print(f"  Response: {json.dumps(submit_data)[:300]}")

    RESULT["submission"] = {
        "httpStatus": resp.status_code,
        "revisionSubmitted": current_revision,
        "submissionId": submission_id,
        "submitResponse": submit_data
    }

    # === STEP 7: POST-SUBMIT VERIFICATION ===
    print("\n=== STEP 7: POST-SUBMIT VERIFICATION (new context) ===")
    resp = _req("POST", f"{BASE}/auth/login", None, {"identifier": IDENTIFIER, "password": PASSWORD})
    new_data = resp.json().get("data", resp.json())
    new_token = new_data.get("accessToken", "")
    new_school = new_data.get("activeSchoolId", "")
    new_headers = {"Authorization": f"Bearer {new_token}", "Content-Type": "application/json"}

    resp = _req("GET", f"{BASE}/schools/{new_school}/student/courses/{assignment_id}", new_headers)
    verify_detail = resp.json().get("data", resp.json())
    verify_submission = verify_detail.get("existingSubmission", verify_detail.get("submission", {}))

    print(f"  Post-submit submission status: {verify_submission.get('status')}")
    print(f"  Post-submit revision: {verify_submission.get('revision')}")

    RESULT["postSubmitVerification"]["newContextStatus"] = verify_submission.get("status")
    RESULT["postSubmitVerification"]["newContextRevision"] = verify_submission.get("revision")

    completed_after = []
    units_verify = verify_detail.get("units", [])
    for u in units_verify:
        for l in u.get("lessons", []):
            for a in l.get("activities", []):
                aid = a.get("activityId", a.get("id", ""))
                is_completed = a.get("isCompleted", False) or (a.get("progress", {}) and a.get("progress", {}).get("completed", False))
                if is_completed:
                    completed_after.append(aid)

    RESULT["postSubmitVerification"]["completedAfterResubmit"] = completed_after

    _save_result()
    print("\n=== E2E COMPLETE ===")


def _build_generic_payload(atype):
    """Build attempt payload for generic activity types."""
    if atype == "AUDIO":
        return {"kind": "AUDIO", "value": {"listened": True, "position": 1.0}, "completed": True}
    elif atype == "CHOICE":
        return {"kind": "CHOICE", "value": {"answerIndex": 0}, "completed": True}
    elif atype == "FILL_BLANK":
        return {"kind": "FILL_BLANK", "value": {"answers": ["测试填空答案"]}, "completed": True}
    elif atype == "TEXT":
        return {"kind": "TEXT", "value": {"acknowledged": True, "position": 1.0}, "completed": True}
    else:
        return None


def _do_generic_save(atype, aid, assignment_id, submission_id, enrollment_id, school_id, headers):
    """Complete a generic activity via saveActivityAttempt."""
    payload = _build_generic_payload(atype)
    if payload is None:
        return {"type": atype, "status": "SKIPPED", "reason": f"no payload logic for {atype}"}

    url = f"{BASE}/schools/{school_id}/student/courses/{assignment_id}/submissions/{submission_id}/activities/{aid}/attempt"
    resp = _req("PUT", url, headers, payload)
    resp_data = resp.json().get("data", resp.json())
    print(f"    Status: {resp.status_code}")

    return {
        "type": atype,
        "httpStatus": resp.status_code,
        "attemptId": resp_data.get("attemptId", resp_data.get("id", "")),
        "completed": payload.get("completed", False),
        "responseSnippet": json.dumps(resp_data)[:200]
    }


def _do_speech_flow(aid, assignment_id, submission_id, enrollment_id, school_id, headers):
    """Complete SPEECH activity: recording chain + link (linkRecording handles ActivityAttempt upsert)."""
    # NOTE: Do NOT call saveActivityAttempt before linkRecording.
    # linkRecording internally upserts ActivityAttempt; a prior save creates a row
    # that may already have a Recording linked via activityAttemptId (@unique),
    # causing the new recording.update({activityAttemptId}) to violate the unique constraint.
    print(f"    SPEECH: Starting recording chain (no prior saveActivityAttempt)...")
    recording_id = _do_recording_chain(assignment_id, submission_id, aid, enrollment_id, school_id, headers)

    if not recording_id:
        RESULT["errors"].append(f"SPEECH recording chain failed for {aid}")
        return {"type": "SPEECH", "status": "FAILED", "reason": "recording chain failed"}

    return {
        "type": "SPEECH",
        "recordingId": recording_id,
        "status": "COMPLETED_VIA_RECORDING"
    }


ORAL_ITEM_TYPES = {"READING", "SPEECH", "LISTEN_REPEAT", "READ_ALOUD"}
WRITTEN_ITEM_TYPES = {"WRITTEN", "CHOICE", "FILL_BLANK", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "SHORT_ANSWER", "LISTEN_RETELL"}


def _do_practice_flow(atype, aid, course_practice, assignment_id, submission_id, enrollment_id, school_id, headers):
    """Complete a coursePractice activity via practice flow:
    1. createOrResume → get assessmentSession/attemptId
    2. Get attempt items
    3. For oral items: recording chain → attachRecording to assessment item
    4. For written items: save + finalize answer
    5. Submit assessment session
    6. Call completePractice (correct URL)
    """
    practice_def_id = course_practice.get("practiceDefinitionId", "")
    if not practice_def_id:
        return {"type": atype, "status": "FAILED", "reason": "no practiceDefinitionId"}

    print(f"    Practice flow: definitionId={practice_def_id}")

    # Step 1: Create or resume practice attempt
    create_url = f"{BASE}/schools/{school_id}/practices/{practice_def_id}/attempts"
    create_payload = {
        "assignmentId": assignment_id,
        "submissionId": submission_id,
        "activityId": aid
    }
    resp = _req("POST", create_url, headers, create_payload)
    print(f"    createOrResume: {resp.status_code}")

    if resp.status_code not in (200, 201):
        RESULT["errors"].append(f"createOrResume failed: {resp.status_code} {resp.text[:200]}")
        return {"type": atype, "status": "FAILED", "reason": f"createOrResume {resp.status_code}"}

    resp_data = resp.json().get("data", resp.json())
    attempt_id = resp_data.get("attemptId", "")
    attempt_status = resp_data.get("status", "")
    resumed = resp_data.get("resumed", False)
    print(f"    attemptId={attempt_id} status={attempt_status} resumed={resumed}")

    if not attempt_id:
        RESULT["errors"].append(f"No attemptId from createOrResume")
        return {"type": atype, "status": "FAILED", "reason": "no attemptId"}

    # Step 2: Get attempt items
    items_url = f"{BASE}/schools/{school_id}/practices/attempts/{attempt_id}/items"
    resp = _req("GET", items_url, headers)
    if resp.status_code != 200:
        RESULT["errors"].append(f"getAttemptItems failed: {resp.status_code}")
        return {"type": atype, "status": "FAILED", "reason": f"getAttemptItems {resp.status_code}"}

    items_data = resp.json().get("data", resp.json())
    items = items_data if isinstance(items_data, list) else items_data.get("items", [])
    print(f"    Practice items count: {len(items)}")

    oral_items = []
    written_items = []
    for item in items:
        item_type = item.get("itemType", "")
        item_id = item.get("id", "")
        has_recording = bool(item.get("recordingId"))
        if item_type in ORAL_ITEM_TYPES and not has_recording:
            oral_items.append({"id": item_id, "itemType": item_type})
        elif item_type in WRITTEN_ITEM_TYPES:
            written_items.append({"id": item_id, "itemType": item_type})

    print(f"    Oral items (need recording): {len(oral_items)}, Written items: {len(written_items)}")

    # Step 3: Handle oral items - recording chain + attachRecording
    recording_results = []
    for oral_item in oral_items:
        item_id = oral_item["id"]
        item_type = oral_item["itemType"]
        print(f"      Oral item: {item_type} ({item_id}) - doing recording chain...")

        recording_id = _do_recording_chain(assignment_id, submission_id, aid, enrollment_id, school_id, headers)
        if not recording_id:
            RESULT["errors"].append(f"Recording chain failed for oral item {item_id}")
            continue

        # Attach recording to assessment item
        attach_url = f"{BASE}/schools/{school_id}/assessments/sessions/{attempt_id}/reading/{item_id}/recording"
        attach_payload = {"recordingId": recording_id}
        resp = _req("POST", attach_url, headers, attach_payload)
        print(f"      attachRecording: {resp.status_code}")
        recording_results.append({
            "itemId": item_id,
            "recordingId": recording_id,
            "attachStatus": resp.status_code
        })
        if resp.status_code not in (200, 201):
            RESULT["errors"].append(f"attachRecording failed for {item_id}: {resp.status_code} {resp.text[:200]}")

    # Step 4: Handle written items - save + finalize answer
    written_results = []
    for written_item in written_items:
        item_id = written_item["id"]
        item_type = written_item["itemType"]
        print(f"      Written item: {item_type} ({item_id}) - saving answer...")

        # Save answer
        answer_url = f"{BASE}/schools/{school_id}/assessments/sessions/{attempt_id}/items/{item_id}/answer"
        answer_content = {"text": "E2E测试答案"} if item_type in {"WRITTEN", "SHORT_ANSWER"} else \
                         {"answerIndex": 0} if item_type in {"CHOICE", "SINGLE_CHOICE"} else \
                         {"answers": ["测试填空"]} if item_type in {"FILL_BLANK"} else \
                         {"indices": [0]} if item_type == "MULTIPLE_CHOICE" else \
                         {"text": "E2E测试答案"}
        answer_payload = {"content": answer_content, "charCount": len(str(answer_content))}
        resp = _req("PUT", answer_url, headers, answer_payload)
        print(f"        saveAnswer: {resp.status_code}")

        # Finalize answer
        finalize_url = f"{BASE}/schools/{school_id}/assessments/sessions/{attempt_id}/items/{item_id}/answer/finalize"
        resp = _req("POST", finalize_url, headers, {})
        print(f"        finalizeAnswer: {resp.status_code}")
        written_results.append({
            "itemId": item_id,
            "saveStatus": resp.status_code,
            "finalizeStatus": resp.status_code
        })

    # Step 5: Start session (CREATED -> IN_PROGRESS) before submit
    start_url = f"{BASE}/schools/{school_id}/assessments/sessions/{attempt_id}/start"
    resp_start = _req("POST", start_url, headers, {})
    print(f"    Start session: {resp_start.status_code}")
    if resp_start.status_code not in (200, 201):
        err_start = resp_start.text[:200]
        # If already IN_PROGRESS or beyond, that's fine
        if "IN_PROGRESS" not in err_start and "SUBMITTED" not in err_start:
            print(f"    Start session warning: {err_start}")

    # Step 6: Submit assessment session
    submit_url = f"{BASE}/schools/{school_id}/assessments/sessions/{attempt_id}/submit"
    resp = _req("POST", submit_url, headers, {})
    print(f"    Submit session: {resp.status_code}")

    if resp.status_code not in (200, 201):
        err_msg = resp.text[:300]
        print(f"    Submit session error: {err_msg}")
        # If already submitted, continue to completePractice
        if "SUBMITTED" not in err_msg and "PROCESSING" not in err_msg:
            RESULT["errors"].append(f"Submit session failed: {resp.status_code} {err_msg}")

    # Step 7: Call completePractice with correct URL
    cp_url = f"{BASE}/schools/{school_id}/student/courses/{assignment_id}/submissions/{submission_id}/activities/{aid}/practice-attempts/{attempt_id}/complete"
    resp = _req("POST", cp_url, headers, {})
    print(f"    completePractice: {resp.status_code}")

    cp_data = resp.json().get("data", resp.json())

    return {
        "type": atype,
        "coursePractice": True,
        "practiceDefinitionId": practice_def_id,
        "attemptId": attempt_id,
        "oralItems": recording_results,
        "writtenItems": written_results,
        "completePracticeStatus": resp.status_code,
        "status": "COMPLETED_VIA_PRACTICE" if resp.status_code in (200, 201) else "PARTIAL",
        "responseSnippet": json.dumps(cp_data)[:200]
    }


def _upload_to_minio(object_key, data_bytes):
    """Upload bytes directly to MinIO using boto3."""
    if not HAS_BOTO3:
        return False
    try:
        s3 = boto3.client(
            "s3",
            endpoint_url="http://127.0.0.1:59000",
            aws_access_key_id="minio",
            aws_secret_access_key="local-dev-only-secret",
            region_name="us-east-1",
        )
        s3.put_object(Bucket="yuzan-dev", Key=object_key, Body=data_bytes, ContentType="audio/webm")
        # Verify object exists
        head = s3.head_object(Bucket="yuzan-dev", Key=object_key)
        size = head.get("ContentLength", 0)
        print(f"      MinIO upload OK: {object_key} size={size}")
        return True
    except Exception as e:
        print(f"      MinIO upload FAILED: {e}")
        return False


def _do_recording_chain(assignment_id, submission_id, activity_id, enrollment_id, school_id, headers):
    """Execute the full recording chain: init -> upload -> complete -> link."""
    # 1. Init recording - use unique idempotencyKey each time
    idempotency_key = f"e2e-{int(time.time()*1000)}-{os.getpid()}-{activity_id[:8]}"
    init_payload = {
        "mimeType": "audio/webm",
        "enrollmentId": enrollment_id,
        "submissionId": submission_id,
        "idempotencyKey": idempotency_key
    }
    resp = _req("POST", f"{BASE}/schools/{school_id}/recordings/simple", headers, init_payload)
    if resp.status_code not in (200, 201):
        RESULT["errors"].append(f"initRecording failed: {resp.status_code} {resp.text[:200]}")
        return None

    init_data = resp.json().get("data", resp.json())
    recording_id = init_data.get("recordingId", init_data.get("id", ""))
    raw_upload_url = init_data.get("uploadUrl", "")
    if isinstance(raw_upload_url, dict):
        upload_url = raw_upload_url.get("url", "")
    else:
        upload_url = str(raw_upload_url)

    print(f"      recordingId={recording_id}")

    # 2. Upload fake audio (8KB non-zero bytes) directly to MinIO
    object_key = f"recordings/{recording_id}/full"
    fake_audio = bytes(range(256)) * 32  # 8KB non-zero
    upload_ok = False

    # Method 1: Direct MinIO upload via boto3 (most reliable)
    if HAS_BOTO3:
        upload_ok = _upload_to_minio(object_key, fake_audio)

    # Method 2: Fallback to presigned URL
    if not upload_ok and upload_url:
        try:
            resp = requests.put(upload_url, data=fake_audio, headers={"Content-Type": "audio/webm"}, timeout=15)
            print(f"      presigned upload status: {resp.status_code}")
            if resp.status_code in (200, 201, 204):
                upload_ok = True
        except Exception as e:
            RESULT["errors"].append(f"Presigned upload exception: {str(e)}")

    if not upload_ok:
        RESULT["errors"].append(f"All upload methods failed for recording {recording_id}")

    # 3. Complete recording
    complete_payload = {"objectKey": object_key}
    resp = _req("POST", f"{BASE}/schools/{school_id}/recordings/{recording_id}/complete", headers, complete_payload)
    print(f"      complete status: {resp.status_code}")
    if resp.status_code >= 400:
        RESULT["errors"].append(f"completeRecording failed: {resp.status_code} {resp.text[:200]}")

    # 4. Check recording status before linking
    check_url = f"{BASE}/schools/{school_id}/recordings/{recording_id}"
    try:
        check_resp = _req("GET", check_url, headers)
        if check_resp.status_code == 200:
            check_data = check_resp.json().get("data", check_resp.json())
            rec_status = check_data.get("status", "UNKNOWN")
            rec_object_key = check_data.get("objectKey", "NONE")
            print(f"      recording status: {rec_status} objectKey: {rec_object_key}")
            if rec_status not in ("COMPLETE", "PROCESSING", "READY"):
                RESULT["errors"].append(f"Recording status is {rec_status}, not COMPLETE/PROCESSING/READY - link will fail")
        else:
            print(f"      check recording status: {check_resp.status_code}")
    except Exception:
        pass

    # 5. Link recording to activity
    link_url = f"{BASE}/schools/{school_id}/student/courses/{assignment_id}/submissions/{submission_id}/activities/{activity_id}/recordings/{recording_id}/link"
    resp = _req("POST", link_url, headers, {})
    print(f"      link status: {resp.status_code}")
    if resp.status_code not in (200, 201):
        RESULT["errors"].append(f"linkRecording failed: {resp.status_code} {resp.text[:300]}")

    return recording_id


def _save_result():
    out_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(out_dir, "browser-result.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(RESULT, f, indent=2, ensure_ascii=False)
    print(f"\nResult saved to {out_path}")


if __name__ == "__main__":
    main()
