import type {
  CopyrightReference,
  CurriculumAssociation,
  CurriculumDraftDetail,
  CurriculumStudioDashboardData,
  CurriculumVersionSummary,
  LibraryAsset,
  PublicationChecklistItem,
} from "./model";

const libraryAssets: LibraryAsset[] = [
  {
    id: "asset-course-plateau-01",
    title: "高原日常表达 · 第一单元",
    subtitle: "课程母版 / 双语讲义",
    kind: "course-unit",
    languageCoverage: "bilingual",
    resourceState: "demo",
    copyrightStatus: "cleared",
    accessibilityStatus: "ready",
    owner: "教研组 A",
  },
  {
    id: "asset-reading-market",
    title: "集市的一天",
    subtitle: "朗读测评文本 / 220 字",
    kind: "assessment-text",
    languageCoverage: "bilingual",
    resourceState: "demo",
    copyrightStatus: "pending",
    accessibilityStatus: "needs-review",
    owner: "语文内容编辑",
  },
  {
    id: "asset-writing-route",
    title: "路线复述练习",
    subtitle: "书面练习题 / 结构化提示",
    kind: "worksheet",
    languageCoverage: "zh-only",
    resourceState: "pending",
    copyrightStatus: "cleared",
    accessibilityStatus: "needs-review",
    owner: "教研组 B",
  },
  {
    id: "asset-recommend-clinic",
    title: "发音诊断补充课",
    subtitle: "推荐课程 / demo 引导",
    kind: "recommended-course",
    languageCoverage: "pending",
    resourceState: "pending",
    copyrightStatus: "cleared",
    accessibilityStatus: "ready",
    owner: "产品内容联动",
  },
  {
    id: "asset-audio-teacher",
    title: "教师参考朗读",
    subtitle: "参考音频 / 未接真实媒体库",
    kind: "reference-audio",
    languageCoverage: "bilingual",
    resourceState: "unavailable",
    copyrightStatus: "restricted",
    accessibilityStatus: "needs-review",
    owner: "音频采集待排期",
  },
];

const versions: CurriculumVersionSummary[] = [
  {
    id: "plateau-route-v3",
    title: "高原路径表达 · v3",
    subtitle: "课程草稿详情",
    status: "draft",
    resourceState: "demo",
    updatedAt: "2026-07-09 10:10",
    owner: "教研主编 格桑",
    bilingualCoverage: "partial",
    copyrightStatus: "pending",
    accessibilityStatus: "needs-review",
    materialCompleteness: 72,
    note: "仍需补齐推荐课程与教师音频引用。",
  },
  {
    id: "village-story-v2",
    title: "村落故事朗读包 · v2",
    subtitle: "审核中版本",
    status: "review",
    resourceState: "pending",
    updatedAt: "2026-07-08 16:20",
    owner: "教研审校 洛桑",
    bilingualCoverage: "complete",
    copyrightStatus: "pending",
    accessibilityStatus: "ready",
    materialCompleteness: 90,
    note: "等待版权回执，不应宣称真实发布。",
  },
  {
    id: "market-phrases-v1",
    title: "集市交流表达 · v1",
    subtitle: "demo 发布快照",
    status: "published",
    resourceState: "demo",
    updatedAt: "2026-07-07 09:30",
    owner: "课程运营 平措",
    bilingualCoverage: "complete",
    copyrightStatus: "cleared",
    accessibilityStatus: "ready",
    materialCompleteness: 100,
    note: "仅用于前端联调与视觉校验，不代表真实服务已接入。",
  },
  {
    id: "oral-bridge-v4",
    title: "口语桥接练习 · v4",
    subtitle: "依赖不可用",
    status: "unavailable",
    resourceState: "unavailable",
    updatedAt: "2026-07-06 14:05",
    owner: "内容运营 待排期",
    bilingualCoverage: "missing",
    copyrightStatus: "restricted",
    accessibilityStatus: "needs-review",
    materialCompleteness: 36,
    note: "引用音频与藏文对照缺失，当前不可进入发布前检查。",
  },
];

