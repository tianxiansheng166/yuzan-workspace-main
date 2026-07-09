export interface ExternalLink {
  label: string;
  href: string;
}

export interface MindGraphTypeOption {
  value: string;
  label: string;
  description: string;
}

export const teacherToolsConfig = {
  mindMate: {
    title: "MindMate",
    subtitle: "教师备课与学情对话助手",
    description:
      "MindMate 帮助教师在备课、课堂追问和学情分析中快速获得结构化建议。所有输出仅作为教学参考，最终判断与教学决策仍由教师作出。",
    inviteCode: "YUZAN-MINDMATE-2026",
    externalLinks: {
      login: {
        label: "进入 MindMate",
        href: "https://mindmate.yuzan.example.com/login",
      },
      guide: {
        label: "使用指南",
        href: "https://docs.yuzan.example.com/mindmate/guide",
      },
      support: {
        label: "联系支持",
        href: "mailto:support@yuzan.example.com",
      },
    } satisfies Record<string, ExternalLink>,
    scenarios: [
      {
        title: "备课提问",
        description:
          "输入教学目标，获取启发式提问建议，用于课堂互动与分层任务设计。",
      },
      {
        title: "学情解析",
        description:
          "基于班级共性错误，生成简要分析维度，辅助教师定位知识薄弱点。",
      },
      {
        title: "资源推荐",
        description: "按主题推荐适配国通语教学的延伸素材，减少教师检索时间。",
      },
    ],
    loginSteps: [
      "打开登录入口并选择“机构账号登录”。",
      "输入学校统一邀请码。",
      "使用已绑定的教师手机号或工号完成认证。",
      "首次登录后按页面提示完善个人信息。",
    ],
    guideSections: [
      {
        title: "提问越具体，建议越可用",
        body: "在输入框中说明年级、课时目标与学生典型问题，MindMate 会返回更贴近课堂场景的参考。",
      },
      {
        title: "输出需复核",
        body: "MindMate 的建议不代表最终教学方案，请结合课标、学情与学校实际进行调整。",
      },
      {
        title: "反馈帮助改进",
        body: "对不符合预期的回答可点击“反馈”，系统将持续优化模型输出。",
      },
    ],
  },
  mindGraph: {
    title: "MindGraph",
    subtitle: "结构化思维图示生成",
    description:
      "MindGraph 接收教学主题或问题，尝试生成可编辑的结构化图示草稿。生成服务正式上线前，页面仅展示输入与预览能力，不伪造结果。",
    apiEndpoint: "/api/v1/teacher-tools/mindgraph/generate",
    maxInputLength: 500,
    types: [
      {
        value: "default",
        label: "默认结构",
        description: "由系统根据主题自动判断较合适的结构。",
      },
      {
        value: "hierarchy",
        label: "层级分类",
        description: "自上而下逐层展开，适合概念归类。",
      },
      {
        value: "flow",
        label: "流程顺序",
        description: "按步骤或时间线排列，适合过程梳理。",
      },
      {
        value: "comparison",
        label: "对比双栏",
        description: "并列比较两个对象，适合异同分析。",
      },
      {
        value: "radiation",
        label: "发散联想",
        description: "围绕中心主题展开，适合头脑风暴。",
      },
    ] as const satisfies readonly MindGraphTypeOption[],
    exportFormats: ["png", "pdf", "json"] as const,
    historyLabel: "历史记录",
    exportLabel: "导出图示",
  },
} as const;

export type TeacherToolsConfig = typeof teacherToolsConfig;
