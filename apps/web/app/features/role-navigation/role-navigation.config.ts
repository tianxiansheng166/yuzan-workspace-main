export type RoleNavigationStatusId =
  "demo" | "pending" | "unavailable" | "coming-soon" | "external";

export type RoleNavigationGroupId = "student" | "teacher" | "platform";

export interface RoleNavigationStatusDefinition {
  id: RoleNavigationStatusId;
  label: string;
  tone: "neutral" | "warning" | "danger" | "information";
  description: string;
}

export interface RouteAvailability {
  route: string;
  source: string;
  kind: "static" | "dynamic-example";
}

export interface RoleNavigationItem {
  id: string;
  label: string;
  description: string;
  to: string;
  routeStatusText: string;
  statusIds: RoleNavigationStatusId[];
  matchPrefixes: string[];
  exactPaths?: string[];
}

export interface RoleNavigationGroup {
  id: RoleNavigationGroupId;
  label: string;
  summary: string;
  items: RoleNavigationItem[];
}

export const routeAvailability: RouteAvailability[] = [
  {
    route: "/student/today",
    source: "apps/web/app/pages/student/today.vue",
    kind: "static",
  },
  {
    route: "/assessment",
    source: "apps/web/app/pages/assessment/index.vue",
    kind: "static",
  },
  {
    route: "/assessment/history",
    source: "apps/web/app/pages/assessment/history.vue",
    kind: "static",
  },
  {
    route: "/teacher",
    source: "apps/web/app/pages/teacher/index.vue",
    kind: "static",
  },
  {
    route: "/teacher/assessments",
    source: "apps/web/app/pages/teacher/assessments/index.vue",
    kind: "static",
  },
  {
    route: "/teacher/students/demo/assessment-reports",
    source:
      "apps/web/app/pages/teacher/students/[studentId]/assessment-reports.vue",
    kind: "dynamic-example",
  },
  {
    route: "/teacher-tools",
    source: "apps/web/app/pages/teacher-tools/index.vue",
    kind: "static",
  },
  {
    route: "/training",
    source: "apps/web/app/pages/training/index.vue",
    kind: "static",
  },
  {
    route: "/products",
    source: "apps/web/app/pages/products.vue",
    kind: "static",
  },
  {
    route: "/tools/tibetan-translation",
    source: "apps/web/app/pages/tools/tibetan-translation.vue",
    kind: "static",
  },
];

export const roleNavigationStatuses: RoleNavigationStatusDefinition[] = [
  {
    id: "demo",
    label: "demo",
    tone: "information",
    description:
      "表示当前入口可用于演示或联调，不代表真实线上权限与真实业务结论。",
  },
  {
    id: "pending",
    label: "pending",
    tone: "warning",
    description:
      "表示流程已打通入口，但真实结果、真实服务或后续处理仍处于等待状态。",
  },
  {
    id: "unavailable",
    label: "unavailable",
    tone: "danger",
    description: "表示页面或其下游能力会明确提示暂不可用，不会伪造成功结果。",
  },
  {
    id: "coming-soon",
    label: "待接入",
    tone: "neutral",
    description:
      "表示该区域存在后续扩展位，当前只展示已存在页面，不伪造未完成能力。",
  },
  {
    id: "external",
    label: "外部链接",
    tone: "neutral",
    description:
      "表示该入口页内包含离开当前站点的外部链接，打开时应明确提示新窗口或外部域名。",
  },
];

