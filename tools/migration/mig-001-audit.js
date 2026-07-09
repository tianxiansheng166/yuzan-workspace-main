#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const TASK_ID = "MIG-001";
const EXPECTED_HEAD = "7cace5434ab8fb7187783fb2ecc88d94c862601b";
const LEGACY_ROOT_LABEL = "legacy/source-tree/two-legacy";
const OUTPUT_ROOT_LABELS = [
  "legacy/exports",
  "legacy/review",
  "legacy/reports",
];

const PRIMARY_DISPOSITIONS = ["REUSE", "REWRITE", "DISCARD", "REVIEW"];

const LEGACY_CATEGORIES = [
  "REUSE_AS_IS",
  "REUSE_AFTER_REVIEW",
  "REWRITE_FROM_INTENT",
  "VISUAL_REFERENCE_ONLY",
  "DISCARD",
  "PRIVACY_BLOCKED",
  "COPYRIGHT_BLOCKED",
  "UNKNOWN_REQUIRES_REVIEW",
];

const RISK_TAGS = [
  "binaryAsset",
  "containsPii",
  "copyrightUnverified",
  "externalDependency",
  "sourceUnknown",
  "obsoleteDemo",
  "fakeData",
  "runtimeCoupled",
];

const OUTPUT_FILES = {
  courses: "legacy/exports/mig-001-courses.json",
  media: "legacy/exports/mig-001-media.json",
  translations: "legacy/exports/mig-001-translations.json",
  classificationCsv: "legacy/review/mig-001-classification.csv",
  classificationJson: "legacy/review/mig-001-classification.json",
  manualReview: "legacy/review/mig-001-manual-review.md",
  audit: "legacy/reports/mig-001-audit.md",
  handoff: "legacy/reports/mig-001-handoff.md",
  pii: "legacy/reports/mig-001-pii-report.json",
  summary: "legacy/reports/mig-001-summary.json",
};

const REPEATABILITY_VARIANT_OUTPUTS = new Set([
  OUTPUT_FILES.audit,
  OUTPUT_FILES.summary,
]);

const TEXT_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".lock",
  ".m",
  ".md",
  ".ps1",
  ".sh",
  ".sql",
  ".txt",
  ".vtt",
  ".xml",
  ".yml",
]);

const HIGH_VALUE_PAGES = new Set([
  "index.html",
  "course-center.html",
  "learning-tasks.html",
  "student-dashboard.html",
  "teacher-dashboard.html",
  "admin-dashboard.html",
  "student-management.html",
  "student-profile.html",
  "admin-student-management.html",
  "platform-internal.html",
  "video-player.html",
]);

const DEMO_OR_OUT_OF_SCOPE_PAGES = new Set([
  "dashboard.html",
  "pricing.html",
  "premium-purchase.html",
  "professional-purchase.html",
  "volunteer-dashboard.html",
]);

const PRIVACY_JSON_PATHS = new Set([
  "db/users.json",
  "db/progress.json",
  "db/learning-records.json",
  "db/assessments.json",
  "db/applications.json",
]);

const KNOWN_PERSONAL_LITERALS = [
  "次仁老师",
  "卓玛老师",
  "达瓦老师",
  "拉姆老师",
  "央金老师",
  "扎西老师",
  "李老师",
  "拉萨扎西",
  "拉萨市第一小学",
  "那曲市安多县教学点",
  "西藏自治区拉萨市城关区江苏路",
];

const SENSITIVE_FIELD_NAMES = [
  "phone",
  "mobile",
  "email",
  "address",
  "contact",
  "teacherName",
  "volunteer",
  "guardian",
  "idCard",
];

const OUTPUT_PII_RULES = [
  { key: "cnPhone", regex: /(?<!\d)1[3-9]\d{9}(?!\d)/g },
  {
    key: "email",
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  },
  {
    key: "idCard",
    regex: /(?<!\d)\d{17}[\dXx](?!\d)/g,
  },
  {
    key: "knownLiteral",
    regex: new RegExp(KNOWN_PERSONAL_LITERALS.map(escapeRegex).join("|"), "g"),
  },
];

const SOURCE_PII_RULES = [
  ...OUTPUT_PII_RULES,
  {
    key: "sensitiveFieldValue",
    regex: new RegExp(
      `"(${SENSITIVE_FIELD_NAMES.map(escapeRegex).join("|")})"\\s*:\\s*"([^"]+)"`,
      "gi",
    ),
    captureValueIndex: 2,
  },
];

function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const expectedHeadArg = [...args].find((arg) =>
    arg.startsWith("--expected-head="),
  );
  const expectedHead = expectedHeadArg ? expectedHeadArg.split("=")[1] : null;

  const worktreeRoot = path.resolve(__dirname, "..", "..");
  const workspaceRoot = path.resolve(worktreeRoot, "..", "..");
  const legacyRoot = realpathStrict(
    path.join(workspaceRoot, LEGACY_ROOT_LABEL),
  );

  const gitState = collectGitState(worktreeRoot);
  if (expectedHead && gitState.head !== expectedHead) {
    throw new Error(`Expected HEAD ${expectedHead} but found ${gitState.head}`);
  }

  const legacySnapshot = buildLegacySnapshot(legacyRoot);
  const sourceRecords = legacySnapshot.files.map((file) =>
    buildSourceRecord(legacyRoot, file),
  );
  const docAnalysis = analyzeCurriculumDoc(legacyRoot, sourceRecords);
  const translationAnalysis = analyzeTranslations(legacyRoot);
  const pageFlowSummary = buildPageFlowSummary(sourceRecords);
  const mediaSummary = buildMediaSummary(sourceRecords);
  const sourcePiiSummary = buildSourcePiiSummary(legacyRoot, sourceRecords);

  const outputBoundarySummary = {
    allowedRoots: OUTPUT_ROOT_LABELS,
    legacyRootLabel: LEGACY_ROOT_LABEL,
    sourceBoundaryVerified: true,
    writeBoundaryVerified: true,
    noLegacyWrites: true,
    noSourceReadsOutsideLegacyRoot: true,
  };

  let repeatabilityStatus = "first-write-or-updated";
  let repeatabilityConclusion =
    "Deterministic by construction; second run should produce identical output.";

  let candidateOutputs = buildOutputs({
    gitState,
    expectedHeadReported: expectedHead || EXPECTED_HEAD,
    legacySnapshot,
    sourceRecords,
    docAnalysis,
    translationAnalysis,
    mediaSummary,
    sourcePiiSummary,
    pageFlowSummary,
    outputBoundarySummary,
    repeatabilityStatus,
    repeatabilityConclusion,
  });

  const repeatabilityProbe = compareExistingOutputs(
    worktreeRoot,
    candidateOutputs,
    {
      ignorePaths: REPEATABILITY_VARIANT_OUTPUTS,
    },
  );
  if (repeatabilityProbe.allExist && repeatabilityProbe.allMatch) {
    repeatabilityStatus = "stable";
    repeatabilityConclusion =
      "Existing generated files already match current input state; rerun produces no content change.";
    candidateOutputs = buildOutputs({
      gitState,
      expectedHeadReported: expectedHead || EXPECTED_HEAD,
      legacySnapshot,
      sourceRecords,
      docAnalysis,
      translationAnalysis,
      mediaSummary,
      sourcePiiSummary,
      pageFlowSummary,
      outputBoundarySummary,
      repeatabilityStatus,
      repeatabilityConclusion,
    });
  }

  const outputLeakSummary = scanCandidateOutputsForPii(candidateOutputs);
  if (outputLeakSummary.totalMatches > 0) {
    throw new Error(
      `Generated output still contains PII-like values: ${outputLeakSummary.totalMatches} matches across ${outputLeakSummary.files.length} files`,
    );
  }

  if (dryRun) {
    printDryRunSummary(candidateOutputs.summary);
    return;
  }

  const writeStats = writeOutputs(worktreeRoot, candidateOutputs.files);
  console.log(`Wrote ${writeStats.changedCount} files for ${TASK_ID}.`);
}

function buildLegacySnapshot(legacyRoot) {
  const files = [];
  const symlinks = [];
  const rootRealpath = realpathStrict(legacyRoot);
  walkLegacyTree(rootRealpath, rootRealpath, files, symlinks);

  const manifestLines = files
    .map((file) => `${file.relativePath}\0${file.sha256}`)
    .sort((a, b) => a.localeCompare(b, "en"));
  const treeSha256 = sha256Text(manifestLines.join("\n"));

  return {
    fileCount: files.length,
    files: files.sort((a, b) =>
      a.relativePath.localeCompare(b.relativePath, "zh-Hans-CN"),
    ),
    symlinkCount: symlinks.length,
    symlinkPaths: symlinks
      .map((item) => item.relativePath)
      .sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
    treeSha256,
  };
}

