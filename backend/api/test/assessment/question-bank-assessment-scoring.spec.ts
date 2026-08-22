import { describe, expect, it, vi } from "vitest";
import { AssessmentService } from "../../src/modules/assessment/assessment.service.js";
import type { AssessmentSession } from "../../src/modules/assessment/domain/assessment.types.js";
import { toAssessmentItemResponse } from "../../src/modules/assessment/dto/assessment-session.response.js";

const now = new Date("2026-08-23T00:00:00.000Z");

function session(status: AssessmentSession["status"]): AssessmentSession {
  return {
    id: "session-qb-005",
    schoolId: "school-qb-005",
    enrollmentId: "enrollment-qb-005",
    classId: "class-qb-005",
    initiatorUserId: "student-qb-005",
    type: "MIXED",
    status,
    startedAt: now,
    submittedAt: now,
    completedAt: null,
    retestOfSessionId: null,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function makeService(rawItems: unknown[]) {
  const current = session("SUBMITTED");
  const sessionRepo = {
    findByIdAndSchool: vi.fn(async () => current),
    updateStatus: vi.fn(async (_id: string, status: AssessmentSession["status"], extra?: Partial<AssessmentSession>) => ({ ...current, ...extra, status })),
  };
  const reportRepo = {
    findBySessionId: vi.fn(async () => null),
    create: vi.fn(async (data: Record<string, unknown>) => ({
      id: "report-qb-005",
      sessionId: data.sessionId as string,
      schoolId: data.schoolId as string,
      overallScore: (data.overallScore as number | undefined) ?? null,
      readingScore: (data.readingScore as number | undefined) ?? null,
      writtenScore: (data.writtenScore as number | undefined) ?? null,
      summary: (data.summary as Record<string, unknown>) ?? null,
      recommendations: null,
      dataCompleteness: data.dataCompleteness as number,
      generatedAt: now,
      generatedByUserId: null,
      createdAt: now,
      updatedAt: now,
    })),
  };
  const prisma = {
    assessmentItem: { findMany: vi.fn(async () => rawItems) },
  };
  const scorer = { scoreSession: vi.fn(async () => undefined) };
  const service = new AssessmentService(
    sessionRepo as any,
    {} as any,
    {} as any,
    reportRepo as any,
    prisma as any,
    scorer as any,
  );
  return { service, sessionRepo, reportRepo, scorer };
}

function qbItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-qb-005",
    questionVersionId: "version-qb-005",
    itemType: "TEXT",
    maxScore: 5,
    scoredScore: null,
    recordingId: null,
    speechJobs: [],
    ...overrides,
  };
}

describe("Question Bank assessment scoring integration", () => {
  it("does not expose scoring fields while the session is still answerable", () => {
    const response = toAssessmentItemResponse({
      id: "item-qb-005",
      sessionId: "session-qb-005",
      questionId: null,
      questionVersionId: "version-qb-005",
      recordingId: null,
      prompt: { text: "student-safe" },
      itemType: "CHOICE",
      status: "ANSWERED",
      sortOrder: 1,
      maxScore: 3,
      scoredScore: 3,
      autoResult: { state: "AUTO_SCORED", score: 3 },
      reviewerUserId: null,
      reviewerComment: null,
      reviewedAt: null,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    }, { includeScoring: false });

    expect(response.scoredScore).toBeNull();
    expect(response.autoResult).toBeNull();
  });

  it("keeps a partial Question Bank session processing and creates no report", async () => {
    const { service, sessionRepo, reportRepo, scorer } = makeService([
      qbItem({ itemType: "CHOICE", maxScore: 3, scoredScore: 3 }),
      qbItem({ id: "item-rubric", maxScore: 8, scoredScore: null }),
      qbItem({ id: "item-speech", itemType: "SPEECH", maxScore: 4, scoredScore: null, recordingId: "recording-qb", speechJobs: [{ recordingId: "recording-qb", status: "AUTO_RESULT" }] }),
    ]);

    await expect(service.finalizeAutomaticReportFromSpeechJob("school-qb-005", "session-qb-005")).resolves.toBeNull();
    expect(scorer.scoreSession).toHaveBeenCalledWith("session-qb-005");
    expect(sessionRepo.updateStatus).toHaveBeenCalledWith("session-qb-005", "PROCESSING");
    expect(reportRepo.create).not.toHaveBeenCalled();
  });

  it("uses point aggregation for a complete Question Bank report", async () => {
    const { service, sessionRepo, reportRepo } = makeService([
      qbItem({ id: "item-choice", itemType: "CHOICE", maxScore: 3, scoredScore: 2 }),
      qbItem({ id: "item-speech", itemType: "SPEECH", maxScore: 4, scoredScore: 3, recordingId: "recording-qb", speechJobs: [{ recordingId: "recording-qb", status: "AUTO_RESULT" }] }),
    ]);

    const response = await service.finalizeAutomaticReportFromSpeechJob("school-qb-005", "session-qb-005");
    expect(response).toMatchObject({ overallScore: 5, readingScore: 3, writtenScore: 2 });
    expect(reportRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      overallScore: 5,
      summary: expect.objectContaining({ aggregation: "POINTS", awardedPoints: 5, totalMaxPoints: 7 }),
    }));
    expect(sessionRepo.updateStatus).toHaveBeenCalledWith("session-qb-005", "COMPLETED", expect.objectContaining({ completedAt: expect.any(Date) }));
  });

  it("keeps legacy report aggregation behavior when no question version is present", async () => {
    const { service, reportRepo } = makeService([
      { id: "legacy-1", questionVersionId: null, itemType: "READING", maxScore: 100, scoredScore: 80, recordingId: "recording-legacy", speechJobs: [{ recordingId: "recording-legacy", status: "AUTO_RESULT" }] },
      { id: "legacy-2", questionVersionId: null, itemType: "READING", maxScore: 100, scoredScore: 60, recordingId: "recording-legacy-2", speechJobs: [{ recordingId: "recording-legacy-2", status: "AUTO_RESULT" }] },
    ]);

    const response = await service.finalizeAutomaticReportFromSpeechJob("school-qb-005", "session-qb-005");
    expect(response).toMatchObject({ overallScore: 70, readingScore: 70 });
    expect(reportRepo.create).toHaveBeenCalledWith(expect.objectContaining({ overallScore: 70 }));
    const data = reportRepo.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect((data.summary as Record<string, unknown>).aggregation).toBeUndefined();
  });
});
