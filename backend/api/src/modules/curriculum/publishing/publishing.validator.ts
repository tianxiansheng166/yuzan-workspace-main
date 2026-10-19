import type { Resource } from "../../resources/domain/resource.types.js";
import type {
  Activity,
  ActivityType,
  BilingualContent,
  CourseVersion,
  ResourceRef,
} from "../domain/course-version.types.js";
import type { PublishValidationError } from "../domain/curriculum.errors.js";

export interface PublishingValidationContext {
  readonly resourcesById: ReadonlyMap<string, Resource>;
}

const SUPPORTED_ACTIVITY_TYPES: readonly ActivityType[] = [
  "TEXT",
  "VIDEO",
  "AUDIO",
  "CHOICE",
  "FILL_BLANK",
  "SPEECH",
];

const LOCAL_PATH_PATTERNS = [
  /^\/[a-zA-Z]:/,
  /^\\/,
  /^\/[a-zA-Z]+\//,
  /\.\./,
  /^~\//,
  /^C:\\/,
  /^\/etc\//,
  /^\/usr\//,
  /^\/home\//,
  /^\/var\//,
];

export function validateCourseVersionForPublish(
  version: CourseVersion,
  context: PublishingValidationContext,
):
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: readonly PublishValidationError[] } {
  const errors: PublishValidationError[] = [];

  validateTopLevel(version, errors);
  validateObjectives(version.objectives, errors);
  validateStructure(version, errors);
  validateResources(version, context.resourcesById, errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true };
}

function addError(
  errors: PublishValidationError[],
  path: string,
  code: string,
  message: string,
): void {
  errors.push({ path, code, message });
}

function validateTopLevel(
  version: CourseVersion,
  errors: PublishValidationError[],
): void {
  const title = version.title?.trim() ?? "";
  if (title.length === 0) {
    addError(errors, "title", "MISSING_TITLE", "课程标题不能为空");
  }

  if (version.locale?.trim().length === 0) {
    addError(errors, "locale", "MISSING_LANGUAGE", "课程语言字段不能为空");
  }
}

function validateObjectives(
  objectives: readonly BilingualContent[],
  errors: PublishValidationError[],
): void {
  if (objectives.length === 0) {
    addError(
      errors,
      "objectives",
      "MISSING_OBJECTIVES",
      "至少需要一个学习目标",
    );
    return;
  }

  for (const [index, objective] of objectives.entries()) {
    const path = `objectives[${index}]`;
    validateBilingualContent(objective, path, errors, true);
  }
}

function validateBilingualContent(
  content: BilingualContent | string | undefined,
  path: string,
  errors: PublishValidationError[],
  requireOriginal: boolean,
): void {
  if (content === undefined || content === null) {
    if (requireOriginal) {
      addError(errors, path, "MISSING_BILINGUAL_CONTENT", "缺少双语内容");
    }
    return;
  }

  if (typeof content === "string") {
    if (requireOriginal && content.trim().length === 0) {
      addError(
        errors,
        path,
        "MISSING_ORIGINAL_TEXT",
        "原文不能为空",
      );
    }
    return;
  }

  if (typeof content !== "object" || Array.isArray(content)) {
    addError(errors, path, "INVALID_BILINGUAL_CONTENT", "双语内容格式无效");
    return;
  }

  const value = content as BilingualContent;

  if (
    requireOriginal &&
    (typeof value.originalText !== "string" || value.originalText.trim().length === 0)
  ) {
    addError(
      errors,
      `${path}.originalText`,
      "MISSING_ORIGINAL_TEXT",
      "原文不能为空",
    );
  }

  if (value.originalText !== undefined && typeof value.originalText !== "string") {
    addError(errors, `${path}.originalText`, "INVALID_ORIGINAL_TEXT", "原文格式无效");
  }

  if (typeof value.locale !== "string" || value.locale.trim().length === 0) {
    addError(errors, `${path}.locale`, "MISSING_LANGUAGE", "语言字段不能为空");
  }

  if (
    value.translation !== undefined &&
    value.translation !== null &&
    typeof value.translation !== "string"
  ) {
    addError(errors, `${path}.translation`, "INVALID_TRANSLATION", "译文格式无效");
  }

  if (value.translationLocale !== undefined &&
    (typeof value.translationLocale !== "string" || !isLocaleTag(value.translationLocale))) {
    addError(errors, `${path}.translationLocale`, "INVALID_TRANSLATION_LANGUAGE", "译文语言格式无效");
  }

  if (typeof value.translation === "string" && value.translation.trim().length > 0 && !value.translationLocale) {
    addError(errors, `${path}.translationLocale`, "MISSING_TRANSLATION_LANGUAGE", "译文目标语言不能为空");
  }

  if (!(["NONE", "AUTO", "EXPERT", "COMMUNITY"] as const).includes(value.translationSource)) {
    addError(errors, `${path}.translationSource`, "INVALID_TRANSLATION_SOURCE", "译文来源无效");
  }

  if (!(["PENDING", "REVIEWED", "EXPERT_CONFIRMED"] as const).includes(value.reviewStatus)) {
    addError(errors, `${path}.reviewStatus`, "INVALID_TRANSLATION_REVIEW_STATUS", "译文审核状态无效");
  }

  if (value.reviewStatus === "PENDING") {
    addError(
      errors,
      `${path}.reviewStatus`,
      "TRANSLATION_PENDING",
      "翻译仍处于 pending 状态，无法发布",
    );
  }

  if (
    value.reviewStatus === "EXPERT_CONFIRMED" &&
    value.translationSource === "AUTO"
  ) {
    addError(
      errors,
      `${path}.reviewStatus`,
      "UNREVIEWED_TRANSLATION_CONFIRMED",
      "自动生成的翻译不能标记为专家确认",
    );
  }

  if (
    value.reviewStatus === "EXPERT_CONFIRMED" &&
    value.translationSource === "NONE"
  ) {
    addError(
      errors,
      `${path}.reviewStatus`,
      "UNREVIEWED_TRANSLATION_CONFIRMED",
      "无来源的翻译不能标记为专家确认",
    );
  }
}

