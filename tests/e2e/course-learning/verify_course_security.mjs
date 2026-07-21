const apiBase = process.env.YUZAN_API_BASE || "http://127.0.0.1:4000/api/v1";
const schoolId = "11111111-1111-4111-8111-111111111111";
const otherSchoolId = "37c25b5f-1289-4901-8267-e47fa4d63c19";
const assignmentId = "85000000-0000-4000-8000-000000000001";
const otherAssignmentId = "85000000-0000-4000-8000-000000000002";
const submissionId = "4cde288e-c451-415b-b369-c4a4b96ed1ac";
const activityId = "84000000-0000-4000-8000-000000000101";

async function call(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, options);
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

const login = await call("/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ identifier: "student.test", password: "YuzanTest!2026" }),
});
if (login.status !== 200) throw new Error(`login failed: ${JSON.stringify(login)}`);
const headers = { authorization: `Bearer ${login.body.data.accessToken}`, "content-type": "application/json" };

const crossSchool = await call(`/schools/${otherSchoolId}/student/courses`, { headers });
if (crossSchool.status !== 403) throw new Error(`cross-school expected 403, got ${crossSchool.status}`);

const crossSubmission = await call(`/schools/${schoolId}/student/courses/${otherAssignmentId}/submissions/${submissionId}/activities/${activityId}/attempt`, {
  method: "PUT",
  headers,
  body: JSON.stringify({ kind: "TEXT", value: { acknowledged: true }, completed: true }),
});
if (crossSubmission.status !== 404) throw new Error(`cross-assignment submission expected 404, got ${crossSubmission.status}`);

const aggregate = await call(`/schools/${schoolId}/student/courses/${assignmentId}`, { headers });
if (aggregate.status !== 200) throw new Error(`aggregate failed: ${aggregate.status}`);
if (aggregate.body.data.courseVersion.status !== "PUBLISHED") throw new Error("student aggregate returned a non-published version");
if (aggregate.body.data.courseCompletion.progressPercent !== 100) throw new Error("expected verified course completion to be 100%");
if (aggregate.body.data.courseCompletion.attainmentStatus !== "PENDING") throw new Error("expected asynchronous attainment to remain PENDING");

console.log(JSON.stringify({ crossSchool: crossSchool.status, crossSubmission: crossSubmission.status, completion: 100, attainment: "PENDING" }));
