/**
 * Disposition classification for migrated records.
 *
 * Each converted record receives exactly one primary disposition:
 * CONVERTED, REVIEW, REJECTED, or SKIPPED.
 */

const DISPOSITIONS = Object.freeze([
  "CONVERTED",
  "REVIEW",
  "REJECTED",
  "SKIPPED",
]);

const ELIGIBILITY = Object.freeze([
  "ELIGIBLE",
  "NOT_ELIGIBLE",
  "REVIEW_REQUIRED",
]);

/**
 * @param {string} value
 * @returns {value is (typeof DISPOSITIONS)[number]}
 */
function isValidDisposition(value) {
  return DISPOSITIONS.includes(value);
}

/**
 * Decide disposition from conversion flags.
 *
 * @param {object} params
 * @param {boolean} params.reusable
 * @param {boolean} params.hasCriticalError
 * @param {boolean} params.hasReviewFlag
 * @param {boolean} params.hasTranslationIssue
 * @param {boolean} params.hasRightsIssue
 * @returns {typeof DISPOSITIONS[number]}
 */
function classifyDisposition({
  reusable,
  hasCriticalError,
  hasReviewFlag,
  hasTranslationIssue,
  hasRightsIssue,
}) {
  if (!reusable || hasCriticalError) {
    return "REJECTED";
  }

  if (hasReviewFlag || hasTranslationIssue || hasRightsIssue) {
    return "REVIEW";
  }

  return "CONVERTED";
}

/**
 * Map disposition to publish eligibility.
 *
 * @param {string} disposition
 * @param {boolean} validationOk
 * @returns {typeof ELIGIBILITY[number]}
 */
function publishEligibility(disposition, validationOk) {
  if (disposition === "CONVERTED" && validationOk) {
    return "ELIGIBLE";
  }
  if (disposition === "REVIEW") {
    return "REVIEW_REQUIRED";
  }
  return "NOT_ELIGIBLE";
}

module.exports = {
  DISPOSITIONS,
  ELIGIBILITY,
  isValidDisposition,
  classifyDisposition,
  publishEligibility,
};
