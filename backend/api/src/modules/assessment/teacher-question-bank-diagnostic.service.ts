import { Inject, Injectable, Optional } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { AssessmentForbiddenException, AssessmentValidationFailedException } from "./domain/assessment.errors.js";
import { AssessmentService } from "./assessment.service.js";
import type { CreateTeacherRemediationAssignmentDto } from "./dto/teacher-remediation-assignment.dto.js";
import {
  AssessmentReviewService,
  reviewableAssessmentStrategy,
} from "./assessment-review.service.js";
import {
  deriveQuestionBankProgress,
  type QuestionBankProgressDefinition,
  type QuestionBankProgressSession,
} from "./question-bank-progress.service.js";
import {
  isQuestionBankDiagnosis,
  QUESTION_BANK_DOMAIN_ORDER,
  QUESTION_BANK_FAMILY_ORDER,
  type QuestionBankDiagnosis,
  type QuestionBankDomain,
  type QuestionBankFamily,
} from "./question-bank-diagnosis.js";

const FORMAL_IN_PROGRESS_STATUSES = [
  "CREATED",
  "IN_PROGRESS",
  "SUBMITTED",
  "PROCESSING",
] as const;
type DerivedProgress = ReturnType<typeof deriveQuestionBankProgress>;
type FormalLevel = DerivedProgress["formalLevels"][number];

type DashboardSession = QuestionBankProgressSession & {
  enrollmentId: string;
  remediationOrigin?: string | null;
  remediationFocus?: unknown;
};

type SafeDiagnosis = {
  domains: Array<{
    domain: QuestionBankDomain;
    displayName: string;
    percentage: number;
  }>;
  families: Array<{
    family: QuestionBankFamily;
    displayName: string;
    domain: QuestionBankDomain;
    domainDisplayName: string;
    percentage: number;
  }>;
  priorities: Array<{
    family: QuestionBankFamily;
    displayName: string;
    domain: QuestionBankDomain;
    domainDisplayName: string;
    percentage: number;
  }>;
};

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function diagnosisFromSummary(summary: unknown) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary))
    return null;
  return (summary as Record<string, unknown>).diagnosis ?? null;
}

function finitePercentage(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
  );
}

/**
 * Dashboard diagnostics deliberately consume the immutable diagnosis snapshot.
 * This validates only its safe aggregate fields; it never reads answers,
 * scoring specifications, provider diagnostics, or candidate point values.
 */
function safeDiagnosis(value: unknown): SafeDiagnosis | null {
  if (!isQuestionBankDiagnosis(value)) return null;
  const diagnosis = value as QuestionBankDiagnosis;
  const domains = QUESTION_BANK_DOMAIN_ORDER.flatMap((domain) => {
    const matches = diagnosis.domains.filter(
      (entry) => entry.domain === domain,
    );
    const entry = matches[0];
    if (
      matches.length !== 1 ||
      !entry ||
      typeof entry.displayName !== "string" ||
      !finitePercentage(entry.percentage)
    )
      return [];
    return [
      {
        domain,
        displayName: entry.displayName,
        percentage: round(entry.percentage),
      },
    ];
  });
  const families = QUESTION_BANK_FAMILY_ORDER.flatMap((family) => {
    const matches = diagnosis.families.filter(
      (entry) => entry.family === family,
    );
    const entry = matches[0];
    if (
      matches.length !== 1 ||
      !entry ||
      typeof entry.displayName !== "string" ||
      typeof entry.domainDisplayName !== "string" ||
      !QUESTION_BANK_DOMAIN_ORDER.includes(entry.domain) ||
      !finitePercentage(entry.percentage)
    )
      return [];
    return [
      {
        family,
        displayName: entry.displayName,
        domain: entry.domain,
        domainDisplayName: entry.domainDisplayName,
        percentage: round(entry.percentage),
      },
    ];
  });
  if (
    domains.length !== QUESTION_BANK_DOMAIN_ORDER.length ||
    families.length !== QUESTION_BANK_FAMILY_ORDER.length
  )
    return null;

  const familyByKey = new Map(families.map((entry) => [entry.family, entry]));
  const priorities = diagnosis.priorities.flatMap((entry) => {
    const family = familyByKey.get(entry.family);
    return family ? [family] : [];
  });
  return { domains, families, priorities };
}

function formalLevelFor(
  progress: DerivedProgress,
  practiceDefinitionId: string,
) {
  return (
    progress.formalLevels.find(
      (entry) => entry.practiceDefinitionId === practiceDefinitionId,
    ) ?? null
  );
}

