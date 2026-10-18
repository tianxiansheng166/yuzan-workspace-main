import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dashboardErrorMessage,
  listItems,
  studentActivitySummary,
  workflowItem,
} from "./dashboard-model.mjs";

describe("teacher dashboard view model", () => {
  it("reads only API collections and represents missing values as empty", () => {
    assert.deepEqual(listItems([{ id: "a" }]), [{ id: "a" }]);
    assert.deepEqual(listItems({ items: [{ id: "b" }] }), [{ id: "b" }]);
    assert.deepEqual(listItems({}), []);
    assert.equal(workflowItem({ workflow: [{ id: "task", count: 4 }] }, "task")?.count, 4);
    assert.equal(workflowItem({}, "task"), null);
  });

  it("summarizes persisted student activity without inventing risk or trend values", () => {
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
    assert.ok(studentActivitySummary({ courseProgress: 0, submittedAssignmentCount: 0, missingAssignmentCount: 0, lastActiveAt: null })
      .includes("暂无学习活动记录"));
  });

  it("distinguishes authorization failures from recoverable network failures", () => {
    assert.ok(dashboardErrorMessage({ status: 403 }).includes("无权读取"));
    assert.ok(dashboardErrorMessage({ status: 502 }).includes("网络或服务暂时不可用"));
    assert.ok(dashboardErrorMessage({ status: 0 }).includes("重新加载"));
  });
});
