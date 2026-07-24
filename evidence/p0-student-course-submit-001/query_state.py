"""Query current ActivityAttempt and Recording state to diagnose linkRecording 500."""
import json, os, sys
import psycopg2

DB_URL = "postgresql://yuzan_dev:1e389bf6a02f02c827dbb8e973b7d0a8ec5aeb0ce239ce5fe55607a9efb35eb7@127.0.0.1:55432/yuzan_dev"

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # 1. Find test student enrollment
    cur.execute("""
        SELECT e.id, e."userId", u."loginIdentifier"
        FROM "Enrollment" e
        JOIN "User" u ON u.id = e."userId"
        WHERE u."loginIdentifier" = 'student.test' AND e.role = 'STUDENT' AND e.status = 'ACTIVE'
        LIMIT 1
    """)
    enroll = cur.fetchone()
    if not enroll:
        print("No test student enrollment found")
        return
    enrollment_id, user_id, identifier = enroll
    print(f"Enrollment: {enrollment_id} user={identifier}")

    # 2. Find SPEECH activities
    cur.execute("""
        SELECT la.id, la.title, la.type
        FROM "LearningActivity" la
        WHERE la.type = 'SPEECH'
        LIMIT 10
    """)
    speech_activities = cur.fetchall()
    print(f"\nSPEECH activities: {len(speech_activities)}")
    for aid, title, atype in speech_activities:
        print(f"  {aid}: {title} ({atype})")

    # 3. Find submissions for this enrollment
    cur.execute("""
        SELECT s.id, s."assignmentId", s.status, s.revision
        FROM "Submission" s
        WHERE s."enrollmentId" = %s AND s."deletedAt" IS NULL
        ORDER BY s."createdAt" DESC
        LIMIT 5
    """, (enrollment_id,))
    submissions = cur.fetchall()
    print(f"\nSubmissions: {len(submissions)}")
    for sid, asgn_id, status, rev in submissions:
        print(f"  {sid}: assignment={asgn_id} status={status} revision={rev}")

    # 4. ActivityAttempts for SPEECH activities
    if speech_activities and submissions:
        speech_ids = [a[0] for a in speech_activities]
        sub_ids = [s[0] for s in submissions]
        cur.execute("""
            SELECT aa.id, aa."submissionId", aa."activityId", aa.kind, aa.value
            FROM "ActivityAttempt" aa
            WHERE aa."activityId"::text = ANY(%s) AND aa."submissionId"::text = ANY(%s)
        """, (speech_ids, sub_ids))
        attempts = cur.fetchall()
        print(f"\nActivityAttempts for SPEECH: {len(attempts)}")
        for aid, sid, actid, kind, val in attempts:
            print(f"  attempt={aid} sub={sid[:8]}... activity={actid[:8]}... kind={kind} val={json.dumps(val)[:100]}")

    # 5. Recordings for this enrollment
    cur.execute("""
        SELECT r.id, r.status, r."activityAttemptId", r."submissionId", r."objectKey", r."durationMs", r."enrollmentId"
        FROM "Recording" r
        WHERE r."enrollmentId" = %s
        ORDER BY r."createdAt" DESC
        LIMIT 10
    """, (enrollment_id,))
    recordings = cur.fetchall()
    print(f"\nRecordings for enrollment: {len(recordings)}")
    for rid, status, attempt_id, sub_id, obj_key, dur_ms, eid in recordings:
        print(f"  {rid}: status={status} attemptId={attempt_id} subId={sub_id} objKey={obj_key} durMs={dur_ms}")

    # 6. Check for recording-activityattempt unique constraint conflicts
    cur.execute("""
        SELECT aa.id as attempt_id, aa."activityId", aa."submissionId",
               r.id as recording_id, r.status as rec_status
        FROM "ActivityAttempt" aa
        LEFT JOIN "Recording" r ON r."activityAttemptId" = aa.id
        WHERE aa.kind = 'SPEECH'
        ORDER BY aa."createdAt" DESC
        LIMIT 10
    """)
    links = cur.fetchall()
    print(f"\nSPEECH Attempt -> Recording links: {len(links)}")
    for att_id, act_id, sub_id, rec_id, rec_status in links:
        print(f"  attempt={att_id[:8]}... activity={act_id[:8]}... sub={sub_id[:8]}... -> recording={rec_id} status={rec_status}")

    # 7. Check Recordings with activityAttemptId pointing to non-SPEECH attempts
    cur.execute("""
        SELECT r.id, r."activityAttemptId", aa.kind, aa."activityId"
        FROM "Recording" r
        JOIN "ActivityAttempt" aa ON aa.id = r."activityAttemptId"
        WHERE r."enrollmentId" = %s AND aa.kind != 'SPEECH'
    """, (enrollment_id,))
    bad_links = cur.fetchall()
    if bad_links:
        print(f"\n!!! BAD LINKS: Recordings linked to non-SPEECH attempts: {len(bad_links)}")
        for rid, att_id, kind, act_id in bad_links:
            print(f"  recording={rid} attempt={att_id} kind={kind} activity={act_id}")
    else:
        print("\nNo bad links found")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