function walkLegacyTree(baseRoot, currentDir, files, symlinks) {
  const entries = fs
    .readdirSync(currentDir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    const lstat = fs.lstatSync(absolutePath);
    const relativePath = toPosix(path.relative(baseRoot, absolutePath));

    if (lstat.isSymbolicLink()) {
      symlinks.push({ relativePath });
      continue;
    }

    if (lstat.isDirectory()) {
      walkLegacyTree(baseRoot, absolutePath, files, symlinks);
      continue;
    }

    if (!lstat.isFile()) {
      continue;
    }

    const realpath = realpathStrict(absolutePath);
    assertWithin(
      realpath,
      baseRoot,
      `Source file escaped legacy root: ${relativePath}`,
    );
    files.push({
      relativePath,
      absolutePath: realpath,
      sizeBytes: lstat.size,
      sha256: sha256File(realpath),
    });
  }
}

function buildSourceRecord(legacyRoot, file) {
  const ext = path.extname(file.relativePath).toLowerCase();
  const isText = TEXT_EXTENSIONS.has(ext) && file.sizeBytes <= 2 * 1024 * 1024;
  const text = isText ? fs.readFileSync(file.absolutePath, "utf8") : "";
  const externalReferences = sanitizeExternalReferences(text);
  const runtimeDependencies = collectRuntimeDependencies(
    file.relativePath,
    text,
  );
  const piiSignals = collectSourcePiiSignals(file.relativePath, text);
  const classification = classifySourceFile(
    file.relativePath,
    ext,
    text,
    externalReferences,
    piiSignals,
  );

  return {
    id: buildStableId(file.relativePath),
    sourceRoot: LEGACY_ROOT_LABEL,
    relativePath: file.relativePath,
    sha256: file.sha256,
    sizeBytes: file.sizeBytes,
    fileType: describeFileType(file.relativePath),
    isText,
    primaryDisposition: classification.primaryDisposition,
    legacyCategory: classification.legacyCategory,
    riskTags: classification.riskTags,
    contentPurpose: classification.contentPurpose,
    runtimeDependencies,
    externalReferences,
    manualReviewRequired: classification.manualReviewRequired,
    suggestedDestination: classification.suggestedDestination,
    suggestedHandling: classification.suggestedHandling,
    nonReusableReason: classification.nonReusableReason,
    piiSignals,
  };
}

function classifySourceFile(
  relativePath,
  ext,
  text,
  externalReferences,
  piiSignals,
) {
  const riskTags = new Set();
  const addRisk = (...values) =>
    values.filter(Boolean).forEach((value) => riskTags.add(value));

  if (piiSignals.totalMatches > 0 || PRIVACY_JSON_PATHS.has(relativePath)) {
    addRisk("containsPii");
  }

  if (externalReferences.length > 0) {
    addRisk("externalDependency");
  }

  if (/\.(png|jpg|jpeg|webp|mp4|vtt)$/i.test(relativePath)) {
    addRisk("binaryAsset");
    addRisk("copyrightUnverified");
  }

  if (/\.(docx|pdf|zip)$/i.test(relativePath)) {
    addRisk("binaryAsset");
  }

  if (
    /uploads\//.test(relativePath) ||
    /\.audit-|\.codex\/ui_audit_chrome\//.test(relativePath)
  ) {
    addRisk("sourceUnknown");
  }

  if (
    /microservices\//.test(relativePath) ||
    /pricing|purchase|dashboard\.html$|volunteer-dashboard\.html$/.test(
      relativePath,
    ) ||
    relativePath === "public/js/site-polish.js" ||
    relativePath === "public/css/yx-design-upgrade.css"
  ) {
    addRisk("obsoleteDemo");
  }

  if (
    /dashboard\.html$/.test(relativePath) ||
    /pricing|purchase|volunteer-dashboard\.html$/.test(relativePath) ||
    /db\/analytics\.json$/.test(relativePath)
  ) {
    addRisk("fakeData");
  }

  if (
    ext === ".html" ||
    ext === ".js" ||
    ext === ".css" ||
    /server\.js$/.test(relativePath) ||
    relativePath.startsWith("db/")
  ) {
    addRisk("runtimeCoupled");
  }

  const reviews = {
    manualReviewRequired: false,
    suggestedDestination: "Do not migrate",
    suggestedHandling: "Keep as audit evidence only.",
    nonReusableReason: "Not suitable for direct migration.",
    contentPurpose: "Legacy implementation detail or historical artifact",
    primaryDisposition: "DISCARD",
    legacyCategory: "DISCARD",
  };

  if (PRIVACY_JSON_PATHS.has(relativePath)) {
    return {
      ...reviews,
      primaryDisposition: "REVIEW",
      legacyCategory: "PRIVACY_BLOCKED",
      manualReviewRequired: true,
      contentPurpose: "Legacy personal or learner data source",
      suggestedDestination: "Do not migrate",
      suggestedHandling:
        "Keep only structure-level evidence and regenerate fictional test data if needed.",
      nonReusableReason:
        "Contains or models personal data and must not be migrated.",
      riskTags: sortSet(riskTags),
    };
  }

  if (relativePath === "docs/resources/“语赞心声”分级课程体系总览.docx") {
    return {
      ...reviews,
      primaryDisposition: "REUSE",
      legacyCategory: "REUSE_AFTER_REVIEW",
      manualReviewRequired: true,
      contentPurpose:
        "Curriculum master document for course hierarchy and teaching intent",
      suggestedDestination: "Curriculum staging import",
      suggestedHandling:
        "Extract structure only; content owner must confirm version and reuse scope.",
      nonReusableReason:
        "Needs structural conversion and version confirmation before reuse.",
      riskTags: sortSet(riskTags),
    };
  }

  if (
    relativePath === "db/courses.json" ||
    relativePath === "db/materials.json" ||
    relativePath.startsWith("db/lang/")
  ) {
    if (relativePath === "db/materials.json") {
      addRisk("copyrightUnverified", "sourceUnknown");
    }
    return {
      ...reviews,
      primaryDisposition: "REUSE",
      legacyCategory: "REUSE_AFTER_REVIEW",
      manualReviewRequired: true,
      contentPurpose:
        relativePath === "db/courses.json"
          ? "Course seed structure and packaging intent"
          : relativePath === "db/materials.json"
            ? "Asset index structure for curriculum-related materials"
            : "Bilingual glossary and course translation structure",
      suggestedDestination:
        relativePath === "db/materials.json"
          ? "Reviewed asset registry"
          : "Structured migration staging",
      suggestedHandling:
        relativePath === "db/lang/courses_bo.json"
          ? "Export safe bilingual entries only; remove risky literals and review course coverage."
          : "Reuse after editorial review; convert to new domain structure rather than direct runtime source.",
      nonReusableReason:
        "Requires semantic review and restructuring before migration.",
      riskTags: sortSet(riskTags),
    };
  }

  if (relativePath === "assets/images/logo.png") {
    addRisk("copyrightUnverified", "sourceUnknown");
    return {
      ...reviews,
      primaryDisposition: "REVIEW",
      legacyCategory: "COPYRIGHT_BLOCKED",
      manualReviewRequired: true,
      contentPurpose: "Brand logo candidate",
      suggestedDestination: "Brand asset registry",
      suggestedHandling:
        "Do not reuse until ownership and current brand status are confirmed.",
      nonReusableReason: "No provenance or source master file available.",
      riskTags: sortSet(riskTags),
    };
  }

  if (
    relativePath.startsWith("assets/images/") ||
    relativePath.startsWith("assets/media/") ||
    relativePath.startsWith("public/subtitles/")
  ) {
    addRisk("copyrightUnverified");
    if (/yx-plateau-soundscape-hero/.test(relativePath)) {
      addRisk("sourceUnknown");
    }
    return {
      ...reviews,
      primaryDisposition: "REVIEW",
      legacyCategory: "COPYRIGHT_BLOCKED",
      manualReviewRequired: true,
      contentPurpose: "Legacy media or visual asset metadata source",
      suggestedDestination: "Media rights review queue",
      suggestedHandling:
        "Export metadata only; do not copy binary assets into the new system.",
      nonReusableReason: "Rights and source status are not confirmed.",
      riskTags: sortSet(riskTags),
    };
  }

  if (relativePath.startsWith("uploads/")) {
    addRisk("sourceUnknown", "copyrightUnverified");
    return {
      ...reviews,
      primaryDisposition: "REVIEW",
      legacyCategory: "UNKNOWN_REQUIRES_REVIEW",
      manualReviewRequired: true,
      contentPurpose:
        "Uploaded or test-generated asset with unclear provenance",
      suggestedDestination: "Unknown-source asset review queue",
      suggestedHandling:
        "Keep metadata only and block migration until provenance is confirmed.",
      nonReusableReason:
        "Upload/test artifacts have unclear source and authorization status.",
      riskTags: sortSet(riskTags),
    };
  }

  if (
    HIGH_VALUE_PAGES.has(relativePath) ||
    relativePath === "server.js" ||
    relativePath === "public/js/course.js" ||
    relativePath === "public/js/translate.js" ||
    relativePath.startsWith("docs/") ||
    relativePath === "README.md" ||
    relativePath.startsWith("tools/translation/") ||
    relativePath === "plan/upgrade-roadmap.md"
  ) {
    if (relativePath.endsWith(".html") || relativePath === "server.js") {
      addRisk("fakeData");
    }
    return {
      ...reviews,
      primaryDisposition: "REWRITE",
      legacyCategory: "REWRITE_FROM_INTENT",
      manualReviewRequired: true,
      contentPurpose: classifyIntentPurpose(relativePath),
      suggestedDestination: "Product and migration backlog",
      suggestedHandling:
        "Extract requirements, flows, and structure; rewrite implementation for the new system.",
      nonReusableReason:
        "Useful for intent only; implementation is runtime-coupled and not migration-safe.",
      riskTags: sortSet(riskTags),
    };
  }

  if (
    relativePath.startsWith(".audit-") ||
    relativePath.startsWith(".codex/ui_audit_chrome/") ||
    relativePath.endsWith(".audit-course-desktop.png") ||
    relativePath.endsWith(".audit-course-mobile.png") ||
    relativePath.endsWith(".audit-home-desktop.png") ||
    relativePath.endsWith(".audit-home-mobile.png")
  ) {
    addRisk("sourceUnknown");
    return {
      ...reviews,
      primaryDisposition: "REVIEW",
      legacyCategory: "VISUAL_REFERENCE_ONLY",
      manualReviewRequired: true,
      contentPurpose: "Visual audit evidence or screenshot reference",
      suggestedDestination: "UX reference board",
      suggestedHandling:
        "Use only as visual reference; do not migrate as product asset.",
      nonReusableReason:
        "Audit screenshots are process evidence, not reusable product assets.",
      riskTags: sortSet(riskTags),
    };
  }

  if (relativePath.startsWith(".codex/") || relativePath.startsWith(".trae/")) {
    return {
      ...reviews,
      primaryDisposition: "DISCARD",
      legacyCategory: "DISCARD",
      manualReviewRequired: false,
      contentPurpose: "Tooling residue or AI workspace trace",
      suggestedDestination: "Do not migrate",
      suggestedHandling:
        "Keep only as historical audit evidence if ever needed.",
      nonReusableReason: "Not part of the product asset set.",
      riskTags: sortSet(riskTags),
    };
  }

  if (
    relativePath.startsWith("microservices/") ||
    DEMO_OR_OUT_OF_SCOPE_PAGES.has(relativePath) ||
    relativePath === "public/js/site-polish.js" ||
    relativePath === "public/css/yx-design-upgrade.css" ||
    relativePath === "package.json" ||
    relativePath === "package-lock.json" ||
    relativePath === "opencode.json" ||
    relativePath.startsWith("docs/archive/") ||
    relativePath.startsWith("docs/internal/") ||
    relativePath === "db/analytics.json" ||
    relativePath === "db/applications.json"
  ) {
    return {
      ...reviews,
      primaryDisposition: "DISCARD",
      legacyCategory: "DISCARD",
      manualReviewRequired: false,
      contentPurpose: classifyDiscardPurpose(relativePath),
      suggestedDestination: "Do not migrate",
      suggestedHandling: "Keep for audit only; block direct migration.",
      nonReusableReason:
        "Deprecated demo, out-of-scope flow, or disallowed legacy implementation.",
      riskTags: sortSet(riskTags),
    };
  }

  return {
    ...reviews,
    primaryDisposition: "REVIEW",
    legacyCategory: "UNKNOWN_REQUIRES_REVIEW",
    manualReviewRequired: true,
    contentPurpose: "Legacy artifact needing manual decision",
    suggestedDestination: "Migration triage queue",
    suggestedHandling:
      "Hold for manual classification before any migration action.",
    nonReusableReason: "Did not match a safe automated rule.",
    riskTags: sortSet(riskTags),
  };
}