function isLocaleTag(value: string): boolean {
  return /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value.trim());
}

function validateStructure(
  version: CourseVersion,
  errors: PublishValidationError[],
): void {
  const ids = new Set<string>();
  const duplicates: string[] = [];

  const trackId = (id: string, path: string): void => {
    if (ids.has(id)) {
      duplicates.push(id);
      addError(errors, `${path}.id`, "DUPLICATE_ID", `标识符重复: ${id}`);
    } else {
      ids.add(id);
    }
  };

  trackId(version.id, "id");

  if (version.units.length === 0) {
    addError(errors, "units", "MISSING_UNITS", "课程至少需要一个单元");
  }

  for (const [unitIndex, unit] of version.units.entries()) {
    const unitPath = `units[${unitIndex}]`;
    trackId(unit.id, unitPath);

    if (unit.title.trim().length === 0) {
      addError(
        errors,
        `${unitPath}.title`,
        "MISSING_UNIT_TITLE",
        "单元标题不能为空",
      );
    }

    if (unit.sortOrder !== unitIndex) {
      addError(
        errors,
        `${unitPath}.sortOrder`,
        "INVALID_SORT_ORDER",
        `单元顺序应为 ${unitIndex}，实际为 ${unit.sortOrder}`,
      );
    }

    if (unit.lessons.length === 0) {
      addError(
        errors,
        `${unitPath}.lessons`,
        "MISSING_LESSONS",
        `单元 ${unit.title} 至少需要一课次`,
      );
    }

    for (const [lessonIndex, lesson] of unit.lessons.entries()) {
      const lessonPath = `${unitPath}.lessons[${lessonIndex}]`;
      trackId(lesson.id, lessonPath);

      if (lesson.title.trim().length === 0) {
        addError(
          errors,
          `${lessonPath}.title`,
          "MISSING_LESSON_TITLE",
          "课次标题不能为空",
        );
      }

      if (lesson.sortOrder !== lessonIndex) {
        addError(
          errors,
          `${lessonPath}.sortOrder`,
          "INVALID_SORT_ORDER",
          `课次顺序应为 ${lessonIndex}，实际为 ${lesson.sortOrder}`,
        );
      }

      if (lesson.activities.length === 0) {
        addError(
          errors,
          `${lessonPath}.activities`,
          "MISSING_ACTIVITIES",
          `课次 ${lesson.title} 至少需要一个活动`,
        );
      }

      for (const [activityIndex, activity] of lesson.activities.entries()) {
        const activityPath = `${lessonPath}.activities[${activityIndex}]`;
        validateActivity(activity, activityPath, errors);
        trackId(activity.id, activityPath);

        if (activity.sortOrder !== activityIndex) {
          addError(
            errors,
            `${activityPath}.sortOrder`,
            "INVALID_SORT_ORDER",
            `活动顺序应为 ${activityIndex}，实际为 ${activity.sortOrder}`,
          );
        }
      }
    }
  }
}

