/**
 * Convert legacy curriculum records to CUR-001 CourseVersion structures.
 */

const { stableId, stableNodeId } = require("./stable-id.js");
const {
  createBilingualContent,
  mapLegacyTranslation,
} = require("./translation-mapper.js");
const {
  mapLegacyAssetToResourceRef,
  containsLocalPath,
} = require("./resource-mapper.js");
const { classifyDisposition, publishEligibility } = require("./disposition.js");

/**
 * @typedef {object} ConversionResult
 * @property {object} courseVersion
 * @property {string} disposition
 * @property {string} publishEligibility
 * @property {string[]} reviewReasons
 * @property {string[]} rejectedReasons
 * @property {string} stableId
 * @property {string} sourceKey
 */

const SUPPORTED_ACTIVITY_TYPES = [
  "TEXT",
  "VIDEO",
  "AUDIO",
  "CHOICE",
  "FILL_BLANK",
  "SPEECH",
];

const MAX_TEXT_LENGTH = 10000;

/**
 * @param {object} legacyRecord
 * @param {object} options
 * @param {Map<string, object>} options.translationByCourseId
 * @param {object[]} options.localAssets
 * @param {object[]} options.externalAssets
 * @param {string} options.defaultSchoolId
 * @param {string} options.defaultAuthorUserId
 * @returns {ConversionResult}
 */
function convertCourseRecord(
  legacyRecord,
  {
    translationByCourseId,
    localAssets,
    externalAssets,
    defaultSchoolId,
    defaultAuthorUserId,
  },
) {
  const courseId = String(legacyRecord.courseId || "");
  const title = String(legacyRecord.title || "").trim();

  const sourceKey = legacyRecord.id || stableId(JSON.stringify(legacyRecord));
  const versionId = stableId(`course-version:${courseId}`, "mig002");

  /** @type {string[]} */
  const reviewReasons = [];
  /** @type {string[]} */
  const rejectedReasons = [];

  if (title.length === 0) {
    rejectedReasons.push("MISSING_TITLE");
  }

  if (courseId.length === 0) {
    rejectedReasons.push("MISSING_COURSE_ID");
  }

  const reusable = legacyRecord.primaryDisposition === "REUSE";
  if (!reusable) {
    rejectedReasons.push(
      `NON_REUSABLE_DISPOSITION:${legacyRecord.primaryDisposition}`,
    );
  }

  // Map status conservatively: never infer PUBLISHED without auditable evidence.
  const status = "DRAFT";
  if (legacyRecord.requiresVersionConfirmation) {
    reviewReasons.push("REQUIRES_VERSION_CONFIRMATION");
  }

  const locale = "zh-CN";
  const translatedTitle = translationByCourseId.has(courseId)
    ? translationByCourseId.get(courseId).title
    : undefined;

  const titleContent = mapLegacyTranslation({
    originalText: title || "[missing title]",
    translatedText: translatedTitle,
    locale,
    legacySource: translationByCourseId.has(courseId) ? "community" : undefined,
    legacyReviewed: "false",
  });

  const gradeBand = buildGradeBand(legacyRecord.grade, legacyRecord.gradeLevel);

  // Objectives from theme and cultural tags if available.
  const objectives = buildObjectives(legacyRecord, locale);

  // Structure generation from outline hints or fallback placeholder.
  const structureResult = buildCourseStructure(
    courseId,
    legacyRecord,
    localAssets,
    externalAssets,
    locale,
  );

  reviewReasons.push(...structureResult.reviewReasons);
  rejectedReasons.push(...structureResult.rejectedReasons);

  const hasCriticalError = rejectedReasons.length > 0;
  const hasReviewFlag = reviewReasons.length > 0;
  const hasTranslationIssue =
    titleContent.reviewStatus === "PENDING" &&
    titleContent.translationSource !== "NONE";
  const hasRightsIssue = structureResult.resourceRefs.some(
    (ref) => ref.rightsStatus === "UNKNOWN" || ref.rightsStatus === "REJECTED",
  );

  const disposition = classifyDisposition({
    reusable,
    hasCriticalError,
    hasReviewFlag,
    hasTranslationIssue,
    hasRightsIssue,
  });

  const now = new Date("2026-01-01T00:00:00.000Z");

  const descriptionContent = buildDescription(legacyRecord, locale);

  const courseVersion = {
    id: versionId,
    schoolId: defaultSchoolId,
    courseId,
    authorUserId: defaultAuthorUserId,
    version: 1,
    status,
    title: titleContent.originalText,
    description: descriptionContent,
    gradeBand,
    locale,
    objectives,
    units: structureResult.units,
    createdAt: now,
    updatedAt: now,
  };

  // Validate structure IDs for duplicates within the course.
  const duplicateIds = findDuplicateIds(courseVersion);
  if (duplicateIds.length > 0) {
    rejectedReasons.push(`DUPLICATE_IDS:${duplicateIds.join(",")}`);
  }

  const validationErrors = validateBasicStructure(courseVersion);
  if (validationErrors.length > 0) {
    reviewReasons.push(...validationErrors.map((e) => e.code));
  }

  const finalDisposition = classifyDisposition({
    reusable,
    hasCriticalError: rejectedReasons.length > 0,
    hasReviewFlag: reviewReasons.length > 0,
    hasTranslationIssue,
    hasRightsIssue,
  });

  return {
    courseVersion,
    disposition: finalDisposition,
    publishEligibility: publishEligibility(
      finalDisposition,
      validationErrors.length === 0 && !hasRightsIssue,
    ),
    reviewReasons,
    rejectedReasons,
    stableId: versionId,
    sourceKey,
  };
}