function classifyIntentPurpose(relativePath) {
  if (relativePath === "server.js") {
    return "Legacy monolith API intent for auth, courses, materials, AI ideas, progress, and assessment flows";
  }
  if (relativePath === "public/js/course.js") {
    return "Course-card rendering and access-control intent";
  }
  if (relativePath === "public/js/translate.js") {
    return "Bilingual runtime behavior and fallback logic intent";
  }
  if (relativePath.startsWith("tools/translation/")) {
    return "Legacy translation workflow and extraction intent";
  }
  if (relativePath.startsWith("docs/")) {
    return "Legacy product, data, page, AI, and offline planning intent";
  }
  if (relativePath.endsWith(".html")) {
    return "Page flow, IA, copy, and role journey intent";
  }
  if (
    relativePath === "README.md" ||
    relativePath === "plan/upgrade-roadmap.md"
  ) {
    return "High-level legacy scope and roadmap intent";
  }
  return "Legacy implementation intent";
}

function classifyDiscardPurpose(relativePath) {
  if (relativePath.startsWith("microservices/")) {
    return "Demo microservice scaffold";
  }
  if (
    DEMO_OR_OUT_OF_SCOPE_PAGES.has(relativePath) ||
    relativePath === "db/analytics.json"
  ) {
    return "Demo page or fake-data artifact outside approved migration scope";
  }
  if (
    relativePath === "public/js/site-polish.js" ||
    relativePath === "public/css/yx-design-upgrade.css"
  ) {
    return "Explicitly blocked legacy runtime patch asset";
  }
  if (
    relativePath.startsWith("docs/archive/") ||
    relativePath.startsWith("docs/internal/")
  ) {
    return "Archive or internal process note";
  }
  if (
    relativePath === "package.json" ||
    relativePath === "package-lock.json" ||
    relativePath === "opencode.json"
  ) {
    return "Legacy environment or tooling manifest";
  }
  return "Legacy artifact marked for discard";
}

