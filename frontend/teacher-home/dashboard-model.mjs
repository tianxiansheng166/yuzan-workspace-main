export function listItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export function workflowItem(dashboard, id) {
  return Array.isArray(dashboard?.workflow)
    ? dashboard.workflow.find((item) => item?.id === id) ?? null
    : null;
}

export function studentActivitySummary(student) {
  const submitted = Number.isFinite(student?.submittedAssignmentCount)
    ? student.submittedAssignmentCount
    : 0;
  const missing = Number.isFinite(student?.missingAssignmentCount)
    ? student.missingAssignmentCount
    : 0;
  const progress = Number.isFinite(student?.courseProgress)
    ? `${student.courseProgress}% 已记录活动完成度`
    : "暂无活动进度记录";
  const activity = student?.lastActiveAt
    ? `最近学习：${new Date(student.lastActiveAt).toLocaleDateString("zh-CN")}`
    : "暂无学习活动记录";
  return `${progress} · 已提交 ${submitted} 项任务 · 待交 ${missing} 项 · ${activity}`;
}

export function dashboardErrorMessage(error) {
  if (error?.status === 403) {
    return "当前账号无权读取所选学校的数据。请切换到有权限的学校，或联系学校管理员分配班级。";
  }
  if (error?.status === 401) {
    return "登录已失效，请重新登录后恢复工作台。";
  }
  if (error?.status === 502 || error?.status === 503 || error?.status === 504 || !error?.status) {
    return "网络或服务暂时不可用。检查连接后可以重新加载。";
  }
  return error?.message || "工作台数据加载失败，请重试。";
}