/**
 * @param {object} record
 * @param {string} locale
 * @returns {object[]}
 */
function buildObjectives(record, locale) {
  const objectives = [];

  const theme = String(record.theme || "").trim();
  const tags = Array.isArray(record.culturalTags) ? record.culturalTags : [];

  if (theme.length > 0) {
    objectives.push(
      mapLegacyTranslation({
        originalText: `理解并讨论${theme}相关主题`,
        locale,
        legacySource: undefined,
        legacyReviewed: "false",
      }),
    );
  }

  if (tags.length > 0) {
    objectives.push(
      mapLegacyTranslation({
        originalText: `认识文化元素：${tags.join("、")}`,
        locale,
        legacySource: undefined,
        legacyReviewed: "false",
      }),
    );
  }

  if (objectives.length === 0) {
    objectives.push(
      mapLegacyTranslation({
        originalText: "完成课程学习并掌握核心内容",
        locale,
        legacySource: undefined,
        legacyReviewed: "false",
      }),
    );
  }

  return objectives;
}

/**
 * @param {object} record
 * @param {string} locale
 * @returns {object | undefined}
 */
function buildDescription(record, locale) {
  const parts = [];
  if (record.level) parts.push(`层级：${record.level}`);
  if (record.gradeLevel) parts.push(`学段：${record.gradeLevel}`);
  if (record.theme) parts.push(`主题：${record.theme}`);

  if (parts.length === 0) {
    return undefined;
  }

  const content = mapLegacyTranslation({
    originalText: parts.join("；"),
    locale,
    legacySource: undefined,
    legacyReviewed: "false",
  });
  return content.originalText;
}

/**
 * @param {number|string} grade
 * @param {string} gradeLevel
 * @returns {string}
 */
function buildGradeBand(grade, gradeLevel) {
  if (typeof grade === "number") {
    return `grade-${grade}`;
  }
  if (gradeLevel) {
    return String(gradeLevel).replace(/\s+/g, "-");
  }
  return "unknown";
}

/**
 * @param {string} courseId
 * @param {object} record
 * @param {object[]} localAssets
 * @param {object[]} externalAssets
 * @param {string} locale
 * @returns {object}
 */
