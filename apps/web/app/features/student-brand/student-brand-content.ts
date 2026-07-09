export type StudentBrandState = "preview" | "loading" | "empty" | "offline";

export interface StudentActionCard {
  id: string;
  title: string;
  to: string;
  eyebrow: string;
  statusLabel: string;
  detail: string;
  availabilityNote: string;
  emphasis: "primary" | "secondary" | "muted";
}

export const studentActionCards: StudentActionCard[] = [
  {
    id: "first-assessment",
    title: "开始首测",
    to: "/assessment",
    eyebrow: "FIRST RUN",
    statusLabel: "当前可进入",
    detail: "进入学生测评入口，完成第一次朗读与书面表达任务。",
    availabilityNote: "demo 与真实流程会在测评页继续明确区分。",
    emphasis: "primary",
  },
  {
    id: "retest",
    title: "进入复测",
    to: "/assessment",
    eyebrow: "RETEST",
    statusLabel: "用于对比",
    detail: "复测入口与首测共用同一流程，重点帮助学生对比最近一次变化。",
    availabilityNote:
      "当前仍以状态说明为主，不把 demo 结果包装成正式成长结论。",
    emphasis: "secondary",
  },
  {
    id: "recommended-course",
    title: "推荐课程",
    to: "/student/today",
    eyebrow: "RECOMMENDED COURSE",
    statusLabel: "待接入",
    detail: "课程推荐位已预留，会在学习任务模块接入后展示真实内容。",
    availabilityNote: "待接入状态已明确说明，当前不伪造课程完成情况。",
    emphasis: "muted",
  },
];

export function studentStatusCopy(state: StudentBrandState) {
  if (state === "loading") {
    return {
      title: "正在整理今天的学习状态……",
      description: "页面会先呈现加载态，避免把缺失数据误写成已完成结果。",
    };
  }

  if (state === "empty") {
    return {
      title: "今天暂时没有新的学习任务。",
      description: "你可以等待老师布置新内容，或回看上一轮测评的学习建议。",
    };
  }

  if (state === "offline") {
    return {
      title: "离线预览：学习记录会在联网后同步。",
      description: "当前状态强调同步说明和下一步，不会制造“已上传”的假象。",
    };
  }

  return {
    title: "今天先把学习状态看清楚，再开始下一步。",
    description:
      "这是一页带品牌层级的学生入口示意，真实任务仍会在后续模块接入后替换。",
  };
}
