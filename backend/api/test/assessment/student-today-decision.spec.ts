import { describe, expect, it } from "vitest";
import {
  buildStudentTodayDecision,
  type StudentTodayAttempt,
  type StudentTodayDecisionInput,
} from "../../src/modules/student-dashboard/student-today-decision.js";

const attempt = (
  overrides: Partial<StudentTodayAttempt> = {},
): StudentTodayAttempt => ({
  id: "attempt-1",
  status: "IN_PROGRESS",
  createdAt: "2026-08-24T01:00:00.000Z",
  updatedAt: "2026-08-24T01:05:00.000Z",
  itemCount: 4,
  practiceTitle: null,
  focusDisplayName: "朗读句子",
  ...overrides,
});

const base = (
  overrides: Partial<StudentTodayDecisionInput> = {},
): StudentTodayDecisionInput => ({
  teacherActionable: [],
  teacherWaiting: [],
  selfActionable: [],
  standardActionable: [],
  latestFormal: null,
  baselinePractice: null,
  legacyTasks: [],
  ...overrides,
});

describe("Student Today decision view", () => {
  it("uses the published baseline practice for a new student", () => {
    const result = buildStudentTodayDecision(
      base({
        baselinePractice: {
          practiceDefinitionId: "level-one",
          title: "水平一级",
        },
      }),
    );
    expect(result.primaryAction).toMatchObject({
      kind: "BASELINE",
      cta: "开始第一次测评",
      target: { practiceDefinitionId: "level-one" },
    });
  });

  it("prioritizes a teacher-assigned actionable remediation", () => {
    const result = buildStudentTodayDecision(
      base({
        teacherActionable: [attempt({ id: "teacher-1", status: "CREATED" })],
      }),
    );
    expect(result.primaryAction).toMatchObject({
      kind: "TEACHER_REMEDIATION",
      title: "老师布置的朗读句子专项巩固",
      reason: "老师给你布置了 4 道「朗读句子」巩固题。",
    });
  });

  it("keeps teacher review waiting while recommending an actionable self task", () => {
    const result = buildStudentTodayDecision(
      base({
        teacherWaiting: [
          attempt({ id: "teacher-waiting", status: "PROCESSING" }),
        ],
        selfActionable: [attempt({ id: "self-1" })],
      }),
    );
    expect(result.primaryAction).toMatchObject({
      kind: "RESUME_REMEDIATION",
      target: { href: "/student/practices/attempts/self-1/runner/" },
    });
    expect(result.waiting).toMatchObject([
      { kind: "TEACHER_REVIEW", reason: "这项练习正在等待老师复核。" },
    ]);
  });

  it("keeps waiting copy family-neutral for non-reading remediation", () => {
    const result = buildStudentTodayDecision(
      base({
        teacherWaiting: [
          attempt({
            id: "picture-waiting",
            focusDisplayName: "看图说话",
            status: "PROCESSING",
          }),
        ],
      }),
    );
    expect(result.waiting[0]).toMatchObject({
      title: "看图说话专项巩固",
      reason: "这项练习正在等待老师复核。",
    });
    expect(result.waiting[0]?.reason).not.toContain("朗读");
  });

  it("resumes an existing self remediation before creating a new one", () => {
    const result = buildStudentTodayDecision(
      base({
        selfActionable: [attempt({ id: "existing-self" })],
        latestFormal: {
          sessionId: "formal-1",
          level: "水平一级",
          score: 72,
          completedAt: "2026-08-23T01:00:00.000Z",
          priorityDisplayName: "朗读句子",
          retryCandidateCount: 2,
        },
      }),
    );
    expect(result.primaryAction).toMatchObject({
      kind: "RESUME_REMEDIATION",
      target: { href: "/student/practices/attempts/existing-self/runner/" },
    });
  });

  it("turns a persisted diagnosis with retry candidates into a start action", () => {
    const result = buildStudentTodayDecision(
      base({
        latestFormal: {
          sessionId: "formal-1",
          level: "水平一级",
          score: 72,
          completedAt: "2026-08-23T01:00:00.000Z",
          priorityDisplayName: "朗读句子",
          retryCandidateCount: 2,
        },
      }),
    );
    expect(result.primaryAction).toMatchObject({
      kind: "START_REMEDIATION",
      title: "巩固上次测评中的薄弱项",
      reason: "上次测评中「朗读句子」建议优先练习。",
      target: { sourceSessionId: "formal-1" },
    });
  });

  it("uses a neutral practice-center action when no retry candidates remain", () => {
    const result = buildStudentTodayDecision(
      base({
        latestFormal: {
          sessionId: "formal-1",
          level: "水平一级",
          score: 91,
          completedAt: "2026-08-23T01:00:00.000Z",
          priorityDisplayName: null,
          retryCandidateCount: 0,
        },
      }),
    );
    expect(result.primaryAction).toMatchObject({
      kind: "CONTINUE_PRACTICE",
      target: { href: "/student/practices/" },
    });
    expect(result.primaryAction?.reason).not.toMatch(/必须|重测/);
  });

  it("keeps a legacy course assignment reachable when it is the only fact", () => {
    const task = {
      assignmentId: "assignment-1",
      title: "真实课程任务",
      courseTitle: "真实课程",
      dueAt: "2026-08-25T10:00:00.000Z",
      status: "OPEN",
      progressPercent: 25,
      hasOfflinePackage: false,
    };
    const result = buildStudentTodayDecision(base({ legacyTasks: [task] }));
    expect(result.primaryAction).toMatchObject({
      kind: "LEGACY_ASSIGNMENT",
      target: { href: "/student/learn/spring-2?assignmentId=assignment-1" },
    });
    expect(result.legacyTasks).toEqual([task]);
  });

  it("is deterministic for the same facts and has no sensitive payload keys", () => {
    const input = base({
      teacherActionable: [
        attempt({ id: "teacher-b", createdAt: "2026-08-24T02:00:00.000Z" }),
        attempt({ id: "teacher-a", createdAt: "2026-08-24T01:00:00.000Z" }),
      ],
      latestFormal: {
        sessionId: "formal-1",
        level: "水平一级",
        score: 72,
        completedAt: "2026-08-23T01:00:00.000Z",
        priorityDisplayName: "朗读句子",
        retryCandidateCount: 2,
      },
    });
    const first = buildStudentTodayDecision(input);
    const second = buildStudentTodayDecision(input);
    expect(second).toEqual(first);
    const forbidden =
      /correctAnswer|referenceAnswer|acceptedAnswers|scoringSpec|rubric|deductionRules|sourceTrace|providerAudit|rawResponse|transcript|candidatePoints/;
    expect(JSON.stringify(first)).not.toMatch(forbidden);
  });
});
