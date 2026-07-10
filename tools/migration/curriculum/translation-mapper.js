/**
 * Map legacy translation data to CUR-001 BilingualContent semantics.
 *
 * Rules:
 * - originalText is required and kept as-is.
 * - translation is only provided when a trustworthy source is known.
 * - If the source cannot be proven, translationSource is NONE or AUTO and
 *   reviewStatus is PENDING.
 * - AUTO or NONE translations must never be marked EXPERT_CONFIRMED.
 */

/**
 * @typedef {object} BilingualContent
 * @property {string} originalText
 * @property {string} [translation]
 * @property {string} locale
 * @property {"NONE" | "AUTO" | "EXPERT" | "COMMUNITY"} translationSource
 * @property {"PENDING" | "REVIEWED" | "EXPERT_CONFIRMED"} reviewStatus
 */

/**
 * @param {object} params
 * @param {string} params.originalText
 * @param {string} [params.translatedText]
 * @param {string} [params.locale]
 * @param {"NONE" | "AUTO" | "EXPERT" | "COMMUNITY"} [params.translationSource]
 * @param {"PENDING" | "REVIEWED" | "EXPERT_CONFIRMED"} [params.reviewStatus]
 * @returns {BilingualContent}
 */
function createBilingualContent({
  originalText,
  translatedText,
  locale = "zh-CN",
  translationSource = "NONE",
  reviewStatus = "PENDING",
}) {
  const normalizedOriginal = String(originalText ?? "").trim();
  const normalizedTranslation = translatedText
    ? String(translatedText).trim()
    : "";

  if (normalizedOriginal.length === 0) {
    throw new Error("BILINGUAL_MISSING_ORIGINAL: originalText is required");
  }

  const source = assertTranslationSource(translationSource);
  const status = assertReviewStatus(reviewStatus);

  // Defensive invariant: never allow unprovable sources to be expert confirmed.
  if (
    status === "EXPERT_CONFIRMED" &&
    (source === "AUTO" || source === "NONE")
  ) {
    throw new Error(
      `INVALID_REVIEW_STATUS: ${source} translation cannot be EXPERT_CONFIRMED`,
    );
  }

  /** @type {BilingualContent} */
  const content = {
    originalText: normalizedOriginal,
    locale,
    translationSource: source,
    reviewStatus: status,
  };

  if (normalizedTranslation.length > 0) {
    content.translation = normalizedTranslation;
  }

  return content;
}

/**
 * @param {unknown} value
 * @returns {"NONE" | "AUTO" | "EXPERT" | "COMMUNITY"}
 */
function assertTranslationSource(value) {
  if (
    value === "NONE" ||
    value === "AUTO" ||
    value === "EXPERT" ||
    value === "COMMUNITY"
  ) {
    return value;
  }
  throw new TypeError(`Unknown translationSource: ${value}`);
}

/**
 * @param {unknown} value
 * @returns {"PENDING" | "REVIEWED" | "EXPERT_CONFIRMED"}
 */
function assertReviewStatus(value) {
  if (
    value === "PENDING" ||
    value === "REVIEWED" ||
    value === "EXPERT_CONFIRMED"
  ) {
    return value;
  }
  throw new TypeError(`Unknown reviewStatus: ${value}`);
}

/**
 * Map a legacy translation entry to BilingualContent.
 *
 * @param {object} params
 * @param {string} params.originalText
 * @param {string} [params.translatedText]
 * @param {string} [params.locale]
 * @param {string} [params.legacySource] - e.g. "machine", "community", "expert"
 * @param {string} [params.legacyReviewed]
 * @returns {BilingualContent}
 */
function mapLegacyTranslation({
  originalText,
  translatedText,
  locale = "zh-CN",
  legacySource,
  legacyReviewed,
}) {
  const normalizedSource = String(legacySource ?? "").toLowerCase();
  const normalizedReviewed = String(legacyReviewed ?? "").toLowerCase();

  /** @type {"NONE" | "AUTO" | "EXPERT" | "COMMUNITY"} */
  let translationSource = "NONE";
  if (
    normalizedSource.includes("machine") ||
    normalizedSource.includes("auto")
  ) {
    translationSource = "AUTO";
  } else if (
    normalizedSource.includes("community") ||
    normalizedSource.includes("volunteer")
  ) {
    translationSource = "COMMUNITY";
  } else if (
    normalizedSource.includes("expert") ||
    normalizedSource.includes("human")
  ) {
    translationSource = "EXPERT";
  }

  // Only trust expert-confirmed when explicitly and believably stated.
  let reviewStatus = "PENDING";
  if (
    normalizedReviewed === "true" ||
    normalizedReviewed === "yes" ||
    normalizedReviewed === "approved"
  ) {
    if (translationSource === "EXPERT") {
      reviewStatus = "EXPERT_CONFIRMED";
    } else if (translationSource === "COMMUNITY") {
      reviewStatus = "REVIEWED";
    }
    // AUTO / NONE remain PENDING.
  }

  return createBilingualContent({
    originalText,
    translatedText,
    locale,
    translationSource,
    reviewStatus,
  });
}

module.exports = { createBilingualContent, mapLegacyTranslation };