const associations: CurriculumAssociation[] = [
  {
    id: "assoc-1",
    readingTextTitle: "集市的一天",
    worksheetTitle: "路线复述练习",
    recommendedCourseTitle: "发音诊断补充课",
    relationNote: "先朗读，再转写路线，再跳转到补充课强化易错音。",
    resourceState: "pending",
  },
  {
    id: "assoc-2",
    readingTextTitle: "山路问答",
    worksheetTitle: "路标选择题",
    recommendedCourseTitle: "高原日常表达 · 第一单元",
    relationNote: "阅读、练习和课程回看共享同一语义主题。",
    resourceState: "demo",
  },
];

const checklist: PublicationChecklistItem[] = [
  {
    id: "check-bilingual",
    label: "双语内容齐备",
    state: "pending",
    detail: "仍有两个书面练习题只有中文提示。",
  },
  {
    id: "check-copyright",
    label: "版权回执入档",
    state: "blocked",
    detail: "教师参考音频尚未完成授权确认。",
  },
  {
    id: "check-material",
    label: "素材完整度",
    state: "ready",
    detail: "课程结构、练习题与推荐关系已具备 demo 数据。",
  },
  {
    id: "check-accessibility",
    label: "可访问性检查",
    state: "pending",
    detail: "仍需补语音文本替代与低视力阅读检查。",
  },
];

const copyrightReferences: CopyrightReference[] = [
  {
    id: "rights-reading-market",
    title: "《集市的一天》文本改写稿",
    rightsOwner: "县教研室授权池",
    status: "pending",
    proof: "等待纸质盖章回执扫描件",
    nextAction: "在 CUR-001 接入后补录附件引用。",
  },
  {
    id: "rights-audio-teacher",
    title: "教师参考朗读样音",
    rightsOwner: "校内采集，二次传播受限",
    status: "restricted",
    proof: "仅有现场录制同意说明",
    nextAction: "未接媒体库前统一标为 unavailable。",
  },
  {
    id: "rights-course-plateau",
    title: "高原路径表达课程讲义",
    rightsOwner: "项目组原创",
    status: "cleared",
    proof: "内部原创登记完成",
    nextAction: "可继续进入 demo 发布演示。",
  },
];

const primaryDraft = versions[0]!;

const draftDetail: CurriculumDraftDetail = {
  version: primaryDraft,
  summary:
    "该草稿围绕“学习路径与地形线”主题组织课程、朗读测评与书面练习，目标是让学生在同一语义场景中完成输入、练习与复盘。",
  releaseBoundary:
    "当前页面仅展示 demo 工作流与待办，不声称真实发布成功；CUR-001 接入前统一使用 demo / pending / unavailable。",
  readingAssessments: [
    {
      id: "reading-1",
      title: "集市的一天",
      textState: "demo",
      scoringMode: "pending",
      note: "文本已准备，评分接口待 CUR-001。",
    },
    {
      id: "reading-2",
      title: "山路问答",
      textState: "pending",
      scoringMode: "pending",
      note: "藏文对照仍在复核。",
    },
  ],
  writtenExercises: [
    {
      id: "writing-1",
      title: "路线复述练习",
      mode: "demo",
      note: "可在前端演示结构，但不伪造学生提交。",
    },
    {
      id: "writing-2",
      title: "路标选择题",
      mode: "pending",
      note: "等待题目资源标准化。",
    },
  ],
  recommendedCourses: [
    {
      id: "course-rec-1",
      title: "发音诊断补充课",
      fit: "针对朗读中常见易错音补充练习",
      state: "pending",
    },
    {
      id: "course-rec-2",
      title: "高原日常表达 · 第一单元",
      fit: "用于回看路径表达核心句式",
      state: "demo",
    },
  ],
  checklist,
  copyrightReferences,
};

export const curriculumStudioDashboardDemo: CurriculumStudioDashboardData = {
  introNote:
    "工作台框架已为 CUR-001 API 接入预留边界；当前所有发布、推荐与评分结果都只是 demo 或 pending。",
  libraryAssets,
  versions,
  associations,
  checklist,
  copyrightReferences,
  highlightedDraftId: draftDetail.version.id,
};

export const curriculumStudioDrafts: Record<string, CurriculumDraftDetail> = {
  [draftDetail.version.id]: draftDetail,
};
