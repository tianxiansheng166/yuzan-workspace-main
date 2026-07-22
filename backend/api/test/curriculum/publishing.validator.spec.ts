import { describe, expect, it } from "vitest";
import { validateCourseVersionForPublish } from "../../src/modules/curriculum/publishing/publishing.validator.js";
import {
  activity,
  bilingualContent,
  courseVersion,
  resourceRef,
  unit,
} from "./fixtures/course-versions.js";
import {
  approvedImageResource,
  unknownCopyrightResource,
} from "./fixtures/resources.js";

describe("validateCourseVersionForPublish", () => {
  it("passes for a valid course version", () => {
    const resource = approvedImageResource();
    const version = courseVersion({
      units: [
        unit({
          lessons: [
            {
              id: "lesson-1",
              title: "课次一",
              sortOrder: 0,
              activities: [
                activity({
                  id: "activity-1",
                  sortOrder: 0,
                  resources: [resourceRef(resource.id)],
                }),
              ],
            },
          ],
        }),
      ],
    });

    const result = validateCourseVersionForPublish(version, {
      resourcesById: new Map([[resource.id, resource]]),
    });

    expect(result.ok).toBe(true);
  });

  it("fails when title is missing", () => {
    const version = courseVersion({ title: "" });
    const result = validateCourseVersionForPublish(version, {
      resourcesById: new Map(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "title", code: "MISSING_TITLE" }),
        ]),
      );
    }
  });

  it("fails when learning objectives are missing", () => {
    const version = courseVersion({ objectives: [] });
    const result = validateCourseVersionForPublish(version, {
      resourcesById: new Map(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "objectives",
            code: "MISSING_OBJECTIVES",
          }),
        ]),
      );
    }
  });

  it("fails when language field is missing", () => {
    const version = courseVersion({
      locale: "",
      units: [unit()],
    });
    const result = validateCourseVersionForPublish(version, {
      resourcesById: new Map(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "locale",
            code: "MISSING_LANGUAGE",
          }),
        ]),
      );
    }
  });

  it("fails for empty activity", () => {
    const version = courseVersion({
      units: [
        unit({
          lessons: [
            {
              id: "lesson-1",
              title: "课次一",
              sortOrder: 0,
              activities: [
                activity({
                  id: "activity-1",
                  sortOrder: 0,
                  content: undefined,
                  instruction: undefined,
                  teacherNotes: undefined,
                  studentNotes: undefined,
                  resources: [],
                }),
              ],
            },
          ],
        }),
      ],
    });

    const result = validateCourseVersionForPublish(version, {
      resourcesById: new Map(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "units[0].lessons[0].activities[0]",
            code: "EMPTY_ACTIVITY",
          }),
        ]),
      );
    }
  });

  it("fails for duplicate ids", () => {
    const version = courseVersion({
      id: "shared-id",
      units: [
        unit({
          id: "shared-id",
          lessons: [
            {
              id: "lesson-1",
              title: "课次一",
              sortOrder: 0,
              activities: [activity({ id: "activity-1", sortOrder: 0 })],
            },
          ],
        }),
      ],
    });

    const result = validateCourseVersionForPublish(version, {
      resourcesById: new Map(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "units[0].id",
            code: "DUPLICATE_ID",
          }),
        ]),
      );
    }
  });

  it("fails for unsupported activity type", () => {
    const version = courseVersion({
      units: [
        unit({
          lessons: [
            {
              id: "lesson-1",
              title: "课次一",
              sortOrder: 0,
              activities: [
                activity({
                  id: "activity-1",
                  sortOrder: 0,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  type: "INVALID_TYPE" as any,
                }),
              ],
            },
          ],
        }),
      ],
    });

    const result = validateCourseVersionForPublish(version, {
      resourcesById: new Map(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "units[0].lessons[0].activities[0].type",
            code: "UNSUPPORTED_ACTIVITY_TYPE",
          }),
        ]),
      );
    }
  });

  it("fails for invalid resource reference", () => {
    const version = courseVersion({
      units: [
        unit({
          lessons: [
            {
              id: "lesson-1",
              title: "课次一",
              sortOrder: 0,
              activities: [
                activity({
                  id: "activity-1",
                  sortOrder: 0,
                  resources: [resourceRef("missing-resource")],
                }),
              ],
            },
          ],
        }),
      ],
    });

    const result = validateCourseVersionForPublish(version, {
      resourcesById: new Map(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "units[0].lessons[0].activities[0].resources[0].id",
            code: "RESOURCE_NOT_FOUND",
          }),
        ]),
      );
    }
  });

  it("fails for unknown copyright status", () => {
    const resource = unknownCopyrightResource();
    const version = courseVersion({
      units: [
        unit({
          lessons: [
            {
              id: "lesson-1",
              title: "课次一",
              sortOrder: 0,
              activities: [
                activity({
                  id: "activity-1",
                  sortOrder: 0,
                  resources: [resourceRef(resource.id)],
                }),
              ],
            },
          ],
        }),
      ],
    });

    const result = validateCourseVersionForPublish(version, {
      resourcesById: new Map([[resource.id, resource]]),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "units[0].lessons[0].activities[0].resources[0].rightsStatus",
            code: "UNKNOWN_COPYRIGHT_STATUS",
          }),
        ]),
      );
    }
  });

  it("fails when auto translation is marked as expert confirmed", () => {
    const version = courseVersion({
      objectives: [
        bilingualContent({
          translationSource: "AUTO",
          reviewStatus: "EXPERT_CONFIRMED",
        }),
      ],
      units: [unit()],
    });

    const result = validateCourseVersionForPublish(version, {
      resourcesById: new Map(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "objectives[0].reviewStatus",
            code: "UNREVIEWED_TRANSLATION_CONFIRMED",
          }),
        ]),
      );
    }
  });

  it("fails for pending translation review status", () => {
    const version = courseVersion({
      objectives: [
        bilingualContent({
          reviewStatus: "PENDING",
        }),
      ],
      units: [unit()],
    });

    const result = validateCourseVersionForPublish(version, {
      resourcesById: new Map(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "objectives[0].reviewStatus",
            code: "TRANSLATION_PENDING",
          }),
        ]),
      );
    }
  });

  it("fails when image resource lacks alt text", () => {
    const resource = approvedImageResource();
    const version = courseVersion({
      units: [
        unit({
          lessons: [
            {
              id: "lesson-1",
              title: "课次一",
              sortOrder: 0,
              activities: [
                activity({
                  id: "activity-1",
                  sortOrder: 0,
                  resources: [resourceRef(resource.id, { altText: undefined })],
                }),
              ],
            },
          ],
        }),
      ],
    });

    const result = validateCourseVersionForPublish(version, {
      resourcesById: new Map([[resource.id, resource]]),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "units[0].lessons[0].activities[0].resources[0].altText",
            code: "IMAGE_MISSING_ALT_TEXT",
          }),
        ]),
      );
    }
  });

  it("fails when resource object key leaks local path", () => {
    const resource = approvedImageResource({
      objectKey: "/etc/passwd",
    });
    const version = courseVersion({
      units: [
        unit({
          lessons: [
            {
              id: "lesson-1",
              title: "课次一",
              sortOrder: 0,
              activities: [
                activity({
                  id: "activity-1",
                  sortOrder: 0,
                  resources: [
                    resourceRef(resource.id, { objectKey: resource.objectKey }),
                  ],
                }),
              ],
            },
          ],
        }),
      ],
    });

    const result = validateCourseVersionForPublish(version, {
      resourcesById: new Map([[resource.id, resource]]),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "units[0].lessons[0].activities[0].resources[0].objectKey",
            code: "LOCAL_PATH_LEAKAGE",
          }),
        ]),
      );
    }
  });
});
