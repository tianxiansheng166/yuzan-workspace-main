export function readCollection(payload) {
  if (Array.isArray(payload)) return { available: true, items: payload };
  if (Array.isArray(payload?.items)) return { available: true, items: payload.items };
  return { available: false, items: [] };
}

export function listItems(payload) {
  return readCollection(payload).items;
}

export function workflowItem(dashboard, id) {
  return Array.isArray(dashboard?.workflow)
    ? dashboard.workflow.find((item) => item?.id === id) ?? null
    : null;
}

export function knownCount(value) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

export function knownPercent(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    return null;
  }
  return value;
}

export function submissionReviewCount(dashboard) {
  return knownCount(workflowItem(dashboard, "review")?.count);
}

export function assessmentReviewQueue(payload) {
  const collection = readCollection(Array.isArray(payload) ? payload : payload?.items);
  return {
    items: collection.items,
    itemsAvailable: collection.available,
    total: knownCount(payload?.total),
  };
}

export function assignmentSubmissionSummary(task) {
  const total = knownCount(task?.total);
  const done = knownCount(task?.done);
  if (total === 0) return "暂无有效目标学生";
  if (total === null || done === null || done > total) return "提交统计暂不可用";
  return `${done} / ${total} 人已提交`;
}

export function studentActivitySummary(student) {
  const submitted = knownCount(student?.submittedAssignmentCount);
  const missing = knownCount(student?.missingAssignmentCount);
  const progress = knownPercent(student?.courseProgress);
  const activityDate = student?.lastActiveAt ? new Date(student.lastActiveAt) : null;
  const activity = activityDate && !Number.isNaN(activityDate.getTime())
    ? `最近学习：${activityDate.toLocaleDateString("zh-CN")}`
    : "暂无学习活动记录";

  return [
    progress === null ? "暂无有效统计" : `${progress}% 已记录活动完成度`,
    `已提交 ${submitted === null ? "—" : submitted} 项任务`,
    `待交 ${missing === null ? "—" : missing} 项`,
    activity,
  ].join(" · ");
}

export function identityKey(identity) {
  return [identity?.schoolId || "", identity?.token || "", identity?.userId || ""].join("\u0000");
}

export function dashboardErrorMessage(error) {
  if (error?.status === 403) {
    return "当前账号无权读取所选学校的数据。请切换到有权限的学校，或联系学校管理员分配班级。";
  }
  if (error?.status === 401) {
    return "登录已失效，请重新登录后恢复工作台。";
  }
  if (error?.status === 404) {
    return "请求的学校或记录不存在。请确认当前工作学校后重试。";
  }
  if (error?.status === 502 || error?.status === 503 || error?.status === 504 || !error?.status) {
    return "网络或服务暂时不可用。检查连接后可以重新加载。";
  }
  return error?.message || "工作台数据加载失败，请重试。";
}