function validateActivity(
  activity: Activity,
  path: string,
  errors: PublishValidationError[],
): void {
  if (activity.title.trim().length === 0) {
    addError(
      errors,
      `${path}.title`,
      "MISSING_ACTIVITY_TITLE",
      "活动标题不能为空",
    );
  }

  if (!SUPPORTED_ACTIVITY_TYPES.includes(activity.type)) {
    addError(
      errors,
      `${path}.type`,
      "UNSUPPORTED_ACTIVITY_TYPE",
      `不支持的活动类型: ${activity.type}`,
    );
  }

  const hasContent =
    activity.content !== undefined &&
    activity.content !== null &&
    (typeof activity.content !== "object" ||
      Object.keys(activity.content as object).length > 0);
  const hasResources = activity.resources.length > 0;
  const hasInstruction =
    activity.instruction && activity.instruction.originalText.trim().length > 0;
  const hasNotes =
    (activity.teacherNotes &&
      activity.teacherNotes.originalText.trim().length > 0) ||
    (activity.studentNotes &&
      activity.studentNotes.originalText.trim().length > 0);

  if (!hasContent && !hasResources && !hasInstruction && !hasNotes) {
    addError(
      errors,
      path,
      "EMPTY_ACTIVITY",
      `活动 ${activity.title} 缺少内容、资源、说明或笔记`,
    );
  }

  validateBilingualContent(
    activity.instruction,
    `${path}.instruction`,
    errors,
    false,
  );
  validateBilingualContent(
    activity.teacherNotes,
    `${path}.teacherNotes`,
    errors,
    false,
  );
  validateBilingualContent(
    activity.studentNotes,
    `${path}.studentNotes`,
    errors,
    false,
  );

  if (
    !activity.teacherNotes ||
    activity.teacherNotes.originalText.trim().length === 0
  ) {
    addError(
      errors,
      `${path}.teacherNotes`,
      "MISSING_TEACHER_NOTES",
      `活动 ${activity.title} 缺少教师说明`,
    );
  }

  if (
    !activity.studentNotes ||
    activity.studentNotes.originalText.trim().length === 0
  ) {
    addError(
      errors,
      `${path}.studentNotes`,
      "MISSING_STUDENT_NOTES",
      `活动 ${activity.title} 缺少学生说明`,
    );
  }
}

function validateResources(
  version: CourseVersion,
  resourcesById: ReadonlyMap<string, Resource>,
  errors: PublishValidationError[],
): void {
  for (const unit of version.units) {
    for (const lesson of unit.lessons) {
      for (const activity of lesson.activities) {
        for (const [resourceIndex, ref] of activity.resources.entries()) {
          const path = `units[${version.units.indexOf(unit)}].lessons[${unit.lessons.indexOf(lesson)}].activities[${lesson.activities.indexOf(activity)}].resources[${resourceIndex}]`;
          validateResourceRef(ref, path, resourcesById, errors);
        }
      }
    }
  }
}

function validateResourceRef(
  ref: ResourceRef,
  path: string,
  resourcesById: ReadonlyMap<string, Resource>,
  errors: PublishValidationError[],
): void {
  const existing = resourcesById.get(ref.id);

  if (!existing) {
    addError(
      errors,
      `${path}.id`,
      "RESOURCE_NOT_FOUND",
      `引用的资源不存在: ${ref.id}`,
    );
    return;
  }

  if (existing.rightsStatus === "UNKNOWN") {
    addError(
      errors,
      `${path}.rightsStatus`,
      "UNKNOWN_COPYRIGHT_STATUS",
      `资源 ${ref.id} 的版权状态未知`,
    );
  }

  if (existing.rightsStatus === "REJECTED") {
    addError(
      errors,
      `${path}.rightsStatus`,
      "REJECTED_COPYRIGHT_STATUS",
      `资源 ${ref.id} 的版权未通过`,
    );
  }

  if (ref.mediaType.trim().length === 0) {
    addError(
      errors,
      `${path}.mediaType`,
      "MISSING_MEDIA_TYPE",
      "资源 MIME 类型不能为空",
    );
  }

  if (ref.byteSize <= 0) {
    addError(
      errors,
      `${path}.byteSize`,
      "INVALID_RESOURCE_SIZE",
      "资源大小必须大于 0",
    );
  }

  if (
    ref.kind === "IMAGE" &&
    (!ref.altText || ref.altText.trim().length === 0)
  ) {
    addError(
      errors,
      `${path}.altText`,
      "IMAGE_MISSING_ALT_TEXT",
      `图片资源 ${ref.id} 缺少 alt text`,
    );
  }

  if (LOCAL_PATH_PATTERNS.some((pattern) => pattern.test(ref.objectKey))) {
    addError(
      errors,
      `${path}.objectKey`,
      "LOCAL_PATH_LEAKAGE",
      "资源 key 包含本地路径，存在信息泄露风险",
    );
  }
}