function buildCourseStructure(
  courseId,
  record,
  localAssets,
  externalAssets,
  locale,
) {
  const reviewReasons = [];
  const rejectedReasons = [];
  const resourceRefs = [];

  const outlineHeadings = Array.isArray(
    record.curriculumStructureHints?.outlineHeadings,
  )
    ? record.curriculumStructureHints.outlineHeadings
    : [];

  const unitHeadings = outlineHeadings.filter((h) =>
    String(h).includes("单元"),
  );

  if (unitHeadings.length === 0) {
    reviewReasons.push("NO_UNIT_STRUCTURE");
  }

  /** @type {object[]} */
  const units = [];

  if (unitHeadings.length > 0) {
    for (let i = 0; i < unitHeadings.length; i += 1) {
      const heading = String(unitHeadings[i]).trim();
      const unitId = stableNodeId(courseId, "unit", `${i}`);
      const parsed = parseUnitHeading(heading);

      const lessons = [];
      if (parsed.hours > 0) {
        // Generate a single representative lesson; real lesson breakdown is unknown.
        const lessonId = stableNodeId(courseId, "lesson", `${i}:0`);
        lessons.push({
          id: lessonId,
          title: mapLegacyTranslation({
            originalText: `${parsed.name}（概览）`,
            locale,
            legacySource: undefined,
            legacyReviewed: "false",
          }).originalText,
          sortOrder: 0,
          activities: [
            buildOverviewActivity(courseId, i, 0, parsed.name, locale),
          ],
        });
      } else {
        lessons.push({
          id: stableNodeId(courseId, "lesson", `${i}:0`),
          title: mapLegacyTranslation({
            originalText: `${parsed.name}`,
            locale,
            legacySource: undefined,
            legacyReviewed: "false",
          }).originalText,
          sortOrder: 0,
          activities: [
            buildOverviewActivity(courseId, i, 0, parsed.name, locale),
          ],
        });
      }

      units.push({
        id: unitId,
        title: mapLegacyTranslation({
          originalText: parsed.name,
          locale,
          legacySource: undefined,
          legacyReviewed: "false",
        }).originalText,
        sortOrder: i,
        lessons,
      });
    }
  } else {
    // Fallback: one placeholder unit/lesson/activity so structure is not empty.
    const unitId = stableNodeId(courseId, "unit", "placeholder");
    const lessonId = stableNodeId(courseId, "lesson", "placeholder:0");
    const activityId = stableNodeId(courseId, "activity", "placeholder:0:0");

    units.push({
      id: unitId,
      title: mapLegacyTranslation({
        originalText: "默认单元",
        locale,
        legacySource: undefined,
        legacyReviewed: "false",
      }).originalText,
      sortOrder: 0,
      lessons: [
        {
          id: lessonId,
          title: mapLegacyTranslation({
            originalText: "默认课次",
            locale,
            legacySource: undefined,
            legacyReviewed: "false",
          }).originalText,
          sortOrder: 0,
          activities: [
            {
              id: activityId,
              type: "TEXT",
              title: mapLegacyTranslation({
                originalText: "课程内容待补充",
                locale,
                legacySource: undefined,
                legacyReviewed: "false",
              }).originalText,
              instruction: mapLegacyTranslation({
                originalText: "请补充本课程内容",
                locale,
                legacySource: undefined,
                legacyReviewed: "false",
              }),
              sortOrder: 0,
              required: false,
              resources: [],
              teacherNotes: mapLegacyTranslation({
                originalText: "教师说明待补充",
                locale,
                legacySource: undefined,
                legacyReviewed: "false",
              }),
              studentNotes: mapLegacyTranslation({
                originalText: "学生说明待补充",
                locale,
                legacySource: undefined,
                legacyReviewed: "false",
              }),
            },
          ],
        },
      ],
    });
  }

  // Attach local cover assets if they match the course title.
  const matchedLocalAssets = matchLocalAssets(record, localAssets);
  for (const asset of matchedLocalAssets) {
    const ref = mapLegacyAssetToResourceRef(asset);
    if (ref) {
      resourceRefs.push(ref);
      if (ref.rightsStatus === "UNKNOWN") {
        reviewReasons.push("UNKNOWN_RESOURCE_RIGHTS");
      }
      if (ref.kind === "IMAGE" && !ref.altText) {
        reviewReasons.push("IMAGE_MISSING_ALT");
      }
    }
  }

  // Attach first external asset as demo reference if no local assets matched.
  if (resourceRefs.length === 0 && externalAssets.length > 0) {
    const ref = mapLegacyAssetToResourceRef(externalAssets[0]);
    if (ref) {
      resourceRefs.push(ref);
      reviewReasons.push("EXTERNAL_RESOURCE_REFERENCE");
      if (ref.rightsStatus === "UNKNOWN") {
        reviewReasons.push("UNKNOWN_RESOURCE_RIGHTS");
      }
      if (ref.kind === "IMAGE" && !ref.altText) {
        reviewReasons.push("IMAGE_MISSING_ALT");
      }
    }
  }

  // Distribute resource refs to the first activity of each unit.
  if (resourceRefs.length > 0) {
    for (const unit of units) {
      const firstActivity = unit.lessons[0]?.activities[0];
      if (firstActivity) {
        firstActivity.resources = resourceRefs.slice(0, 1);
      }
    }
  }

  return { units, reviewReasons, rejectedReasons, resourceRefs };
}

/**
 * @param {string} courseId
 * @param {number} unitIndex
 * @param {number} lessonIndex
 * @param {string} unitName
 * @param {string} locale
 * @returns {object}
 */
function buildOverviewActivity(
  courseId,
  unitIndex,
  lessonIndex,
  unitName,
  locale,
) {
  return {
    id: stableNodeId(courseId, "activity", `${unitIndex}:${lessonIndex}:0`),
    type: "TEXT",
    title: mapLegacyTranslation({
      originalText: `${unitName} 学习导引`,
      locale,
      legacySource: undefined,
      legacyReviewed: "false",
    }).originalText,
    instruction: mapLegacyTranslation({
      originalText: `了解${unitName}的核心学习目标`,
      locale,
      legacySource: undefined,
      legacyReviewed: "false",
    }),
    sortOrder: 0,
    required: true,
    resources: [],
    teacherNotes: mapLegacyTranslation({
      originalText: "教师可在此补充教学重点",
      locale,
      legacySource: undefined,
      legacyReviewed: "false",
    }),
    studentNotes: mapLegacyTranslation({
      originalText: "学生可在此记录学习要点",
      locale,
      legacySource: undefined,
      legacyReviewed: "false",
    }),
  };
}

