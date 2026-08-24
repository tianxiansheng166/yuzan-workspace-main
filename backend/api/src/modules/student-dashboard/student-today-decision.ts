export const STUDENT_TODAY_VERSION = "student-today-v1";

export type StudentTodayActionKind =
  | "TEACHER_REMEDIATION"
  | "RESUME_REMEDIATION"
  | "RESUME_ASSESSMENT"
  | "START_REMEDIATION"
  | "BASELINE"
  | "CONTINUE_PRACTICE"
  | "LEGACY_ASSIGNMENT";

export type StudentTodayTarget = {
  readonly href: string;
  readonly sourceSessionId?: string;
  readonly practiceDefinitionId?: string;
};

export type StudentTodayAction = {
  readonly kind: StudentTodayActionKind;
  readonly title: string;
  readonly reason: string;
  readonly cta: string;
  readonly target: StudentTodayTarget;
};

export type StudentTodayWaiting = {
  readonly kind: "TEACHER_REVIEW";
  readonly title: string;
  readonly reason: string;
  readonly itemCount: number;
};

export type StudentTodayLegacyTask = {
  readonly assignmentId: string;
  readonly title: string;
  readonly courseTitle: string;
  readonly dueAt: string;
  readonly status: string;
  readonly progressPercent: number;
  readonly hasOfflinePackage: boolean;
};

export type StudentTodayAttempt = {
  readonly id: string;
  readonly status: "CREATED" | "IN_PROGRESS" | "SUBMITTED" | "PROCESSING";
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly itemCount: number;
  readonly practiceTitle: string | null;
  readonly focusDisplayName: string | null;
};

export type StudentTodayFormalDiagnosis = {
  readonly sessionId: string;
  readonly level: string | null;
  readonly score: number | null;
  readonly completedAt: string;
  readonly priorityDisplayName: string | null;
  readonly retryCandidateCount: number;
};

export type StudentTodayBaselinePractice = {
  readonly practiceDefinitionId: string;
  readonly title: string;
};

export type StudentTodayDecisionInput = {
  readonly teacherActionable: readonly StudentTodayAttempt[];
  readonly teacherWaiting: readonly StudentTodayAttempt[];
  readonly selfActionable: readonly StudentTodayAttempt[];
  readonly standardActionable: readonly StudentTodayAttempt[];
  readonly latestFormal: StudentTodayFormalDiagnosis | null;
  readonly baselinePractice: StudentTodayBaselinePractice | null;
  readonly legacyTasks: readonly StudentTodayLegacyTask[];
};

export type StudentTodayDecision = {
  readonly version: typeof STUDENT_TODAY_VERSION;
  readonly primaryAction: StudentTodayAction | null;
  readonly secondaryActions: readonly StudentTodayAction[];
  readonly waiting: readonly StudentTodayWaiting[];
  readonly legacyTasks: readonly StudentTodayLegacyTask[];
  readonly summary: {
    readonly latestFormalAssessment: {
      readonly level: string | null;
      readonly score: number | null;
      readonly completedAt: string;
    } | null;
  };
};

function byPriority(left: StudentTodayAttempt, right: StudentTodayAttempt) {
  const statusRank = (status: StudentTodayAttempt["status"]) =>
    status === "IN_PROGRESS" ? 0 : 1;
  return (
    statusRank(left.status) - statusRank(right.status) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.updatedAt.localeCompare(right.updatedAt) ||
    left.id.localeCompare(right.id)
  );
}

function firstAttempt(attempts: readonly StudentTodayAttempt[]) {
  return [...attempts].sort(byPriority)[0] ?? null;
}

function remediationTitle(attempt: StudentTodayAttempt) {
  return attempt.focusDisplayName &&
    attempt.focusDisplayName !== "全部待巩固题目"
    ? `${attempt.focusDisplayName}专项巩固`
    : "专项巩固";
}

function remediationReason(attempt: StudentTodayAttempt) {
  const count = Math.max(0, attempt.itemCount);
  return `这项练习共有 ${count} 道题，完成后可以把上次需要加强的地方再练一遍。`;
}

