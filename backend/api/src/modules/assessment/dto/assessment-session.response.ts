import type { AssessmentSession, AssessmentItem, AssessmentReport, WrittenAnswer } from "../domain/assessment.types.js";
import { isQuestionBankDiagnosis, type QuestionBankDiagnosis } from "../question-bank-diagnosis.js";

export function toAssessmentSessionResponse(session: AssessmentSession) {
  return {
    id: session.id,
    schoolId: session.schoolId,
    enrollmentId: session.enrollmentId,
    classId: session.classId,
    initiatorUserId: session.initiatorUserId,
    type: session.type,
    status: session.status,
    startedAt: session.startedAt?.toISOString() ?? null,
    submittedAt: session.submittedAt?.toISOString() ?? null,
    completedAt: session.completedAt?.toISOString() ?? null,
    retestOfSessionId: session.retestOfSessionId,
    revision: session.revision,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

function studentSafeAutoResult(value: Record<string, unknown> | null) {
  if (value?.reasonCode === "SCORING_CONFIG_INVALID") {
    return {
      state: "NEEDS_REVIEW",
      message: "该题评分配置需复核",
    };
  }
  return value;
}

export function toAssessmentItemResponse(item: AssessmentItem, options: { includeScoring?: boolean; viewer?: "student" | "staff" } = {}) {
  const includeScoring = options.includeScoring ?? true;
  const autoResult = includeScoring
    ? options.viewer === "student" ? studentSafeAutoResult(item.autoResult) : item.autoResult
    : null;
  return {
    id: item.id,
    sessionId: item.sessionId,
    questionId: item.questionId,
    recordingId: item.recordingId,
    prompt: item.prompt,
    itemType: item.itemType,
    status: item.status,
    sortOrder: item.sortOrder,
    maxScore: item.maxScore,
    scoredScore: includeScoring ? item.scoredScore : null,
    autoResult,
    reviewerUserId: item.reviewerUserId,
    reviewedAt: item.reviewedAt?.toISOString() ?? null,
  };
}

export function toReadingItemResponse(item: AssessmentItem & { questionPrompt?: Record<string, unknown>; demoAudioUrl?: string | null }) {
  return {
    id: item.id,
    sessionId: item.sessionId,
    prompt: item.prompt,
    itemType: item.itemType,
    questionPrompt: item.questionPrompt,
    demoAudioUrl: item.demoAudioUrl,
    recordingId: item.recordingId,
    sortOrder: item.sortOrder,
    status: item.status,
    maxScore: item.maxScore,
  };
}

export function toWrittenItemResponse(item: AssessmentItem) {
  return {
    id: item.id,
    sessionId: item.sessionId,
    prompt: item.prompt,
    itemType: item.itemType,
    sortOrder: item.sortOrder,
    status: item.status,
    maxScore: item.maxScore,
  };
}

export function toWrittenAnswerResponse(answer: WrittenAnswer) {
  return {
    id: answer.id,
    itemId: answer.itemId,
    content: answer.content,
    wordCount: answer.wordCount,
    charCount: answer.charCount,
    autoSavedAt: answer.autoSavedAt?.toISOString() ?? null,
    finalSubmittedAt: answer.finalSubmittedAt?.toISOString() ?? null,
  };
}

function finiteNumber(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function text(value: unknown) { return typeof value === "string" ? value : null; }

/** Project a strict allowlist from the persisted JSON snapshot for student safety. */
function studentSafeDiagnosis(value: unknown) {
  if (!isQuestionBankDiagnosis(value)) return null;
  const diagnosis = value as QuestionBankDiagnosis;
  const score = (entry: any) => ({ earnedPoints: finiteNumber(entry?.earnedPoints), maxPoints: finiteNumber(entry?.maxPoints), percentage: finiteNumber(entry?.percentage), proficiency: text(entry?.proficiency) });
  const domain = (entry: any) => ({ domain: text(entry?.domain), displayName: text(entry?.displayName), ...score(entry), itemCount: finiteNumber(entry?.itemCount), lostPoints: finiteNumber(entry?.lostPoints) });
  const family = (entry: any) => ({ family: text(entry?.family), displayName: text(entry?.displayName), domain: text(entry?.domain), domainDisplayName: text(entry?.domainDisplayName), levels: Array.isArray(entry?.levels) ? entry.levels.filter((level: unknown) => typeof level === "string") : [], ...score(entry), itemCount: finiteNumber(entry?.itemCount), lostPoints: finiteNumber(entry?.lostPoints) });
  return {
    version: diagnosis.version,
    overall: score(diagnosis.overall),
    domains: diagnosis.domains.map(domain), families: diagnosis.families.map(family), strengths: diagnosis.strengths.map(family), priorities: diagnosis.priorities.map(family),
    retryCandidates: diagnosis.retryCandidates.map((entry) => ({ assessmentItemId: text(entry.assessmentItemId), questionVersionId: text(entry.questionVersionId), family: text(entry.family), displayName: text(entry.displayName), domain: text(entry.domain), domainDisplayName: text(entry.domainDisplayName), earned: finiteNumber(entry.earned), max: finiteNumber(entry.max) })),
    nextSteps: diagnosis.nextSteps.map((entry) => ({ family: text(entry.family), displayName: text(entry.displayName), domain: text(entry.domain), domainDisplayName: text(entry.domainDisplayName), levels: Array.isArray(entry.levels) ? entry.levels.filter((level) => typeof level === "string") : [], guidance: text(entry.guidance) })),
  };
}

export function toAssessmentReportResponse(report: AssessmentReport, options: { includeDiagnosis?: boolean } = {}) {
  const summary = report.summary && typeof report.summary === "object" && !Array.isArray(report.summary)
    ? Object.fromEntries(Object.entries(report.summary).filter(([key]) => key !== "diagnosis")) : report.summary;
  const persistedDiagnosis = report.summary && typeof report.summary === "object" && !Array.isArray(report.summary) ? report.summary.diagnosis : null;
  return {
    id: report.id,
    sessionId: report.sessionId,
    schoolId: report.schoolId,
    overallScore: report.overallScore,
    readingScore: report.readingScore,
    writtenScore: report.writtenScore,
    summary,
    recommendations: report.recommendations,
    diagnosis: options.includeDiagnosis ? studentSafeDiagnosis(persistedDiagnosis) : null,
    dataCompleteness: report.dataCompleteness,
    generatedAt: report.generatedAt?.toISOString() ?? null,
    createdAt: report.createdAt.toISOString(),
  };
}
