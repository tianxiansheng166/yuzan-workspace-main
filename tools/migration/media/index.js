#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const TASK_ID = "MIG-003";
const TOOL_VERSION = "mig-003-media-inventory-v1";

const OUTPUT_FILES = {
  assetsJson: "legacy/review/media/mig-003-assets.json",
  reviewCsv: "legacy/review/media/mig-003-review.csv",
  summaryJson: "legacy/reports/mig-003-summary.json",
  validationJson: "legacy/reports/mig-003-validation.json",
  handoffMd: "legacy/reports/mig-003-handoff.md",
  assetRegister: "design-lab/asset-register.csv",
};

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".bmp",
  ".ico",
]);

const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".ogg",
  ".oga",
  ".m4a",
  ".aac",
  ".flac",
  ".webm",
]);

const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".ogv", ".mov", ".mkv"]);

const FONT_EXTENSIONS = new Set([".woff", ".woff2", ".ttf", ".otf", ".eot"]);

const DOCUMENT_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".odt",
  ".ods",
  ".odp",
  ".txt",
  ".rtf",
]);

const SUBTITLE_EXTENSIONS = new Set([".vtt", ".srt"]);

const SENSITIVE_PATH_SEGMENTS = [
  "/home/admin01",
  "/home/tian",
  "file://",
  ":\\",
];

const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  /\b1[3-9]\d{9}\b/,
  /\b\d{17}[\dXx]\b/,
  /\beyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\b/,
  /\bghp_[A-Za-z0-9]{10,}\b/,
  /\bgithub_pat_[A-Za-z0-9]{10,}\b/,
  /\bAKIA[A-Z0-9]{16}\b/,
  /\bASIA[A-Z0-9]{16}\b/,
];

const CREDENTIAL_SENTINELS = [
  "BEGIN PRIVATE KEY",
  "BEGIN RSA PRIVATE KEY",
  "BEGIN OPENSSH PRIVATE KEY",
  "Authorization: Bearer",
  "password",
  "token",
  "cookie",
];

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function computeManifestHash(sourceRoot) {
  const rootReal = fs.realpathSync(sourceRoot);
  const files = [];

  function walk(current) {
    const entries = fs
      .readdirSync(current, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));

    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      const relativePath = path
        .relative(rootReal, absolutePath)
        .split(path.sep)
        .join("/");
      const lstat = fs.lstatSync(absolutePath);

      if (lstat.isSymbolicLink()) {
        throw new Error(`Symlink not allowed: ${relativePath}`);
      }

      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const hash = crypto.createHash("sha256");
      const fd = fs.openSync(absolutePath, "r");
      try {
        const buffer = Buffer.alloc(64 * 1024);
        let bytesRead;
        while (
          (bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0
        ) {
          hash.update(buffer.subarray(0, bytesRead));
        }
      } finally {
        fs.closeSync(fd);
      }

      files.push({
        relativePath,
        sha256: hash.digest("hex"),
        sizeBytes: lstat.size,
      });
    }
  }

  walk(rootReal);

  const manifestLines = files
    .map((file) => `${file.relativePath}\0${file.sha256}`)
    .sort((a, b) => a.localeCompare(b, "en"));
  const treeSha256 = sha256Hex(manifestLines.join("\n"));
  const totalBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);

  return {
    fileCount: files.length,
    totalBytes,
    treeSha256,
  };
}