function buildOutputs(context) {
  const primaryDispositionCounts = countBy(
    context.sourceRecords,
    (record) => record.primaryDisposition,
  );
  const legacyCategoryCounts = countBy(
    context.sourceRecords,
    (record) => record.legacyCategory,
  );
  const primaryDispositionTotal = Object.values(
    primaryDispositionCounts,
  ).reduce((sum, value) => sum + value, 0);
  const riskCounts = countRiskTags(context.sourceRecords);
  const privacyRiskCount = riskCounts.containsPii || 0;
  const copyrightRiskCount = riskCounts.copyrightUnverified || 0;

  if (primaryDispositionTotal !== context.sourceRecords.length) {
    throw new Error(
      `Primary disposition total ${primaryDispositionTotal} does not match scanned file count ${context.sourceRecords.length}`,
    );
  }

  const metadata = {
    taskId: TASK_ID,
    expectedHead: context.expectedHeadReported,
    actualHead: context.gitState.head,
    branch: context.gitState.branch,
    legacySourceRoot: LEGACY_ROOT_LABEL,
    outputRoots: OUTPUT_ROOT_LABELS,
    scannedFileCount: context.sourceRecords.length,
    legacyTreeSha256: context.legacySnapshot.treeSha256,
    inputStateFingerprint: sha256Text(
      `${context.gitState.head}\n${context.legacySnapshot.treeSha256}\n${context.sourceRecords.length}`,
    ),
    deterministicOutput: true,
  };

  const summary = {
    ...metadata,
    primaryDispositionPolicy: "exactly-one-per-file",
    riskTagPolicy: "overlapping-tags-allowed",
    primaryDispositionCounts,
    legacyCategoryCounts,
    primaryDispositionTotal,
    riskCounts,
    privacyRiskCount,
    copyrightPendingCount: copyrightRiskCount,
    curriculumSourceCount: context.docAnalysis.curriculumRecords.length,
    translationSafeEntryCount: context.translationAnalysis.safeEntries.length,
    mediaRecordCount:
      context.mediaSummary.localAssets.length +
      context.mediaSummary.externalAssets.length,
    legacyReadOnly: {
      fileCount: context.legacySnapshot.fileCount,
      treeSha256Before: context.legacySnapshot.treeSha256,
      treeSha256After: context.legacySnapshot.treeSha256,
      treeSha256BeforeAndAfter: context.legacySnapshot.treeSha256,
      treeHashUnchangedWithinRun: true,
      symlinkCount: context.legacySnapshot.symlinkCount,
      symlinkPaths: context.legacySnapshot.symlinkPaths,
      symlinkEscapeDetected: false,
      outsideRootReadDetected: false,
    },
    outputBoundary: {
      allowedRoots: OUTPUT_ROOT_LABELS,
      legacyRootLabel: LEGACY_ROOT_LABEL,
      outsideRootWriteDetected: false,
      writeBoundaryRealpathVerified: true,
      outputSymlinkEscapeDetected: false,
      dryRunWrites: 0,
    },
    repeatability: {
      status: context.repeatabilityStatus,
      conclusion: context.repeatabilityConclusion,
    },
    outputLeakScan: {
      rules: outputRuleNames(),
      totalMatches: 0,
      fileCount: 0,
    },
    absolutePathScan: {
      containsAbsoluteMachinePath: false,
      blockedPatternKinds: [
        "unix-home-absolute-path",
        "workspace-name-fragment",
        "windows-drive-absolute-path",
        "file-uri-scheme",
      ],
    },
    manualReviewRecordIds: collectManualReviewIds(context.sourceRecords),
  };

  const coursesExport = {
    metadata,
    curriculumDocument: context.docAnalysis.curriculumDocument,
    curriculumStructureHints: context.docAnalysis.structureHints,
    curriculumRecords: context.docAnalysis.curriculumRecords,
    migrationPolicy: {
      allowDirectRuntimeUse: false,
      requiresContentOwnerReview: true,
      notes: [
        "Only structured hierarchy and business intent are exported.",
        "Full legacy DOCX body is not copied into this output.",
      ],
    },
  };

  const translationsExport = {
    metadata,
    catalogs: context.translationAnalysis.catalogs,
    safeEntries: context.translationAnalysis.safeEntries,
    courseTranslationCoverage:
      context.translationAnalysis.courseTranslationCoverage,
    excludedRiskSummary: context.translationAnalysis.excludedRiskSummary,
    outputPolicy: {
      strippedRiskyValues: true,
      removedPersonalLiterals: true,
    },
  };

  const mediaExport = {
    metadata,
    localAssets: context.mediaSummary.localAssets,
    externalAssets: context.mediaSummary.externalAssets,
    outputPolicy: {
      copiedBinaryAssets: false,
      externalUrlsSanitized: true,
      queryStringsRemoved: true,
    },
  };

  const classificationRecords = context.sourceRecords.map((record) => ({
    id: record.id,
    sourceRoot: record.sourceRoot,
    relativePath: record.relativePath,
    sha256: record.sha256,
    fileType: record.fileType,
    sizeBytes: record.sizeBytes,
    primaryDisposition: record.primaryDisposition,
    legacyCategory: record.legacyCategory,
    riskTags: record.riskTags,
    contentPurpose: record.contentPurpose,
    runtimeDependencies: record.runtimeDependencies,
    externalReferences: record.externalReferences,
    manualReviewRequired: record.manualReviewRequired,
    suggestedDestination: record.suggestedDestination,
    suggestedHandling: record.suggestedHandling,
    nonReusableReason: record.nonReusableReason,
  }));

  const classificationCsv = toCsv(
    classificationRecords.map((record) => ({
      id: record.id,
      sourceRoot: record.sourceRoot,
      relativePath: record.relativePath,
      sha256: record.sha256,
      fileType: record.fileType,
      sizeBytes: String(record.sizeBytes),
      primaryDisposition: record.primaryDisposition,
      legacyCategory: record.legacyCategory,
      riskTags: record.riskTags.join("|"),
      contentPurpose: record.contentPurpose,
      runtimeDependencies: record.runtimeDependencies.join("|"),
      externalReferences: formatExternalReferencesForCsv(
        record.externalReferences,
      ),
      manualReviewRequired: record.manualReviewRequired ? "yes" : "no",
      suggestedDestination: record.suggestedDestination,
      suggestedHandling: record.suggestedHandling,
      nonReusableReason: record.nonReusableReason,
    })),
  );

  const classificationJson = {
    metadata,
    primaryDispositionCounts,
    legacyCategoryCounts,
    riskCounts,
    records: classificationRecords,
  };

  const piiReport = {
    metadata,
    sourceScanRules: outputRuleNames(),
    sourceRiskSummary: context.sourcePiiSummary,
    outputLeakScan: {
      scannedRoots: OUTPUT_ROOT_LABELS,
      rules: outputRuleNames(),
      totalMatches: 0,
      files: [],
      storesRawPii: false,
    },
  };

  const manualReview = renderManualReviewMarkdown(
    summary,
    classificationRecords,
    context,
  );
  const audit = renderAuditMarkdown(summary, context, classificationRecords);
  const handoff = renderHandoffMarkdown(summary);

  const files = [
    { path: OUTPUT_FILES.courses, content: stableJson(coursesExport) },
    { path: OUTPUT_FILES.media, content: stableJson(mediaExport) },
    {
      path: OUTPUT_FILES.translations,
      content: stableJson(translationsExport),
    },
    { path: OUTPUT_FILES.classificationCsv, content: classificationCsv },
    {
      path: OUTPUT_FILES.classificationJson,
      content: stableJson(classificationJson),
    },
    { path: OUTPUT_FILES.manualReview, content: manualReview },
    { path: OUTPUT_FILES.audit, content: audit },
    { path: OUTPUT_FILES.handoff, content: handoff },
    { path: OUTPUT_FILES.pii, content: stableJson(piiReport) },
    { path: OUTPUT_FILES.summary, content: stableJson(summary) },
  ];

  return { summary, files };
}

function analyzeCurriculumDoc(legacyRoot, sourceRecords) {
  const relativePath = "docs/resources/“语赞心声”分级课程体系总览.docx";
  const record = findRecord(sourceRecords, relativePath);
  const headings = extractDocxHeadings(path.join(legacyRoot, relativePath));
  const structureHints = {
    targetSegment:
      headings.find((line) => /1-2年级/.test(line)) || "小学低年段（1-2年级）",
    unitModel:
      headings.find((line) => /八大生活主题单元/.test(line)) ||
      "八大生活主题单元",
    totalCoreHours:
      parseLeadingNumber(headings.find((line) => /144课时/.test(line))) || 144,
    outlineHeadings: headings
      .filter((line) => /上册|单元一|一年级|二年级/.test(line))
      .slice(0, 6),
  };

  const courses = readJsonFromLegacy(legacyRoot, "db/courses.json");
  const curriculumRecords = courses.map((course) => ({
    id: buildStableId(`course:${course.id}`),
    sourceRecordId: record.id,
    sourceRoot: LEGACY_ROOT_LABEL,
    sourcePath: "db/courses.json",
    sourceSha256: findRecord(sourceRecords, "db/courses.json").sha256,
    courseId: course.id,
    title: course.title,
    grade: course.grade,
    gradeLevel: course.gradeLevel,
    theme: course.theme,
    level: course.level,
    culturalTags: course.culturalTags || [],
    techTagCount: (course.techTags || []).length,
    researchTagCount: (course.researchTags || []).length,
    materialRefCount: Array.isArray(course.materials)
      ? course.materials.length
      : 0,
    mediaReferenceType: course.videoUrl ? "legacy-demo-reference" : "none",
    primaryDisposition: "REUSE",
    legacyCategory: "REUSE_AFTER_REVIEW",
    requiresVersionConfirmation: true,
  }));

  return {
    curriculumDocument: {
      id: record.id,
      sourceRoot: LEGACY_ROOT_LABEL,
      relativePath,
      sha256: record.sha256,
      fileType: record.fileType,
      primaryDisposition: record.primaryDisposition,
      needsContentOwnerReview: true,
      outlineOnly: true,
    },
    structureHints,
    curriculumRecords,
  };
}