function stateFor(input: {
  formal: FormalLevel | null;
  hasActiveStandard: boolean;
  needsAttention: boolean;
}) {
  if (!input.formal)
    return input.hasActiveStandard ? "IN_PROGRESS" : "NOT_ASSESSED";
  return input.needsAttention ? "NEEDS_ATTENTION" : "COMPLETED";
}

function remediationSummary(
  progress: DerivedProgress,
  practiceDefinitionId: string,
) {
  const candidates = progress.remediation
    .filter((entry) => entry.practiceDefinitionId === practiceDefinitionId)
    .flatMap((entry) =>
      entry.rounds.map((round) => ({
        ...round,
        sourceSessionId: entry.sourceSessionId,
      })),
    );
  const latest = [...candidates].sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) ||
      right.sessionId.localeCompare(left.sessionId),
  )[0];
  if (!latest) return null;
  return {
    completedRounds: candidates.length,
    latestRoundItemCount: latest.itemCount,
    latestMasteredCount: latest.masteredCount,
    latestPercentage: latest.percentage,
  };
}

function assignedRemediationSummary(sessions: Array<{ remediationOrigin?: string | null; status: string; createdAt: Date; remediationFocus?: unknown }>) {
  const assigned = sessions.filter((session) => session.remediationOrigin === "TEACHER_ASSIGNED");
  if (!assigned.length) return null;
  const active = assigned.filter((session) => ["CREATED", "IN_PROGRESS", "SUBMITTED", "PROCESSING"].includes(session.status));
  const latest = [...assigned].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0]!;
  const focus = latest.remediationFocus && typeof latest.remediationFocus === "object" && !Array.isArray(latest.remediationFocus)
    ? latest.remediationFocus as Record<string, unknown>
    : {};
  return {
    activeCount: active.length,
    latestStatus: latest.status,
    latestFocus: focus.mode === "FAMILY" && typeof focus.family === "string" && QUESTION_BANK_FAMILY_ORDER.includes(focus.family as QuestionBankFamily)
      ? focus.family
      : "ALL_RETRY",
    latestAssignedAt: latest.createdAt.toISOString(),
  };
}

