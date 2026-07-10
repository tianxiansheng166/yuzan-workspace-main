"use strict";

/**
 * MIG-002 curriculum and bilingual content converter.
 *
 * Reads MIG-001 outputs and produces deterministic, privacy-safe CUR-001
 * CourseVersion structures, review items, rejected items and reports.
 */

const { resolve } = require("node:path");
const { loadMig001Inputs } = require("./load-mig-001.js");
const { convertCourseRecord } = require("./course-converter.js");
const { scanForPii } = require("./pii-scanner.js");
const { writeJsonFile, writeTextFile, toCsv } = require("./output-writer.js");
const { guardPath } = require("./path-guard.js");
const { createHash } = require("node:crypto");
const { readFile } = require("node:fs/promises");

const DEFAULT_OUTPUT_ROOTS = {
  exports: "legacy/exports",
  review: "legacy/review",
  reports: "legacy/reports",
};

const DEFAULT_SCHOOL_ID = "platform-migration";
const DEFAULT_AUTHOR_USER_ID = "system-migration";

/**
 * @param {string} projectRoot
 * @param {object} [options]
 * @param {boolean} [options.dryRun=false]
 * @param {string} [options.schoolId]
 * @param {string} [options.authorUserId]
 * @returns {Promise<object>}
 */
async function runMigration(projectRoot, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const schoolId = options.schoolId || DEFAULT_SCHOOL_ID;
  const authorUserId = options.authorUserId || DEFAULT_AUTHOR_USER_ID;

  const root = resolve(projectRoot);

  // Verify output roots are inside the project and not symlinks.
  const exportRoot = await guardPath(
    resolve(root, DEFAULT_OUTPUT_ROOTS.exports),
    root,
  );
  const reviewRoot = await guardPath(
    resolve(root, DEFAULT_OUTPUT_ROOTS.review),
    root,
  );
  const reportRoot = await guardPath(
    resolve(root, DEFAULT_OUTPUT_ROOTS.reports),
    root,
  );

  const inputs = await loadMig001Inputs(root);

  const translationByCourseId = buildTranslationLookup(inputs.translations);
  const localAssets = Array.isArray(inputs.media.localAssets)
    ? inputs.media.localAssets
    : [];
  const externalAssets = Array.isArray(inputs.media.externalAssets)
    ? inputs.media.externalAssets
    : [];

  const records = Array.isArray(inputs.courses.curriculumRecords)
    ? inputs.courses.curriculumRecords
    : [];

  // Sort records deterministically by courseId.
  const sortedRecords = records
    .slice()
    .sort((a, b) => String(a.courseId).localeCompare(String(b.courseId)));

  /** @type {ConversionResult[]} */
  const converted = [];
  /** @type {object[]} */
  const reviewItems = [];
  /** @type {object[]} */
  const rejectedItems = [];
  /** @type {object[]} */
  const skippedItems = [];

  for (const record of sortedRecords) {
    const result = convertCourseRecord(record, {
      translationByCourseId,
      localAssets,
      externalAssets,
      defaultSchoolId: schoolId,
      defaultAuthorUserId: authorUserId,
    });

    if (result.disposition === "CONVERTED") {
      converted.push(result);
    } else if (result.disposition === "REVIEW") {
      reviewItems.push(result);
    } else if (result.disposition === "REJECTED") {
      rejectedItems.push(result);
    } else {
      skippedItems.push(result);
    }
  }

  const stats = buildStats(
    sortedRecords,
    converted,
    reviewItems,
    rejectedItems,
    skippedItems,
  );

  const convertedVersions = converted.map((r) => r.courseVersion);
  const reviewVersions = reviewItems.map((r) => r.courseVersion);
  const allVersions = [...convertedVersions, ...reviewVersions];

  const exportJson = {
    metadata: {
      taskId: "MIG-002",
      schemaVersion: "2026-07-10",
      deterministicByInput: true,
      sourceFingerprint: inputs.courses.metadata?.sourceTreeFingerprint || "",
      recordCount: sortedRecords.length,
    },
    converted: convertedVersions,
    reviewRequired: reviewVersions,
  };

  const reviewJson = {
    metadata: {
      taskId: "MIG-002",
      schemaVersion: "2026-07-10",
      reviewItemCount: reviewItems.length,
    },
    items: reviewItems.map(toReviewItem),
  };

  const rejectedJson = {
    metadata: {
      taskId: "MIG-002",
      schemaVersion: "2026-07-10",
      rejectedCount: rejectedItems.length,
    },
    items: rejectedItems.map(toRejectedItem),
  };

  const validationJson = {
    metadata: {
      taskId: "MIG-002",
      schemaVersion: "2026-07-10",
    },
    results: allVersions.map((version) => ({
      id: version.id,
      courseId: version.courseId,
      title: version.title,
      publishEligibility:
        converted.find((c) => c.courseVersion.id === version.id)
          ?.publishEligibility ||
        reviewItems.find((r) => r.courseVersion.id === version.id)
          ?.publishEligibility ||
        "NOT_ELIGIBLE",
    })),
  };

  const summaryJson = {
    metadata: {
      taskId: "MIG-002",
      schemaVersion: "2026-07-10",
      deterministicByInput: true,
    },
    stats,
    dispositionCounts: {
      CONVERTED: converted.length,
      REVIEW: reviewItems.length,
      REJECTED: rejectedItems.length,
      SKIPPED: skippedItems.length,
    },
  };

  const piiFindings = scanForPii({
    converted: convertedVersions,
    review: reviewJson.items,
    rejected: rejectedJson.items,
  });

  summaryJson.piiScan = {
    findingCount: piiFindings.length,
    findings: piiFindings.map((f) => ({
      rule: f.rule,
      severity: f.severity,
      path: f.path,
    })),
  };

  const handoffMd = buildHandoffMarkdown(
    stats,
    converted.length,
    reviewItems.length,
    rejectedItems.length,
    skippedItems.length,
    piiFindings.length,
  );

  const outputPlan = {
    exportJsonPath: resolve(exportRoot, "mig-002-curriculum.json"),
    exportCsvPath: resolve(exportRoot, "mig-002-curriculum.csv"),
    reviewJsonPath: resolve(reviewRoot, "mig-002-curriculum-review.json"),
    reviewCsvPath: resolve(reviewRoot, "mig-002-curriculum-review.csv"),
    rejectedJsonPath: resolve(reportRoot, "mig-002-rejected.json"),
    validationJsonPath: resolve(reportRoot, "mig-002-validation.json"),
    summaryJsonPath: resolve(reportRoot, "mig-002-summary.json"),
    handoffMdPath: resolve(reportRoot, "mig-002-handoff.md"),
  };

  if (!dryRun) {
    await writeJsonFile(outputPlan.exportJsonPath, exportJson, root);
    await writeTextFile(
      outputPlan.exportCsvPath,
      toCsv(
        buildExportRows(
          allVersions,
          new Map(
            [...converted, ...reviewItems].map((r) => [
              r.courseVersion.id,
              r.publishEligibility,
            ]),
          ),
        ),
        [
          "stableId",
          "sourceKey",
          "courseId",
          "title",
          "status",
          "locale",
          "unitCount",
          "lessonCount",
          "activityCount",
          "resourceCount",
          "publishEligibility",
        ],
      ),
      root,
    );
    await writeJsonFile(outputPlan.reviewJsonPath, reviewJson, root);
    await writeTextFile(
      outputPlan.reviewCsvPath,
      toCsv(reviewJson.items, [
        "stableId",
        "sourceKey",
        "courseId",
        "disposition",
        "path",
        "reasonCode",
      ]),
      root,
    );
    await writeJsonFile(outputPlan.rejectedJsonPath, rejectedJson, root);
    await writeJsonFile(outputPlan.validationJsonPath, validationJson, root);
    await writeJsonFile(outputPlan.summaryJsonPath, summaryJson, root);
    await writeTextFile(outputPlan.handoffMdPath, handoffMd, root);
  }

  return {
    dryRun,
    stats,
    dispositionCounts: summaryJson.dispositionCounts,
    piiFindingCount: piiFindings.length,
    outputPaths: dryRun ? {} : outputPlan,
  };
}

