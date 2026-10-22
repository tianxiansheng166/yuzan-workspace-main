import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("./assignments-data.js", import.meta.url), "utf8");
const window = {};
vm.runInNewContext(source, { window, String, Number, Array, Math, encodeURIComponent });
const data = window.YuzanAssignmentsData;

test("course task mapping uses API assignments and keeps progress/status factual", () => {
  const courses = data.normalize({ courses: [
    { assignmentId: "assigned/one", title: "真实课程", status: "IN_PROGRESS", progressPercent: 37, coverAsset: "/assets/course.jpg", nextActivity: { title: "看课堂录像" } },
    { assignmentId: "two", title: "未开始", status: "NOT_STARTED", progressPercent: 0, coverAsset: "javascript:alert(1)" },
    { title: "缺少作业标识", status: "COMPLETED" },
  ] });

  assert.equal(courses.length, 2);
  assert.equal(courses[0].progressPercent, 37);
  assert.equal(courses[0].nextActivity, "看课堂录像");
  assert.equal(courses[1].coverAsset, "/assets/cover-spring.png");
  assert.equal(data.detailHref("assigned/one"), "/student/courses/course-detail/?id=assigned%2Fone");
});

test("task filters include pending results with active study and search real course fields", () => {
  const courses = data.normalize({ courses: [
    { assignmentId: "one", title: "古诗朗读", status: "RESULT_PENDING", progressPercent: 100 },
    { assignmentId: "two", title: "散文阅读", status: "NOT_STARTED", progressPercent: 0 },
  ] });

  assert.deepEqual(data.filter(courses, "IN_PROGRESS", "").map((course) => course.assignmentId), ["one"]);
  assert.deepEqual(data.filter(courses, "ALL", "散文").map((course) => course.assignmentId), ["two"]);
});