function remediationAction(
  attempt: StudentTodayAttempt,
  kind: "TEACHER_REMEDIATION" | "RESUME_REMEDIATION",
): StudentTodayAction {
  const teacherAssigned = kind === "TEACHER_REMEDIATION";
  return {
    kind,
    title: teacherAssigned
      ? `老师布置的${remediationTitle(attempt)}`
      : `继续${remediationTitle(attempt)}`,
    reason: teacherAssigned
      ? `老师给你布置了 ${Math.max(0, attempt.itemCount)} 道${attempt.focusDisplayName && attempt.focusDisplayName !== "全部待巩固题目" ? `「${attempt.focusDisplayName}」` : "专项"}巩固题。`
      : remediationReason(attempt),
    cta: teacherAssigned
      ? attempt.status === "CREATED"
        ? "开始巩固"
        : "继续巩固"
      : "继续完成",
    target: {
      href: `/student/practices/attempts/${encodeURIComponent(attempt.id)}/runner/`,
    },
  };
}

function standardAction(attempt: StudentTodayAttempt): StudentTodayAction {
  const title = attempt.practiceTitle
    ? `继续完成「${attempt.practiceTitle}」`
    : "继续完成测评";
  return {
    kind: "RESUME_ASSESSMENT",
    title,
    reason: "你有一项还没完成的测评，从上次进度继续即可。",
    cta: attempt.status === "CREATED" ? "开始测评" : "继续测评",
    target: { href: `/assessment/sessions/${encodeURIComponent(attempt.id)}/` },
  };
}

function legacyAction(task: StudentTodayLegacyTask): StudentTodayAction {
  return {
    kind: "LEGACY_ASSIGNMENT",
    title: task.title,
    reason: task.dueAt
      ? `老师布置的课程任务，截止时间为 ${task.dueAt.slice(0, 10)}。`
      : "老师布置的课程任务。",
    cta: task.progressPercent > 0 ? "继续课程" : "开始课程",
    target: {
      href: `/student/learn/spring-2?assignmentId=${encodeURIComponent(task.assignmentId)}`,
    },
  };
}

export function buildStudentTodayDecision(
  input: StudentTodayDecisionInput,
): StudentTodayDecision {
  const primaryTeacher = firstAttempt(input.teacherActionable);
  const primarySelf = firstAttempt(input.selfActionable);
  const primaryStandard = firstAttempt(input.standardActionable);
  const secondaryActions = input.legacyTasks.map(legacyAction);
  let primaryAction: StudentTodayAction | null = null;

  if (primaryTeacher)
    primaryAction = remediationAction(primaryTeacher, "TEACHER_REMEDIATION");
  else if (primarySelf)
    primaryAction = remediationAction(primarySelf, "RESUME_REMEDIATION");
  else if (primaryStandard) primaryAction = standardAction(primaryStandard);
  else if (input.latestFormal && input.latestFormal.retryCandidateCount > 0) {
    const displayName =
      input.latestFormal.priorityDisplayName || "需要优先练习的题型";
    primaryAction = {
      kind: "START_REMEDIATION",
      title: "巩固上次测评中的薄弱项",
      reason: `上次测评中「${displayName}」建议优先练习。`,
      cta: "开始巩固",
      target: {
        href: "/student/practices/",
        sourceSessionId: input.latestFormal.sessionId,
      },
    };
  } else if (input.latestFormal) {
    primaryAction = {
      kind: "CONTINUE_PRACTICE",
      title: "继续练习",
      reason: "上次测评暂时没有需要优先重练的题目，可以从练习中心继续学习。",
      cta: "进入练习中心",
      target: { href: "/student/practices/" },
    };
  } else if (input.baselinePractice) {
    primaryAction = {
      kind: "BASELINE",
      title: "先完成第一次能力测评",
      reason: "完成第一次测评后，系统才能根据你的真实表现安排下一步练习。",
      cta: "开始第一次测评",
      target: {
        href: "/student/practices/",
        practiceDefinitionId: input.baselinePractice.practiceDefinitionId,
      },
    };
  } else if (secondaryActions[0]) {
    primaryAction = secondaryActions.shift()!;
  }

  const waiting = [...input.teacherWaiting]
    .sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) ||
        left.id.localeCompare(right.id),
    )
    .map((attempt) => ({
      kind: "TEACHER_REVIEW" as const,
      title: attempt.focusDisplayName
        ? `${attempt.focusDisplayName}专项巩固`
        : "专项巩固",
      reason: "这项朗读练习正在等待老师复核。",
      itemCount: Math.max(0, attempt.itemCount),
    }));

  return {
    version: STUDENT_TODAY_VERSION,
    primaryAction,
    secondaryActions,
    waiting,
    legacyTasks: input.legacyTasks,
    summary: {
      latestFormalAssessment: input.latestFormal
        ? {
            level: input.latestFormal.level,
            score: input.latestFormal.score,
            completedAt: input.latestFormal.completedAt,
          }
        : null,
    },
  };
}