/**
 * @param {object} translations
 * @returns {Map<string, { title: string; locale: string }>}
 */
function buildTranslationLookup(translations) {
  const map = new Map();
  const coverage = Array.isArray(translations.courseTranslationCoverage)
    ? translations.courseTranslationCoverage
    : [];

  for (const entry of coverage) {
    if (entry.hasBoTranslation && entry.courseId) {
      map.set(entry.courseId, { title: "", locale: "bo-CN" });
    }
  }

  // We do not have actual Tibetan titles in MIG-001 exports; mark as needing review.
  return map;
}

/**
 * @param {object[]} records
 * @param {ConversionResult[]} converted
 * @param {ConversionResult[]} reviewItems
 * @param {ConversionResult[]} rejectedItems
 * @param {ConversionResult[]} skippedItems
 * @returns {object}
 */
function buildStats(
  records,
  converted,
  reviewItems,
  rejectedItems,
  skippedItems,
) {
  let unitCount = 0;
  let lessonCount = 0;
  let activityCount = 0;
  let bilingualFieldCount = 0;
  let resourceRefCount = 0;

  const countBilingual = (content) => {
    if (content && typeof content === "object" && "originalText" in content) {
      bilingualFieldCount += 1;
    }
  };

  for (const result of [...converted, ...reviewItems]) {
    const version = result.courseVersion;
    unitCount += version.units.length;

    for (const unit of version.units) {
      lessonCount += unit.lessons.length;
      countBilingual(unit.title);

      for (const lesson of unit.lessons) {
        activityCount += lesson.activities.length;
        countBilingual(lesson.title);

        for (const activity of lesson.activities) {
          countBilingual(activity.title);
          countBilingual(activity.instruction);
          countBilingual(activity.teacherNotes);
          countBilingual(activity.studentNotes);
          resourceRefCount += activity.resources?.length || 0;
        }
      }
    }

    bilingualFieldCount += version.objectives.length;
    if (version.description) {
      bilingualFieldCount += 1;
    }
  }

  return {
    totalRecordCount: records.length,
    courseCount: records.length,
    versionCount: converted.length + reviewItems.length,
    unitCount,
    lessonCount,
    activityCount,
    bilingualFieldCount,
    resourceRefCount,
    missingRightsCount: countMissingRights(converted, reviewItems),
    missingAltCount: countMissingAlt(converted, reviewItems),
    unmappedStatusCount: 0,
    unmappedLocaleCount: 0,
  };
}

