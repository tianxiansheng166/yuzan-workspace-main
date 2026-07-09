import type { AssessmentQuestion, TrainingModule } from "./types";

export const TRAINING_MODULES: TrainingModule[] = [
  {
    id: "intro",
    title: "项目介绍",
    summary:
      "语赞心声面向西藏农牧区学校，帮助学生在弱网与离线环境下持续学习国家通用语言文字。",
    content: [
      "项目目标：为乡村学校提供稳定、可复用的语言学习工具。",
      "核心价值：离线优先、低带宽可用、教师可复核的学习闭环。",
      "志愿者角色：协助课堂秩序、陪伴学生练习、反馈一线使用问题。",
    ],
  },
  {
    id: "audience",
    title: "服务对象",
    summary: "服务对象以小学低年级学生为主，兼顾乡村教师与家长的辅助需求。",
    content: [
      "学生特点：注意力时间短、母语非汉语、设备与网络条件有限。",
      "教师需求：减轻批改负担、获得可信的学习进度数据。",
      "家长期待：了解孩子学习情况，便于在家辅助复习。",
    ],
  },
  {
    id: "communication",
    title: "教学沟通",
    summary: "使用简洁、正向、可重复的语言，帮助学生建立信心。",
    content: [
      "语速放慢，句子简短，配合手势或板书。",
      "多用鼓励，少说否定：把“错了”换成“再试一次”。",
      "确认理解：让学生复述指令或示范动作。",
    ],
  },
  {
    id: "child-protection",
    title: "未成年人保护",
    summary: "志愿者是未成年人的临时照护者，必须遵守隐私与身体边界原则。",
    content: [
      "不单独与学生相处，课堂活动应在教师或其他成人可视范围内。",
      "不拍摄学生面部或收集可识别个人信息。",
      "发现疑似虐待、欺凌立即报告学校负责人。",
    ],
  },
  {
    id: "cross-culture",
    title: "跨文化沟通",
    summary: "尊重藏族语言与文化，避免居高临下的态度。",
    content: [
      "学习常用藏语问候，主动请教当地教师正确发音。",
      "尊重宗教与家庭习俗，不评价学生的文化背景。",
      "遇到沟通障碍时，请本地教师或高年级学生协助翻译。",
    ],
  },
  {
    id: "classroom-support",
    title: "课堂协助和突发情况",
    summary: "志愿者负责维持秩序、分发材料、协助技术问题，不替代教师授课。",
    content: [
      "课前：检查设备电量、网络状态与教材是否齐全。",
      "课中：巡视学生屏幕，帮助操作困难的儿童。",
      "突发情况：设备故障先安抚学生，再联系教师；医疗紧急情况立即呼叫校医。",
    ],
  },
];

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  {
    id: "q1",
    moduleId: "child-protection",
    question: "发现学生疑似遭受欺凌时，志愿者应首先做什么？",
    options: [
      "私下找欺凌者谈话警告",
      "立即报告学校负责人",
      "让学生自己解决",
      "拍照留证后发到社交网络",
    ],
    correctIndex: 1,
  },
  {
    id: "q2",
    moduleId: "communication",
    question: "面对回答错误的学生，下列哪种沟通方式更合适？",
    options: [
      "直接说“错了”",
      "说“再试一次，你已经接近了”",
      "让其他同学嘲笑他",
      "跳过他不再提问",
    ],
    correctIndex: 1,
  },
  {
    id: "q3",
    moduleId: "cross-culture",
    question: "志愿者在跨文化沟通中最应注意的是？",
    options: [
      "坚持用自己的习惯方式交流",
      "评价学生的宗教习俗",
      "尊重并主动了解当地文化",
      "避免与当地教师交流",
    ],
    correctIndex: 2,
  },
];

export const TRAINING_MATERIALS = [
  { id: "handbook", title: "志愿者手册（PDF）", size: "2.4 MB" },
  { id: "phrase-card", title: "课堂常用语卡片", size: "860 KB" },
  { id: "checklist", title: "课前准备清单", size: "320 KB" },
];
