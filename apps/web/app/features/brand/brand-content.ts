export interface BrandValueItem {
  id: string;
  title: string;
  summary: string;
  proofLabel: string;
}

export interface BrandEntryLink {
  label: string;
  to: string;
  tone: "primary" | "secondary" | "quiet";
  description: string;
}

export const brandProductName = "语赞心声";

export const brandPositioning =
  "面向弱网环境的国通语学习与支持平台，让测评、成长、教学与培训进入同一条可持续路径。";

export const brandValues: BrandValueItem[] = [
  {
    id: "ai-assessment",
    title: "AI 测评",
    summary:
      "把首测、复测与结果等待状态说清楚，帮助学生和教师理解当前处于哪一步。",
    proofLabel: "明确区分 demo 与真实流程",
  },
  {
    id: "student-growth",
    title: "学生成长",
    summary: "以学习状态、下一步建议和课程入口组织学生端，而不是堆砌统计数字。",
    proofLabel: "优先展示下一步行动",
  },
  {
    id: "teacher-tools",
    title: "教师工具",
    summary: "让测评管理、思维工具与翻译支持成为同一品牌语境中的工作入口。",
    proofLabel: "教师入口与学生入口统一语气",
  },
  {
    id: "training-support",
    title: "培训与公益支持",
    summary:
      "突出培训、志愿者与公益支持的协作关系，不伪造真实机构背书或合作名单。",
    proofLabel: "不展示虚构合作学校与荣誉",
  },
];

export const brandEntryLinks: BrandEntryLink[] = [
  {
    label: "开始 AI 测评",
    to: "/assessment",
    tone: "primary",
    description: "进入学生测评入口，查看首测、复测与状态说明。",
  },
  {
    label: "查看学生今日",
    to: "/student/today",
    tone: "secondary",
    description: "进入学生今日页，查看学习状态、入口和待接入说明。",
  },
  {
    label: "教师工作台",
    to: "/teacher",
    tone: "quiet",
    description: "前往教师工作台，继续进入测评与工具相关任务。",
  },
];

export const brandPrinciples = [
  {
    index: "01",
    title: "统一入口，不虚构成绩",
    description:
      "首页和学生端都明确区分 demo、待接入和真实任务状态，不用假数据制造成熟感。",
  },
  {
    index: "02",
    title: "在弱网里也能读懂状态",
    description: "视觉强调同步、等待与下一步，而不是把学习状态藏进抽象图表里。",
  },
  {
    index: "03",
    title: "品牌图形服务于信息",
    description:
      "原创 SVG 图形只承担路径、节奏和层级表达，不替代真实业务信息。",
  },
];
