import type { SubmissionDetail, TeacherFeedbackDraft } from "../types";

export const submissionReviewSeed: SubmissionDetail[] = [
  {
    id: "submission-demo-001",
    className: "三年级一班",
    studentDisplayName: "示例学生甲（demo）",
    assignmentTitle: "第三单元朗读测评",
    submissionType: "initial-assessment",
    submittedAt: "2026-07-09 09:20",
    reviewStatus: "needs-review",
    aiAssistState: "pending",
    marker: "demo",
    isOverdue: false,
    needsAttention: true,
    evidenceComplete: true,
    schoolScopedLabel: "任教班级范围 · demo teacher",
    taskDescription:
      "朗读《高原的早晨》第一段，并完成两句跟读。教师需确认节奏、停连与收音。",
    readingTextTitle: "《高原的早晨》第一段",
    audioMetadata: {
      recordingSubmitted: true,
      durationLabel: "36 秒",
      recordedAt: "2026-07-09 09:17",
      captureDevice: "平板录音入口（demo）",
      fileStatus: "demo",
      aiProcessingStatus: "pending",
    },
    writtenExercises: [
      {
        prompt: "用一句话概括这段朗读的主要内容。",
        answer: "高原的早晨很安静，孩子们去上学。",
        completionState: "complete",
        teacherComment: "待教师复核",
        redoSuggestion: "关注“安静”和“去上学”的语义连贯性。",
      },
    ],
    learningEvidence: [
      {
        id: "evidence-001",
        label: "学习过程证据",
        detail:
          "保留录音提交时间、本地回执与自动转写状态；未提供虚假音频地址。",
        status: "available",
      },
      {
        id: "evidence-002",
        label: "AI 辅助状态",
        detail: "自动处理仍为 pending，只提示“需人工复核”，不展示伪造评分。",
        status: "pending",
      },
    ],
    attempt: {
      kind: "initial-assessment",
      roundLabel: "第 1 轮 / 首测",
      previousSubmissionId: null,
      historyEntryState: "unavailable",
    },
    reportState: "pending",
    recommendationEntries: [
      {
        title: "口腔开合与句尾收音练习",
        state: "demo",
        note: "前端 demo 推荐，教师可接受、调整或待确认，未写入后端。",
      },
    ],
    teacherReviewState: "in-review",
    reviewHistory: [
      {
        id: "history-001",
        actorLabel: "系统",
        at: "2026-07-09 09:21",
        action: "进入待复核",
        note: "AI 处理状态 pending，暂不向学生显示确定性结论。",
      },
    ],
  },
  {
    id: "submission-demo-002",
    className: "三年级一班",
    studentDisplayName: "示例学生乙（demo）",
    assignmentTitle: "句意匹配书面练习",
    submissionType: "written-practice",
    submittedAt: "2026-07-09 08:54",
    reviewStatus: "resubmitted",
    aiAssistState: "unavailable",
    marker: "pending",
    isOverdue: false,
    needsAttention: true,
    evidenceComplete: false,
    schoolScopedLabel: "任教班级范围 · demo teacher",
    taskDescription:
      "完成句意匹配，并写出第二题解释。教师需要确认缺失是否由离线同步造成。",
    readingTextTitle: "无朗读文本",
    audioMetadata: {
      recordingSubmitted: false,
      durationLabel: "未提交录音",
      recordedAt: "unavailable",
      captureDevice: "unavailable",
      fileStatus: "unavailable",
      aiProcessingStatus: "unavailable",
    },
    writtenExercises: [
      {
        prompt: "第二题：为什么选择“孩子们走向学校”？",
        answer: "答案为空，学生端显示离线后再同步。",
        completionState: "partial",
        teacherComment: "待确认是否需要重做。",
        redoSuggestion: "若确认不是同步异常，则要求补写解释。",
      },
    ],
    learningEvidence: [
      {
        id: "evidence-003",
        label: "书面答案",
        detail: "保留学生原始输入与空白项，不自动补齐。",
        status: "available",
      },
      {
        id: "evidence-004",
        label: "同步状态",
        detail: "服务端确认仍为 pending，不能把缺项直接当成学生失误。",
        status: "pending",
      },
    ],
    attempt: {
      kind: "retest",
      roundLabel: "第 2 轮 / 复测",
      previousSubmissionId: "submission-demo-001b",
      historyEntryState: "pending",
    },
    reportState: "unavailable",
    recommendationEntries: [
      {
        title: "基础句意解释训练",
        state: "adjusted",
        note: "教师可在前端调成“先补写再推荐课程”。",
      },
    ],
    teacherReviewState: "pending",
    reviewHistory: [
      {
        id: "history-002",
        actorLabel: "系统",
        at: "2026-07-09 08:55",
        action: "标记需要关注",
        note: "答案缺项与同步延迟同时存在，等待教师判断。",
      },
    ],
  },
  {
    id: "submission-demo-003",
    className: "三年级二班",
    studentDisplayName: "示例学生丙（demo）",
    assignmentTitle: "问候语跟读复测",
    submissionType: "retest",
    submittedAt: "2026-07-08 17:36",
    reviewStatus: "completed",
    aiAssistState: "demo",
    marker: "demo",
    isOverdue: false,
    needsAttention: false,
    evidenceComplete: true,
    schoolScopedLabel: "任教班级范围 · demo teacher",
    taskDescription: "完成问候语跟读复测。教师已给出 demo 复核结论。",
    readingTextTitle: "《问候语》复测文本",
    audioMetadata: {
      recordingSubmitted: true,
      durationLabel: "18 秒",
      recordedAt: "2026-07-08 17:32",
      captureDevice: "手机录音入口（demo）",
      fileStatus: "demo",
      aiProcessingStatus: "demo",
    },
    writtenExercises: [
      {
        prompt: "写出你觉得最难的一句。",
        answer: "第二句比较难，因为尾音总是读得太长。",
        completionState: "complete",
        teacherComment: "教师已给出重音与收音建议。",
        redoSuggestion: "可复测但不强制。",
      },
    ],
    learningEvidence: [
      {
        id: "evidence-005",
        label: "历史提交入口",
        detail: "前一轮提交存在引用，但历史详情仍是 pending 入口。",
        status: "pending",
      },
    ],
    attempt: {
      kind: "retest",
      roundLabel: "第 2 轮 / 复测",
      previousSubmissionId: "submission-demo-003-prev",
      historyEntryState: "pending",
    },
    reportState: "ready",
    recommendationEntries: [
      {
        title: "跟读节奏巩固课程",
        state: "accepted",
        note: "教师接受了前端 demo 推荐，但尚未正式写回。",
      },
    ],
    teacherReviewState: "reviewed",
    reviewHistory: [
      {
        id: "history-003",
        actorLabel: "教师",
        at: "2026-07-08 18:03",
        action: "完成复核",
        note: "记录为 demo reviewed，不代表真实服务端写入。",
      },
    ],
  },
  {
    id: "submission-demo-004",
    className: "三年级二班",
    studentDisplayName: "示例学生丁（demo）",
    assignmentTitle: "课后书面反思",
    submissionType: "written-practice",
    submittedAt: "2026-07-07 19:10",
    reviewStatus: "priority",
    aiAssistState: "pending",
    marker: "unavailable",
    isOverdue: true,
    needsAttention: true,
    evidenceComplete: false,
    schoolScopedLabel: "任教班级范围 · demo teacher",
    taskDescription:
      "提交课后书面反思。逾期且服务端报告 unavailable，需要教师人工干预。",
    readingTextTitle: "无朗读文本",
    audioMetadata: {
      recordingSubmitted: false,
      durationLabel: "无录音要求",
      recordedAt: "unavailable",
      captureDevice: "unavailable",
      fileStatus: "unavailable",
      aiProcessingStatus: "pending",
    },
    writtenExercises: [
      {
        prompt: "描述本周你最有把握的一次朗读。",
        answer: "系统当前只保留 demo 摘要，完整内容 unavailable。",
        completionState: "unavailable",
        teacherComment: "需要先恢复证据链再决定是否重做。",
        redoSuggestion: "先排障，再判断是否要求补交。",
      },
    ],
    learningEvidence: [
      {
        id: "evidence-006",
        label: "证据链状态",
        detail: "学生端显示已提交，但部分过程证据 unavailable。",
        status: "unavailable",
      },
    ],
    attempt: {
      kind: "initial-assessment",
      roundLabel: "第 1 轮 / 首测",
      previousSubmissionId: null,
      historyEntryState: "unavailable",
    },
    reportState: "unavailable",
    recommendationEntries: [
      {
        title: "书面表达补强课程",
        state: "pending",
        note: "推荐课程仍待教师确认，不能声称算法已正式生成。",
      },
    ],
    teacherReviewState: "unavailable",
    reviewHistory: [
      {
        id: "history-004",
        actorLabel: "系统",
        at: "2026-07-07 19:12",
        action: "标记逾期",
        note: "逾期且部分证据 unavailable，建议先排障。",
      },
    ],
  },
];

export const defaultTeacherFeedbackDraft = (
  submissionId: string,
): TeacherFeedbackDraft => ({
  submissionId,
  strengths: "",
  priorityIssue: "",
  nextAction: "",
  sectionFeedback: "",
  summary: "",
  reviewStatus: "reviewed",
  needsRedo: false,
  returnReason: "",
  retestRecommended: false,
  retestGoal: "",
  focusAreas: [],
});

export function cloneSubmissionReviewSeed(): SubmissionDetail[] {
  return submissionReviewSeed.map((item) => ({
    ...item,
    audioMetadata: { ...item.audioMetadata },
    writtenExercises: item.writtenExercises.map((entry) => ({ ...entry })),
    learningEvidence: item.learningEvidence.map((entry) => ({ ...entry })),
    attempt: { ...item.attempt },
    recommendationEntries: item.recommendationEntries.map((entry) => ({
      ...entry,
    })),
    reviewHistory: item.reviewHistory.map((entry) => ({ ...entry })),
  }));
}
