import { randomUUID } from "node:crypto";
import type {
  Activity,
  BilingualContent,
  CourseVersion,
  CourseVersionStatus,
  Lesson,
  ResourceRef,
  Unit,
} from "../../../src/modules/curriculum/domain/course-version.types.js";

export function bilingualContent(
  overrides: Partial<BilingualContent> = {},
): BilingualContent {
  return {
    originalText: "原文示例",
    translation: "Translation example",
    locale: "zh-CN",
    translationSource: "EXPERT",
    reviewStatus: "EXPERT_CONFIRMED",
    ...overrides,
  };
}

export function resourceRef(
  resourceId: string,
  overrides: Partial<ResourceRef> = {},
): ResourceRef {
  return {
    id: resourceId,
    kind: "IMAGE",
    objectKey: "curriculum/images/sample.png",
    mediaType: "image/png",
    byteSize: 1024,
    altText: "示例图片",
    language: "zh-CN",
    source: "licensed",
    rightsStatus: "APPROVED",
    ...overrides,
  };
}

export function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: randomUUID(),
    type: "TEXT",
    title: "阅读活动",
    instruction: bilingualContent(),
    sortOrder: 0,
    required: true,
    content: { text: "阅读材料内容" },
    resources: [],
    teacherNotes: bilingualContent({
      originalText: "教师说明",
      translation: "Teacher notes",
    }),
    studentNotes: bilingualContent({
      originalText: "学生说明",
      translation: "Student notes",
    }),
    ...overrides,
  };
}

export function lesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: randomUUID(),
    title: "课次一",
    sortOrder: 0,
    activities: [activity()],
    ...overrides,
  };
}

export function unit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: randomUUID(),
    title: "单元一",
    sortOrder: 0,
    lessons: [lesson()],
    ...overrides,
  };
}

export function courseVersion(
  overrides: Partial<CourseVersion> = {},
): CourseVersion {
  const now = new Date();
  return {
    id: randomUUID(),
    schoolId: randomUUID(),
    courseId: randomUUID(),
    authorUserId: randomUUID(),
    version: 1,
    status: "DRAFT" as CourseVersionStatus,
    title: "测试课程",
    description: "课程描述",
    gradeBand: "一年级",
    locale: "zh-CN",
    objectives: [bilingualContent()],
    units: [unit()],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
