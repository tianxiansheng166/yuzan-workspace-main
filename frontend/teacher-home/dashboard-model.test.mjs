import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assessmentReviewQueue,
  assignmentSubmissionSummary,
  dashboardErrorMessage,
  identityKey,
  knownCount,
  listItems,
  readCollection,
  studentActivitySummary,
  submissionReviewCount,
  workflowItem,
} from "./dashboard-model.mjs";

describe("teacher dashboard view model", () => {
  it("keeps absent collections distinct from server-confirmed empty collections", () => {
    assert.deepEqual(readCollection([{ id: "a" }]), { available: true, items: [{ id: "a" }] });
    assert.deepEqual(readCollection({ items: [{ id: "b" }] }), { available: true, items: [{ id: "b" }] });
    assert.deepEqual(readCollection([]), { available: true, items: [] });
    assert.deepEqual(readCollection({}), { available: false, items: [] });
    assert.deepEqual(listItems({}), []);
  });

  it("shows zero only when the service returned a valid zero", () => {
    assert.equal(knownCount(0), 0);
    assert.equal(knownCount("0"), 0);
    assert.equal(knownCount(7), 7);
    for (const unknown of [null, undefined, "", "  ", "NaN", -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(knownCount(unknown), null, `expected ${String(unknown)} to remain unknown`);
    }
  });

  it("keeps submission reviews separate from question-bank item reviews", () => {
    const dashboard = {
      workflow: [{ id: "review", count: 3 }],
      reviews: [{ submissionId: "submission-real" }],
    };
    const queue = assessmentReviewQueue({
      total: 6,
      items: [{ itemId: "assessment-item-real" }],
    });

    assert.equal(submissionReviewCount(dashboard), 3);
    assert.equal(queue.total, 6);
    assert.equal(dashboard.reviews[0].submissionId, "submission-real");
    assert.equal(queue.items[0].itemId, "assessment-item-real");
    assert.equal(submissionReviewCount({ workflow: [{ id: "review", count: null }] }), null);
    assert.deepEqual(assessmentReviewQueue({ items: [] }), {
      items: [], itemsAvailable: true, total: null,
    });
  });

  it("summarizes task submissions without filling missing counts with zero", () => {
    assert.equal(assignmentSubmissionSummary({ done: 0, total: 0 }), "暂无有效目标学生");
    assert.equal(assignmentSubmissionSummary({ done: 0, total: 4 }), "0 / 4 人已提交");
    assert.equal(assignmentSubmissionSummary({ done: null, total: 4 }), "提交统计暂不可用");
    assert.equal(assignmentSubmissionSummary({ done: 6, total: 4 }), "提交统计暂不可用");
  });

  it("summarizes persisted student activity and leaves unavailable values unknown", () => {
    const summary = studentActivitySummary({
      courseProgress: 50,
      submittedAssignmentCount: 2,
      missingAssignmentCount: 1,
      lastActiveAt: "2026-10-17T00:00:00.000Z",
    });
    assert.ok(summary.includes("50% 已记录活动完成度"));
    assert.ok(summary.includes("已提交 2 项任务"));
    assert.ok(summary.includes("待交 1 项"));
    assert.equal(summary.includes("下降"), false);

    const unknown = studentActivitySummary({
      courseProgress: null,
      submittedAssignmentCount: undefined,
      missingAssignmentCount: null,
      lastActiveAt: null,
    });
    assert.ok(unknown.includes("暂无有效统计"));
    assert.ok(unknown.includes("已提交 — 项任务"));
    assert.ok(unknown.includes("待交 — 项"));
    assert.ok(unknown.includes("暂无学习活动记录"));
    assert.ok(studentActivitySummary({ courseProgress: 0, submittedAssignmentCount: 0, missingAssignmentCount: 0 })
      .includes("0% 已记录活动完成度"));
  });

  it("keys asynchronous page data to school, token, and user identity", () => {
    const teacherA = { schoolId: "school-a", userId: "teacher-a", token: "token-a" };
    assert.equal(identityKey(teacherA), identityKey({ ...teacherA }));
    assert.notEqual(identityKey(teacherA), identityKey({ ...teacherA, schoolId: "school-b" }));
    assert.notEqual(identityKey(teacherA), identityKey({ ...teacherA, userId: "teacher-b" }));
    assert.notEqual(identityKey(teacherA), identityKey({ ...teacherA, token: "token-b" }));
  });

  it("distinguishes authorization, missing-route, and recoverable network failures", () => {
    assert.ok(dashboardErrorMessage({ status: 401 }).includes("重新登录"));
    assert.ok(dashboardErrorMessage({ status: 403 }).includes("无权读取"));
    assert.ok(dashboardErrorMessage({ status: 404 }).includes("不存在"));
    assert.ok(dashboardErrorMessage({ status: 503 }).includes("网络或服务暂时不可用"));
    assert.ok(dashboardErrorMessage({ status: 0 }).includes("重新加载"));
  });

  it("finds workflow values by their server-defined key", () => {
    assert.equal(workflowItem({ workflow: [{ id: "task", count: 4 }] }, "task")?.count, 4);
    assert.equal(workflowItem({}, "task"), null);
  });
});
