# Student teacher invitation binding contract request

User-authorized change to remove the blocked-student state exposed by the reusable practice catalog.

## Journey

A registered student enters personal center, enters a teacher's class invitation code, and joins the teacher's school and class.  The resulting `Membership(STUDENT, ACTIVE)` plus `Enrollment(STUDENT, ACTIVE)` is the only authority used by practice delivery.

## Schema

Add `TeacherInvitation` with a school, class, teacher user, opaque unique code, usage limit, expiry, revocation time and timestamps.  It is intentionally separate from `InviteCode`, which remains a school-account onboarding code and must not change its existing semantics.

## API

- `POST /schools/{schoolId}/teacher-invitations` — teacher/admin creates a class-bound invitation after proving an active teacher enrollment in that class.
- `GET /schools/{schoolId}/teacher-invitations/mine` — teacher/admin lists only their own active/inactive invitations.
- `POST /student/teacher-invitations/bind` — authenticated student submits `{ code }`; the service validates the invitation and teacher/class relationship, creates or restores the target school membership and active class enrollment atomically, records an audit event, and returns the target school for a fresh school selection.

## Safety and compatibility

- A code is not a general tenant bypass: it only grants the target class and only while valid, unrevoked and within its use limit.
- The bind operation is idempotent for a student already active in the invitation's class and does not consume another use in that case.
- Cross-school practice access remains denied unless the student has joined that school and the client has selected it with a fresh session token.
- Existing `/auth/invitations/redeem` and `InviteCode` account-onboarding behaviour remain unchanged.