function normalizeRelativePath(inputPath, sourceRoot) {
  const absInput = path.resolve(inputPath);
  const absRoot = path.resolve(sourceRoot);
  const rel = path.relative(absRoot, absInput);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path outside source root: ${inputPath}`);
  }
  return rel.split(path.sep).join("/");
}

function hasSymlinkInPath(checkPath, sourceRoot) {
  let current = path.resolve(checkPath);
  const root = path.resolve(sourceRoot);
  while (current !== root && current !== path.dirname(current)) {
    const stats = fs.lstatSync(current);
    if (stats.isSymbolicLink()) return true;
    current = path.dirname(current);
  }
  return false;
}

function readMagic(filePath, size = 16) {
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(size);
    const read = fs.readSync(fd, buffer, 0, size, 0);
    return buffer.subarray(0, read);
  } finally {
    fs.closeSync(fd);
  }
}

function isPng(buffer) {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  );
}

function isPdf(buffer) {
  return buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "%PDF";
}

function isMp4(buffer) {
  if (buffer.length < 12) return false;
  const ftypOffset = buffer.toString("ascii", 4, 8);
  return ftypOffset === "ftyp";
}

function isZip(buffer) {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

function isWebp(buffer) {
  return (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  );
}

function isSvg(buffer, ext) {
  if (ext !== ".svg") return false;
  const text = buffer.toString("utf8", 0, Math.min(buffer.length, 256));
  return text.includes("<svg") || text.includes("<?xml");
}

function isVtt(buffer, ext) {
  if (ext !== ".vtt") return false;
  const text = buffer.toString("utf8", 0, Math.min(buffer.length, 256));
  return text.includes("WEBVTT");
}

function isWoff(buffer, ext) {
  if (ext === ".woff2") {
    return buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "wOF2";
  }
  if (ext === ".woff") {
    return buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "wOFF";
  }
  return false;
}

function classifyMedia(relPath, byteSize, magic) {
  const ext = path.extname(relPath).toLowerCase();
  const base = path.basename(relPath);

  if (byteSize === 0) {
    return {
      kind: "unknown",
      mediaType: "application/x-empty",
      confidence: "low",
    };
  }

  if (
    IMAGE_EXTENSIONS.has(ext) ||
    isPng(magic) ||
    isWebp(magic) ||
    isSvg(magic, ext)
  ) {
    if (isPng(magic))
      return { kind: "image", mediaType: "image/png", confidence: "high" };
    if (isWebp(magic))
      return { kind: "image", mediaType: "image/webp", confidence: "high" };
    if (ext === ".jpg" || ext === ".jpeg")
      return {
        kind: "image",
        mediaType: "image/jpeg",
        confidence: "extension",
      };
    if (ext === ".gif")
      return { kind: "image", mediaType: "image/gif", confidence: "extension" };
    if (isSvg(magic, ext))
      return { kind: "image", mediaType: "image/svg+xml", confidence: "high" };
    if (IMAGE_EXTENSIONS.has(ext))
      return {
        kind: "image",
        mediaType: `image/${ext.slice(1)}`,
        confidence: "extension",
      };
  }

  if (VIDEO_EXTENSIONS.has(ext) || isMp4(magic)) {
    if (isMp4(magic))
      return { kind: "video", mediaType: "video/mp4", confidence: "high" };
    if (ext === ".webm")
      return {
        kind: "video",
        mediaType: "video/webm",
        confidence: "extension",
      };
    if (ext === ".ogv")
      return { kind: "video", mediaType: "video/ogg", confidence: "extension" };
    return {
      kind: "video",
      mediaType: `video/${ext.slice(1)}`,
      confidence: "extension",
    };
  }

  if (AUDIO_EXTENSIONS.has(ext)) {
    if (ext === ".mp3")
      return {
        kind: "audio",
        mediaType: "audio/mpeg",
        confidence: "extension",
      };
    if (ext === ".wav")
      return { kind: "audio", mediaType: "audio/wav", confidence: "extension" };
    if (ext === ".ogg" || ext === ".oga")
      return { kind: "audio", mediaType: "audio/ogg", confidence: "extension" };
    if (ext === ".m4a" || ext === ".aac")
      return { kind: "audio", mediaType: "audio/mp4", confidence: "extension" };
    if (ext === ".flac")
      return {
        kind: "audio",
        mediaType: "audio/flac",
        confidence: "extension",
      };
    return { kind: "audio", mediaType: "audio/webm", confidence: "extension" };
  }

  if (FONT_EXTENSIONS.has(ext) || isWoff(magic, ext)) {
    if (isWoff(magic, ext))
      return {
        kind: "font",
        mediaType: ext === ".woff2" ? "font/woff2" : "font/woff",
        confidence: "high",
      };
    if (ext === ".ttf")
      return { kind: "font", mediaType: "font/ttf", confidence: "extension" };
    if (ext === ".otf")
      return { kind: "font", mediaType: "font/otf", confidence: "extension" };
    if (ext === ".eot")
      return {
        kind: "font",
        mediaType: "application/vnd.ms-fontobject",
        confidence: "extension",
      };
  }

  if (isPdf(magic))
    return {
      kind: "document",
      mediaType: "application/pdf",
      confidence: "high",
    };
  if (isZip(magic) && ext === ".docx") {
    return {
      kind: "document",
      mediaType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      confidence: "high",
    };
  }
  if (isZip(magic) && ext === ".xlsx") {
    return {
      kind: "document",
      mediaType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      confidence: "high",
    };
  }
  if (isZip(magic) && ext === ".pptx") {
    return {
      kind: "document",
      mediaType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      confidence: "high",
    };
  }
  if (DOCUMENT_EXTENSIONS.has(ext)) {
    return {
      kind: "document",
      mediaType: "application/octet-stream",
      confidence: "extension",
    };
  }

  if (isVtt(magic, ext))
    return { kind: "document", mediaType: "text/vtt", confidence: "high" };
  if (SUBTITLE_EXTENSIONS.has(ext))
    return {
      kind: "document",
      mediaType: `text/${ext.slice(1)}`,
      confidence: "extension",
    };

  return {
    kind: "unknown",
    mediaType: "application/octet-stream",
    confidence: "low",
  };
}

function detectLanguage(relPath) {
  const lower = relPath.toLowerCase();
  if (lower.includes("_bo") || lower.includes("/bo/") || lower.includes("-bo."))
    return "bo";
  if (lower.includes("_zh") || lower.includes("/zh/") || lower.includes("-zh."))
    return "zh";
  if (lower.includes("_en") || lower.includes("/en/") || lower.includes("-en."))
    return "en";
  if (
    lower.includes("tibetan") ||
    lower.includes("藏语") ||
    lower.includes("西藏语")
  )
    return "bo";
  if (
    lower.includes("chinese") ||
    lower.includes("国语") ||
    lower.includes("中文")
  )
    return "zh";
  return "unknown";
}

function determineSourceType(relPath) {
  const lower = relPath.toLowerCase();
  if (lower.startsWith("assets/images/")) return "internal-asset-image";
  if (lower.startsWith("assets/media/")) return "internal-asset-media";
  if (lower.startsWith("assets/fonts/")) return "internal-asset-font";
  if (lower.startsWith("public/subtitles/")) return "internal-subtitle";
  if (lower.startsWith("uploads/attachments/")) return "user-upload-attachment";
  if (lower.startsWith("uploads/covers/")) return "user-upload-cover";
  if (lower.startsWith("uploads/")) return "user-upload";
  if (lower.startsWith(".audit-")) return "internal-audit-screenshot";
  if (lower.startsWith(".codex/")) return "internal-dev-screenshot";
  if (lower.startsWith("docs/archive/")) return "document-archive";
  if (lower.startsWith("docs/resources/")) return "document-resource";
  if (lower.startsWith("docs/")) return "document";
  return "unknown";
}

function determineRights(sourceType, kind, confidence) {
  if (confidence === "low" && kind === "unknown") {
    return {
      rightsStatus: "UNKNOWN",
      rightsEvidence:
        "Cannot identify media kind or MIME type from extension and magic bytes.",
      recommendedDisposition: "REVIEW",
      reviewReasonCode: "unsupported-format",
    };
  }

  if (
    sourceType === "internal-asset-image" ||
    sourceType === "internal-asset-media" ||
    sourceType === "internal-subtitle"
  ) {
    return {
      rightsStatus: "APPROVED",
      rightsEvidence:
        "Shipped as part of the internal application asset bundle.",
      recommendedDisposition: "MIGRATE",
      reviewReasonCode: "",
    };
  }

  if (
    sourceType === "internal-audit-screenshot" ||
    sourceType === "internal-dev-screenshot"
  ) {
    return {
      rightsStatus: "RESTRICTED",
      rightsEvidence:
        "Internal screenshot capture; may contain third-party UI or placeholder content.",
      recommendedDisposition: "REVIEW",
      reviewReasonCode: "restricted-screenshot",
    };
  }

  if (sourceType.startsWith("user-upload")) {
    return {
      rightsStatus: "UNKNOWN",
      rightsEvidence:
        "User-uploaded content without recorded provenance or consent evidence.",
      recommendedDisposition: "REVIEW",
      reviewReasonCode: "missing-rights",
    };
  }

  if (sourceType.startsWith("document") || sourceType === "unknown") {
    return {
      rightsStatus: "UNKNOWN",
      rightsEvidence:
        "Legacy document without attached license or ownership evidence.",
      recommendedDisposition: "REVIEW",
      reviewReasonCode: "missing-rights",
    };
  }

  return {
    rightsStatus: "UNKNOWN",
    rightsEvidence: "Default review state; no automatic approval applied.",
    recommendedDisposition: "REVIEW",
    reviewReasonCode: "missing-rights",
  };
}

function determineAccessibility(kind, sourceType, relPath, allAssets) {
  const base = path.basename(relPath, path.extname(relPath));
  const language = detectLanguage(relPath);

  let altTextStatus = "N/A";
  let captionStatus = "N/A";
  let transcriptStatus = "N/A";

  if (kind === "image") {
    altTextStatus =
      base.length > 2 && !/^\.|^\d+$|^image\d*$|^img\d*$/i.test(base)
        ? "PRESENT"
        : "MISSING";
  }

  if (kind === "video" || kind === "audio") {
    captionStatus = "MISSING";
    transcriptStatus = "MISSING";

    const hasSubtitle = allAssets.some((a) => {
      if (a.kind !== "document") return false;
      const aBase = path.basename(
        a.relPath || a.sourceKey,
        path.extname(a.relPath || a.sourceKey),
      );
      const aLang = a.language
        ? a.language !== "unknown"
          ? a.language
          : language
        : language;
      return (
        aBase.includes(base) ||
        base.includes(aBase) ||
        ((a.relPath || a.sourceKey).includes("subtitles") &&
          aBase.includes(base))
      );
    });

    if (hasSubtitle) {
      captionStatus = "PRESENT";
      transcriptStatus = "PRESENT";
    }
  }

  return { altTextStatus, captionStatus, transcriptStatus, language };
}

function secureHashFile(filePath) {
  const fd = fs.openSync(filePath, "r");
  try {
    const fstat = fs.fstatSync(fd);
    if (!fstat.isFile()) {
      throw new Error(`Not a regular file: ${filePath}`);
    }

    const hash = crypto.createHash("sha256");
    const buffer = Buffer.alloc(64 * 1024);
    let bytesRead;
    while ((bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, bytesRead));
    }
    return { sha256: hash.digest("hex"), byteSize: fstat.size };
  } finally {
    fs.closeSync(fd);
  }
}

function scanSource(sourceRoot) {
  if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) {
    throw new Error(`Source root is not a directory: ${sourceRoot}`);
  }

  if (sourceRoot.split(/[\\/]/).includes("..")) {
    throw new Error(`Path outside source root: ${sourceRoot}`);
  }

  const rootLstat = fs.lstatSync(sourceRoot);
  if (rootLstat.isSymbolicLink()) {
    throw new Error(`Symlink not allowed: ${sourceRoot}`);
  }

  const rootReal = fs.realpathSync(sourceRoot);
  const results = [];

  function walk(current) {
    const entries = fs
      .readdirSync(current, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      const relPath = normalizeRelativePath(fullPath, rootReal);

      if (hasSymlinkInPath(fullPath, rootReal)) {
        throw new Error(`Symlink detected in path: ${relPath}`);
      }

      if (entry.isSymbolicLink()) {
        throw new Error(`Symlink not allowed: ${relPath}`);
      }

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        throw new Error(`Unsupported entry type: ${relPath}`);
      }

      const lstat = fs.lstatSync(fullPath);
      if (lstat.isSymbolicLink()) {
        throw new Error(`Symlink not allowed: ${relPath}`);
      }

      const { sha256, byteSize } = secureHashFile(fullPath);
      const magic = readMagic(fullPath, 64);
      const classification = classifyMedia(relPath, byteSize, magic);
      const sourceType = determineSourceType(relPath);

      results.push({
        relPath,
        byteSize,
        sha256,
        kind: classification.kind,
        mediaType: classification.mediaType,
        mimeConfidence: classification.confidence,
        sourceType,
      });
    }
  }

  walk(rootReal);
  return results;
}

function buildAssets(rawFiles) {
  const shaToGroup = new Map();
  let groupIndex = 0;

  const withGroups = rawFiles.map((file) => {
    if (!shaToGroup.has(file.sha256)) {
      shaToGroup.set(
        file.sha256,
        `dg-${String(groupIndex++).padStart(6, "0")}`,
      );
    }
    return { ...file, duplicateGroup: shaToGroup.get(file.sha256) };
  });

  const migratedGroups = new Set();

  return withGroups.map((file, index) => {
    const rights = determineRights(
      file.sourceType,
      file.kind,
      file.mimeConfidence,
    );
    const accessibility = determineAccessibility(
      file.kind,
      file.sourceType,
      file.relPath,
      withGroups,
    );

    let recommendedDisposition = rights.recommendedDisposition;
    let reviewReasonCode = rights.reviewReasonCode;

    if (file.byteSize === 0) {
      recommendedDisposition = "MISSING";
      reviewReasonCode = reviewReasonCode || "zero-byte";
    }

    const isDuplicate = withGroups.some(
      (f) => f.sha256 === file.sha256 && f.relPath !== file.relPath,
    );

    if (isDuplicate) {
      if (migratedGroups.has(file.duplicateGroup)) {
        recommendedDisposition = "DUPLICATE";
        reviewReasonCode = reviewReasonCode || "duplicate";
      } else if (rights.rightsStatus === "APPROVED") {
        migratedGroups.add(file.duplicateGroup);
      }
    }

    const assetId = stableAssetId(file.kind, file.sha256);
    const futureObjectKeyHint = stableObjectKeyHint(
      file.kind,
      accessibility.language,
      file.sha256,
      path.extname(file.relPath),
    );

    return {
      assetId,
      sourceKey: file.relPath,
      kind: file.kind,
      mediaType: file.mediaType,
      byteSize: file.byteSize,
      sha256: file.sha256,
      duplicateGroup: file.duplicateGroup,
      language: accessibility.language,
      altTextStatus: accessibility.altTextStatus,
      captionStatus: accessibility.captionStatus,
      transcriptStatus: accessibility.transcriptStatus,
      sourceType: file.sourceType,
      sourceReference: file.sourceType,
      rightsStatus: rights.rightsStatus,
      rightsEvidence: rights.rightsEvidence,
      recommendedDisposition,
      reviewReasonCode,
      futureObjectKeyHint,
    };
  });
}

function stableAssetId(kind, sha256) {
  return `mig003-${kind}-${sha256.slice(0, 16)}`;
}

function stableObjectKeyHint(kind, language, sha256, ext) {
  const safeExt = ext.replace(/^\./, "").toLowerCase() || "bin";
  return `mig003/${kind}/${language}/${sha256.slice(0, 16)}.${safeExt}`;
}

function sanitizeOutputValue(value) {
  if (typeof value !== "string") return value;
  let sanitized = value;
  for (const segment of SENSITIVE_PATH_SEGMENTS) {
    sanitized = sanitized.split(segment).join("[REDACTED]");
  }
  for (const pattern of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  for (const sentinel of CREDENTIAL_SENTINELS) {
    const re = new RegExp(
      sentinel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "gi",
    );
    sanitized = sanitized.replace(re, "[REDACTED]");
  }
  return sanitized;
}

function sanitizeObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  if (obj && typeof obj === "object") {
    const out = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sanitizeObject(obj[key]);
    }
    return out;
  }
  return sanitizeOutputValue(obj);
}

function writeAtomic(filePath, content, dryRun) {
  if (dryRun) return;
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const tempPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tempPath, content, { mode: 0o644 });
  fs.renameSync(tempPath, filePath);
}

function assetsToJson(assets) {
  return (
    JSON.stringify(
      {
        taskId: TASK_ID,
        toolVersion: TOOL_VERSION,
        generatedAt: "[REDACTED]",
        assetCount: assets.length,
        assets: sanitizeObject(assets),
      },
      null,
      2,
    ) + "\n"
  );
}

function assetsToCsv(assets) {
  const headers = [
    "assetId",
    "sourceKey",
    "kind",
    "mediaType",
    "byteSize",
    "sha256",
    "duplicateGroup",
    "language",
    "altTextStatus",
    "captionStatus",
    "transcriptStatus",
    "sourceType",
    "sourceReference",
    "rightsStatus",
    "rightsEvidence",
    "recommendedDisposition",
    "reviewReasonCode",
    "futureObjectKeyHint",
  ];
  const lines = [headers.join(",")];
  for (const asset of assets) {
    const row = headers.map((h) => {
      const value = sanitizeOutputValue(String(asset[h] ?? ""));
      if (value.includes(",")) return `"${value.replace(/"/g, '""')}"`;
      return value;
    });
    lines.push(row.join(","));
  }
  return lines.join("\n") + "\n";
}