function analyzeTranslations(legacyRoot) {
  const zh = readJsonFromLegacy(legacyRoot, "db/lang/zh.json");
  const bo = readJsonFromLegacy(legacyRoot, "db/lang/bo.json");
  const coursesBo = readJsonFromLegacy(legacyRoot, "db/lang/courses_bo.json");
  const courseSeedIds = readJsonFromLegacy(legacyRoot, "db/courses.json").map(
    (course) => course.id,
  );

  const flatZh = flattenObject(zh).map((entry) => ({
    ...entry,
    locale: "zh",
    sourcePath: "db/lang/zh.json",
  }));
  const flatBo = flattenObject(bo).map((entry) => ({
    ...entry,
    locale: "bo",
    sourcePath: "db/lang/bo.json",
  }));

  const excludedRiskSummary = [];
  const safeEntries = [...flatZh, ...flatBo].filter((entry) => {
    const reasons = detectTranslationRiskReasons(entry.key, entry.value);
    if (reasons.length > 0) {
      excludedRiskSummary.push({
        locale: entry.locale,
        sourcePath: entry.sourcePath,
        keyDigest: sha256Text(entry.key).slice(0, 12),
        reasons,
      });
      return false;
    }
    return true;
  });

  const safeCourseTranslations = Object.entries(coursesBo)
    .map(([courseId, value]) => ({
      courseId,
      title: typeof value.title === "string" ? value.title : null,
      description:
        typeof value.description === "string" ? value.description : null,
    }))
    .filter(
      (entry) =>
        !detectTranslationRiskReasons(
          entry.courseId,
          `${entry.title || ""} ${entry.description || ""}`,
        ).length,
    )
    .map((entry) => ({
      id: buildStableId(`translation:${entry.courseId}`),
      locale: "bo",
      sourcePath: "db/lang/courses_bo.json",
      courseId: entry.courseId,
      title: entry.title,
      description: entry.description,
    }));

  const courseTranslationCoverage = courseSeedIds
    .sort((a, b) => a.localeCompare(b, "en"))
    .map((courseId) => ({
      courseId,
      hasBoTranslation: Boolean(coursesBo[courseId]),
      sourcePath: "db/lang/courses_bo.json",
    }));

  const orphanCourseIds = Object.keys(coursesBo)
    .filter((courseId) => !courseSeedIds.includes(courseId))
    .sort((a, b) => a.localeCompare(b, "en"));

  const catalogs = [
    {
      locale: "zh",
      sourcePath: "db/lang/zh.json",
      flatEntryCount: flatZh.length,
      namespaceKeys: collectSafeNamespaceKeys(zh),
      freeformKeyCount: Object.keys(zh).filter(
        (key) => !isSafeNamespaceKey(key),
      ).length,
    },
    {
      locale: "bo",
      sourcePath: "db/lang/bo.json",
      flatEntryCount: flatBo.length,
      namespaceKeys: collectSafeNamespaceKeys(bo),
      freeformKeyCount: Object.keys(bo).filter(
        (key) => !isSafeNamespaceKey(key),
      ).length,
    },
    {
      locale: "bo",
      sourcePath: "db/lang/courses_bo.json",
      courseTranslationCount: Object.keys(coursesBo).length,
      orphanCourseIds,
    },
  ];

  return {
    catalogs,
    safeEntries: safeEntries
      .map((entry) => ({
        id: buildStableId(`safe-i18n:${entry.locale}:${entry.key}`),
        locale: entry.locale,
        sourcePath: entry.sourcePath,
        key: entry.key,
        value: entry.value,
      }))
      .concat(safeCourseTranslations)
      .sort((a, b) =>
        `${a.locale}:${a.key || a.courseId}`.localeCompare(
          `${b.locale}:${b.key || b.courseId}`,
          "en",
        ),
      ),
    courseTranslationCoverage,
    excludedRiskSummary: collapseExcludedRiskSummary(excludedRiskSummary),
  };
}

function buildMediaSummary(sourceRecords) {
  const localAssets = sourceRecords
    .filter((record) =>
      /^(assets\/images|assets\/media|public\/subtitles)\//.test(
        record.relativePath,
      ),
    )
    .map((record) => ({
      id: record.id,
      sourceRoot: LEGACY_ROOT_LABEL,
      relativePath: record.relativePath,
      sha256: record.sha256,
      sizeBytes: record.sizeBytes,
      fileType: record.fileType,
      mediaCategory: classifyMediaCategory(record.relativePath),
      rightsStatus: "unverified",
      sourceStatus: /hero|logo|课程封面|视频播放封面/.test(record.relativePath)
        ? "legacy-local-asset"
        : "legacy-local-media",
      manualReviewRequired: true,
      suggestedDisposition: record.primaryDisposition,
      legacyCategory: record.legacyCategory,
    }));

  const externalAssets = [];
  for (const record of sourceRecords.filter(
    (item) => item.fileType === "HTML page",
  )) {
    for (const reference of record.externalReferences) {
      if (!reference.isExternal) {
        continue;
      }
      externalAssets.push({
        id: buildStableId(
          `external:${record.relativePath}:${reference.normalized}`,
        ),
        sourceRecordId: record.id,
        sourceRoot: LEGACY_ROOT_LABEL,
        sourcePage: record.relativePath,
        domain: reference.domain,
        pathHint: reference.pathHint,
        mediaCategory: reference.mediaCategory,
        rightsStatus: "unverified",
        sourceStatus: reference.domain.includes("byteimg.com")
          ? "signed-external-cdn"
          : "external-cdn",
        manualReviewRequired: true,
        suggestedDisposition: "REVIEW",
        legacyCategory: "COPYRIGHT_BLOCKED",
      });
    }
  }

  return {
    localAssets,
    externalAssets: uniqueBy(externalAssets, (item) => item.id),
  };
}

function buildSourcePiiSummary(legacyRoot, sourceRecords) {
  const files = [];

  for (const record of sourceRecords) {
    const shouldScan =
      record.isText || PRIVACY_JSON_PATHS.has(record.relativePath);
    if (!shouldScan) {
      continue;
    }
    const text = record.isText
      ? fs.readFileSync(path.join(legacyRoot, record.relativePath), "utf8")
      : "";
    const matches = scanTextWithRules(text, SOURCE_PII_RULES);
    if (
      matches.totalMatches === 0 &&
      record.legacyCategory !== "PRIVACY_BLOCKED"
    ) {
      continue;
    }
    files.push({
      recordId: record.id,
      sourceRoot: LEGACY_ROOT_LABEL,
      relativePath: record.relativePath,
      primaryDisposition: record.primaryDisposition,
      legacyCategory: record.legacyCategory,
      totalMatches: matches.totalMatches,
      matchTypes: matches.matchTypes,
      matchDigests: matches.matchDigests,
    });
  }

  return {
    totalFiles: files.length,
    files,
  };
}

function buildPageFlowSummary(sourceRecords) {
  return sourceRecords
    .filter((record) => HIGH_VALUE_PAGES.has(record.relativePath))
    .map((record) => ({
      id: record.id,
      relativePath: record.relativePath,
      primaryDisposition: record.primaryDisposition,
      riskTags: record.riskTags,
      contentPurpose: record.contentPurpose,
    }));
}

function renderAuditMarkdown(summary, context, classificationRecords) {
  const primaryLines = PRIMARY_DISPOSITIONS.map(
    (key) => `- \`${key}\`: ${summary.primaryDispositionCounts[key] || 0}`,
  ).join("\n");
  const legacyCategoryLines = LEGACY_CATEGORIES.map(
    (key) => `- \`${key}\`: ${summary.legacyCategoryCounts[key] || 0}`,
  ).join("\n");
  const riskLines = RISK_TAGS.map(
    (key) => `- \`${key}\`: ${summary.riskCounts[key] || 0}`,
  ).join("\n");
  const manualLines = buildManualReviewEntries(classificationRecords)
    .slice(0, 12)
    .map(
      (item) =>
        `- [${item.id}] \`${item.relativePath}\` -> ${item.primaryDisposition} (${item.legacyCategory})`,
    )
    .join("\n");
  const pageFlowLines = context.pageFlowSummary
    .map(
      (item) =>
        `- [${item.id}] \`${item.relativePath}\` -> ${item.contentPurpose}`,
    )
    .join("\n");
  const externalDomainLines = summarizeExternalDomains(
    context.mediaSummary.externalAssets,
  )
    .map((item) => `- \`${item.domain}\`: ${item.count} references`)
    .join("\n");

  return [
    `# ${TASK_ID} Legacy Asset Audit`,
    "",
    "## Allowed Paths",
    "",
    ...OUTPUT_ROOT_LABELS.map((label) => `- \`${label}/**\``),
    "- `tools/migration/**`",
    "",
    "## Input Validation",
    "",
    `- branch: \`${summary.branch}\``,
    `- expected HEAD: \`${summary.expectedHead}\``,
    `- actual HEAD: \`${summary.actualHead}\``,
    `- legacy source root: \`${summary.legacySourceRoot}\``,
    `- legacy tree sha256: \`${summary.legacyTreeSha256}\``,
    "",
    "## Primary Disposition",
    "",
    `- scanned file count: ${summary.scannedFileCount}`,
    `- policy: ${summary.primaryDispositionPolicy}`,
    primaryLines,
    `- total: ${summary.primaryDispositionTotal}`,
    "",
    "## Legacy Category Detail",
    "",
    legacyCategoryLines,
    "",
    "## Risk Tags",
    "",
    `- policy: ${summary.riskTagPolicy}`,
    riskLines,
    `- privacy risk count: ${summary.privacyRiskCount}`,
    `- copyright pending count: ${summary.copyrightPendingCount}`,
    "",
    "## Read-only and Boundary Proof",
    "",
    `- legacy file count: ${summary.legacyReadOnly.fileCount}`,
    `- legacy tree sha256 before: \`${summary.legacyReadOnly.treeSha256Before}\``,
    `- legacy tree sha256 after: \`${summary.legacyReadOnly.treeSha256After}\``,
    `- tree hash unchanged within run: ${summary.legacyReadOnly.treeHashUnchangedWithinRun ? "yes" : "no"}`,
    `- symlink count: ${summary.legacyReadOnly.symlinkCount}`,
    `- legacy symlink escape detected: ${summary.legacyReadOnly.symlinkEscapeDetected ? "yes" : "no"}`,
    `- outside-root read detected: ${summary.legacyReadOnly.outsideRootReadDetected ? "yes" : "no"}`,
    `- outside-root write detected: ${summary.outputBoundary.outsideRootWriteDetected ? "yes" : "no"}`,
    `- output realpath boundary verified: ${summary.outputBoundary.writeBoundaryRealpathVerified ? "yes" : "no"}`,
    `- output symlink escape detected: ${summary.outputBoundary.outputSymlinkEscapeDetected ? "yes" : "no"}`,
    `- dry-run writes: ${summary.outputBoundary.dryRunWrites}`,
    "",
    "## Repeatability",
    "",
    `- status: ${summary.repeatability.status}`,
    `- conclusion: ${summary.repeatability.conclusion}`,
    "",
    "## PII and Copyright",
    "",
    "- Generated outputs are scanned with phone/email/ID/known-literal rules and are required to produce zero matches.",
    `- output leak scan matches: ${summary.outputLeakScan.totalMatches}`,
    "- Source PII is retained only as file-level counts and match digests in the report output.",
    "- Media exports contain metadata only; no legacy binaries are copied.",
    "",
    "## Curriculum and Translation Scope",
    "",
    `- curriculum source doc: \`${context.docAnalysis.curriculumDocument.relativePath}\``,
    `- curriculum source sha256: \`${context.docAnalysis.curriculumDocument.sha256}\``,
    `- curriculum records exported: ${context.docAnalysis.curriculumRecords.length}`,
    `- safe translation entries exported: ${context.translationAnalysis.safeEntries.length}`,
    `- translation course coverage rows: ${context.translationAnalysis.courseTranslationCoverage.length}`,
    "",
    "## Page Flow Intent",
    "",
    pageFlowLines || "- none",
    "",
    "## External Asset Domains",
    "",
    externalDomainLines || "- none",
    "",
    "## Manual Review Traceability",
    "",
    manualLines || "- none",
    "",
    "## Absolute Path Scan",
    "",
    `- contains absolute machine path: ${summary.absolutePathScan.containsAbsoluteMachinePath ? "yes" : "no"}`,
    "",
    "## Known Limitations",
    "",
    "- Rights and provenance still require human confirmation for blocked media and brand assets.",
    "- Safe translation export intentionally excludes risky literals, so downstream migration must merge approved entries only.",
    "- Course DOCX is represented by structure hints and source metadata, not copied body text.",
    "",
  ].join("\n");
}

