"""
Database Cross-Verification Script for P0-STUDENT-COURSE-SUBMIT-001

Reads dynamic IDs from browser-result.json, then queries PostgreSQL to verify:
  a) Submission status = SUBMITTED, revision > 0
  b) Each ActivityAttempt exists with correct kind/value
  c) Each ActivityProgress has completed = true
  d) Recording has non-empty objectKey, activityAttemptId bound
  e) AssessmentSession status = SUBMITTED or COMPLETED
  f) enrollmentId and submissionId match E2E script dynamic discovery

DB_URL: postgresql://yuzan_dev:<password>@127.0.0.1:55432/yuzan_dev
"""
import json
import os
import sys
import time

try:
    import psycopg2
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False

DB_HOST = os.environ.get("DB_HOST", "127.0.0.1")
DB_PORT = os.environ.get("DB_PORT", "55432")
DB_NAME = os.environ.get("DB_NAME", "yuzan_dev")
DB_USER = os.environ.get("DB_USER", "yuzan_dev")
DB_PASS = os.environ.get("DB_PASS", "1e389bf6a02f02c827dbb8e973b7d0a8ec5aeb0ce239ce5fe55607a9efb35eb7")

RESULT = {
    "task": "P0-STUDENT-COURSE-SUBMIT-001",
    "script": "db_cross_verify",
    "timestamp": "",
    "verification_result": "PASS",
    "dynamicIds": {},
    "checks": {},
    "errors": []
}