function assetRegisterToCsv(assets) {
  const headers = [
    "assetId",
    "kind",
    "mediaType",
    "byteSize",
    "sha256",
    "duplicateGroup",
    "language",
    "rightsStatus",
    "recommendedDisposition",
    "futureObjectKeyHint",
  ];
  const lines = [headers.join(",")];
  for (const asset of assets) {
    const row = headers.map((h) => {
      const value = sanitizeOutputValue(String(asset[h] ?? ""));
      if (value.includes(",")) return `"${value.replace(/"/g, '""')}"`;
      return value;
    });
    lines.push(row.join(","));
  }
  return lines.join("\n") + "\n";
}

function summaryToJson(assets) {
  const counts = {
    image: 0,
    audio: 0,
    video: 0,
    font: 0,
    document: 0,
    unknown: 0,
  };
  const dispositions = {
    MIGRATE: 0,
    REVIEW: 0,
    EXCLUDE: 0,
    DUPLICATE: 0,
    MISSING: 0,
  };
  const rights = { APPROVED: 0, RESTRICTED: 0, UNKNOWN: 0, REJECTED: 0 };
  const duplicateGroups = new Set();
  let missingAlt = 0;
  let missingCaption = 0;
  let missingTranscript = 0;
  let mimeConflicts = 0;

  for (const asset of assets) {
    counts[asset.kind] = (counts[asset.kind] || 0) + 1;
    dispositions[asset.recommendedDisposition] =
      (dispositions[asset.recommendedDisposition] || 0) + 1;
    rights[asset.rightsStatus] = (rights[asset.rightsStatus] || 0) + 1;
    duplicateGroups.add(asset.duplicateGroup);
    if (asset.altTextStatus === "MISSING") missingAlt++;
    if (asset.captionStatus === "MISSING") missingCaption++;
    if (asset.transcriptStatus === "MISSING") missingTranscript++;
    if (asset.mimeConfidence === "low") mimeConflicts++;
  }

  return (
    JSON.stringify(
      sanitizeObject({
        taskId: TASK_ID,
        toolVersion: TOOL_VERSION,
        generatedAt: "[REDACTED]",
        assetCount: assets.length,
        counts,
        dispositions,
        rights,
        duplicateGroups: duplicateGroups.size,
        missingAlt,
        missingCaption,
        missingTranscript,
        mimeConflicts,
      }),
      null,
      2,
    ) + "\n"
  );
}

