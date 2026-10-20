import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const practiceSource = readFileSync(
  new URL("../../assessment/assets/practice.js", import.meta.url),
  "utf8",
);
const tick = () => new Promise((resolve) => setTimeout(resolve, 30));

const identity = { schoolId: "school-fixture-a", userId: "student-fixture-a" };
const practice = {
  id: "definition-fixture-t081",
  title: "T081 TEST_FIXTURE_ONLY",
  summary: "TEST_FIXTURE_ONLY",
  gradeBand: "四年级",
  difficulty: "基础",
  estimatedMinutes: 10,
  abilityCategories: ["阅读理解"],
  cultureTags: [],
  catalogType: "SPECIALIZED",
  mode: "SELF_PRACTICE",
  itemTypes: ["SINGLE_CHOICE"],
  studentState: { completionStatus: "NOT_STARTED", favorite: false },
  recommendationReason: "TEST_FIXTURE_ONLY",
  sections: [{ title: "阅读", itemCount: 1 }],
  oralItemCount: 0,
  writtenItemCount: 1,
  requiresRecording: false,
  scoringDisclosure: "TEST_FIXTURE_ONLY",
};

function attempt(id, overrides = {}) {
  return {
    id,
    schoolId: identity.schoolId,
    enrollmentId: "enrollment-fixture-a",
    initiatorUserId: identity.userId,
    practiceDefinitionId: practice.id,
    courseSubmissionId: null,
    courseActivityId: null,
    status: "IN_PROGRESS",
    createdAt: "2026-10-18T08:00:00.000Z",
    updatedAt: "2026-10-18T08:00:00.000Z",
    ...overrides,
  };
}

async function mountCatalog({ attempts, currentIdentity = { ...identity }, afterAttemptRead } = {}) {
  const root = { innerHTML: "" };
  const attemptsById = new Map(attempts.map((item) => [item.id, item]));
  let createCalls = 0;
  const api = {
    getToken: () => `TEST_FIXTURE_ONLY:${currentIdentity.userId}`,
    getActiveSchoolId: () => currentIdentity.schoolId,
    getStoredUser: () => ({ id: currentIdentity.userId }),
    listPractices: async () => ({
      items: [practice],
      facets: {},
      total: 1,
      nextCursor: null,
    }),
    listAssignedRemediations: async () => ({ items: [] }),
    listAssessmentSessions: async () => ({
      items: attempts.map(({ id, status }) => ({ id, status })),
      nextCursor: null,
      hasMore: false,
    }),
    getPracticeAttempt: async (id) => {
      const result = attemptsById.get(id);
      await afterAttemptRead?.(id);
      return result;
    },
    createOrResumePractice: async () => {
      createCalls += 1;
      return { attemptId: "unexpected-new-attempt" };
    },
  };
  const document = {
    body: { dataset: { practicePage: "catalog" } },
    querySelector: (selector) => (selector === "#app" ? root : null),
    querySelectorAll: () => [],
  };
  const context = vm.createContext({
    YuzanApi: api,
    URLSearchParams,
    console,
    setTimeout,
    clearTimeout,
    location: { pathname: "/student/practices/", search: "" },
    document,
    window: { YuzanApi: api, addEventListener() {} },
  });
  vm.runInContext(practiceSource, context, {
    filename: "frontend/assessment/assets/practice.js",
  });
  await tick();
  return { html: root.innerHTML, createCalls };
}

test("older standalone Attempt wins over a newer course-linked Attempt", async () => {
  const standalone = attempt("standalone-older", {
    updatedAt: "2026-10-18T08:00:00.000Z",
  });
  const courseLinked = attempt("course-linked-newer", {
    courseSubmissionId: "submission-fixture-a",
    courseActivityId: "activity-fixture-a",
    updatedAt: "2026-10-19T08:00:00.000Z",
  });
  const catalog = await mountCatalog({ attempts: [standalone, courseLinked] });

  assert.match(catalog.html, /\/student\/practices\/attempts\/standalone-older\/runner\//);
  assert.doesNotMatch(catalog.html, /\/student\/practices\/attempts\/course-linked-newer\//);
  assert.equal(catalog.createCalls, 0);
});

test("a course-linked Attempt alone is not resumed from the standalone catalog", async () => {
  const catalog = await mountCatalog({
    attempts: [
      attempt("course-linked-only", {
        courseSubmissionId: "submission-fixture-only",
        courseActivityId: "activity-fixture-only",
      }),
    ],
  });

  assert.doesNotMatch(catalog.html, /\/student\/practices\/attempts\/course-linked-only\//);
  assert.equal(catalog.createCalls, 0);
});

test("an Attempt with missing course scope is not assumed to be standalone", async () => {
  const missingScope = attempt("unknown-scope-attempt");
  delete missingScope.courseSubmissionId;
  const catalog = await mountCatalog({ attempts: [missingScope] });

  assert.doesNotMatch(catalog.html, /\/student\/practices\/attempts\/unknown-scope-attempt\//);
  assert.equal(catalog.createCalls, 0);
});

test("a valid standalone Attempt resumes with its original Attempt ID", async () => {
  const catalog = await mountCatalog({ attempts: [attempt("standalone-same-id")] });

  assert.match(catalog.html, /\/student\/practices\/attempts\/standalone-same-id\/runner\//);
  assert.equal(catalog.createCalls, 0);
});

test("an Attempt from another school or student identity is not resumed", async () => {
  const wrongSchool = attempt("other-school-attempt", {
    schoolId: "school-fixture-other",
    updatedAt: "2026-10-19T08:00:00.000Z",
  });
  const wrongStudent = attempt("other-student-attempt", {
    initiatorUserId: "student-fixture-other",
    updatedAt: "2026-10-20T08:00:00.000Z",
  });
  const wrongDefinition = attempt("other-definition-attempt", {
    practiceDefinitionId: "definition-fixture-other",
    updatedAt: "2026-10-21T08:00:00.000Z",
  });
  const catalog = await mountCatalog({ attempts: [wrongSchool, wrongStudent, wrongDefinition] });

  assert.doesNotMatch(catalog.html, /\/student\/practices\/attempts\/(?:other-school|other-student|other-definition)-attempt\//);
  assert.equal(catalog.createCalls, 0);
});

test("an identity change while Attempt reads are in flight discards the stale result", async () => {
  const currentIdentity = { ...identity };
  const staleAttempt = attempt("identity-switched-attempt");
  const catalog = await mountCatalog({
    attempts: [staleAttempt],
    currentIdentity,
    afterAttemptRead: async () => {
      currentIdentity.schoolId = "school-fixture-switched";
    },
  });

  assert.doesNotMatch(catalog.html, /\/student\/practices\/attempts\/identity-switched-attempt\//);
  assert.equal(catalog.createCalls, 0);
});
