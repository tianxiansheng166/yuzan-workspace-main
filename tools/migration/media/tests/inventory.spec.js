const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

const {
  classifyMedia,
  determineSourceType,
  determineRights,
  stableAssetId,
  stableObjectKeyHint,
  scanSource,
  buildAssets,
  runInventory,
  hashOutputs,
  sanitizeOutputValue,
  OUTPUT_FILES,
} = require("../index.js");

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mig003-test-"));
}

function writeFile(dir, relPath, content) {
  const fullPath = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  return fullPath;
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

// Minimal valid PNG: 1x1 transparent
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

// Minimal valid MP4 ftyp box
const MP4_BYTES = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00,
  0x00, 0x00, 0x00, 0x69, 0x73, 0x6f, 0x6d, 0x6d, 0x70, 0x34, 0x31,
]);

// Minimal valid PDF
const PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\n",
);

// Minimal valid ZIP (DOCX)
const ZIP_BYTES = Buffer.from([
  0x50, 0x4b, 0x03, 0x04, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x00,
  0x00, 0x00, 0x5b, 0x43, 0x6f, 0x6e, 0x74, 0x65, 0x6e, 0x74, 0x5f, 0x54, 0x79,
  0x70, 0x65, 0x73, 0x5d, 0x2e, 0x78, 0x6d, 0x6c, 0x50, 0x4b, 0x01, 0x02, 0x1f,
  0x00, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const VTT_BYTES = Buffer.from(
  "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello\n",
);

const WOFF2_BYTES = Buffer.from([
  0x77, 0x4f, 0x46, 0x32, 0x00, 0x00, 0x00, 0x00,
]);

describe("classifyMedia", () => {
  it("classifies PNG as image", () => {
    const r = classifyMedia(
      "logo.png",
      PNG_BYTES.length,
      PNG_BYTES.subarray(0, 64),
    );
    assert.strictEqual(r.kind, "image");
    assert.strictEqual(r.mediaType, "image/png");
    assert.strictEqual(r.confidence, "high");
  });

  it("classifies MP4 as video", () => {
    const r = classifyMedia(
      "clip.mp4",
      MP4_BYTES.length,
      MP4_BYTES.subarray(0, 64),
    );
    assert.strictEqual(r.kind, "video");
    assert.strictEqual(r.mediaType, "video/mp4");
    assert.strictEqual(r.confidence, "high");
  });

  it("classifies MP3 by extension as audio", () => {
    const r = classifyMedia("song.mp3", 100, Buffer.alloc(64));
    assert.strictEqual(r.kind, "audio");
    assert.strictEqual(r.mediaType, "audio/mpeg");
  });

  it("classifies WOFF2 as font", () => {
    const r = classifyMedia(
      "icon.woff2",
      WOFF2_BYTES.length,
      WOFF2_BYTES.subarray(0, 64),
    );
    assert.strictEqual(r.kind, "font");
    assert.strictEqual(r.mediaType, "font/woff2");
    assert.strictEqual(r.confidence, "high");
  });

  it("classifies PDF as document", () => {
    const r = classifyMedia(
      "report.pdf",
      PDF_BYTES.length,
      PDF_BYTES.subarray(0, 64),
    );
    assert.strictEqual(r.kind, "document");
    assert.strictEqual(r.mediaType, "application/pdf");
    assert.strictEqual(r.confidence, "high");
  });

  it("classifies DOCX as document", () => {
    const r = classifyMedia(
      "notes.docx",
      ZIP_BYTES.length,
      ZIP_BYTES.subarray(0, 64),
    );
    assert.strictEqual(r.kind, "document");
    assert.ok(r.mediaType.includes("officedocument"));
  });

  it("classifies VTT as document", () => {
    const r = classifyMedia(
      "sample_zh.vtt",
      VTT_BYTES.length,
      VTT_BYTES.subarray(0, 64),
    );
    assert.strictEqual(r.kind, "document");
    assert.strictEqual(r.mediaType, "text/vtt");
  });

  it("classifies unknown extension as unknown", () => {
    const r = classifyMedia("data.xyz", 100, Buffer.alloc(64));
    assert.strictEqual(r.kind, "unknown");
    assert.strictEqual(r.confidence, "low");
  });

  it("flags zero byte file as unknown", () => {
    const r = classifyMedia("empty.png", 0, Buffer.alloc(0));
    assert.strictEqual(r.kind, "unknown");
    assert.strictEqual(r.mediaType, "application/x-empty");
  });

  it("flags MIME conflict when extension and magic disagree", () => {
    const r = classifyMedia(
      "logo.jpg",
      PNG_BYTES.length,
      PNG_BYTES.subarray(0, 64),
    );
    assert.strictEqual(r.kind, "image");
    assert.strictEqual(r.mediaType, "image/png");
  });
});

describe("source typing and rights", () => {
  it("identifies internal asset images", () => {
    assert.strictEqual(
      determineSourceType("assets/images/logo.png"),
      "internal-asset-image",
    );
  });

  it("identifies user uploads", () => {
    assert.strictEqual(
      determineSourceType("uploads/covers/file.png"),
      "user-upload-cover",
    );
  });

  it("marks internal assets APPROVED/MIGRATE", () => {
    const r = determineRights("internal-asset-image", "image", "high");
    assert.strictEqual(r.rightsStatus, "APPROVED");
    assert.strictEqual(r.recommendedDisposition, "MIGRATE");
  });

  it("marks unknown provenance UNKNOWN/REVIEW", () => {
    const r = determineRights("user-upload-cover", "image", "high");
    assert.strictEqual(r.rightsStatus, "UNKNOWN");
    assert.strictEqual(r.recommendedDisposition, "REVIEW");
  });

  it("marks restricted screenshots REVIEW", () => {
    const r = determineRights("internal-dev-screenshot", "image", "high");
    assert.strictEqual(r.rightsStatus, "RESTRICTED");
    assert.strictEqual(r.recommendedDisposition, "REVIEW");
  });

  it("marks unknown format for REVIEW", () => {
    const r = determineRights("unknown", "unknown", "low");
    assert.strictEqual(r.rightsStatus, "UNKNOWN");
    assert.strictEqual(r.recommendedDisposition, "REVIEW");
    assert.strictEqual(r.reviewReasonCode, "unsupported-format");
  });
});

describe("stable IDs", () => {
  it("produces deterministic asset IDs", () => {
    const h = "a".repeat(64);
    assert.strictEqual(stableAssetId("image", h), stableAssetId("image", h));
    assert.ok(stableAssetId("image", h).startsWith("mig003-image-"));
  });

  it("produces deterministic object key hints", () => {
    const h = "b".repeat(64);
    const hint = stableObjectKeyHint("image", "zh", h, ".png");
    assert.strictEqual(hint, stableObjectKeyHint("image", "zh", h, ".png"));
    assert.ok(!hint.includes("/home"));
    assert.ok(!hint.includes("\\"));
  });
});

describe("scanSource security", () => {
  let sourceRoot;

  after(() => {
    if (sourceRoot) fs.rmSync(sourceRoot, { recursive: true, force: true });
  });

  it("rejects file symlink", () => {
    sourceRoot = tmpDir();
    writeFile(sourceRoot, "real.png", PNG_BYTES);
    fs.symlinkSync(
      path.join(sourceRoot, "real.png"),
      path.join(sourceRoot, "link.png"),
    );
    assert.throws(() => scanSource(sourceRoot), /Symlink/);
  });

  it("rejects directory symlink", () => {
    sourceRoot = tmpDir();
    fs.mkdirSync(path.join(sourceRoot, "realdir"));
    fs.symlinkSync(
      path.join(sourceRoot, "realdir"),
      path.join(sourceRoot, "linkdir"),
    );
    assert.throws(() => scanSource(sourceRoot), /Symlink/);
  });

  it("rejects ancestor symlink", () => {
    sourceRoot = tmpDir();
    const ancestor = path.dirname(sourceRoot);
    const linkName = path.join(ancestor, `mig003-ancestor-link-${Date.now()}`);
    fs.symlinkSync(sourceRoot, linkName);
    try {
      assert.throws(() => scanSource(linkName), /Symlink/);
    } finally {
      fs.unlinkSync(linkName);
    }
  });

  it("rejects dangling symlink", () => {
    sourceRoot = tmpDir();
    fs.symlinkSync(
      path.join(sourceRoot, "missing.png"),
      path.join(sourceRoot, "dangling.png"),
    );
    assert.throws(() => scanSource(sourceRoot), /Symlink/);
  });

  it("rejects path traversal", () => {
    sourceRoot = tmpDir();
    writeFile(sourceRoot, "real.png", PNG_BYTES);
    assert.throws(
      () => scanSource(`${sourceRoot}/../`),
      /Path outside source root/,
    );
  });
});

describe("inventory pipeline", () => {
  let sourceRoot;

  after(() => {
    if (sourceRoot) fs.rmSync(sourceRoot, { recursive: true, force: true });
  });

  it("computes SHA256 and duplicate groups", () => {
    sourceRoot = tmpDir();
    writeFile(sourceRoot, "a/logo.png", PNG_BYTES);
    writeFile(sourceRoot, "b/logo-copy.png", PNG_BYTES);
    writeFile(
      sourceRoot,
      "c/other.png",
      Buffer.concat([PNG_BYTES, Buffer.from([0x01])]),
    );
    const raw = scanSource(sourceRoot);
    const assets = buildAssets(raw);
    const dupes = assets.filter((a) => a.sourceKey.includes("logo"));
    assert.strictEqual(dupes.length, 2);
    assert.strictEqual(dupes[0].duplicateGroup, dupes[1].duplicateGroup);
    assert.notStrictEqual(
      dupes[0].duplicateGroup,
      assets.find((a) => a.sourceKey.includes("other")).duplicateGroup,
    );
    assert.ok(dupes[0].sha256);
    assert.strictEqual(dupes[0].sha256, dupes[1].sha256);
  });

  it("detects same name different content", () => {
    sourceRoot = tmpDir();
    writeFile(sourceRoot, "a/logo.png", PNG_BYTES);
    writeFile(
      sourceRoot,
      "b/logo.png",
      Buffer.concat([PNG_BYTES, Buffer.from([0x00])]),
    );
    const raw = scanSource(sourceRoot);
    const assets = buildAssets(raw);
    assert.strictEqual(assets.length, 2);
    assert.notStrictEqual(assets[0].sha256, assets[1].sha256);
  });

  it("reports missing alt for generic filenames", () => {
    sourceRoot = tmpDir();
    writeFile(sourceRoot, "assets/images/12345.png", PNG_BYTES);
    writeFile(sourceRoot, "assets/images/hero-banner.png", PNG_BYTES);
    const raw = scanSource(sourceRoot);
    const assets = buildAssets(raw);
    const generic = assets.find((a) => a.sourceKey.includes("12345"));
    const descriptive = assets.find((a) => a.sourceKey.includes("hero-banner"));
    assert.strictEqual(generic.altTextStatus, "MISSING");
    assert.strictEqual(descriptive.altTextStatus, "PRESENT");
  });

  it("matches video with subtitle files", () => {
    sourceRoot = tmpDir();
    writeFile(sourceRoot, "assets/media/lesson.mp4", MP4_BYTES);
    writeFile(sourceRoot, "public/subtitles/lesson_zh.vtt", VTT_BYTES);
    const raw = scanSource(sourceRoot);
    const assets = buildAssets(raw);
    const video = assets.find((a) => a.kind === "video");
    assert.strictEqual(video.captionStatus, "PRESENT");
    assert.strictEqual(video.transcriptStatus, "PRESENT");
  });

  it("is invariant to input order", () => {
    sourceRoot = tmpDir();
    writeFile(sourceRoot, "z/last.png", PNG_BYTES);
    writeFile(sourceRoot, "a/first.png", PNG_BYTES);
    writeFile(sourceRoot, "m/middle.png", PNG_BYTES);
    const hash1 = hashOutputs(
      runInventory({ sourceRoot, dryRun: true }).outputs,
    );
    const hash2 = hashOutputs(
      runInventory({ sourceRoot, dryRun: true }).outputs,
    );
    assert.strictEqual(hash1, hash2);
  });

  it("dry-run does not create output files", () => {
    sourceRoot = tmpDir();
    writeFile(sourceRoot, "assets/images/logo.png", PNG_BYTES);
    const outDir = tmpDir();
    runInventory({ sourceRoot, outputRoot: outDir, dryRun: true });
    assert.strictEqual(fs.readdirSync(outDir).length, 0);
  });

  it("atomic write leaves no temp files on success", () => {
    sourceRoot = tmpDir();
    writeFile(sourceRoot, "assets/images/logo.png", PNG_BYTES);
    const outDir = tmpDir();
    runInventory({ sourceRoot, outputRoot: outDir, dryRun: false });
    const files = fs.readdirSync(outDir, { recursive: true }).flat();
    assert.ok(files.some((f) => f.includes("mig-003-assets.json")));
    const tempFiles = files.filter((f) => String(f).includes(".tmp-"));
    assert.strictEqual(tempFiles.length, 0);
  });
});

describe("privacy and sanitization", () => {
  it("redacts absolute paths in output", () => {
    const value = sanitizeOutputValue(
      "file stored at /home/admin01/secret.png",
    );
    assert.ok(!value.includes("/home/admin01"));
    assert.ok(value.includes("[REDACTED]"));
  });

  it("redacts email-like strings", () => {
    const value = sanitizeOutputValue("contact admin@example.com");
    assert.ok(!value.includes("@example.com"));
  });

  it("does not include binary content in output", () => {
    const sourceRoot = tmpDir();
    writeFile(sourceRoot, "assets/images/logo.png", PNG_BYTES);
    const result = runInventory({ sourceRoot, dryRun: true });
    const json = result.outputs[OUTPUT_FILES.assetsJson];
    assert.ok(!json.includes(PNG_BYTES.toString("base64")));
    assert.ok(!json.includes(PNG_BYTES.toString("hex")));
    fs.rmSync(sourceRoot, { recursive: true, force: true });
  });

  it("does not include credential sentinels", () => {
    const value = sanitizeOutputValue("password is secret123");
    assert.ok(!value.toLowerCase().includes("password"));
  });
});

describe("determinism", () => {
  let sourceRoot;

  after(() => {
    if (sourceRoot) fs.rmSync(sourceRoot, { recursive: true, force: true });
  });

  it("produces identical hashes across three runs", () => {
    sourceRoot = tmpDir();
    writeFile(sourceRoot, "assets/images/logo.png", PNG_BYTES);
    writeFile(
      sourceRoot,
      "assets/images/hero.png",
      Buffer.concat([PNG_BYTES, Buffer.from([0x01])]),
    );
    writeFile(sourceRoot, "assets/media/lesson.mp4", MP4_BYTES);
    writeFile(sourceRoot, "docs/archive/report.pdf", PDF_BYTES);

    const hashes = [];
    for (let i = 0; i < 3; i++) {
      hashes.push(runInventory({ sourceRoot, dryRun: true }).runHash);
    }
    assert.strictEqual(hashes[0], hashes[1]);
    assert.strictEqual(hashes[1], hashes[2]);
  });
});

describe("dispositions are valid", () => {
  it("only emits allowed disposition values", () => {
    const sourceRoot = tmpDir();
    writeFile(sourceRoot, "assets/images/logo.png", PNG_BYTES);
    writeFile(sourceRoot, "uploads/cover.png", PNG_BYTES);
    writeFile(sourceRoot, "docs/archive/report.pdf", PDF_BYTES);
    writeFile(sourceRoot, ".codex/audit.png", PNG_BYTES);
    writeFile(sourceRoot, "unknown/file.xyz", Buffer.from("data"));
    writeFile(sourceRoot, "empty.png", Buffer.alloc(0));

    const raw = scanSource(sourceRoot);
    const assets = buildAssets(raw);
    const allowed = new Set([
      "MIGRATE",
      "REVIEW",
      "EXCLUDE",
      "DUPLICATE",
      "MISSING",
    ]);
    for (const asset of assets) {
      assert.ok(
        allowed.has(asset.recommendedDisposition),
        `invalid disposition ${asset.recommendedDisposition}`,
      );
    }

    fs.rmSync(sourceRoot, { recursive: true, force: true });
  });
});