/**
 * @param {ConversionResult[]} converted
 * @param {ConversionResult[]} reviewItems
 * @returns {number}
 */
function countMissingRights(converted, reviewItems) {
  let count = 0;
  for (const result of [...converted, ...reviewItems]) {
    for (const unit of result.courseVersion.units) {
      for (const lesson of unit.lessons) {
        for (const activity of lesson.activities) {
          for (const resource of activity.resources || []) {
            if (resource.rightsStatus === "UNKNOWN") {
              count += 1;
            }
          }
        }
      }
    }
  }
  return count;
}

/**
 * @param {ConversionResult[]} converted
 * @param {ConversionResult[]} reviewItems
 * @returns {number}
 */
function countMissingAlt(converted, reviewItems) {
  let count = 0;
  for (const result of [...converted, ...reviewItems]) {
    for (const unit of result.courseVersion.units) {
      for (const lesson of unit.lessons) {
        for (const activity of lesson.activities) {
          for (const resource of activity.resources || []) {
            if (resource.kind === "IMAGE" && !resource.altText) {
              count += 1;
            }
          }
        }
      }
    }
  }
  return count;
}

/**
 * @param {ConversionResult} result
 * @returns {object}
 */
function toReviewItem(result) {
  return {
    stableId: result.stableId,
    sourceKey: result.sourceKey,
    courseId: result.courseVersion.courseId,
    title: result.courseVersion.title,
    disposition: result.disposition,
    publishEligibility: result.publishEligibility,
    path: `course:${result.courseVersion.courseId}`,
    reasonCode: result.reviewReasons.join("; ") || "REVIEW_REQUIRED",
    reasons: result.reviewReasons,
  };
}

