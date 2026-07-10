"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const {
  mkdtemp,
  mkdir,
  symlink,
  writeFile,
  rm,
  readFile,
  readdir,
  rename,
  lstat,
  unlink,
} = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { dirname, join, resolve } = require("node:path");
const { createHash } = require("node:crypto");

const { stableId, stableNodeId } = require("./stable-id.js");
const {
  guardPath,
  guardWriteTarget,
  ensureSafeDir,
  safeReadTextFile,
  safeReadJsonFile,
} = require("./path-guard.js");
const { scanForPii } = require("./pii-scanner.js");
const {
  createBilingualContent,
  mapLegacyTranslation,
} = require("./translation-mapper.js");
const {
  mapLegacyAssetToResourceRef,
  buildSafeObjectKey,
  containsLocalPath,
  detectKind,
  detectMediaType,
  mapRightsStatus,
} = require("./resource-mapper.js");
const { convertCourseRecord } = require("./course-converter.js");
const {
  classifyDisposition,
  publishEligibility,
  isValidDisposition,
} = require("./disposition.js");
const { runMigration } = require("./migrate-curriculum.js");
const { loadMig001Inputs } = require("./load-mig-001.js");
const { toCsv, writeTextFile } = require("./output-writer.js");

describe("stable-id", () => {
  it("returns the same id for the same input", () => {
    const a = stableId("course-version:primary-1-language-001", "mig002");
    const b = stableId("course-version:primary-1-language-001", "mig002");
    assert.strictEqual(a, b);
  });

  it("normalizes case and whitespace", () => {
    const a = stableId("  Course VERSION: A  ", "mig002");
    const b = stableId("course version: a", "mig002");
    assert.strictEqual(a, b);
  });

  it("throws on empty input", () => {
    assert.throws(() => stableId(""), TypeError);
    assert.throws(() => stableId(123), TypeError);
  });

  it("produces different ids for different inputs", () => {
    const a = stableId("a", "mig002");
    const b = stableId("b", "mig002");
    assert.notStrictEqual(a, b);
  });

  it("stableNodeId combines course, type and local key", () => {
    const id = stableNodeId("c1", "unit", "0");
    assert.match(id, /^mig002_[a-f0-9]{16}$/);
    const again = stableNodeId("c1", "unit", "0");
    assert.strictEqual(id, again);
  });
});

describe("path-guard", () => {
  let fixtureRoot;

  before(async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), "mig002-path-guard-"));
    await mkdir(join(fixtureRoot, "inside"));
    await mkdir(join(fixtureRoot, "outside"));
    await mkdir(join(fixtureRoot, "nested", "deep"), { recursive: true });
    // Create a real directory outside fixtureRoot for traversal tests.
    const outer = join(fixtureRoot, "..", "mig002-path-guard-outer");
    await mkdir(outer, { recursive: true });
  });

  after(async () => {
    await rm(fixtureRoot, { recursive: true, force: true });
    await rm(join(tmpdir(), "mig002-path-guard-outer"), {
      recursive: true,
      force: true,
    });
  });

  it("allows paths inside the root", async () => {
    const p = await guardPath(join(fixtureRoot, "inside"), fixtureRoot);
    assert.strictEqual(p, resolve(join(fixtureRoot, "inside")));
  });

  it("rejects ../ traversal", async () => {
    await assert.rejects(
      guardPath(
        join(fixtureRoot, "..", "mig002-path-guard-outer"),
        fixtureRoot,
      ),
      /PATH_ESCAPE/,
    );
  });

  it("rejects absolute path outside root", async () => {
    await assert.rejects(guardPath("/etc", fixtureRoot), /PATH_ESCAPE/);
  });

  it("guardWriteTarget rejects symlink file", async () => {
    const target = join(fixtureRoot, "inside", "real.txt");
    const link = join(fixtureRoot, "inside", "link.txt");
    await writeFile(target, "x");
    await symlink(target, link);
    await assert.rejects(guardWriteTarget(link, fixtureRoot), /SYMLINK_FILE/);
  });

  it("guardWriteTarget rejects symlink parent dir", async () => {
    const linkDir = join(fixtureRoot, "link-dir");
    await symlink(join(fixtureRoot, "inside"), linkDir);
    await assert.rejects(
      guardWriteTarget(join(linkDir, "file.json"), fixtureRoot),
      /SYMLINK_DIR/,
    );
  });

  it("rejects traversal before creating any external directory", async () => {
    const external = join(fixtureRoot, "..", "mig002-never-create", "out.json");
    await rm(dirname(external), { recursive: true, force: true });
    await assert.rejects(
      ensureSafeDir(external, fixtureRoot),
      (error) => error.code === "OUTPUT_PATH_ESCAPE",
    );
    await assert.rejects(lstat(dirname(external)), { code: "ENOENT" });
  });

  it("rejects normalized and backslash traversal before mkdir", async () => {
    for (const candidate of [
      join(fixtureRoot, "nested", "..", "..", "outside", "x.json"),
      `${fixtureRoot}/nested//../../outside/x.json`,
      `${fixtureRoot}/nested/../../../outside/x.json`,
      `${fixtureRoot}\\..\\outside\\x.json`,
    ]) {
      await assert.rejects(
        ensureSafeDir(candidate, fixtureRoot),
        (error) => error.code === "OUTPUT_PATH_ESCAPE",
      );
    }
  });

  it("rejects dangling output root and file symlinks without raw ENOENT", async () => {
    const danglingRoot = join(fixtureRoot, "dangling-root");
    const danglingFile = join(fixtureRoot, "inside", "dangling-output.json");
    await symlink(join(fixtureRoot, "missing-root"), danglingRoot);
    await symlink(join(fixtureRoot, "missing-file"), danglingFile);

    await assert.rejects(
      guardWriteTarget(join(danglingRoot, "out.json"), danglingRoot),
      (error) => error.code === "SYMLINK_DIR" && error.code !== "ENOENT",
    );
    await assert.rejects(
      guardWriteTarget(danglingFile, fixtureRoot),
      (error) => error.code === "SYMLINK_FILE" && error.code !== "ENOENT",
    );
  });

  it("rejects output directory replacement before temp creation", async () => {
    const safeDir = join(fixtureRoot, "race-dir");
    const backupDir = join(fixtureRoot, "race-dir-backup");
    const externalDir = join(fixtureRoot, "outside");
    const output = join(safeDir, "out.txt");
    await mkdir(safeDir);
    try {
      await assert.rejects(
        writeTextFile(output, "safe", fixtureRoot, {
          beforeTempOpen: async () => {
            await rename(safeDir, backupDir);
            await symlink(externalDir, safeDir);
          },
        }),
        (error) => error.code === "SYMLINK_DIR",
      );
      await assert.rejects(lstat(join(externalDir, "out.txt")), {
        code: "ENOENT",
      });
      assert.deepStrictEqual(
        (await readdir(externalDir)).filter((name) => name.includes(".tmp")),
        [],
      );
    } finally {
      await rm(safeDir, { force: true });
      await rename(backupDir, safeDir).catch(() => {});
    }
  });
});