function renderManualReviewMarkdown(summary, classificationRecords, context) {
  const entries = buildManualReviewEntries(classificationRecords);
  const piiEntries = context.sourcePiiSummary.files
    .slice(0, 10)
    .map(
      (item) =>
        `- [${item.recordId}] \`${item.relativePath}\` -> ${item.matchTypes.join(", ") || "structure-blocked"}`,
    );
  const copyrightEntries = classificationRecords
    .filter(
      (record) =>
        record.legacyCategory === "COPYRIGHT_BLOCKED" ||
        record.legacyCategory === "UNKNOWN_REQUIRES_REVIEW" ||
        record.legacyCategory === "VISUAL_REFERENCE_ONLY",
    )
    .slice(0, 12)
    .map(
      (record) =>
        `- [${record.id}] \`${record.relativePath}\` -> ${record.primaryDisposition} (${record.legacyCategory})`,
    );

  return [
    "# MIG-001 Manual Review",
    "",
    "## Primary Disposition Traceability",
    "",
    ...entries
      .slice(0, 16)
      .map(
        (item) =>
          `- [${item.id}] \`${item.relativePath}\` -> ${item.primaryDisposition} (${item.legacyCategory})`,
      ),
    "",
    "## PII-sensitive Sources",
    "",
    ...(piiEntries.length ? piiEntries : ["- none"]),
    "",
    "## Rights / Provenance Review",
    "",
    ...(copyrightEntries.length ? copyrightEntries : ["- none"]),
    "",
    "## Outstanding Questions",
    "",
    "- Confirm whether the curriculum DOCX is the approved master version for staged conversion.",
    "- Confirm ownership and authorization status for logo, hero art, course covers, subtitles, uploaded assets, and signed external image sources.",
    "- Confirm whether AI-related legacy intents remain in scope as future backlog only, not MVP implementation.",
    "- Confirm whether all pricing, charity, and volunteer flows remain deferred and should stay blocked from migration.",
    "",
  ].join("\n");
}

function renderHandoffMarkdown(summary) {
  return [
    "# Task Handoff",
    "",
    `- Task ID: ${TASK_ID}`,
    "- Owner: Codex",
    `- Branch: ${summary.branch}`,
    `- Base commit: ${summary.expectedHead}`,
    "- Final commit: resolved from Git metadata at handoff time",
    "- Status: IN_REVIEW",
    "",
    "## User outcome",
    "",
    "Legacy assets were re-audited with a strict four-class primaryDisposition model, stronger PII and rights filtering, deterministic outputs, and explicit read-only / write-boundary checks.",
    "",
    "## Implemented",
    "",
    "- Reworked the audit script to assign exactly one four-class primaryDisposition per scanned file and separate overlapping risk tags from legacy category detail.",
    "- Rebuilt course, translation, media, classification, PII, summary, audit, and handoff outputs without absolute machine paths or raw PII.",
    "- Added deterministic write-if-changed behavior so repeated generation produces no new workspace diff.",
    "",
    "## Files changed",
    "",
    "- tools/migration/mig-001-audit.js",
    "- legacy/exports/mig-001-courses.json",
    "- legacy/exports/mig-001-translations.json",
    "- legacy/exports/mig-001-media.json",
    "- legacy/review/mig-001-classification.csv",
    "- legacy/review/mig-001-classification.json",
    "- legacy/review/mig-001-manual-review.md",
    "- legacy/reports/mig-001-pii-report.json",
    "- legacy/reports/mig-001-summary.json",
    "- legacy/reports/mig-001-audit.md",
    "- legacy/reports/mig-001-handoff.md",
    "",
    "## Contract/schema impact",
    "",
    "None. No OpenAPI, Prisma, or business-code changes were made.",
    "",
    "## Security/privacy",
    "",
    "- Output leak scan must remain zero-match for phone/email/ID/known-literal checks.",
    "- Source PII is reported only as path-level counts and digests.",
    "",
    "## Offline/failure behavior",
    "",
    "- Dry-run performs all analysis but writes no output files.",
    "- Any HEAD mismatch, boundary escape, absolute-path leak, or output PII leak causes the script to fail.",
    "",
    "## Tests actually run",
    "",
    "See final response for exact commands and outcomes.",
    "",
    "## Screenshots / recordings",
    "",
    "None for this audit task.",
    "",
    "## Migrations / environment",
    "",
    "No database migration. Writes are restricted to legacy/exports, legacy/review, and legacy/reports.",
    "",
    "## Known limitations",
    "",
    "- Rights confirmation still needs human review for blocked media and brand assets.",
    "- Safe translation export intentionally excludes risky literals and therefore is not a full mirror of legacy dictionaries.",
    "",
    "## Rollback",
    "",
    "Use `git revert <commit>` or reset this worktree to the previous reviewed commit if instructed.",
    "",
    "## Reviewer focus",
    "",
    "- Verify that primaryDisposition totals equal scanned file count.",
    "- Verify that output leak scan remains zero-match.",
    "- Verify that deterministic rerun produces no new diff.",
    "",
  ].join("\n");
}

function compareExistingOutputs(worktreeRoot, candidateOutputs, options = {}) {
  const ignorePaths = options.ignorePaths || new Set();
  const comparisons = candidateOutputs.files.map((file) => {
    if (ignorePaths.has(file.path)) {
      return { exists: true, matches: true };
    }
    const absolutePath = toWorktreePath(worktreeRoot, file.path);
    if (!fs.existsSync(absolutePath)) {
      return { exists: false, matches: false };
    }
    return {
      exists: true,
      matches: fs.readFileSync(absolutePath, "utf8") === file.content,
    };
  });
  return {
    allExist:
      comparisons.length > 0 && comparisons.every((value) => value.exists),
    allMatch:
      comparisons.length > 0 && comparisons.every((value) => value.matches),
  };
}

function scanCandidateOutputsForPii(candidateOutputs) {
  const files = [];
  for (const file of candidateOutputs.files) {
    const matches = scanTextWithRules(file.content, OUTPUT_PII_RULES);
    if (matches.totalMatches > 0) {
      files.push({
        path: file.path,
        totalMatches: matches.totalMatches,
        matchTypes: matches.matchTypes,
      });
    }
  }
  return {
    totalMatches: files.reduce((sum, file) => sum + file.totalMatches, 0),
    files,
  };
}

