export interface TrainingCategory {
  id: string;
  title: string;
  description: string;
  audience: string;
  route?: string;
  available: boolean;
  unavailableReason?: string;
}

/**
 * 培训分类入口集中配置。
 * 路由存在但 available 为 false 时，页面会明确展示 unavailable 状态，
 * 避免用户进入尚未接入的模块。
 */
export const trainingCategories: TrainingCategory[] = [
  {
    id: "student-courses",
    title: "学生课程",
    description:
      "围绕国家通用语言文字的课堂学习与课后练习，按年级与能力分层，配套离线内容包。",
    audience: "在校学生",
    route: "/training/student",
    available: false,
    unavailableReason: "学生课程入口正在由学习任务模块接入，暂不可进入。",
  },
  {
    id: "teacher-training",
    title: "教师培训",
    description:
      "教师国家通用语言能力、教学设计与课堂反馈技能培训，支持线上学习与校本研修。",
    audience: "任课教师",
    route: "/training/teacher",
    available: false,
    unavailableReason: "教师培训模块正在由身份与能力模块接入，暂不可进入。",
  },
  {
    id: "volunteer-training",
    title: "志愿者培训",
    description:
      "志愿者助学岗前培训与持续进修，帮助志愿者安全、有效地支持课堂教学。",
    audience: "支教志愿者",
    route: "/training/volunteer",
    available: true,
  },
];

export function getAvailableCategories(
  categories: TrainingCategory[] = trainingCategories,
): TrainingCategory[] {
  return categories.filter((category) => category.available);
}