describe("safe input reading", () => {
  let fixtureRoot;
  let outsideRoot;
  const EXTERNAL_SENTINEL = "MIG002_EXTERNAL_SYMLINK_SENTINEL_7C9A";
  const EXTERNAL_PII = "13800138000";

  before(async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), "mig002-safe-input-"));
    outsideRoot = await mkdtemp(join(tmpdir(), "mig002-safe-input-out-"));
    await mkdir(join(fixtureRoot, "exports"), { recursive: true });
    await mkdir(join(fixtureRoot, "review"), { recursive: true });
    await mkdir(join(fixtureRoot, "nested", "deep"), { recursive: true });
  });

  after(async () => {
    await rm(fixtureRoot, { recursive: true, force: true });
    await rm(outsideRoot, { recursive: true, force: true });
  });

  it("reads a regular file", async () => {
    const file = join(fixtureRoot, "exports", "regular.json");
    await writeFile(file, '{"ok":true}');
    const text = await safeReadTextFile(file, fixtureRoot);
    assert.strictEqual(text, '{"ok":true}');
  });

  it("reads a regular JSON file", async () => {
    const file = join(fixtureRoot, "exports", "regular2.json");
    await writeFile(file, '{"ok":true}');
    const data = await safeReadJsonFile(file, fixtureRoot);
    assert.deepStrictEqual(data, { ok: true });
  });

  it("rejects internal file symlink", async () => {
    const target = join(fixtureRoot, "exports", "real.json");
    const link = join(fixtureRoot, "exports", "link.json");
    await writeFile(target, '{"x":1}');
    await symlink(target, link);
    await assert.rejects(
      safeReadTextFile(link, fixtureRoot),
      /SOURCE_PATH_ANCESTOR_SYMLINK_REJECTED/,
    );
  });

  it("rejects external file symlink", async () => {
    const target = join(outsideRoot, "external.json");
    const link = join(fixtureRoot, "exports", "external-link.json");
    await writeFile(
      target,
      JSON.stringify({ sentinel: EXTERNAL_SENTINEL, pii: EXTERNAL_PII }),
    );
    await symlink(target, link);
    await assert.rejects(
      safeReadTextFile(link, fixtureRoot),
      /SOURCE_PATH_ANCESTOR_SYMLINK_REJECTED/,
    );
  });

  it("rejects dangling file symlink", async () => {
    const link = join(fixtureRoot, "exports", "dangling.json");
    await symlink(join(outsideRoot, "missing.json"), link);
    await assert.rejects(
      safeReadTextFile(link, fixtureRoot),
      /SOURCE_PATH_ANCESTOR_SYMLINK_REJECTED/,
    );
  });

  it("rejects source directory symlink", async () => {
    const realDir = join(fixtureRoot, "exports");
    const linkDir = join(fixtureRoot, "link-exports");
    await symlink(realDir, linkDir);
    await assert.rejects(
      safeReadTextFile(join(linkDir, "x.json"), fixtureRoot),
      /SOURCE_PATH_ANCESTOR_SYMLINK_REJECTED/,
    );
  });

  it("rejects ancestor directory symlink", async () => {
    const realDir = join(fixtureRoot, "nested");
    const linkDir = join(fixtureRoot, "link-nested");
    await symlink(realDir, linkDir);
    const file = join(linkDir, "deep", "x.json");
    await writeFile(join(realDir, "deep", "x.json"), '{"x":1}');
    await assert.rejects(
      safeReadTextFile(file, fixtureRoot),
      /SOURCE_PATH_ANCESTOR_SYMLINK_REJECTED/,
    );
  });

  it("rejects symlink to valid JSON", async () => {
    const target = join(fixtureRoot, "exports", "valid.json");
    const link = join(fixtureRoot, "exports", "valid-link.json");
    await writeFile(target, '{"x":1}');
    await symlink(target, link);
    await assert.rejects(
      safeReadJsonFile(link, fixtureRoot),
      /SOURCE_PATH_ANCESTOR_SYMLINK_REJECTED/,
    );
  });

  it("rejects symlink to valid CSV", async () => {
    const target = join(fixtureRoot, "exports", "valid.csv");
    const link = join(fixtureRoot, "exports", "valid-link.csv");
    await writeFile(target, "a,b\n1,2\n");
    await symlink(target, link);
    await assert.rejects(
      safeReadTextFile(link, fixtureRoot),
      /SOURCE_PATH_ANCESTOR_SYMLINK_REJECTED/,
    );
  });

  it("error message does not expose external absolute target path", async () => {
    const target = join(outsideRoot, "secret.json");
    const link = join(fixtureRoot, "exports", "secret-link.json");
    await writeFile(target, '{"x":1}');
    await symlink(target, link);
    let caught;
    try {
      await safeReadTextFile(link, fixtureRoot);
    } catch (err) {
      caught = String(err);
    }
    assert.ok(caught);
    assert.doesNotMatch(caught, new RegExp(escapeRegExp(outsideRoot)));
    assert.doesNotMatch(caught, /\/tmp\/mig002-safe-input-out-/);
  });

  it("error message does not expose external sentinel", async () => {
    const target = join(outsideRoot, "sentinel.json");
    const link = join(fixtureRoot, "exports", "sentinel-link.json");
    await writeFile(target, JSON.stringify({ sentinel: EXTERNAL_SENTINEL }));
    await symlink(target, link);
    let caught;
    try {
      await safeReadTextFile(link, fixtureRoot);
    } catch (err) {
      caught = String(err);
    }
    assert.ok(caught);
    assert.doesNotMatch(caught, new RegExp(EXTERNAL_SENTINEL));
  });

  it("rejects file path outside root", async () => {
    const file = join(outsideRoot, "outside.json");
    await writeFile(file, '{"x":1}');
    await assert.rejects(safeReadTextFile(file, fixtureRoot), /PATH_ESCAPE/);
  });

  it("rejects path changed during read", async () => {
    const file = join(fixtureRoot, "exports", "race.json");
    await writeFile(file, '{"x":1}');
    const fsPromises = require("node:fs/promises");
    const originalOpen = fsPromises.open;
    let callCount = 0;
    const stubbedOpen = async (path, flags, ...rest) => {
      const handle = await originalOpen(path, flags, ...rest);
      if (String(path).endsWith("race.json") && callCount === 0) {
        callCount += 1;
        // Replace the path with a new inode while the original descriptor is
        // still open. The read itself is safe (old descriptor), but the
        // after-read lstat must detect the swap and reject.
        await fsPromises.unlink(file);
        await fsPromises.writeFile(file, '{"x":2}');
      }
      return handle;
    };
    fsPromises.open = stubbedOpen;
    try {
      await assert.rejects(
        safeReadTextFile(file, fixtureRoot),
        /SOURCE_PATH_CHANGED_DURING_READ/,
      );
    } finally {
      fsPromises.open = originalOpen;
    }
  });

  it("rejects a real symlink replacement before open without reading it", async () => {
    const file = join(fixtureRoot, "exports", "pre-open-race.json");
    const external = join(outsideRoot, "pre-open-external.json");
    const sentinel = `${EXTERNAL_SENTINEL}_PRE_OPEN`;
    await writeFile(file, '{"safe":true}');
    await writeFile(external, sentinel);

    await assert.rejects(
      safeReadTextFile(file, fixtureRoot, {
        beforeOpen: async () => {
          await unlink(file);
          await symlink(external, file);
        },
      }),
      (error) => error.code === "SOURCE_PATH_CHANGED_DURING_READ",
    );
    assert.strictEqual(await readFile(external, "utf8"), sentinel);
  });

  it("rejects ordinary inode replacement before reading bytes", async () => {
    const file = join(fixtureRoot, "exports", "inode-race.json");
    const replacement = join(fixtureRoot, "exports", "inode-replacement.json");
    await writeFile(file, '{"first":true}');
    await writeFile(replacement, '{"second":true}');
    await assert.rejects(
      safeReadTextFile(file, fixtureRoot, {
        beforeOpen: async () => {
          await rename(replacement, file);
        },
      }),
      (error) => error.code === "SOURCE_PATH_CHANGED_DURING_READ",
    );
  });

  it("rejects final file replacement with a directory", async () => {
    const file = join(fixtureRoot, "exports", "directory-race.json");
    await writeFile(file, '{"first":true}');
    await assert.rejects(
      safeReadTextFile(file, fixtureRoot, {
        beforeOpen: async () => {
          await unlink(file);
          await mkdir(file);
        },
      }),
      (error) => error.code === "SOURCE_PATH_CHANGED_DURING_READ",
    );
  });

  it("rejects an input root symlink with a stable error", async () => {
    const rootLink = join(fixtureRoot, "root-link");
    await symlink(join(fixtureRoot, "exports"), rootLink);
    await assert.rejects(
      safeReadTextFile(join(rootLink, "regular.json"), rootLink),
      (error) => error.code === "SOURCE_ROOT_SYMLINK_REJECTED",
    );
  });
});