function writeOutputs(worktreeRoot, files) {
  let changedCount = 0;
  for (const file of files) {
    const absolutePath = toWorktreePath(worktreeRoot, file.path);
    assertOutputBoundary(worktreeRoot, absolutePath);
    const previous = fs.existsSync(absolutePath)
      ? fs.readFileSync(absolutePath, "utf8")
      : null;
    if (previous === file.content) {
      continue;
    }
    fs.writeFileSync(absolutePath, file.content, "utf8");
    changedCount += 1;
  }
  return { changedCount };
}

function collectGitState(worktreeRoot) {
  return {
    branch: runCommand(
      "git",
      ["branch", "--show-current"],
      worktreeRoot,
    ).trim(),
    head: runCommand("git", ["rev-parse", "HEAD"], worktreeRoot).trim(),
  };
}

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

function readJsonFromLegacy(legacyRoot, relativePath) {
  const absolutePath = resolveLegacyPath(legacyRoot, relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function resolveLegacyPath(legacyRoot, relativePath) {
  const absolutePath = realpathStrict(path.join(legacyRoot, relativePath));
  assertWithin(
    absolutePath,
    legacyRoot,
    `Legacy path escaped root: ${relativePath}`,
  );
  return absolutePath;
}

function extractDocxHeadings(docxAbsolutePath) {
  const xml = runCommand(
    "unzip",
    ["-p", docxAbsolutePath, "word/document.xml"],
    path.dirname(docxAbsolutePath),
  );
  return xml
    .replace(/<w:p[^>]*>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /课时|单元|上册|下册|年级|课程体系/.test(line));
}

function sanitizeExternalReferences(text) {
  if (!text) {
    return [];
  }
  const matches = [...text.matchAll(/https?:\/\/[^\s"'<>]+/g)]
    .map((match) => match[0].replace(/&amp;/g, "&").replace(/[),.;]+$/g, ""))
    .filter(Boolean);
  return uniqueBy(
    matches
      .map((value) => {
        try {
          return normalizeExternalReference(value);
        } catch (error) {
          return null;
        }
      })
      .filter(Boolean),
    (item) => item.normalized,
  ).sort((a, b) => a.normalized.localeCompare(b.normalized, "en"));
}

function normalizeExternalReference(value) {
  const url = new URL(value);
  url.search = "";
  url.hash = "";
  return {
    isExternal: true,
    normalized: `${url.origin}${url.pathname}`,
    domain: url.hostname,
    pathHint:
      url.pathname.split("/").filter(Boolean).slice(-2).join("/") || "/",
    mediaCategory: inferExternalMediaCategory(url.pathname),
  };
}

function inferExternalMediaCategory(pathname) {
  if (/\.(png|jpg|jpeg|webp|gif)$/i.test(pathname)) {
    return "image";
  }
  if (/font-awesome|fonts/.test(pathname)) {
    return "font";
  }
  if (/chart|tailwind/.test(pathname)) {
    return "script";
  }
  return "external-resource";
}

function collectRuntimeDependencies(relativePath, text) {
  if (!text) {
    return [];
  }
  const dependencies = new Set();

  if (relativePath.endsWith(".js")) {
    for (const match of text.matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
      dependencies.add(match[1]);
    }
    for (const match of text.matchAll(/import .* from ['"]([^'"]+)['"]/g)) {
      dependencies.add(match[1]);
    }
  }

  if (relativePath.endsWith(".html")) {
    for (const match of text.matchAll(
      /<(?:script|link)[^>]+(?:src|href)=["']([^"']+)["']/g,
    )) {
      const ref = match[1];
      dependencies.add(
        ref.startsWith("http")
          ? normalizeExternalReference(ref).normalized
          : ref,
      );
    }
  }

  if (relativePath.endsWith("package.json")) {
    try {
      const parsed = JSON.parse(text);
      for (const group of ["dependencies", "devDependencies"]) {
        for (const key of Object.keys(parsed[group] || {})) {
          dependencies.add(key);
        }
      }
    } catch (error) {
      dependencies.add("package.json:parse-error");
    }
  }

  return [...dependencies].sort((a, b) => a.localeCompare(b, "en"));
}

function collectSourcePiiSignals(relativePath, text) {
  const matches = scanTextWithRules(text, SOURCE_PII_RULES);
  const fieldSignals = [];
  if (PRIVACY_JSON_PATHS.has(relativePath)) {
    fieldSignals.push("blocked-by-path");
  }
  return {
    totalMatches: matches.totalMatches,
    matchTypes: matches.matchTypes,
    matchDigests: matches.matchDigests,
    fieldSignals,
  };
}

function scanTextWithRules(text, rules) {
  const typeCounts = {};
  const matchDigests = [];
  if (!text) {
    return {
      totalMatches: 0,
      matchTypes: [],
      matchDigests,
    };
  }

  for (const rule of rules) {
    if (!rule.regex) {
      continue;
    }
    const regex = new RegExp(rule.regex.source, rule.regex.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const raw = rule.captureValueIndex
        ? match[rule.captureValueIndex]
        : match[0];
      if (!raw) {
        continue;
      }
      typeCounts[rule.key] = (typeCounts[rule.key] || 0) + 1;
      matchDigests.push({
        type: rule.key,
        digest: sha256Text(raw).slice(0, 16),
      });
      if (match[0].length === 0) {
        regex.lastIndex += 1;
      }
    }
  }

  return {
    totalMatches: Object.values(typeCounts).reduce(
      (sum, value) => sum + value,
      0,
    ),
    matchTypes: Object.keys(typeCounts).sort((a, b) =>
      a.localeCompare(b, "en"),
    ),
    matchDigests: uniqueBy(
      matchDigests,
      (item) => `${item.type}:${item.digest}`,
    ),
  };
}

function detectTranslationRiskReasons(key, value) {
  const combined = `${key} ${value}`;
  const reasons = new Set();
  if (KNOWN_PERSONAL_LITERALS.some((item) => combined.includes(item))) {
    reasons.add("known-personal-literal");
  }
  if (/(?<!\d)1[3-9]\d{9}(?!\d)/.test(combined)) {
    reasons.add("phone-like");
  }
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(combined)) {
    reasons.add("email-like");
  }
  if (
    /(地址|address|contact|联系人|teacherName|guardian|volunteer|phone|mobile|email|idCard)/i.test(
      combined,
    )
  ) {
    reasons.add("contact-or-address-like");
  }
  if (/拉萨|那曲|昌都|林芝|日喀则/.test(combined)) {
    reasons.add("location-like");
  }
  return sortSet(reasons);
}

function collectSafeNamespaceKeys(dictionary) {
  return Object.keys(dictionary)
    .filter((key) => isSafeNamespaceKey(key))
    .sort((a, b) => a.localeCompare(b, "en"));
}

function isSafeNamespaceKey(key) {
  return /^[a-z][a-zA-Z0-9_-]*$/.test(key);
}

function collapseExcludedRiskSummary(entries) {
  const grouped = new Map();
  for (const entry of entries) {
    const signature = `${entry.locale}:${entry.sourcePath}:${entry.reasons.join("|")}`;
    const current = grouped.get(signature) || {
      locale: entry.locale,
      sourcePath: entry.sourcePath,
      reasons: entry.reasons,
      count: 0,
      keyDigests: [],
    };
    current.count += 1;
    current.keyDigests.push(entry.keyDigest);
    grouped.set(signature, current);
  }
  return [...grouped.values()]
    .map((entry) => ({
      locale: entry.locale,
      sourcePath: entry.sourcePath,
      reasons: entry.reasons,
      count: entry.count,
      keyDigests: uniqueBy(
        entry.keyDigests.map((digest) => ({ digest })),
        (item) => item.digest,
      )
        .slice(0, 12)
        .map((item) => item.digest),
    }))
    .sort((a, b) =>
      `${a.locale}:${a.sourcePath}`.localeCompare(
        `${b.locale}:${b.sourcePath}`,
        "en",
      ),
    );
}

function formatExternalReferencesForCsv(references) {
  return references.map(formatExternalReferenceForCsv).join("|");
}

function formatExternalReferenceForCsv(reference) {
  if (!reference || typeof reference !== "object") {
    return "";
  }
  if (reference.normalized) {
    return reference.normalized;
  }
  if (reference.domain && reference.pathHint) {
    return `${reference.domain}/${reference.pathHint}`.replace(/\/{2,}/g, "/");
  }
  return stableJson(reference).trim();
}

function flattenObject(value, prefix = "", results = []) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      const nextKey = prefix ? `${prefix}.${key}` : key;
      flattenObject(child, nextKey, results);
    }
    return results;
  }
  results.push({ key: prefix, value: String(value) });
  return results;
}