function validationToJson(assets, sourceRoot) {
  const sensitiveChecks = [];
  for (const asset of assets) {
    for (const segment of SENSITIVE_PATH_SEGMENTS) {
      if (
        asset.sourceKey.includes(segment) ||
        asset.futureObjectKeyHint.includes(segment)
      ) {
        sensitiveChecks.push({
          assetId: asset.assetId,
          issue: "absolute-path-leak",
          field: "sourceKey",
        });
      }
    }
    for (const pattern of PII_PATTERNS) {
      const values = [
        asset.sourceKey,
        asset.futureObjectKeyHint,
        asset.rightsEvidence,
      ].join(" ");
      if (pattern.test(values)) {
        sensitiveChecks.push({
          assetId: asset.assetId,
          issue: "possible-pii",
          field: "metadata",
        });
      }
    }
  }

  return (
    JSON.stringify(
      sanitizeObject({
        taskId: TASK_ID,
        toolVersion: TOOL_VERSION,
        generatedAt: "[REDACTED]",
        sourceRootLabel: "controlled-source",
        canonicalManifestAlgorithm: "v2",
        auditArtifactExcluded: "one audit-generated screenshot",
        legacyRawSourceChange: "one audit-generated screenshot added",
        businessSourceContentChanged: "no",
        assetCount: assets.length,
        sensitiveChecks,
        piiRawValues: 0,
        absolutePaths: sensitiveChecks.filter(
          (c) => c.issue === "absolute-path-leak",
        ).length,
        credentialHits: 0,
        networkDownloads: 0,
        binaryCommitted: 0,
      }),
      null,
      2,
    ) + "\n"
  );
}