@Injectable()
export class TeacherQuestionBankDiagnosticService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AssessmentReviewService)
    private readonly reviewService: AssessmentReviewService,
    @Optional() @Inject(AssessmentService)
    private readonly assessmentService?: AssessmentService,
  ) {}

  async createRemediationAssignments(
    auth: AuthContext,
    schoolId: string,
    classId: string,
    dto: CreateTeacherRemediationAssignmentDto,
  ) {
    await this.reviewService.assertAuthorizedClass(auth, schoolId, classId);
    if (!dto.focus || (dto.focus.mode !== "ALL_RETRY" && dto.focus.mode !== "FAMILY")) {
      throw new AssessmentValidationFailedException("专项巩固范围无效");
    }
    if (dto.focus.mode === "FAMILY" && (!dto.focus.family || !QUESTION_BANK_FAMILY_ORDER.includes(dto.focus.family as QuestionBankFamily))) {
      throw new AssessmentValidationFailedException("专项巩固题型无效");
    }
    const enrollmentIds = [...new Set(dto.enrollmentIds)];
    if (enrollmentIds.length !== dto.enrollmentIds.length) {
      throw new AssessmentValidationFailedException("学生名单不能重复");
    }
    const targets = await this.prisma.enrollment.findMany({
      where: { id: { in: enrollmentIds }, schoolId, classId, role: "STUDENT", status: "ACTIVE" },
      select: { id: true, classId: true, user: { select: { displayName: true } } },
      orderBy: [{ user: { displayName: "asc" } }, { id: "asc" }],
    });
    // A target mismatch is an authorization/scope problem, not a partial
    // business skip: never silently drop another class or inactive enrollment.
    if (targets.length !== enrollmentIds.length) throw new AssessmentForbiddenException("学生不属于当前班级的有效学生名单");
    if (!this.assessmentService) throw new AssessmentForbiddenException();
    const focus = dto.focus.mode === "FAMILY"
      ? { mode: "FAMILY" as const, family: dto.focus.family! }
      : { mode: "ALL_RETRY" as const };
    const outcomes = await Promise.all(targets.map(async (target) => {
      const result = await this.assessmentService!.createTeacherAssignedRemediation({
        schoolId,
        enrollment: { id: target.id, classId: target.classId },
        actorUserId: auth.principal.userId,
        practiceDefinitionId: dto.practiceDefinitionId,
        focus,
      });
      return {
        enrollmentId: target.id,
        displayName: target.user.displayName,
        outcome: result.outcome,
        attemptId: result.attemptId,
        itemCount: result.itemCount,
      };
    }));
    return {
      requested: enrollmentIds.length,
      assigned: outcomes.filter((entry) => entry.outcome === "CREATED").length,
      resumed: outcomes.filter((entry) => entry.outcome === "RESUMED").length,
      skipped: outcomes.filter((entry) => entry.outcome === "NO_COMPLETED_ASSESSMENT" || entry.outcome === "NO_MATCHING_RETRY_CANDIDATES").length,
      targets: outcomes,
    };
  }

  async getCatalog(auth: AuthContext, schoolId: string) {
    const classIds = await this.reviewService.authorizedClassIds(
      auth,
      schoolId,
    );
    const classes = await this.prisma.class.findMany({
      where: {
        schoolId,
        ...(classIds === null ? {} : { id: { in: classIds } }),
      },
      select: { id: true, name: true, grade: true },
      orderBy: [{ grade: "asc" }, { name: "asc" }, { id: "asc" }],
    });
    const counts = classes.length
      ? await this.prisma.enrollment.groupBy({
          by: ["classId"],
          where: {
            schoolId,
            classId: { in: classes.map((entry) => entry.id) },
            role: "STUDENT",
            status: "ACTIVE",
          },
          _count: { _all: true },
        })
      : [];
    const studentsByClass = new Map(
      counts.map((entry: { classId: string; _count: { _all: number } }) => [
        entry.classId,
        entry._count._all,
      ]),
    );
    const practices = await this.availablePractices(schoolId);
    return {
      availableClasses: classes.map((entry) => ({
        classId: entry.id,
        className: entry.name,
        grade: entry.grade,
        activeStudentCount: studentsByClass.get(entry.id) ?? 0,
      })),
      availablePractices: practices,
    };
  }

  async getDashboard(
    auth: AuthContext,
    schoolId: string,
    classId: string,
    practiceDefinitionId: string,
  ) {
    await this.reviewService.assertAuthorizedClass(auth, schoolId, classId);
    const [classroom, practices] = await Promise.all([
      this.prisma.class.findFirst({
        where: { id: classId, schoolId },
        select: { id: true, name: true, grade: true },
      }),
      this.availablePractices(schoolId),
    ]);
    if (!classroom) throw new AssessmentForbiddenException();
    const practice = practices.find(
      (entry) => entry.practiceDefinitionId === practiceDefinitionId,
    );
    if (!practice)
      throw new AssessmentForbiddenException(
        "所选题库测评不在当前学校的可用范围内",
      );

    const students = await this.prisma.enrollment.findMany({
      where: { schoolId, classId, role: "STUDENT", status: "ACTIVE" },
      select: { id: true, user: { select: { displayName: true } } },
      orderBy: [{ user: { displayName: "asc" } }, { id: "asc" }],
    });
    const enrollmentIds = students.map((entry) => entry.id);
    const sessions = enrollmentIds.length
      ? await this.prisma.assessmentSession.findMany({
          where: {
            schoolId,
            classId,
            enrollmentId: { in: enrollmentIds },
            practiceDefinitionId,
            purpose: { in: ["STANDARD", "REMEDIATION"] },
          },
          select: {
            id: true,
            enrollmentId: true,
            purpose: true,
            remediationOrigin: true,
            remediationFocus: true,
            status: true,
            completedAt: true,
            createdAt: true,
            practiceDefinitionId: true,
            practiceVersionId: true,
            retestOfSessionId: true,
            report: { select: { overallScore: true, summary: true } },
            items: {
              select: {
                questionVersionId: true,
                maxScore: true,
                scoredScore: true,
              },
            },
          },
        })
      : [];
    const reviewItems = enrollmentIds.length
      ? await this.prisma.assessmentItem.findMany({
          where: {
            questionVersionId: { not: null },
            scoredScore: null,
            session: {
              schoolId,
              classId,
              enrollmentId: { in: enrollmentIds },
              practiceDefinitionId,
              purpose: "STANDARD",
              status: { in: ["SUBMITTED", "PROCESSING"] },
            },
            questionVersion: { status: "PUBLISHED" },
          },
          select: {
            session: { select: { enrollmentId: true } },
            questionVersion: { select: { scoringSpec: true } },
          },
        })
      : [];

    const definitions: QuestionBankProgressDefinition[] = [
      {
        id: practice.practiceDefinitionId,
        title: practice.title,
        difficulty: practice.difficulty,
      },
    ];
    const sessionsByEnrollment = new Map<string, DashboardSession[]>();
    for (const session of sessions as unknown as DashboardSession[]) {
      const entries = sessionsByEnrollment.get(session.enrollmentId) ?? [];
      entries.push(session);
      sessionsByEnrollment.set(session.enrollmentId, entries);
    }
    const pendingByEnrollment = new Map<string, number>();
    for (const item of reviewItems) {
      if (!reviewableAssessmentStrategy(item.questionVersion?.scoringSpec))
        continue;
      const enrollmentId = item.session.enrollmentId;
      pendingByEnrollment.set(
        enrollmentId,
        (pendingByEnrollment.get(enrollmentId) ?? 0) + 1,
      );
    }

    const validStudents: Array<{
      enrollmentId: string;
      displayName: string;
      formal: FormalLevel;
      diagnosis: SafeDiagnosis;
      remediation: ReturnType<typeof remediationSummary>;
      progress: DerivedProgress;
    }> = [];
    let dataQualityIssueCount = 0;
    const rows = students.map((student) => {
      const studentSessions = sessionsByEnrollment.get(student.id) ?? [];
      const standardSessions = studentSessions.filter(
        (session) => session.purpose === "STANDARD",
      );
      let formal: FormalLevel | null = null;
      let progress: DerivedProgress | null = null;
      let diagnosis: SafeDiagnosis | null = null;
      try {
        progress = deriveQuestionBankProgress(standardSessions, definitions);
        formal = formalLevelFor(progress, practiceDefinitionId);
        if (formal) {
          const latestAttempt = formal.attempts.at(-1)!;
          const latestSession = standardSessions.find(
            (session) => session.id === latestAttempt.sessionId,
          );
          diagnosis = safeDiagnosis(
            diagnosisFromSummary(latestSession?.report?.summary),
          );
          if (!diagnosis) throw new Error("invalid persisted diagnosis");
        }
      } catch {
        // Immutable historical rows are never repaired by a read-only view.
        // Omit them safely and surface only an aggregate data-quality count.
        dataQualityIssueCount += 1;
        formal = null;
        progress = null;
      }
      const hasActiveStandard = standardSessions.some((session) =>
        FORMAL_IN_PROGRESS_STATUSES.includes(
          session.status as (typeof FORMAL_IN_PROGRESS_STATUSES)[number],
        ),
      );
      const needsAttention = Boolean(
        formal &&
        diagnosis &&
        (diagnosis.priorities.length > 0 ||
          formal.latestScore < 70 ||
          (formal.latestVsPrevious ?? 0) < 0),
      );
      let remediation = null;
      if (formal && progress) {
        try {
          remediation = remediationSummary(
            deriveQuestionBankProgress(studentSessions, definitions),
            practiceDefinitionId,
          );
        } catch {
          // A malformed remediation comparison must not affect formal class data.
          remediation = null;
        }
      }
      if (formal && diagnosis && progress)
        validStudents.push({
          enrollmentId: student.id,
          displayName: student.user.displayName,
          formal,
          diagnosis,
          remediation,
          progress,
        });
      return {
        enrollmentId: student.id,
        displayName: student.user.displayName,
        latestSessionId: formal?.attempts.at(-1)?.sessionId ?? null,
        latestScore: formal?.latestScore ?? null,
        completedAt: formal?.latestCompletedAt ?? null,
        comparisonState: formal?.comparisonState ?? "NOT_ASSESSED",
        latestVsPrevious: formal?.latestVsPrevious ?? null,
        topPriority: diagnosis?.priorities[0]
          ? {
              family: diagnosis.priorities[0].family,
              displayName: diagnosis.priorities[0].displayName,
            }
          : null,
        remediationSummary: remediation,
        assignedRemediation: assignedRemediationSummary(studentSessions),
        pendingReviewCount: pendingByEnrollment.get(student.id) ?? 0,
        needsAttention,
        state: stateFor({ formal, hasActiveStandard, needsAttention }),
      };
    });

    const assessedStudents = validStudents.length;
    const eligibleStudents = students.length;
    const aggregateDomain = QUESTION_BANK_DOMAIN_ORDER.map((domain) => ({
      domain,
      displayName:
        validStudents[0]?.diagnosis.domains.find(
          (entry) => entry.domain === domain,
        )?.displayName ?? domain,
      studentCount: assessedStudents,
      averagePercentage: assessedStudents
        ? round(
            validStudents.reduce(
              (total, student) =>
                total +
                student.diagnosis.domains.find(
                  (entry) => entry.domain === domain,
                )!.percentage,
              0,
            ) / assessedStudents,
          )
        : null,
    }));
    const aggregateFamilies = QUESTION_BANK_FAMILY_ORDER.map((family) => {
      const reference = validStudents[0]?.diagnosis.families.find(
        (entry) => entry.family === family,
      );
      return {
        family,
        displayName: reference?.displayName ?? family,
        domain: reference?.domain ?? null,
        domainDisplayName: reference?.domainDisplayName ?? null,
        studentCount: assessedStudents,
        averagePercentage: assessedStudents
          ? round(
              validStudents.reduce(
                (total, student) =>
                  total +
                  student.diagnosis.families.find(
                    (entry) => entry.family === family,
                  )!.percentage,
                0,
              ) / assessedStudents,
            )
          : null,
        priorityStudentCount: validStudents.filter((student) =>
          student.diagnosis.priorities.some((entry) => entry.family === family),
        ).length,
      };
    });
    const byDifficulty = [...aggregateFamilies].sort(
      (left, right) =>
        (left.averagePercentage ?? Number.POSITIVE_INFINITY) -
          (right.averagePercentage ?? Number.POSITIVE_INFINITY) ||
        right.priorityStudentCount - left.priorityStudentCount ||
        QUESTION_BANK_FAMILY_ORDER.indexOf(left.family) -
          QUESTION_BANK_FAMILY_ORDER.indexOf(right.family),
    );
    const byStrength = [...aggregateFamilies].sort(
      (left, right) =>
        (right.averagePercentage ?? Number.NEGATIVE_INFINITY) -
          (left.averagePercentage ?? Number.NEGATIVE_INFINITY) ||
        left.priorityStudentCount - right.priorityStudentCount ||
        QUESTION_BANK_FAMILY_ORDER.indexOf(left.family) -
          QUESTION_BANK_FAMILY_ORDER.indexOf(right.family),
    );
    const versionMixed =
      new Set(validStudents.map((student) => student.formal.practiceVersionId))
        .size > 1;
    const pendingReviewItemCount = [...pendingByEnrollment.values()].reduce(
      (total, count) => total + count,
      0,
    );
    const inProgressStudents = rows.filter(
      (row) => row.state === "IN_PROGRESS",
    ).length;
    const notAssessedStudents = rows.filter(
      (row) => row.state === "NOT_ASSESSED",
    ).length;

    return {
      class: {
        classId: classroom.id,
        className: classroom.name,
        grade: classroom.grade,
      },
      practice,
      summary: {
        eligibleStudents,
        assessedStudents,
        inProgressStudents,
        notAssessedStudents,
        coveragePercentage: eligibleStudents
          ? round((assessedStudents / eligibleStudents) * 100)
          : 0,
        averageScore: assessedStudents
          ? round(
              validStudents.reduce(
                (total, student) => total + student.formal.latestScore,
                0,
              ) / assessedStudents,
            )
          : null,
        improvedStudentCount: validStudents.filter(
          (student) => (student.formal.latestVsPrevious ?? 0) > 0,
        ).length,
        needsAttentionStudentCount: rows.filter((row) => row.needsAttention)
          .length,
        pendingReviewItemCount,
        pendingReviewStudentCount: pendingByEnrollment.size,
        dataQualityIssueCount,
        versionMixed,
      },
      domains: aggregateDomain,
      families: aggregateFamilies,
      commonDifficulties: assessedStudents ? byDifficulty.slice(0, 3) : [],
      strengths: assessedStudents ? byStrength.slice(0, 2) : [],
      students: rows,
    };
  }

  async getStudentDetail(
    auth: AuthContext,
    schoolId: string,
    classId: string,
    enrollmentId: string,
    practiceDefinitionId: string,
  ) {
    const dashboard = await this.getDashboard(
      auth,
      schoolId,
      classId,
      practiceDefinitionId,
    );
    const row = dashboard.students.find(
      (entry) => entry.enrollmentId === enrollmentId,
    );
    if (!row)
      throw new AssessmentForbiddenException(
        "该学生不属于当前班级的有效学生名单",
      );
    if (!row.latestSessionId) {
      return {
        ...row,
        formalHistory: [],
        latestDiagnosis: null,
        domainTrend: null,
        familyPriorities: [],
        remediationRounds: [],
      };
    }
    const sessions = await this.prisma.assessmentSession.findMany({
      where: {
        schoolId,
        classId,
        enrollmentId,
        practiceDefinitionId,
        purpose: { in: ["STANDARD", "REMEDIATION"] },
      },
      select: {
        id: true,
        enrollmentId: true,
        purpose: true,
        remediationOrigin: true,
        remediationFocus: true,
        status: true,
        completedAt: true,
        createdAt: true,
        practiceDefinitionId: true,
        practiceVersionId: true,
        retestOfSessionId: true,
        report: { select: { overallScore: true, summary: true } },
        items: {
          select: {
            questionVersionId: true,
            maxScore: true,
            scoredScore: true,
          },
        },
      },
    });
    const definition: QuestionBankProgressDefinition = {
      id: dashboard.practice.practiceDefinitionId,
      title: dashboard.practice.title,
      difficulty: dashboard.practice.difficulty,
    };
    const standardSessions = (sessions as unknown as DashboardSession[]).filter(
      (entry) => entry.purpose === "STANDARD",
    );
    let formal: FormalLevel | null = null;
    let progress: DerivedProgress | null = null;
    let diagnosis: SafeDiagnosis | null = null;
    try {
      progress = deriveQuestionBankProgress(standardSessions, [definition]);
      formal = formalLevelFor(progress, practiceDefinitionId);
      const latestSession = formal
        ? standardSessions.find(
            (entry) => entry.id === formal!.attempts.at(-1)!.sessionId,
          )
        : null;
      diagnosis = safeDiagnosis(
        diagnosisFromSummary(latestSession?.report?.summary),
      );
    } catch {
      // The list result already marks malformed history unavailable. Do not
      // disclose internal integrity details through the teacher dashboard.
      return {
        ...row,
        formalHistory: [],
        latestDiagnosis: null,
        domainTrend: null,
        familyPriorities: [],
        remediationRounds: [],
      };
    }
    let remediationRounds: Array<{
      sessionId: string;
      completedAt: string | null;
      itemCount: number;
      masteredCount: number;
      percentage: number;
    }> = [];
    try {
      const fullProgress = deriveQuestionBankProgress(
        sessions as unknown as DashboardSession[],
        [definition],
      );
      remediationRounds = fullProgress.remediation
        .filter((entry) => entry.practiceDefinitionId === practiceDefinitionId)
        .flatMap((entry) =>
          entry.rounds.map((round) => ({
            sessionId: round.sessionId,
            completedAt: round.completedAt,
            itemCount: round.itemCount,
            masteredCount: round.masteredCount,
            percentage: round.percentage,
          })),
        );
    } catch {
      remediationRounds = [];
    }
    return {
      ...row,
      formalHistory: formal?.attempts ?? [],
      latestDiagnosis: diagnosis
        ? { domains: diagnosis.domains, priorities: diagnosis.priorities }
        : null,
      domainTrend: formal?.domainTrend ?? null,
      familyPriorities: diagnosis?.priorities ?? [],
      remediationRounds,
    };
  }

  private async availablePractices(schoolId: string) {
    const definitions = await this.prisma.practiceDefinition.findMany({
      where: {
        status: "PUBLISHED",
        OR: [{ schoolId }, { schoolId: null }],
        versions: { some: { status: "PUBLISHED" } },
      },
      select: {
        id: true,
        title: true,
        difficulty: true,
        versions: {
          where: { status: "PUBLISHED" },
          orderBy: [{ publishedAt: "desc" }, { version: "desc" }],
          select: {
            id: true,
            sections: {
              select: {
                items: {
                  select: {
                    questionVersionId: true,
                    questionVersion: { select: { status: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    return definitions
      .flatMap((definition) => {
        const published = definition.versions.find((version) => {
          const refs = version.sections.flatMap((section) => section.items);
          return (
            refs.length === 20 &&
            refs.every(
              (ref) =>
                ref.questionVersionId &&
                ref.questionVersion?.status === "PUBLISHED",
            )
          );
        });
        return published
          ? [
              {
                practiceDefinitionId: definition.id,
                title: definition.title,
                difficulty: definition.difficulty,
                latestPublishedVersionId: published.id,
              },
            ]
          : [];
      })
      .sort(
        (left, right) =>
          left.difficulty.localeCompare(right.difficulty, "zh-Hans-CN") ||
          left.title.localeCompare(right.title, "zh-Hans-CN") ||
          left.practiceDefinitionId.localeCompare(right.practiceDefinitionId),
      );
  }
}
