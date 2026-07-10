import type { TodayActivity } from "../types";

const actionable = new Set([
  "ready",
  "in-progress",
  "paused",
  "local-only",
  "pending-sync",
  "needs-revision",
  "retest-recommended",
]);

export function sortTodayActivities(items: TodayActivity[]) {
  return [...items].sort((a, b) => b.priority - a.priority);
}

export function selectPrimaryActivity(items: TodayActivity[]) {
  return sortTodayActivities(items).find((item) => actionable.has(item.state));
}

export function continuingActivities(items: TodayActivity[]) {
  return sortTodayActivities(items).filter((item) =>
    [
      "in-progress",
      "paused",
      "local-only",
      "pending-sync",
      "needs-revision",
    ].includes(item.state),
  );
}

export function retestReminders(items: TodayActivity[]) {
  return items.filter((item) => item.state === "retest-recommended");
}

export function completedActivities(items: TodayActivity[]) {
  return items.filter((item) => item.state === "completed");
}

export function stateLabel(state: TodayActivity["state"]) {
  const labels: Record<TodayActivity["state"], string> = {
    "not-started": "尚未开始",
    ready: "可以开始",
    "in-progress": "正在学习",
    paused: "已暂停",
    "local-only": "仅保存在本机",
    "pending-sync": "等待同步",
    submitted: "已提交，等待确认",
    "needs-revision": "老师建议修改",
    "retest-recommended": "建议复测",
    completed: "已完成",
    unavailable: "暂不可用",
  };
  return labels[state];
}
