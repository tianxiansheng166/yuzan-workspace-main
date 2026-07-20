import type {
  AssignmentDetail,
  AssignmentDraft,
  AssignmentSummary,
  PublishResult,
  SaveDraftResult,
  UserRole,
} from "../types";

export interface AssignmentListResult {
  role: UserRole;
  assignments: AssignmentSummary[];
}

export interface AssignmentDetailResult {
  role: UserRole;
  assignment: AssignmentDetail | null;
}

const DEMO_ASSIGNMENTS: AssignmentSummary[] = [
  {
    id: "asn-demo-01",
    classId: "cls-demo-01",
    className: "三年级一班",
    type: "first-assessment",
    title: "第三单元首次测评",
    status: "active",
    startsAt: "2026-07-01T08:00",
    dueAt: "2026-07-15T23:59",
    completionRatio: 0.6,
    isDemo: true,
  },
  {
    id: "asn-demo-02",
    classId: "cls-demo-01",
    className: "三年级一班",
    type: "learning",
    title: "古诗朗读练习",
    status: "scheduled",
    startsAt: "2026-07-10T08:00",
    dueAt: "2026-07-20T23:59",
    completionRatio: 0,
    isDemo: true,
  },
  {
    id: "asn-demo-03",
    classId: "cls-demo-02",
    className: "三年级二班",
    type: "composite",
    title: "期末综合任务",
    status: "draft",
    startsAt: "2026-07-05T08:00",
    dueAt: "2026-07-25T23:59",
    completionRatio: 0,
    isDemo: true,
  },
  {
    id: "asn-demo-04",
    classId: "cls-demo-01",
    className: "三年级一班",
    type: "written-practice",
    title: "生字书面练习",
    status: "completed",
    startsAt: "2026-06-01T08:00",
    dueAt: "2026-06-10T23:59",
    completionRatio: 1,
    isDemo: true,
  },
];

let draftCounter = 0;

/**
 * Gateway for assignment builder data.
 * Current implementation returns demo/pending data for UI scaffolding.
 * ASN-001 will replace this with real API calls while keeping the adapter boundary.
 */
export async function fetchAssignmentList(): Promise<AssignmentListResult> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return { role: "teacher", assignments: DEMO_ASSIGNMENTS };
}

export async function fetchAssignmentDetail(
  assignmentId: string,
): Promise<AssignmentDetailResult> {
  await new Promise((resolve) => setTimeout(resolve, 300));

  if (assignmentId === "asn-error") {
    throw new Error("Failed to load assignment detail");
  }

  const summary = DEMO_ASSIGNMENTS.find((a) => a.id === assignmentId);
  if (!summary) {
    return { role: "teacher", assignment: null };
  }

  const detail: AssignmentDetail = {
    ...summary,
    description:
      "这是一个 demo 任务，用于预览任务编排界面。正式任务将在 ASN-001 完成后接入真实数据。",
    allowRetest: summary.type === "retest",
    includeSpeech:
      summary.type === "speech-practice" || summary.type === "composite",
    includeWritten:
      summary.type === "written-practice" || summary.type === "composite",
    recommendNextCourse: false,
    selectedContents: [
      {
        id: "cnt-demo-01",
        kind: "assessment",
        title: "第三单元形成性测评",
      },
    ],
    students: [
      {
        studentId: "stu-demo-01",
        displayName: "示例学生甲（demo）",
        isDemo: true,
        progressStatus: "completed",
        speechStatus: "completed",
        writtenStatus: "completed",
        reportStatus: "pending",
      },
      {
        studentId: "stu-demo-02",
        displayName: "示例学生乙（demo）",
        isDemo: true,
        progressStatus: "in-progress",
        speechStatus: "pending",
        writtenStatus: "pending",
        reportStatus: "unavailable",
      },
      {
        studentId: "stu-demo-03",
        displayName: "示例学生丙（demo）",
        isDemo: true,
        progressStatus: "not-started",
        speechStatus: "unavailable",
        writtenStatus: "unavailable",
        reportStatus: "unavailable",
      },
    ],
  };

  return { role: "teacher", assignment: detail };
}

export async function saveAssignmentDraft(
  draft: AssignmentDraft,
): Promise<SaveDraftResult> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  draftCounter += 1;
  return {
    success: true,
    id: draft.id ?? `asn-draft-${draftCounter}`,
    demo: true,
    message: "草稿已保存在本地 demo 状态（ASN-001 完成后将同步到后端）。",
  };
}

export async function publishAssignment(
  draft: AssignmentDraft,
): Promise<PublishResult> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  draftCounter += 1;
  return {
    success: false,
    id: `asn-draft-${draftCounter}`,
    demo: true,
    message:
      "发布服务尚未接入（ASN-001 待完成）。任务仅作为 demo 预览，不会真正下发。",
  };
}
