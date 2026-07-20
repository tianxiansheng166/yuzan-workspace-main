import type { AssessmentSession, AssessmentItem, AssessmentReport, WrittenAnswer } from "../domain/assessment.types.js";

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

export function toAssessmentItemResponse(item: AssessmentItem) {
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
    scoredScore: item.scoredScore,
    autoResult: item.autoResult,
    reviewerUserId: item.reviewerUserId,
    reviewedAt: item.reviewedAt?.toISOString() ?? null,
  };
}

export function toReadingItemResponse(item: AssessmentItem & { questionPrompt?: Record<string, unknown>; demoAudioUrl?: string | null }) {
  return {
    id: item.id,
    sessionId: item.sessionId,
    prompt: item.prompt,
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

export function toAssessmentReportResponse(report: AssessmentReport) {
  return {
    id: report.id,
    sessionId: report.sessionId,
    schoolId: report.schoolId,
    overallScore: report.overallScore,
    readingScore: report.readingScore,
    writtenScore: report.writtenScore,
    summary: report.summary,
    recommendations: report.recommendations,
    dataCompleteness: report.dataCompleteness,
    generatedAt: report.generatedAt?.toISOString() ?? null,
    createdAt: report.createdAt.toISOString(),
  };
}
