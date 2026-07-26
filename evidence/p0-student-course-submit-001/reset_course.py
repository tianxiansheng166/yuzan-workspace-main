"""Reset course progress, attempts, recordings, and submissions for E2E re-run."""
import psycopg2

DB_URL = "postgresql://yuzan_dev:1e389bf6a02f02c827dbb8e973b7d0a8ec5aeb0ce239ce5fe55607a9efb35eb7@127.0.0.1:55432/yuzan_dev"

def main():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    cur = conn.cursor()

    # Find test student enrollment
    cur.execute("""
        SELECT e.id FROM "Enrollment" e
        JOIN "User" u ON u.id = e."userId"
        WHERE u."loginIdentifier" = 'student.test' AND e.role = 'STUDENT' AND e.status = 'ACTIVE'
        LIMIT 1
    """)
    enroll = cur.fetchone()
    if not enroll:
        print("No test student enrollment found")
        return
    enrollment_id = enroll[0]
    print(f"Enrollment: {enrollment_id}")

    # Find submissions for this enrollment (skip the NEEDS_REVIEW one)
    cur.execute("""
        SELECT s.id, s."assignmentId", s.status
        FROM "Submission" s
        WHERE s."enrollmentId" = %s AND s."deletedAt" IS NULL AND s.status != 'NEEDS_REVIEW'
    """, (enrollment_id,))
    subs = cur.fetchall()
    print(f"Submissions to reset: {len(subs)}")
    for sid, asgn, status in subs:
        print(f"  {sid}: assignment={asgn} status={status}")

    if not subs:
        print("No submissions to reset")
        cur.close()
        conn.close()
        return

    sub_ids = [s[0] for s in subs]

    # 1. Delete ActivityAttempts for these submissions
    for sid in sub_ids:
        cur.execute("""DELETE FROM "ActivityAttempt" WHERE "submissionId" = %s""", (sid,))
        print(f"  Deleted ActivityAttempts for {sid[:8]}...")

    # 2. Delete Recordings for these submissions
    for sid in sub_ids:
        cur.execute("""DELETE FROM "Recording" WHERE "submissionId" = %s""", (sid,))
        print(f"  Deleted Recordings for {sid[:8]}...")

    # 3. Delete ActivityProgress for this enrollment
    cur.execute("""DELETE FROM "ActivityProgress" WHERE "enrollmentId" = %s""", (enrollment_id,))
    print(f"  Deleted ActivityProgress for enrollment")

    # 4. Delete StudentActivityNotes for this enrollment
    cur.execute("""DELETE FROM "StudentActivityNote" WHERE "enrollmentId" = %s""", (enrollment_id,))
    print(f"  Deleted StudentActivityNotes for enrollment")

    # 5. Delete AssessmentSessions for these submissions
    for sid in sub_ids:
        cur.execute("""DELETE FROM "AssessmentSession" WHERE "courseSubmissionId" = %s""", (sid,))
        print(f"  Deleted AssessmentSessions for {sid[:8]}...")

    # 6. Reset submissions status to allow re-creation
    for sid in sub_ids:
        cur.execute("""DELETE FROM "Submission" WHERE id = %s""", (sid,))
        print(f"  Deleted Submission {sid[:8]}...")

    print("\nReset complete. E2E can now re-run cleanly.")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