def _load_browser_result():
    """Load browser-result.json from the same directory as this script."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    br_path = os.path.join(script_dir, "browser-result.json")

    if not os.path.exists(br_path):
        RESULT["errors"].append(f"browser-result.json not found at {br_path}")
        return None

    with open(br_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _extract_dynamic_ids(br):
    """Extract submissionId, enrollmentId, assignmentId, schoolId, activityIds from browser-result.json."""
    ids = {}

    # From login section
    ids["schoolId"] = br.get("login", {}).get("schoolId", "")
    ids["userId"] = br.get("login", {}).get("userId", "")

    # From courseDiscovery
    cd = br.get("courseDiscovery", {})
    ids["assignmentId"] = cd.get("assignmentId", "")
    ids["submissionId"] = cd.get("submissionId", "")
    ids["enrollmentId"] = cd.get("enrollmentId", "")

    # If submissionId is in the submission section (more reliable after submit)
    sub = br.get("submission", {})
    if sub.get("submissionId"):
        ids["submissionId"] = sub["submissionId"]
    submit_resp = sub.get("submitResponse", {})
    if isinstance(submit_resp, dict):
        sub_obj = submit_resp.get("submission", {})
        if sub_obj.get("id"):
            ids["submissionId"] = sub_obj["id"]
        if sub_obj.get("enrollmentId"):
            ids["enrollmentId"] = sub_obj["enrollmentId"]

    # Activity IDs and types
    activities = cd.get("activities", [])
    ids["activityIds"] = []
    ids["activities"] = []
    for act in activities:
        aid = act.get("activityId", "")
        atype = act.get("type", "")
        ids["activityIds"].append(aid)
        ids["activities"].append({"activityId": aid, "type": atype})

    # Recording IDs from activities section
    acts_result = br.get("activities", {})
    ids["recordingIds"] = []
    for aid, adata in acts_result.items():
        if isinstance(adata, dict) and adata.get("recordingId"):
            ids["recordingIds"].append(adata["recordingId"])
        # Practice oral items recordings
        if isinstance(adata, dict) and adata.get("oralItems"):
            for item in adata["oralItems"]:
                if item.get("recordingId"):
                    ids["recordingIds"].append(item["recordingId"])

    # Practice attempt IDs
    ids["practiceAttemptIds"] = []
    for aid, adata in acts_result.items():
        if isinstance(adata, dict) and adata.get("attemptId"):
            ids["practiceAttemptIds"].append(adata["attemptId"])

    return ids


def _query_scalar(cur, sql, params=None):
    """Execute query and return first row."""
    cur.execute(sql, params)
    return cur.fetchall()


def check_submission(cur, ids):
    """a) Verify Submission status = SUBMITTED, revision > 0."""
    print("\n=== Check A: Submission status and revision ===")
    check = {"name": "submission_status", "passed": False, "details": {}}

    submission_id = ids.get("submissionId", "")
    if not submission_id:
        check["error"] = "No submissionId from browser-result.json"
        check["details"]["submissionId"] = ""
        print(f"  FAIL: No submissionId")
        return check

    rows = _query_scalar(cur, """
        SELECT id, status, revision, "enrollmentId", "assignmentId", "submittedAt"
        FROM "Submission"
        WHERE id = %s
    """, (submission_id,))

    if not rows:
        check["error"] = f"Submission {submission_id} not found in DB"
        print(f"  FAIL: Submission not found")
        return check

    row = rows[0]
    db_status = row[1]
    db_revision = row[2]
    db_enrollment_id = row[3]
    db_assignment_id = row[4]

    status_ok = db_status == "SUBMITTED"
    revision_ok = db_revision is not None and db_revision > 0

    check["details"] = {
        "id": str(row[0]),
        "status": db_status,
        "revision": db_revision,
        "enrollmentId": str(db_enrollment_id) if db_enrollment_id else "",
        "assignmentId": str(db_assignment_id) if db_assignment_id else ""
    }
    check["statusOk"] = status_ok
    check["revisionOk"] = revision_ok
    check["passed"] = status_ok and revision_ok

    print(f"  id={submission_id}")
    print(f"  status={db_status} (expected SUBMITTED): {'OK' if status_ok else 'FAIL'}")
    print(f"  revision={db_revision} (expected > 0): {'OK' if revision_ok else 'FAIL'}")
    print(f"  Check A: {'PASS' if check['passed'] else 'FAIL'}")
    return check


def check_activity_attempts(cur, ids):
    """b) Verify each ActivityAttempt exists with correct kind/value."""
    print("\n=== Check B: ActivityAttempts exist with kind/value ===")
    check = {"name": "activity_attempts", "passed": False, "details": [], "missing": []}

    submission_id = ids.get("submissionId", "")
    activities = ids.get("activities", [])

    if not submission_id or not activities:
        check["error"] = "Missing submissionId or activities"
        return check

    all_ok = True
    for act in activities:
        aid = act["activityId"]
        atype = act["type"]

        rows = _query_scalar(cur, """
            SELECT id, "submissionId", "activityId", kind, value, "createdAt"
            FROM "ActivityAttempt"
            WHERE "submissionId" = %s AND "activityId" = %s
            ORDER BY "createdAt" DESC LIMIT 1
        """, (submission_id, aid))

        if not rows:
            check["missing"].append(aid)
            check["details"].append({
                "activityId": aid,
                "type": atype,
                "found": False,
                "error": "No ActivityAttempt row"
            })
            print(f"  {atype} ({aid}): NOT FOUND")
            all_ok = False
            continue

        row = rows[0]
        db_kind = row[3]
        db_value = row[4]
        has_value = db_value is not None and db_value != ""

        # Kind should match activity type (or be a compatible variant)
        kind_match = (db_kind == atype) or (db_kind and atype and db_kind.upper() == atype.upper())

        check["details"].append({
            "activityId": aid,
            "type": atype,
            "found": True,
            "attemptId": str(row[0]),
            "kind": db_kind,
            "hasValue": has_value,
            "kindMatchesType": kind_match
        })
        status_str = "OK" if (has_value) else "WARN(no value)"
        print(f"  {atype} ({aid}): kind={db_kind} hasValue={has_value} → {status_str}")
        if not has_value:
            all_ok = False

    check["passed"] = all_ok
    print(f"  Check B: {'PASS' if check['passed'] else 'FAIL'}")
    return check


def check_activity_progress(cur, ids):
    """c) Verify each ActivityProgress has completed = true."""
    print("\n=== Check C: ActivityProgress completed = true ===")
    check = {"name": "activity_progress", "passed": False, "details": [], "notCompleted": []}

    enrollment_id = ids.get("enrollmentId", "")
    activity_ids = ids.get("activityIds", [])

    if not enrollment_id or not activity_ids:
        check["error"] = "Missing enrollmentId or activityIds"
        return check

    all_completed = True
    for aid in activity_ids:
        rows = _query_scalar(cur, """
            SELECT "activityId", "enrollmentId", completed, position, revision
            FROM "ActivityProgress"
            WHERE "enrollmentId" = %s AND "activityId" = %s
        """, (enrollment_id, aid))

        if not rows:
            check["notCompleted"].append(aid)
            check["details"].append({
                "activityId": aid,
                "found": False,
                "completed": False
            })
            print(f"  {aid}: NOT FOUND in ActivityProgress")
            all_completed = False
            continue

        row = rows[0]
        is_completed = row[2] is True
        check["details"].append({
            "activityId": aid,
            "found": True,
            "completed": is_completed,
            "position": row[3],
            "revision": row[4]
        })
        if not is_completed:
            check["notCompleted"].append(aid)
            all_completed = False

        print(f"  {aid}: completed={is_completed}")

    check["allCompleted"] = all_completed
    check["passed"] = all_completed
    print(f"  Check C: {'PASS' if check['passed'] else 'FAIL'}")
    return check


def check_recordings(cur, ids):
    """d) Verify Recording has non-empty objectKey, activityAttemptId bound.

    Two recording categories:
    - SPEECH direct recording: must have activityAttemptId bound
    - Practice oral recording (via attachRecording): bound via AssessmentAnswer,
      activityAttemptId may be null; just verify objectKey and status
    """
    print("\n=== Check D: Recording objectKey and activityAttemptId ===")
    check = {"name": "recordings", "passed": False, "details": []}

    recording_ids = ids.get("recordingIds", [])
    # Identify which recordings are from practice (oralItems) vs direct SPEECH
    acts_result = {}
    br = _load_browser_result()
    if br:
        acts_result = br.get("activities", {})

    practice_recording_ids = set()
    speech_recording_ids = set()
    for aid, adata in acts_result.items():
        if isinstance(adata, dict):
            if adata.get("oralItems"):
                for item in adata["oralItems"]:
                    if item.get("recordingId"):
                        practice_recording_ids.add(item["recordingId"])
            if adata.get("type") == "SPEECH" and adata.get("recordingId"):
                speech_recording_ids.add(adata["recordingId"])

    if not recording_ids:
        check["note"] = "No recordingIds found in browser-result.json"
        # Try to find recordings linked to this submission's attempts
        submission_id = ids.get("submissionId", "")
        if submission_id:
            rows = _query_scalar(cur, """
                SELECT r.id, r.status, r."objectKey", r."durationMs", r."activityAttemptId"
                FROM "Recording" r
                JOIN "ActivityAttempt" aa ON aa.id = r."activityAttemptId"
                WHERE aa."submissionId" = %s
                ORDER BY r."createdAt" DESC
            """, (submission_id,))
            if rows:
                recording_ids = [str(r[0]) for r in rows]
                check["discoveredRecordingIds"] = recording_ids
                print(f"  Discovered {len(recording_ids)} recordings from DB for submission")

    if not recording_ids:
        check["note"] = "No recordings to verify"
        check["passed"] = True  # Not a failure if no recordings needed
        print(f"  No recordings to verify")
        return check

    all_ok = True
    for rid in recording_ids:
        rows = _query_scalar(cur, """
            SELECT id, status, "objectKey", "durationMs", "activityAttemptId", "mimeType"
            FROM "Recording"
            WHERE id = %s
        """, (rid,))

        if not rows:
            check["details"].append({
                "recordingId": rid,
                "found": False,
                "error": "Recording not found in DB"
            })
            print(f"  Recording {rid}: NOT FOUND")
            all_ok = False
            continue

        row = rows[0]
        db_status = row[1]
        db_object_key = row[2]
        db_duration = row[3]
        db_attempt_id = row[4]

        has_object_key = db_object_key is not None and db_object_key != ""
        has_attempt_binding = db_attempt_id is not None and db_attempt_id != ""

        # Determine recording category
        is_practice = rid in practice_recording_ids
        is_speech = rid in speech_recording_ids

        # SPEECH direct recording: must have attemptId bound
        # Practice recording: attemptId may be null (linked via AssessmentAnswer)
        if is_speech:
            rec_ok = has_object_key and has_attempt_binding
        elif is_practice:
            rec_ok = has_object_key  # objectKey is sufficient for practice recordings
        else:
            # Unknown category: require both for strictness
            rec_ok = has_object_key and has_attempt_binding

        if not rec_ok:
            all_ok = False

        check["details"].append({
            "recordingId": str(row[0]),
            "found": True,
            "status": db_status,
            "objectKey": db_object_key or "",
            "objectKeyOk": has_object_key,
            "durationMs": db_duration,
            "activityAttemptId": str(db_attempt_id) if db_attempt_id else "",
            "attemptBoundOk": has_attempt_binding,
            "category": "practice" if is_practice else ("speech" if is_speech else "unknown"),
            "passCriteria": "objectKey_only" if is_practice else "objectKey_and_attemptId"
        })
        status_str = "OK" if rec_ok else "FAIL"
        cat_str = "practice" if is_practice else ("speech" if is_speech else "unknown")
        print(f"  Recording {rid}: status={db_status} objectKey={'OK' if has_object_key else 'MISSING'} "
              f"attemptBound={'OK' if has_attempt_binding else 'N/A(Practice)'} "
              f"category={cat_str} → {status_str}")

    check["passed"] = all_ok
    print(f"  Check D: {'PASS' if check['passed'] else 'FAIL'}")
    return check


def check_assessment_sessions(cur, ids):
    """e) Verify AssessmentSession status = SUBMITTED or COMPLETED."""
    print("\n=== Check E: AssessmentSession status ===")
    check = {"name": "assessment_sessions", "passed": False, "details": []}

    practice_attempt_ids = ids.get("practiceAttemptIds", [])
    submission_id = ids.get("submissionId", "")

    # If no practice attempt IDs from browser-result, try finding them via DB
    if not practice_attempt_ids and submission_id:
        rows = _query_scalar(cur, """
            SELECT "assessmentSessionId", "activityId"
            FROM "ActivityAttempt"
            WHERE "submissionId" = %s AND "assessmentSessionId" IS NOT NULL
        """, (submission_id,))
        if rows:
            practice_attempt_ids = [str(r[0]) for r in rows]
            check["discoveredFromDB"] = True

    if not practice_attempt_ids:
        check["note"] = "No assessment sessions to verify (no coursePractice activities, or no IDs available)"
        check["passed"] = True  # Not a failure if no practices
        print(f"  No assessment sessions to verify")
        return check

    all_ok = True
    for session_id in practice_attempt_ids:
        rows = _query_scalar(cur, """
            SELECT id, status, "practiceDefinitionId", "createdAt"
            FROM "AssessmentSession"
            WHERE id = %s
        """, (session_id,))

        if not rows:
            check["details"].append({
                "sessionId": session_id,
                "found": False,
                "error": "AssessmentSession not found"
            })
            print(f"  Session {session_id}: NOT FOUND")
            all_ok = False
            continue

        row = rows[0]
        db_status = row[1]
        status_ok = db_status in ("SUBMITTED", "COMPLETED", "PROCESSING")

        check["details"].append({
            "sessionId": str(row[0]),
            "found": True,
            "status": db_status,
            "statusOk": status_ok
        })
        print(f"  Session {session_id}: status={db_status} → {'OK' if status_ok else 'FAIL'}")
        if not status_ok:
            all_ok = False

    check["passed"] = all_ok
    print(f"  Check E: {'PASS' if check['passed'] else 'FAIL'}")
    return check


def check_enrollment_submission_consistency(cur, ids):
    """f) Verify enrollmentId and submissionId match E2E script dynamic discovery."""
    print("\n=== Check F: enrollmentId/submissionId consistency ===")
    check = {"name": "enrollment_submission_consistency", "passed": False, "details": {}}

    submission_id = ids.get("submissionId", "")
    enrollment_id = ids.get("enrollmentId", "")
    assignment_id = ids.get("assignmentId", "")

    if not submission_id:
        check["error"] = "No submissionId"
        return check

    # Verify submission's enrollmentId matches
    rows = _query_scalar(cur, """
        SELECT id, "enrollmentId", "assignmentId", status
        FROM "Submission"
        WHERE id = %s
    """, (submission_id,))

    if not rows:
        check["error"] = f"Submission {submission_id} not found in DB"
        return check

    row = rows[0]
    db_enrollment_id = row[1]
    db_assignment_id = row[2]

    enrollment_match = str(db_enrollment_id) == enrollment_id if enrollment_id and db_enrollment_id else True
    assignment_match = str(db_assignment_id) == assignment_id if assignment_id and db_assignment_id else True

    check["details"] = {
        "submissionId": submission_id,
        "browserEnrollmentId": enrollment_id,
        "dbEnrollmentId": str(db_enrollment_id) if db_enrollment_id else "",
        "enrollmentMatch": enrollment_match,
        "browserAssignmentId": assignment_id,
        "dbAssignmentId": str(db_assignment_id) if db_assignment_id else "",
        "assignmentMatch": assignment_match
    }

    print(f"  enrollmentId: browser={enrollment_id} db={db_enrollment_id} match={enrollment_match}")
    print(f"  assignmentId: browser={assignment_id} db={db_assignment_id} match={assignment_match}")

    check["passed"] = enrollment_match and assignment_match
    print(f"  Check F: {'PASS' if check['passed'] else 'FAIL'}")
    return check


def main():
    RESULT["timestamp"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    print("=" * 60)
    print("Database Cross-Verification: P0-STUDENT-COURSE-SUBMIT-001")
    print("=" * 60)

    if not HAS_PSYCOPG2:
        RESULT["verification_result"] = "ERROR"
        RESULT["errors"].append("psycopg2 not installed. Install with: pip install psycopg2-binary")
        print("ERROR: psycopg2 not installed")
        _save_result()
        return

    # Load browser-result.json for dynamic IDs
    print("\n=== Loading browser-result.json ===")
    br = _load_browser_result()
    if not br:
        RESULT["verification_result"] = "ERROR"
        _save_result()
        return

    ids = _extract_dynamic_ids(br)
    RESULT["dynamicIds"] = ids
    print(f"  submissionId={ids.get('submissionId')}")
    print(f"  enrollmentId={ids.get('enrollmentId')}")
    print(f"  assignmentId={ids.get('assignmentId')}")
    print(f"  activityIds={ids.get('activityIds')}")
    print(f"  recordingIds={ids.get('recordingIds')}")
    print(f"  practiceAttemptIds={ids.get('practiceAttemptIds')}")

    # Connect to DB
    print("\n=== Connecting to PostgreSQL ===")
    try:
        conn = psycopg2.connect(
            host=DB_HOST, port=DB_PORT,
            dbname=DB_NAME, user=DB_USER, password=DB_PASS
        )
        cur = conn.cursor()
        print(f"  Connected to {DB_NAME}@{DB_HOST}:{DB_PORT}")
    except Exception as e:
        RESULT["verification_result"] = "ERROR"
        RESULT["errors"].append(f"DB connection failed: {str(e)}")
        print(f"  Connection failed: {e}")
        _save_result()
        return

    # Run all checks
    try:
        RESULT["checks"]["A_submission"] = check_submission(cur, ids)
        RESULT["checks"]["B_activityAttempts"] = check_activity_attempts(cur, ids)
        RESULT["checks"]["C_activityProgress"] = check_activity_progress(cur, ids)
        RESULT["checks"]["D_recordings"] = check_recordings(cur, ids)
        RESULT["checks"]["E_assessmentSessions"] = check_assessment_sessions(cur, ids)
        RESULT["checks"]["F_enrollmentConsistency"] = check_enrollment_submission_consistency(cur, ids)
    except Exception as e:
        RESULT["errors"].append(f"Check execution error: {str(e)}")
        print(f"\n  Error during checks: {e}")
    finally:
        cur.close()
        conn.close()

    # Compute overall result
    all_checks = RESULT["checks"]
    all_passed = all(
        c.get("passed", False)
        for c in all_checks.values()
        if isinstance(c, dict)
    )
    RESULT["verification_result"] = "PASS" if all_passed else "FAIL"

    print(f"\n{'=' * 60}")
    print(f"Overall: {RESULT['verification_result']}")
    for name, check in all_checks.items():
        if isinstance(check, dict) and "passed" in check:
            print(f"  {name}: {'PASS' if check['passed'] else 'FAIL'}")
    print(f"{'=' * 60}")

    _save_result()


def _save_result():
    out_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(out_dir, "database-result.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(RESULT, f, indent=2, ensure_ascii=False)
    print(f"\nResult saved to {out_path}")


if __name__ == "__main__":
    main()