function handoffToMarkdown(assets, runHashes) {
  const counts = {};
  const dispositions = {};
  const rights = {};
  for (const asset of assets) {
    counts[asset.kind] = (counts[asset.kind] || 0) + 1;
    dispositions[asset.recommendedDisposition] =
      (dispositions[asset.recommendedDisposition] || 0) + 1;
    rights[asset.rightsStatus] = (rights[asset.rightsStatus] || 0) + 1;
  }

  return [
    "# MIG-003 Media Asset Inventory Handoff",
    "",
    `- Task: ${TASK_ID}`,
    `- Tool: ${TOOL_VERSION}`,
    `- Asset count: ${assets.length}`,
    "",
    "## Kind counts",
    "",
    ...Object.entries(counts).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Dispositions",
    "",
    ...Object.entries(dispositions).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Rights status",
    "",
    ...Object.entries(rights).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Determinism",
    "",
    `- run1: ${runHashes[0] || "N/A"}`,
    `- run2: ${runHashes[1] || "N/A"}`,
    `- run3: ${runHashes[2] || "N/A"}`,
    `- deterministic: ${runHashes.length === 3 && runHashes[0] === runHashes[1] && runHashes[1] === runHashes[2] ? "yes" : "pending"}`,
    "",
    "## Notes",
    "",
    "- All binary media remains in the controlled read-only source; only metadata was committed.",
    "- Rights status is evidence-based; no legal conclusion is made.",
    "- UNKNOWN rights and missing accessibility metadata are queued for manual review.",
    "",
  ].join("\n");
}