/**
 * @param {ConversionResult} result
 * @returns {object}
 */
function toRejectedItem(result) {
  return {
    stableId: result.stableId,
    sourceKey: result.sourceKey,
    courseId: result.courseVersion.courseId,
    title: result.courseVersion.title,
    disposition: result.disposition,
    path: `course:${result.courseVersion.courseId}`,
    reasonCode: result.rejectedReasons.join("; ") || "REJECTED",
    reasons: result.rejectedReasons,
  };
}

/**
 * @param {object[]} versions
 * @param {Map<string, string>} eligibilityById
 * @returns {object[]}
 */
function buildExportRows(versions, eligibilityById) {
  return versions.map((version) => {
    let unitCount = 0;
    let lessonCount = 0;
    let activityCount = 0;
    let resourceCount = 0;

    for (const unit of version.units) {
      unitCount += 1;
      for (const lesson of unit.lessons) {
        lessonCount += 1;
        for (const activity of lesson.activities) {
          activityCount += 1;
          resourceCount += activity.resources?.length || 0;
        }
      }
    }

    return {
      stableId: version.id,
      sourceKey: version.courseId,
      courseId: version.courseId,
      title: version.title,
      status: version.status,
      locale: version.locale,
      unitCount,
      lessonCount,
      activityCount,
      resourceCount,
      publishEligibility: eligibilityById.get(version.id) || "NOT_ELIGIBLE",
    };
  });
}

/**
 * @param {object} stats
 * @param {number} convertedCount
 * @param {number} reviewCount
 * @param {number} rejectedCount
 * @param {number} skippedCount
 * @param {number} piiFindingCount
 * @returns {string}
 */
function buildHandoffMarkdown(
  stats,
  convertedCount,
  reviewCount,
  rejectedCount,
  skippedCount,
  piiFindingCount,
) {
  return `# MIG-002 Handoff

## Summary

- Total records: ${stats.totalRecordCount}
- Converted: ${convertedCount}
- Review required: ${reviewCount}
- Rejected: ${rejectedCount}
- Skipped: ${skippedCount}

## Structure counts

- Courses: ${stats.courseCount}
- Versions: ${stats.versionCount}
- Units: ${stats.unitCount}
- Lessons: ${stats.lessonCount}
- Activities: ${stats.activityCount}
- Bilingual fields: ${stats.bilingualFieldCount}
- Resource references: ${stats.resourceRefCount}

## Quality flags

- Missing rights: ${stats.missingRightsCount}
- Missing alt text: ${stats.missingAltCount}
- PII scan findings: ${piiFindingCount}

## Decisions

- All records mapped to DRAFT; no legacy status inferred as PUBLISHED without
  auditable evidence.
- Tibetan translations marked PENDING because MIG-001 exports do not include
  audited Tibetan course titles.
- Local media assets referenced, not copied. Copyright status defaulted to
  UNKNOWN where unverified.
- No external URLs downloaded.

## Next steps

- Independent migration review.
- MIG-003 media body and rights ledger integration.
- Real repository import after GOV-002/GOV-003 persistence is ready.
`;
}

/**
 * Compute SHA-256 hash of a file.
 *
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function fileSha256(filePath) {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

module.exports = { runMigration, fileSha256 };

if (require.main === module) {
  (async () => {
    const positionalArgs = process.argv
      .slice(2)
      .filter((arg) => !arg.startsWith("-"));
    const projectRoot = positionalArgs[0] || ".";
    const dryRun = process.argv.includes("--dry-run");

    try {
      const result = await runMigration(projectRoot, { dryRun });
      process.stdout.write(
        JSON.stringify(
          {
            ok: true,
            dryRun: result.dryRun,
            dispositionCounts: result.dispositionCounts,
            stats: result.stats,
            piiFindingCount: result.piiFindingCount,
          },
          null,
          2,
        ) + "\n",
      );
    } catch (err) {
      process.stderr.write(String(err) + "\n");
      process.exit(1);
    }
  })();
}