/**
 * @param {string} heading
 * @returns {{ name: string; hours: number }}
 */
function parseUnitHeading(heading) {
  const text = String(heading).trim();
  const match = text.match(
    /单元[一二三四五六七八九十\d]+[：:]\s*(.+?)(?:（|\(|\d+|$)/,
  );
  const name = match ? match[1].trim() : text;
  const hoursMatch = text.match(/(\d+)\s*课时/);
  const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
  return { name, hours };
}

/**
 * @param {object} record
 * @param {object[]} localAssets
 * @returns {object[]}
 */
function matchLocalAssets(record, localAssets) {
  const title = String(record.title || "").trim();
  if (title.length === 0) {
    return [];
  }
  return localAssets.filter((asset) => {
    const path = String(asset.relativePath || "").toLowerCase();
    const lowerTitle = title.toLowerCase();
    // Match only when the whole title appears in the asset path.
    return path.includes(lowerTitle);
  });
}

/**
 * @param {object} courseVersion
 * @returns {string[]}
 */
function findDuplicateIds(courseVersion) {
  const ids = new Set();
  const duplicates = new Set();

  const track = (id) => {
    if (ids.has(id)) {
      duplicates.add(id);
    } else {
      ids.add(id);
    }
  };

  track(courseVersion.id);
  for (const unit of courseVersion.units) {
    track(unit.id);
    for (const lesson of unit.lessons) {
      track(lesson.id);
      for (const activity of lesson.activities) {
        track(activity.id);
      }
    }
  }

  return Array.from(duplicates).sort();
}

/**
 * @param {object} courseVersion
 * @returns {object[]}
 */
function validateBasicStructure(courseVersion) {
  const errors = [];

  if (!courseVersion.title || courseVersion.title.trim().length === 0) {
    errors.push({ code: "MISSING_TITLE", message: "课程标题为空" });
  }

  if (!courseVersion.locale || courseVersion.locale.trim().length === 0) {
    errors.push({ code: "MISSING_LANGUAGE", message: "缺少课程语言" });
  }

  if (courseVersion.objectives.length === 0) {
    errors.push({ code: "MISSING_OBJECTIVES", message: "缺少学习目标" });
  }

  if (courseVersion.units.length === 0) {
    errors.push({ code: "EMPTY_UNITS", message: "课程没有单元" });
  }

  for (const [unitIndex, unit] of courseVersion.units.entries()) {
    if (unit.sortOrder !== unitIndex) {
      errors.push({
        code: "INVALID_SORT_ORDER",
        message: `单元 ${unit.id} 顺序错误`,
      });
    }
    if (unit.lessons.length === 0) {
      errors.push({
        code: "EMPTY_LESSONS",
        message: `单元 ${unit.id} 没有课次`,
      });
    }
    for (const [lessonIndex, lesson] of unit.lessons.entries()) {
      if (lesson.sortOrder !== lessonIndex) {
        errors.push({
          code: "INVALID_SORT_ORDER",
          message: `课次 ${lesson.id} 顺序错误`,
        });
      }
      if (lesson.activities.length === 0) {
        errors.push({
          code: "EMPTY_ACTIVITIES",
          message: `课次 ${lesson.id} 没有活动`,
        });
      }
      for (const [activityIndex, activity] of lesson.activities.entries()) {
        if (activity.sortOrder !== activityIndex) {
          errors.push({
            code: "INVALID_SORT_ORDER",
            message: `活动 ${activity.id} 顺序错误`,
          });
        }
        if (!SUPPORTED_ACTIVITY_TYPES.includes(activity.type)) {
          errors.push({
            code: "UNSUPPORTED_ACTIVITY_TYPE",
            message: `活动类型不支持: ${activity.type}`,
          });
        }
        if (!activity.teacherNotes?.originalText) {
          errors.push({
            code: "MISSING_TEACHER_NOTES",
            message: `活动 ${activity.id} 缺少教师说明`,
          });
        }
        if (!activity.studentNotes?.originalText) {
          errors.push({
            code: "MISSING_STUDENT_NOTES",
            message: `活动 ${activity.id} 缺少学生说明`,
          });
        }
      }
    }
  }

  return errors;
}

module.exports = {
  convertCourseRecord,
  buildObjectives,
  buildCourseStructure,
  findDuplicateIds,
  validateBasicStructure,
  MAX_TEXT_LENGTH,
};