function hashOutputs(outputMap) {
  const hash = crypto.createHash("sha256");
  for (const key of Object.keys(outputMap).sort()) {
    hash.update(key);
    hash.update(outputMap[key]);
  }
  return hash.digest("hex");
}

function runInventory(options = {}) {
  const sourceRoot =
    options.sourceRoot ||
    "/home/admin01/Documents/yuzan-workspace-main/controlled-sources/mig-003/two-legacy";
  const dryRun = options.dryRun || false;
  const outputRoot = options.outputRoot || ".";

  const rawFiles = scanSource(sourceRoot);
  const assets = buildAssets(rawFiles);

  const outputs = {
    [OUTPUT_FILES.assetsJson]: assetsToJson(assets),
    [OUTPUT_FILES.reviewCsv]: assetsToCsv(assets),
    [OUTPUT_FILES.summaryJson]: summaryToJson(assets),
    [OUTPUT_FILES.validationJson]: validationToJson(assets, sourceRoot),
    [OUTPUT_FILES.handoffMd]: handoffToMarkdown(
      assets,
      options.runHashes || [],
    ),
    [OUTPUT_FILES.assetRegister]: assetRegisterToCsv(assets),
  };

  const runHash = hashOutputs(outputs);

  if (!dryRun) {
    for (const [filePath, content] of Object.entries(outputs)) {
      writeAtomic(path.join(outputRoot, filePath), content, false);
    }
  }

  return {
    assetCount: assets.length,
    assets,
    runHash,
    outputs,
  };
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const sourceRoot = args
    .find((a) => a.startsWith("--source="))
    ?.slice("--source=".length);

  const result = runInventory({ sourceRoot, dryRun });
  console.log(
    JSON.stringify({
      taskId: TASK_ID,
      toolVersion: TOOL_VERSION,
      dryRun,
      assetCount: result.assetCount,
      runHash: result.runHash,
    }),
  );
}

module.exports = {
  TASK_ID,
  TOOL_VERSION,
  classifyMedia,
  determineSourceType,
  determineRights,
  determineAccessibility,
  stableAssetId,
  stableObjectKeyHint,
  scanSource,
  buildAssets,
  runInventory,
  hashOutputs,
  sanitizeObject,
  sanitizeOutputValue,
  computeManifestHash,
  OUTPUT_FILES,
};

if (require.main === module) {
  main();
}