describe("MIG-001 loader safe-open integration", () => {
  let projectRoot;
  let outsideRoot;

  before(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "mig002-loader-race-"));
    outsideRoot = await mkdtemp(join(tmpdir(), "mig002-loader-out-"));
    await mkdir(join(projectRoot, "legacy", "exports"), { recursive: true });
    await mkdir(join(projectRoot, "legacy", "review"), { recursive: true });
    await writeFile(
      join(projectRoot, "legacy", "exports", "mig-001-courses.json"),
      '{"curriculumRecords":[]}',
    );
    await writeFile(
      join(projectRoot, "legacy", "exports", "mig-001-translations.json"),
      "{}",
    );
    await writeFile(
      join(projectRoot, "legacy", "exports", "mig-001-media.json"),
      "{}",
    );
    await writeFile(
      join(projectRoot, "legacy", "review", "mig-001-classification.json"),
      "{}",
    );
  });

  after(async () => {
    await rm(projectRoot, { recursive: true, force: true });
    await rm(outsideRoot, { recursive: true, force: true });
  });

  it("rejects a real pre-open external symlink swap in the loader", async () => {
    const source = join(
      projectRoot,
      "legacy",
      "exports",
      "mig-001-courses.json",
    );
    const external = join(outsideRoot, "external.json");
    const sentinel = "MIG002_LOADER_EXTERNAL_SENTINEL";
    await writeFile(external, sentinel);

    await assert.rejects(
      loadMig001Inputs(projectRoot, {
        coursesReadOptions: {
          beforeOpen: async () => {
            await unlink(source);
            await symlink(external, source);
          },
        },
      }),
      (error) => error.code === "SOURCE_PATH_CHANGED_DURING_READ",
    );
    assert.strictEqual(await readFile(external, "utf8"), sentinel);
    assert.deepStrictEqual(
      await readdir(join(projectRoot, "legacy", "review")),
      ["mig-001-classification.json"],
    );
  });
});

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("pii-scanner", () => {
  it("detects email", () => {
    const findings = scanForPii({ user: "test@example.com" });
    assert.ok(findings.some((f) => f.rule === "email"));
  });

  it("detects phone", () => {
    const findings = scanForPii({ contact: "13800138000" });
    assert.ok(findings.some((f) => f.rule === "cnPhone"));
  });

  it("detects id card", () => {
    const findings = scanForPii({ id: "110101199001011234" });
    assert.ok(findings.some((f) => f.rule === "idCard"));
  });

  it("detects token", () => {
    const findings = scanForPii({ secret: "api-key: abcdef1234567890" });
    assert.ok(findings.some((f) => f.rule === "token"));
  });

  it("detects private key", () => {
    const findings = scanForPii({ key: "-----BEGIN RSA PRIVATE KEY-----" });
    assert.ok(findings.some((f) => f.rule === "privateKey"));
  });

  it("detects home path", () => {
    const findings = scanForPii({ path: "/home/admin01/project" });
    assert.ok(findings.some((f) => f.rule === "homePath"));
  });

  it("detects file uri", () => {
    const findings = scanForPii({ uri: "file:///etc/passwd" });
    assert.ok(findings.some((f) => f.rule === "fileUri"));
  });

  it("returns empty for safe business content", () => {
    const findings = scanForPii({ title: "基础语言启蒙", grade: 1 });
    assert.strictEqual(findings.length, 0);
  });

  it("scans nested arrays and objects", () => {
    const findings = scanForPii({ list: [{ email: "a@b.com" }] });
    assert.ok(findings.some((f) => f.rule === "email"));
  });
});