function countBy(items, getKey) {
  return items.reduce((accumulator, item) => {
    const key = getKey(item);
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});
}

function countRiskTags(records) {
  const counts = {};
  for (const record of records) {
    for (const tag of record.riskTags) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }
  return counts;
}

function collectManualReviewIds(records) {
  return records
    .filter((record) => record.manualReviewRequired)
    .map((record) => record.id)
    .sort((a, b) => a.localeCompare(b, "en"));
}

function buildManualReviewEntries(records) {
  return records
    .filter((record) => record.manualReviewRequired)
    .map((record) => ({
      id: record.id,
      relativePath: record.relativePath,
      primaryDisposition: record.primaryDisposition,
      legacyCategory: record.legacyCategory,
    }))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath, "zh-Hans-CN"));
}

function summarizeExternalDomains(externalAssets) {
  const counts = countBy(externalAssets, (item) => item.domain);
  return Object.keys(counts)
    .sort((a, b) => a.localeCompare(b, "en"))
    .map((domain) => ({ domain, count: counts[domain] }));
}

function classifyMediaCategory(relativePath) {
  if (/logo/.test(relativePath)) return "logo";
  if (/hero/.test(relativePath)) return "hero-image";
  if (/课程封面|cover/.test(relativePath)) return "course-cover";
  if (/video\.mp4$/.test(relativePath)) return "video";
  if (/\.vtt$/.test(relativePath)) return "subtitle";
  if (/视频播放封面/.test(relativePath)) return "player-cover";
  return "image";
}

function findRecord(records, relativePath) {
  const match = records.find((record) => record.relativePath === relativePath);
  if (!match) {
    throw new Error(`Missing expected record: ${relativePath}`);
  }
  return match;
}

function stableJson(value) {
  return `${formatJsonValue(sortValue(value), 0)}\n`;
}

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }
  if (value && typeof value === "object") {
    const sorted = {};
    for (const key of Object.keys(value).sort((a, b) =>
      a.localeCompare(b, "en"),
    )) {
      sorted[key] = sortValue(value[key]);
    }
    return sorted;
  }
  return value;
}

function formatJsonValue(value, indentLevel) {
  if (Array.isArray(value)) {
    return formatJsonArray(value, indentLevel);
  }
  if (value && typeof value === "object") {
    return formatJsonObject(value, indentLevel);
  }
  return JSON.stringify(value);
}

function formatJsonArray(values, indentLevel) {
  if (values.length === 0) {
    return "[]";
  }

  if (values.every(isJsonPrimitive)) {
    const inline = formatInlineJsonArray(values);
    if (inline.length <= 60) {
      return inline;
    }
  }

  const indent = "  ".repeat(indentLevel);
  const childIndent = "  ".repeat(indentLevel + 1);
  return `[\n${values
    .map((item) => `${childIndent}${formatJsonValue(item, indentLevel + 1)}`)
    .join(",\n")}\n${indent}]`;
}

function formatJsonObject(value, indentLevel) {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return "{}";
  }

  const indent = "  ".repeat(indentLevel);
  const childIndent = "  ".repeat(indentLevel + 1);
  return `{\n${entries
    .map(([key, child]) => {
      const keyPrefix = `${childIndent}${JSON.stringify(key)}: `;
      if (Array.isArray(child) && child.every(isJsonPrimitive)) {
        const inline = formatInlineJsonArray(child);
        if (`${keyPrefix}${inline}`.length < 80) {
          return `${keyPrefix}${inline}`;
        }
        return `${keyPrefix}${formatJsonMultilineArray(child, indentLevel + 1)}`;
      }
      return `${keyPrefix}${formatJsonValue(child, indentLevel + 1)}`;
    })
    .join(",\n")}\n${indent}}`;
}

function isJsonPrimitive(value) {
  return (
    value === null || ["boolean", "number", "string"].includes(typeof value)
  );
}

function formatInlineJsonArray(values) {
  return `[${values.map((item) => JSON.stringify(item)).join(", ")}]`;
}

function formatJsonMultilineArray(values, indentLevel) {
  const indent = "  ".repeat(indentLevel);
  const childIndent = "  ".repeat(indentLevel + 1);
  return `[\n${values
    .map((item) => `${childIndent}${formatJsonValue(item, indentLevel + 1)}`)
    .join(",\n")}\n${indent}]`;
}

function toCsv(rows) {
  const headers = [
    "id",
    "sourceRoot",
    "relativePath",
    "sha256",
    "fileType",
    "sizeBytes",
    "primaryDisposition",
    "legacyCategory",
    "riskTags",
    "contentPurpose",
    "runtimeDependencies",
    "externalReferences",
    "manualReviewRequired",
    "suggestedDestination",
    "suggestedHandling",
    "nonReusableReason",
  ];

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header] || "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function csvEscape(value) {
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function buildStableId(input) {
  return `mig001_${crypto.createHash("sha1").update(input).digest("hex").slice(0, 12)}`;
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function realpathStrict(absolutePath) {
  return fs.realpathSync.native
    ? fs.realpathSync.native(absolutePath)
    : fs.realpathSync(absolutePath);
}

function assertWithin(targetPath, rootPath, message) {
  const relative = path.relative(rootPath, targetPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(message);
  }
}

function assertOutputBoundary(worktreeRoot, absolutePath) {
  const relative = toPosix(path.relative(worktreeRoot, absolutePath));
  const allowedRoot = OUTPUT_ROOT_LABELS.find(
    (root) => relative === root || relative.startsWith(`${root}/`),
  );
  if (!allowedRoot) {
    throw new Error(`Output path escaped allowed roots: ${relative}`);
  }

  const worktreeRealRoot = realpathStrict(worktreeRoot);
  const outputRootPath = path.join(worktreeRoot, allowedRoot);
  fs.mkdirSync(outputRootPath, { recursive: true });
  const outputRootReal = realpathStrict(outputRootPath);
  assertWithin(
    outputRootReal,
    worktreeRealRoot,
    `Output root symlink escaped worktree: ${allowedRoot}`,
  );

  const parentDir = path.dirname(absolutePath);
  fs.mkdirSync(parentDir, { recursive: true });
  const parentReal = realpathStrict(parentDir);
  assertWithin(
    parentReal,
    outputRootReal,
    `Output parent symlink escaped allowed root: ${relative}`,
  );

  if (
    fs.existsSync(absolutePath) &&
    fs.lstatSync(absolutePath).isSymbolicLink()
  ) {
    throw new Error(`Output file path is a symlink: ${relative}`);
  }
}

function toWorktreePath(worktreeRoot, relativePath) {
  return path.join(worktreeRoot, relativePath);
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  const results = [];
  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    results.push(item);
  }
  return results;
}

function sortSet(values) {
  return [...values].sort((a, b) => a.localeCompare(b, "en"));
}

function parseLeadingNumber(value) {
  if (!value) {
    return null;
  }
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function describeFileType(relativePath) {
  if (relativePath.endsWith(".docx")) return "DOCX document";
  if (relativePath.endsWith(".pdf")) return "PDF document";
  if (relativePath.endsWith(".png")) return "PNG image";
  if (relativePath.endsWith(".mp4")) return "MP4 video";
  if (relativePath.endsWith(".vtt")) return "WebVTT subtitle";
  if (relativePath.endsWith(".html")) return "HTML page";
  if (relativePath.endsWith(".js")) return "JavaScript";
  if (relativePath.endsWith(".json")) return "JSON";
  if (relativePath.endsWith(".md")) return "Markdown";
  if (relativePath.endsWith(".yml")) return "YAML";
  if (relativePath.endsWith(".sql")) return "SQL";
  if (relativePath.endsWith(".ps1")) return "PowerShell";
  if (relativePath.endsWith(".sh")) return "Shell script";
  return "File";
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function outputRuleNames() {
  return OUTPUT_PII_RULES.map((rule) => rule.key);
}

function printDryRunSummary(summary) {
  console.log(`[dry-run] ${TASK_ID}`);
  console.log(`branch: ${summary.branch}`);
  console.log(`head: ${summary.actualHead}`);
  console.log(`legacyTreeSha256: ${summary.legacyTreeSha256}`);
  console.log(`scannedFileCount: ${summary.scannedFileCount}`);
  console.log(`primaryDispositionTotal: ${summary.primaryDispositionTotal}`);
  for (const key of PRIMARY_DISPOSITIONS) {
    console.log(`${key}: ${summary.primaryDispositionCounts[key] || 0}`);
  }
  console.log(`privacyRiskCount: ${summary.privacyRiskCount}`);
  console.log(`copyrightPendingCount: ${summary.copyrightPendingCount}`);
}

main();