export const roleNavigationGroups: RoleNavigationGroup[] = [
  {
    id: "student",
    label: "学生角色入口",
    summary: "聚焦学生当天学习、测评闭环与历史回看，不代表已登录为真实学生。",
    items: [
      {
        id: "student-today",
        label: "学生今日",
        to: "/student/today",
        description: "进入学生当天任务总览，查看首测、复测与推荐课程入口。",
        routeStatusText:
          "状态：待接入。课程推荐等后续能力会在页面内明确标注，不伪造完成状态。",
        statusIds: ["coming-soon"],
        matchPrefixes: ["/student/today"],
        exactPaths: ["/student/today"],
      },
      {
        id: "student-assessment",
        label: "AI 测评",
        to: "/assessment",
        description: "进入学生测评首页、朗读录音、书面作答和报告查看流程。",
        routeStatusText:
          "状态：demo、pending。学生端可走完整闭环，但真实评分仍以 pending 呈现。",
        statusIds: ["demo", "pending"],
        matchPrefixes: [
          "/assessment/reading",
          "/assessment/written",
          "/assessment/report/",
        ],
        exactPaths: ["/assessment"],
      },
      {
        id: "student-assessment-history",
        label: "测评历史",
        to: "/assessment/history",
        description: "查看学生历史提交与报告对比，保留旧记录，不覆盖先前结果。",
        routeStatusText:
          "状态：demo。历史页会保留演示与真实流程记录，但不会伪造真实 AI 结论。",
        statusIds: ["demo"],
        matchPrefixes: ["/assessment/history"],
        exactPaths: ["/assessment/history"],
      },
    ],
  },
  {
    id: "teacher",
    label: "教师角色入口",
    summary:
      "聚焦教师工作台、测评任务、学生报告与教师工具，不代表真实鉴权或真实角色授权。",
    items: [
      {
        id: "teacher-home",
        label: "教师工作台",
        to: "/teacher",
        description: "进入教师首页，查看教师工作台概览与各业务入口分发。",
        routeStatusText:
          "状态：demo。当前按页面分组展示教师入口，不伪造真实登录与班级权限。",
        statusIds: ["demo"],
        matchPrefixes: [],
        exactPaths: ["/teacher"],
      },
      {
        id: "teacher-assessments",
        label: "测评任务",
        to: "/teacher/assessments",
        description: "查看教师测评任务列表、详情与新建任务入口。",
        routeStatusText:
          "状态：demo、unavailable。页面支持演示态、空态和不可用态，不伪造真实班级数据。",
        statusIds: ["demo", "unavailable"],
        matchPrefixes: ["/teacher/assessments"],
      },
      {
        id: "teacher-student-reports",
        label: "学生报告",
        to: "/teacher/students/demo/assessment-reports",
        description:
          "查看示例学生报告页，演示 ready、生成中和 unavailable 三类状态。",
        routeStatusText:
          "状态：demo、unavailable。这里使用示例学生路由，不代表真实学生身份或权限。",
        statusIds: ["demo", "unavailable"],
        matchPrefixes: ["/teacher/students/"],
      },
      {
        id: "teacher-tools",
        label: "教师工具",
        to: "/teacher-tools",
        description:
          "进入 MindMate 与 MindGraph 等教师工具入口，查看外部链接与待接入提示。",
        routeStatusText:
          "状态：unavailable、外部链接。工具页会明确提示不可用能力，并标识外部站点入口。",
        statusIds: ["unavailable", "external"],
        matchPrefixes: ["/teacher-tools"],
      },
    ],
  },
  {
    id: "platform",
    label: "平台 / 公共入口",
    summary:
      "汇集培训、产品方案与翻译工具等公共能力，统一说明待接入与外部跳转边界。",
    items: [
      {
        id: "training",
        label: "培训",
        to: "/training",
        description:
          "查看培训总览与志愿者培训入口，其他培训模块会明确显示是否待接入。",
        routeStatusText:
          "状态：待接入、unavailable。页面会明确指出哪些培训模块尚未开放。",
        statusIds: ["coming-soon", "unavailable"],
        matchPrefixes: ["/training"],
      },
      {
        id: "product-plans",
        label: "产品方案",
        to: "/products",
        description:
          "查看产品方案、价格层级与方案对比，页面内会引导到外部试用或咨询入口。",
        routeStatusText:
          "状态：外部链接。产品页内包含外部跳转入口，需要明确提示离开当前站点。",
        statusIds: ["external"],
        matchPrefixes: ["/products"],
        exactPaths: ["/products"],
      },
      {
        id: "tibetan-translation",
        label: "藏语翻译",
        to: "/tools/tibetan-translation",
        description: "进入藏语翻译页面，支持本地短语兜底与服务不可用提示。",
        routeStatusText:
          "状态：pending、unavailable。真实翻译服务未接通时会回退到本地短语，不伪造实时翻译。",
        statusIds: ["pending", "unavailable"],
        matchPrefixes: ["/tools/tibetan-translation"],
        exactPaths: ["/tools/tibetan-translation"],
      },
    ],
  },
];
