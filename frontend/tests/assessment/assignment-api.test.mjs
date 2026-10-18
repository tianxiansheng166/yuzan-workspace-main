import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const apiClientSource = readFileSync(new URL("../../assets/api-client.js", import.meta.url), "utf8");

async function createApiClient(responseBody = { data: { items: [], nextCursor: null, hasMore: false } }) {
  const values = new Map([
    ["yuzan-active-school-id", "school-1"],
    ["yuzan-access-token", "test-token"],
  ]);
  const calls = [];
  const context = {
    window: {},
    URLSearchParams,
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      return { ok: true, status: 200, json: async () => responseBody };
    },
  };
  vm.runInNewContext(apiClientSource, context, { filename: fileURLToPath(new URL("../../assets/api-client.js", import.meta.url)) });
  return { api: context.window.YuzanApi, calls };
}

test("assignment creation returns the server-issued assignment ID", async () => {
  const createdAssignment = { id: "assignment-created-42", status: "DRAFT", revision: 1 };
  const { api, calls } = await createApiClient({ data: createdAssignment });
  const result = await api.createAssignment({ title: "草稿", targets: [{ targetType: "CLASS", classId: "class-1" }] });

  assert.equal(result.id, createdAssignment.id);
  assert.equal(result.status, "DRAFT");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(new URL(calls[0].url, "http://localhost").pathname, "/api/v1/schools/school-1/assignments");
  assert.deepEqual(JSON.parse(calls[0].options.body), { title: "草稿", targets: [{ targetType: "CLASS", classId: "class-1" }] });
});

test("assignment list sends real server filters and cursor parameters", async () => {
  const { api, calls } = await createApiClient();
  await api.listAssignments({
    classId: "class-1",
    status: "OPEN",
    search: "朗读练习",
    dueAtFrom: "2026-10-01T00:00:00.000Z",
    dueAtTo: "2026-10-08T23:59:59.999Z",
    limit: 20,
    cursor: "cursor-1",
  });

  const url = new URL(calls[0].url, "http://localhost");
  assert.equal(url.pathname, "/api/v1/schools/school-1/assignments");
  assert.equal(url.searchParams.get("classId"), "class-1");
  assert.equal(url.searchParams.get("status"), "OPEN");
  assert.equal(url.searchParams.get("search"), "朗读练习");
  assert.equal(url.searchParams.get("dueAtFrom"), "2026-10-01T00:00:00.000Z");
  assert.equal(url.searchParams.get("dueAtTo"), "2026-10-08T23:59:59.999Z");
  assert.equal(url.searchParams.get("limit"), "20");
  assert.equal(url.searchParams.get("cursor"), "cursor-1");
});

test("assignment detail and submissions use the selected assignment ID", async () => {
  const { api, calls } = await createApiClient();
  await api.getAssignment("assignment-7");
  await api.getAssignmentSubmissions("assignment-7", { limit: 100, cursor: "submission-cursor" });

  assert.equal(new URL(calls[0].url, "http://localhost").pathname, "/api/v1/schools/school-1/assignments/assignment-7");
  const submissionsUrl = new URL(calls[1].url, "http://localhost");
  assert.equal(submissionsUrl.pathname, "/api/v1/schools/school-1/assignments/assignment-7/submissions");
  assert.equal(submissionsUrl.searchParams.get("limit"), "100");
  assert.equal(submissionsUrl.searchParams.get("cursor"), "submission-cursor");
  assert.equal(calls[1].options.headers.Authorization, "Bearer test-token");
});