describe("translation-mapper", () => {
  it("maps expert/approved to EXPERT_CONFIRMED", () => {
    const content = mapLegacyTranslation({
      originalText: "hello",
      translatedText: "你好",
      legacySource: "expert",
      legacyReviewed: "approved",
    });
    assert.strictEqual(content.translationSource, "EXPERT");
    assert.strictEqual(content.reviewStatus, "EXPERT_CONFIRMED");
  });

  it("maps community/yes to REVIEWED", () => {
    const content = mapLegacyTranslation({
      originalText: "hello",
      translatedText: "你好",
      legacySource: "community",
      legacyReviewed: "yes",
    });
    assert.strictEqual(content.translationSource, "COMMUNITY");
    assert.strictEqual(content.reviewStatus, "REVIEWED");
  });

  it("auto source cannot be EXPERT_CONFIRMED", () => {
    const content = mapLegacyTranslation({
      originalText: "hello",
      translatedText: "你好",
      legacySource: "machine",
      legacyReviewed: "approved",
    });
    assert.strictEqual(content.translationSource, "AUTO");
    assert.strictEqual(content.reviewStatus, "PENDING");
  });

  it("none source cannot be EXPERT_CONFIRMED", () => {
    const content = mapLegacyTranslation({
      originalText: "hello",
      translatedText: "你好",
      legacySource: "unknown",
      legacyReviewed: "approved",
    });
    assert.strictEqual(content.translationSource, "NONE");
    assert.strictEqual(content.reviewStatus, "PENDING");
  });

  it("defaults to PENDING when review status unknown", () => {
    const content = mapLegacyTranslation({ originalText: "hello" });
    assert.strictEqual(content.reviewStatus, "PENDING");
    assert.strictEqual(content.translationSource, "NONE");
  });

  it("throws on missing originalText", () => {
    assert.throws(
      () => createBilingualContent({ originalText: "" }),
      /BILINGUAL_MISSING_ORIGINAL/,
    );
  });

  it("createBilingualContent enforces invariant", () => {
    assert.throws(
      () =>
        createBilingualContent({
          originalText: "x",
          translationSource: "AUTO",
          reviewStatus: "EXPERT_CONFIRMED",
        }),
      /INVALID_REVIEW_STATUS/,
    );
  });
});

