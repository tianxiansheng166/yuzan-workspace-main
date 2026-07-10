/**
 * Convert legacy media references to CUR-001 ResourceRef structures.
 *
 * MIG-002 only converts references; it does not copy media files.
 */

const { stableId } = require("./stable-id.js");

const SUPPORTED_MEDIA_TYPES = {
  PNG: "image/png",
  JPG: "image/jpeg",
  JPEG: "image/jpeg",
  MP4: "video/mp4",
  WEBVTT: "text/vtt",
  PDF: "application/pdf",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const LOCAL_PATH_PATTERNS = [
  /^\//,
  /^\\/,
  /\.\./,
  /^~/,
  /^C:\\/,
  /^file:\/\//i,
];

/**
 * @typedef {object} ResourceRef
 * @property {string} id
 * @property {"IMAGE" | "AUDIO" | "VIDEO" | "DOCUMENT" | "SUBTITLE" | "OTHER"} kind
 * @property {string} objectKey
 * @property {string} [uri]
 * @property {string} mediaType
 * @property {number} byteSize
 * @property {string} [altText]
 * @property {string} [language]
 * @property {string} [source]
 * @property {"UNKNOWN" | "RESTRICTED" | "APPROVED" | "REJECTED"} rightsStatus
 * @property {string} [rightsNote]
 */

/**
 * @param {object} legacyAsset
 * @returns {ResourceRef | null}
 */
function mapLegacyAssetToResourceRef(legacyAsset) {
  const id = legacyAsset.id || stableId(JSON.stringify(legacyAsset));
  const relativePath = String(legacyAsset.relativePath || "");
  const pathHint = String(legacyAsset.pathHint || "");
  const domain = String(legacyAsset.domain || "");
  const isExternal = Boolean(legacyAsset.isExternal || domain.length > 0);

  const sourceValue = isExternal
    ? `https://${domain}${pathHint.startsWith("/") ? pathHint : `/${pathHint}`}`
    : relativePath;

  if (containsLocalPath(sourceValue)) {
    return null;
  }

  const kind = detectKind(legacyAsset.mediaCategory, legacyAsset.fileType);
  const mediaType = detectMediaType(legacyAsset.fileType);
  const byteSize = Number.isFinite(legacyAsset.sizeBytes)
    ? legacyAsset.sizeBytes
    : 0;

  const rightsStatus = mapRightsStatus(legacyAsset.rightsStatus);

  /** @type {ResourceRef} */
  const ref = {
    id,
    kind,
    objectKey: buildSafeObjectKey(id, kind, sourceValue),
    mediaType,
    byteSize,
    rightsStatus,
  };

  if (isExternal) {
    ref.uri = sourceValue;
    ref.source = "external-cdn";
  } else if (relativePath.length > 0) {
    ref.source = "legacy-local-asset";
  }

  if (legacyAsset.altText) {
    ref.altText = String(legacyAsset.altText);
  }

  if (legacyAsset.language) {
    ref.language = String(legacyAsset.language);
  }

  const noteParts = [];
  if (legacyAsset.legacyCategory) {
    noteParts.push(`legacyCategory=${legacyAsset.legacyCategory}`);
  }
  if (legacyAsset.suggestedDisposition) {
    noteParts.push(`suggestedDisposition=${legacyAsset.suggestedDisposition}`);
  }
  if (noteParts.length > 0) {
    ref.rightsNote = noteParts.join("; ");
  }

  return ref;
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function containsLocalPath(value) {
  return LOCAL_PATH_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * @param {string} id
 * @param {string} kind
 * @param {string} sourceValue
 * @returns {string}
 */
function buildSafeObjectKey(id, kind, sourceValue) {
  // Strip any absolute path, URL protocol, or traversal so the key is safe.
  const normalized = sourceValue
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/^(\/|\\|~\/|[a-z]:\\)/i, "")
    .replace(/\.\./g, "")
    .replace(/[\\]+/g, "/")
    .replace(/^\/+/, "")
    .replace(/\s+/g, "-")
    .toLowerCase();

  if (normalized.length === 0) {
    return `mig002/${kind}/${id}.bin`;
  }

  return `mig002/${kind}/${normalized}`;
}

/**
 * @param {string} [mediaCategory]
 * @param {string} [fileType]
 */
function detectKind(mediaCategory, fileType) {
  const category = String(mediaCategory || "").toLowerCase();
  const type = String(fileType || "").toLowerCase();

  if (category.includes("video") || type.includes("mp4")) return "VIDEO";
  if (
    category.includes("audio") ||
    type.includes("mp3") ||
    type.includes("wav")
  )
    return "AUDIO";
  if (category.includes("subtitle") || type.includes("vtt")) return "SUBTITLE";
  if (
    category.includes("image") ||
    type.includes("png") ||
    type.includes("jpg")
  )
    return "IMAGE";
  if (
    category.includes("document") ||
    type.includes("pdf") ||
    type.includes("docx")
  )
    return "DOCUMENT";
  return "OTHER";
}

/**
 * @param {string} [fileType]
 * @returns {string}
 */
function detectMediaType(fileType) {
  const type = String(fileType || "").toUpperCase();
  return SUPPORTED_MEDIA_TYPES[type] || "application/octet-stream";
}

/**
 * @param {string} [legacyRights]
 * @returns {"UNKNOWN" | "RESTRICTED" | "APPROVED" | "REJECTED"}
 */
function mapRightsStatus(legacyRights) {
  const normalized = String(legacyRights || "").toLowerCase();
  if (normalized === "approved") return "APPROVED";
  if (normalized === "restricted" || normalized === "unverified")
    return "UNKNOWN";
  if (normalized === "rejected" || normalized === "copyright_blocked")
    return "REJECTED";
  return "UNKNOWN";
}

module.exports = {
  mapLegacyAssetToResourceRef,
  buildSafeObjectKey,
  containsLocalPath,
  detectKind,
  detectMediaType,
  mapRightsStatus,
};