describe("resource-mapper", () => {
  it("maps external asset to ref", () => {
    const ref = mapLegacyAssetToResourceRef({
      id: "mig001_ext1",
      domain: "cdn.example.com",
      pathHint: "/image.png",
      mediaCategory: "image",
      fileType: "PNG",
      sizeBytes: 1234,
      rightsStatus: "approved",
      altText: "desc",
    });
    assert.ok(ref);
    assert.strictEqual(ref.kind, "IMAGE");
    assert.strictEqual(ref.mediaType, "image/png");
    assert.strictEqual(ref.rightsStatus, "APPROVED");
    assert.strictEqual(ref.uri, "https://cdn.example.com/image.png");
  });

  it("rejects local absolute path", () => {
    const ref = mapLegacyAssetToResourceRef({
      relativePath: "/home/admin01/file.png",
      mediaCategory: "image",
    });
    assert.strictEqual(ref, null);
  });

  it("rejects file uri", () => {
    const ref = mapLegacyAssetToResourceRef({
      relativePath: "file:///etc/passwd",
      mediaCategory: "document",
    });
    assert.strictEqual(ref, null);
  });

  it("rejects traversal", () => {
    const ref = mapLegacyAssetToResourceRef({
      relativePath: "../../secret.png",
      mediaCategory: "image",
    });
    assert.strictEqual(ref, null);
  });

  it("defaults rights status to UNKNOWN", () => {
    const ref = mapLegacyAssetToResourceRef({
      id: "mig001_unknown",
      domain: "cdn.example.com",
      pathHint: "/x.pdf",
      mediaCategory: "document",
      fileType: "PDF",
    });
    assert.strictEqual(ref.rightsStatus, "UNKNOWN");
  });

  it("detects kind and media type", () => {
    assert.strictEqual(detectKind("video", ""), "VIDEO");
    assert.strictEqual(detectKind("audio", ""), "AUDIO");
    assert.strictEqual(detectKind("image", "png"), "IMAGE");
    assert.strictEqual(detectKind("document", "pdf"), "DOCUMENT");
    assert.strictEqual(detectKind("unknown", ""), "OTHER");
    assert.strictEqual(detectMediaType("png"), "image/png");
    assert.strictEqual(detectMediaType("unknown"), "application/octet-stream");
  });

  it("buildSafeObjectKey strips traversal and absolute prefixes", () => {
    const key = buildSafeObjectKey("id1", "IMAGE", "../../x.png");
    assert.doesNotMatch(key, /\.\./);
    assert.doesNotMatch(key, /^\//);
    assert.match(key, /^mig002\/IMAGE\//);
  });

  it("buildSafeObjectKey strips URL protocols", () => {
    const key = buildSafeObjectKey(
      "id1",
      "IMAGE",
      "https://cdn.example.com/x.png",
    );
    assert.doesNotMatch(key, /https:\/\//);
    assert.match(key, /^mig002\/IMAGE\//);
  });

  it("containsLocalPath recognizes common patterns", () => {
    assert.ok(containsLocalPath("/etc/passwd"));
    assert.ok(containsLocalPath("file:///x"));
    assert.ok(containsLocalPath("../x"));
    assert.ok(!containsLocalPath("relative/path.png"));
  });
});

describe("disposition", () => {
  it("classifies valid cases", () => {
    assert.strictEqual(
      classifyDisposition({
        reusable: true,
        hasCriticalError: false,
        hasReviewFlag: false,
        hasTranslationIssue: false,
        hasRightsIssue: false,
      }),
      "CONVERTED",
    );
    assert.strictEqual(
      classifyDisposition({
        reusable: true,
        hasCriticalError: false,
        hasReviewFlag: true,
        hasTranslationIssue: false,
        hasRightsIssue: false,
      }),
      "REVIEW",
    );
    assert.strictEqual(
      classifyDisposition({
        reusable: true,
        hasCriticalError: true,
        hasReviewFlag: false,
        hasTranslationIssue: false,
        hasRightsIssue: false,
      }),
      "REJECTED",
    );
  });

  it("publish eligibility maps correctly", () => {
    assert.strictEqual(publishEligibility("CONVERTED", true), "ELIGIBLE");
    assert.strictEqual(publishEligibility("CONVERTED", false), "NOT_ELIGIBLE");
    assert.strictEqual(publishEligibility("REVIEW", true), "REVIEW_REQUIRED");
    assert.strictEqual(publishEligibility("REJECTED", false), "NOT_ELIGIBLE");
  });

  it("validates disposition values", () => {
    assert.ok(isValidDisposition("CONVERTED"));
    assert.ok(!isValidDisposition("INVALID"));
  });
});

describe("course-converter", () => {
  const baseOptions = {
    translationByCourseId: new Map(),
    localAssets: [],
    externalAssets: [],
    defaultSchoolId: "school-1",
    defaultAuthorUserId: "user-1",
  };

  it("converts a normal course record", () => {
    const result = convertCourseRecord(
      {
        id: "mig001_001",
        courseId: "c1",
        title: "基础语言启蒙",
        grade: 1,
        gradeLevel: "小学低学段",
        theme: "语言积累",
        culturalTags: ["日常用语", "儿歌"],
        primaryDisposition: "REUSE",
        curriculumStructureHints: {
          outlineHeadings: ["单元一：你好，新学校！（18课时）"],
        },
      },
      baseOptions,
    );
    assert.strictEqual(result.disposition, "CONVERTED");
    assert.strictEqual(result.courseVersion.status, "DRAFT");
    assert.strictEqual(result.courseVersion.courseId, "c1");
    assert.ok(result.courseVersion.units.length > 0);
  });

  it("rejects missing title", () => {
    const result = convertCourseRecord(
      {
        id: "mig001_002",
        courseId: "c2",
        title: "",
        primaryDisposition: "REUSE",
      },
      baseOptions,
    );
    assert.strictEqual(result.disposition, "REJECTED");
    assert.ok(result.rejectedReasons.includes("MISSING_TITLE"));
  });

  it("rejects missing courseId", () => {
    const result = convertCourseRecord(
      {
        id: "mig001_003",
        courseId: "",
        title: "x",
        primaryDisposition: "REUSE",
      },
      baseOptions,
    );
    assert.strictEqual(result.disposition, "REJECTED");
    assert.ok(result.rejectedReasons.includes("MISSING_COURSE_ID"));
  });

  it("rejects non-reusable disposition", () => {
    const result = convertCourseRecord(
      {
        id: "mig001_004",
        courseId: "c4",
        title: "x",
        primaryDisposition: "DISCARD",
      },
      baseOptions,
    );
    assert.strictEqual(result.disposition, "REJECTED");
    assert.ok(
      result.rejectedReasons.some((r) =>
        r.startsWith("NON_REUSABLE_DISPOSITION"),
      ),
    );
  });

  it("marks version confirmation as review", () => {
    const result = convertCourseRecord(
      {
        id: "mig001_005",
        courseId: "c5",
        title: "x",
        primaryDisposition: "REUSE",
        requiresVersionConfirmation: true,
        curriculumStructureHints: {
          outlineHeadings: ["单元一：示例（8课时）"],
        },
      },
      baseOptions,
    );
    assert.strictEqual(result.disposition, "REVIEW");
    assert.ok(result.reviewReasons.includes("REQUIRES_VERSION_CONFIRMATION"));
  });

  it("detects duplicate ids", () => {
    const result = convertCourseRecord(
      {
        id: "mig001_006",
        courseId: "c6",
        title: "x",
        primaryDisposition: "REUSE",
        curriculumStructureHints: {
          outlineHeadings: ["单元一：a", "单元二：b"],
        },
      },
      baseOptions,
    );
    const ids = new Set();
    ids.add(result.courseVersion.id);
    for (const unit of result.courseVersion.units) {
      assert.ok(!ids.has(unit.id));
      ids.add(unit.id);
      for (const lesson of unit.lessons) {
        assert.ok(!ids.has(lesson.id));
        ids.add(lesson.id);
        for (const activity of lesson.activities) {
          assert.ok(!ids.has(activity.id));
          ids.add(activity.id);
        }
      }
    }
  });

  it("validates sort order", () => {
    const result = convertCourseRecord(
      {
        id: "mig001_007",
        courseId: "c7",
        title: "x",
        primaryDisposition: "REUSE",
        curriculumStructureHints: {
          outlineHeadings: ["单元一：a"],
        },
      },
      baseOptions,
    );
    assert.strictEqual(result.courseVersion.units[0].sortOrder, 0);
    assert.strictEqual(result.courseVersion.units[0].lessons[0].sortOrder, 0);
    assert.strictEqual(
      result.courseVersion.units[0].lessons[0].activities[0].sortOrder,
      0,
    );
  });

  it("supports only known activity types", () => {
    const result = convertCourseRecord(
      {
        id: "mig001_008",
        courseId: "c8",
        title: "x",
        primaryDisposition: "REUSE",
        curriculumStructureHints: {
          outlineHeadings: ["单元一：a"],
        },
      },
      baseOptions,
    );
    assert.ok(
      ["TEXT", "VIDEO", "AUDIO", "CHOICE", "FILL_BLANK", "SPEECH"].includes(
        result.courseVersion.units[0].lessons[0].activities[0].type,
      ),
    );
  });

  it("requires teacher and student notes", () => {
    const result = convertCourseRecord(
      {
        id: "mig001_009",
        courseId: "c9",
        title: "x",
        primaryDisposition: "REUSE",
        curriculumStructureHints: {
          outlineHeadings: ["单元一：a"],
        },
      },
      baseOptions,
    );
    const activity = result.courseVersion.units[0].lessons[0].activities[0];
    assert.ok(activity.teacherNotes?.originalText.length > 0);
    assert.ok(activity.studentNotes?.originalText.length > 0);
  });

  it("flags unknown resource rights as review", () => {
    const result = convertCourseRecord(
      {
        id: "mig001_010",
        courseId: "c10",
        title: "x",
        primaryDisposition: "REUSE",
        curriculumStructureHints: {
          outlineHeadings: ["单元一：a"],
        },
      },
      {
        ...baseOptions,
        externalAssets: [
          {
            id: "mig001_ext",
            domain: "cdn.example.com",
            pathHint: "/x.png",
            mediaCategory: "image",
            fileType: "PNG",
            rightsStatus: "unverified",
          },
        ],
      },
    );
    assert.strictEqual(result.disposition, "REVIEW");
    assert.ok(result.reviewReasons.includes("UNKNOWN_RESOURCE_RIGHTS"));
  });

  it("flags missing alt text as review", () => {
    const result = convertCourseRecord(
      {
        id: "mig001_011",
        courseId: "c11",
        title: "x",
        primaryDisposition: "REUSE",
        curriculumStructureHints: {
          outlineHeadings: ["单元一：a"],
        },
      },
      {
        ...baseOptions,
        externalAssets: [
          {
            id: "mig001_img",
            domain: "cdn.example.com",
            pathHint: "/x.png",
            mediaCategory: "image",
            fileType: "PNG",
            rightsStatus: "approved",
          },
        ],
      },
    );
    assert.strictEqual(result.disposition, "REVIEW");
    assert.ok(result.reviewReasons.includes("IMAGE_MISSING_ALT"));
  });

  it("does not download external URLs", () => {
    const result = convertCourseRecord(
      {
        id: "mig001_012",
        courseId: "c12",
        title: "x",
        primaryDisposition: "REUSE",
        curriculumStructureHints: {
          outlineHeadings: ["单元一：a"],
        },
      },
      {
        ...baseOptions,
        externalAssets: [
          {
            id: "mig001_url",
            domain: "cdn.example.com",
            pathHint: "/remote.mp4",
            mediaCategory: "video",
            fileType: "MP4",
            rightsStatus: "approved",
          },
        ],
      },
    );
    const ref =
      result.courseVersion.units[0].lessons[0].activities[0].resources[0];
    assert.ok(ref);
    assert.ok(ref.uri.startsWith("https://"));
    assert.strictEqual(ref.byteSize, 0);
  });
});

describe("migrate-curriculum integration", () => {
  let projectRoot;

  before(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "mig002-integration-"));
    await mkdir(join(projectRoot, "legacy", "exports"), { recursive: true });
    await mkdir(join(projectRoot, "legacy", "review"), { recursive: true });
    await mkdir(join(projectRoot, "legacy", "reports"), { recursive: true });

    const courses = {
      metadata: { sourceTreeFingerprint: "abc123" },
      curriculumRecords: [
        {
          id: "mig001_c1",
          courseId: "primary-1-language-001",
          title: "基础语言启蒙",
          grade: 1,
          gradeLevel: "小学低学段",
          theme: "语言积累",
          culturalTags: ["日常用语", "儿歌"],
          primaryDisposition: "REUSE",
          curriculumStructureHints: {
            outlineHeadings: ["单元一：你好，新学校！（18课时）"],
          },
        },
        {
          id: "mig001_c2",
          courseId: "primary-2-food-001",
          title: "舌尖上的家乡",
          grade: 2,
          gradeLevel: "小学低学段",
          theme: "饮食文化",
          culturalTags: ["青稞", "酥油茶"],
          primaryDisposition: "REUSE",
          curriculumStructureHints: {
            outlineHeadings: ["单元一：饮食文化探索（12课时）"],
          },
        },
      ],
    };

    const translations = { courseTranslationCoverage: [] };
    const media = { localAssets: [], externalAssets: [] };
    const classification = { items: [] };

    await writeFile(
      join(projectRoot, "legacy", "exports", "mig-001-courses.json"),
      JSON.stringify(courses),
    );
    await writeFile(
      join(projectRoot, "legacy", "exports", "mig-001-translations.json"),
      JSON.stringify(translations),
    );
    await writeFile(
      join(projectRoot, "legacy", "exports", "mig-001-media.json"),
      JSON.stringify(media),
    );
    await writeFile(
      join(projectRoot, "legacy", "review", "mig-001-classification.json"),
      JSON.stringify(classification),
    );
  });

  after(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("dry-run does not write output files", async () => {
    const result = await runMigration(projectRoot, { dryRun: true });
    assert.strictEqual(result.dryRun, true);
    const files = await readdir(join(projectRoot, "legacy", "exports"));
    assert.ok(!files.some((f) => f.startsWith("mig-002")));
  });

  it("normal run writes expected files", async () => {
    const result = await runMigration(projectRoot, { dryRun: false });
    assert.strictEqual(result.dryRun, false);
    assert.strictEqual(result.stats.totalRecordCount, 2);

    const exportJson = JSON.parse(
      await readFile(
        join(projectRoot, "legacy", "exports", "mig-002-curriculum.json"),
        "utf8",
      ),
    );
    assert.strictEqual(exportJson.metadata.taskId, "MIG-002");

    const reviewJson = JSON.parse(
      await readFile(
        join(projectRoot, "legacy", "review", "mig-002-curriculum-review.json"),
        "utf8",
      ),
    );
    assert.ok(Array.isArray(reviewJson.items));

    const summaryJson = JSON.parse(
      await readFile(
        join(projectRoot, "legacy", "reports", "mig-002-summary.json"),
        "utf8",
      ),
    );
    assert.strictEqual(
      summaryJson.dispositionCounts.CONVERTED +
        summaryJson.dispositionCounts.REVIEW,
      2,
    );
  });

  it("produces deterministic output across three runs", async () => {
    const hashes = [];
    for (let i = 0; i < 3; i += 1) {
      await runMigration(projectRoot, { dryRun: false });
      const exportJson = await readFile(
        join(projectRoot, "legacy", "exports", "mig-002-curriculum.json"),
      );
      const reviewJson = await readFile(
        join(projectRoot, "legacy", "review", "mig-002-curriculum-review.json"),
      );
      const summaryJson = await readFile(
        join(projectRoot, "legacy", "reports", "mig-002-summary.json"),
      );
      const combined = createHash("sha256")
        .update(exportJson)
        .update(reviewJson)
        .update(summaryJson)
        .digest("hex");
      hashes.push(combined);
    }
    assert.strictEqual(hashes[0], hashes[1]);
    assert.strictEqual(hashes[1], hashes[2]);
  });

  it("input order changes do not affect output", async () => {
    const coursesPath = join(
      projectRoot,
      "legacy",
      "exports",
      "mig-001-courses.json",
    );
    const before = await readFile(
      join(projectRoot, "legacy", "exports", "mig-002-curriculum.json"),
      "utf8",
    );

    const courses = JSON.parse(await readFile(coursesPath, "utf8"));
    courses.curriculumRecords.reverse();
    await writeFile(coursesPath, JSON.stringify(courses));

    await runMigration(projectRoot, { dryRun: false });
    const after = await readFile(
      join(projectRoot, "legacy", "exports", "mig-002-curriculum.json"),
      "utf8",
    );
    assert.strictEqual(before, after);
  });
});

describe("migrate-curriculum symlink integration", () => {
  let projectRoot;
  let outsideRoot;
  const EXTERNAL_SENTINEL = "MIG002_EXTERNAL_SYMLINK_SENTINEL_7C9A";

  before(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "mig002-symlink-int-"));
    outsideRoot = await mkdtemp(join(tmpdir(), "mig002-symlink-int-out-"));
    await mkdir(join(projectRoot, "legacy", "exports"), { recursive: true });
    await mkdir(join(projectRoot, "legacy", "review"), { recursive: true });
    await mkdir(join(projectRoot, "legacy", "reports"), { recursive: true });

    const courses = {
      metadata: { sourceTreeFingerprint: "abc123" },
      curriculumRecords: [
        {
          id: "mig001_c1",
          courseId: "primary-1-language-001",
          title: "基础语言启蒙",
          grade: 1,
          primaryDisposition: "REUSE",
          curriculumStructureHints: {
            outlineHeadings: ["单元一：你好，新学校！（18课时）"],
          },
        },
      ],
    };

    await writeFile(
      join(outsideRoot, "mig-001-courses.json"),
      JSON.stringify({
        metadata: {},
        curriculumRecords: [
          {
            id: "mig001_evil",
            courseId: "evil-course",
            title: EXTERNAL_SENTINEL,
            grade: 1,
            primaryDisposition: "REUSE",
          },
        ],
      }),
    );

    await writeFile(
      join(projectRoot, "legacy", "exports", "mig-001-courses.json"),
      JSON.stringify(courses),
    );
    await writeFile(
      join(projectRoot, "legacy", "exports", "mig-001-translations.json"),
      JSON.stringify({ courseTranslationCoverage: [] }),
    );
    await writeFile(
      join(projectRoot, "legacy", "exports", "mig-001-media.json"),
      JSON.stringify({ localAssets: [], externalAssets: [] }),
    );
    await writeFile(
      join(projectRoot, "legacy", "review", "mig-001-classification.json"),
      JSON.stringify({ items: [] }),
    );
  });

  after(async () => {
    await rm(projectRoot, { recursive: true, force: true });
    await rm(outsideRoot, { recursive: true, force: true });
  });

  it("dry-run rejects symlinked input and writes no output", async () => {
    const link = join(projectRoot, "legacy", "exports", "mig-001-courses.json");
    const backup = join(
      projectRoot,
      "legacy",
      "exports",
      "mig-001-courses-real.json",
    );
    await rename(link, backup);
    await symlink(join(outsideRoot, "mig-001-courses.json"), link);

    try {
      await assert.rejects(
        runMigration(projectRoot, { dryRun: true }),
        /SOURCE_PATH_ANCESTOR_SYMLINK_REJECTED/,
      );
      const files = await readdir(join(projectRoot, "legacy", "exports"));
      assert.ok(!files.some((f) => f.startsWith("mig-002")));
    } finally {
      await rm(link, { force: true });
      await rename(backup, link);
    }
  });

  it("formal run rejects symlinked input and leaves no half files", async () => {
    const link = join(projectRoot, "legacy", "exports", "mig-001-courses.json");
    const backup = join(
      projectRoot,
      "legacy",
      "exports",
      "mig-001-courses-real.json",
    );
    await rename(link, backup);
    await symlink(join(outsideRoot, "mig-001-courses.json"), link);

    try {
      await assert.rejects(
        runMigration(projectRoot, { dryRun: false }),
        /SOURCE_PATH_ANCESTOR_SYMLINK_REJECTED/,
      );
      const allOutputs = [];
      for (const dir of ["exports", "review", "reports"]) {
        const files = await readdir(join(projectRoot, "legacy", dir));
        allOutputs.push(...files.filter((f) => f.startsWith("mig-002")));
      }
      assert.strictEqual(allOutputs.length, 0);
    } finally {
      await rm(link, { force: true });
      await rename(backup, link);
    }
  });

  it("external sentinel never appears in any output", async () => {
    const link = join(projectRoot, "legacy", "exports", "mig-001-courses.json");
    const backup = join(
      projectRoot,
      "legacy",
      "exports",
      "mig-001-courses-real.json",
    );
    await rename(link, backup);
    await symlink(join(outsideRoot, "mig-001-courses.json"), link);

    try {
      try {
        await runMigration(projectRoot, { dryRun: false });
      } catch {
        // expected
      }
      for (const dir of ["exports", "review", "reports"]) {
        const files = (await readdir(join(projectRoot, "legacy", dir))).filter(
          (f) => f.startsWith("mig-002"),
        );
        for (const file of files) {
          const stats = await lstat(join(projectRoot, "legacy", dir, file));
          assert.ok(
            !stats.isSymbolicLink(),
            `output symlink detected: ${file}`,
          );
          const content = await readFile(
            join(projectRoot, "legacy", dir, file),
            "utf8",
          );
          assert.doesNotMatch(content, new RegExp(EXTERNAL_SENTINEL));
        }
      }
    } finally {
      await rm(link, { force: true });
      await rename(backup, link);
    }
  });

  it("regular run after symlink rejection produces normal output", async () => {
    const result = await runMigration(projectRoot, { dryRun: false });
    assert.strictEqual(result.stats.totalRecordCount, 1);
    assert.strictEqual(result.dispositionCounts.CONVERTED, 1);
  });
});

describe("output-writer csv", () => {
  it("escapes commas and quotes", () => {
    const rows = [{ a: 'value, with "quotes"', b: "normal" }];
    const csv = toCsv(rows, ["a", "b"]);
    assert.ok(csv.includes('"value, with ""quotes"""'));
  });

  it("handles undefined values as empty", () => {
    const rows = [{ a: undefined, b: "x" }];
    const csv = toCsv(rows, ["a", "b"]);
    assert.ok(csv.includes(",x"));
  });
});

describe("publish eligibility", () => {
  it("maps converted without issues to ELIGIBLE", () => {
    assert.strictEqual(publishEligibility("CONVERTED", true), "ELIGIBLE");
  });

  it("maps review to REVIEW_REQUIRED", () => {
    assert.strictEqual(publishEligibility("REVIEW", true), "REVIEW_REQUIRED");
  });

  it("maps rejected to NOT_ELIGIBLE", () => {
    assert.strictEqual(publishEligibility("REJECTED", false), "NOT_ELIGIBLE");
  });
});
