import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  cleanupSourceWorkspace,
  materializeLevelSources,
} from "./source-read-boundary.mjs";
import { defaultOptions, run } from "./index.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function fixtureRoot() {
  return mkdtemp(path.join(os.tmpdir(), "yz-rd-t056-boundary-test-"));
}

test("Level 1 allowlist opens and hashes only Level 1 files; Level 4 paths stay unopened", async () => {
  const sourceRoot = await fixtureRoot();
  let workspace;
  try {
    const levelOne = [
      {
        role: "questions",
        path: "level-one/questions.docx",
        bytes: Buffer.from("L1 question fixture"),
      },
      {
        role: "answers",
        path: "level-one/answers.docx",
        bytes: Buffer.from("L1 answer fixture"),
      },
      {
        role: "media",
        path: "level-one/media.zip",
        bytes: Buffer.from("L1 media fixture"),
      },
    ];
    for (const entry of levelOne) {
      const filePath = path.join(sourceRoot, entry.path);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, entry.bytes);
    }

    const levelFour = [
      {
        role: "questions",
        path: "level-four/never-open-questions.docx",
        bytes: Buffer.from("L4 question sentinel"),
      },
      {
        role: "answers",
        path: "level-four/never-open-answers.docx",
        bytes: Buffer.from("L4 answer sentinel"),
      },
      {
        role: "media",
        path: "level-four/never-open-media.zip",
        bytes: Buffer.from("L4 media sentinel"),
      },
    ];
    for (const entry of levelFour) {
      const filePath = path.join(sourceRoot, entry.path);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, entry.bytes);
    }

    const files = [
      ...levelOne.map(({ role, path: filePath, bytes }) => ({
        role,
        level: 1,
        path: filePath,
        sha256: hash(bytes),
      })),
      ...levelFour.map(({ role, path: filePath, bytes }) => ({
        role,
        level: 4,
        path: filePath,
        sha256: hash(bytes),
      })),
    ];
    const manifestBytes = Buffer.from(
      JSON.stringify({ schemaVersion: 1, files }),
    );
    const manifestPath = path.join(
      sourceRoot,
      "owner-approved-source-manifest.json",
    );
    await writeFile(manifestPath, manifestBytes);

    const openedPaths = [];
    const result = await materializeLevelSources({
      sourceRoot,
      manifestPath,
      manifestSha256: hash(manifestBytes),
      requestedLevel: 1,
      openAllowedFile: async (filePath, entry) => {
        openedPaths.push(entry.path);
        return readFile(filePath);
      },
    });
    workspace = result.workspace;

    assert.deepEqual(
      openedPaths,
      levelOne.map((entry) => entry.path),
    );
    assert.deepEqual(
      result.openedFiles.map(({ role, level, sha256: digest }) => ({
        role,
        level,
        sha256: digest,
      })),
      [
        { role: "questions", level: 1, sha256: hash(levelOne[0].bytes) },
        { role: "answers", level: 1, sha256: hash(levelOne[1].bytes) },
        { role: "media", level: 1, sha256: hash(levelOne[2].bytes) },
      ],
    );
    assert.equal(
      await readFile(result.sourcePaths.questions, "utf8"),
      "L1 question fixture",
    );
    assert.equal(
      await readFile(result.sourcePaths.answers, "utf8"),
      "L1 answer fixture",
    );
    assert.equal(
      await readFile(result.sourcePaths.media, "utf8"),
      "L1 media fixture",
    );
  } finally {
    if (workspace) await cleanupSourceWorkspace(workspace);
    await rm(sourceRoot, { recursive: true, force: true });
  }
});

test("production source opener stages a pinned Level 1 package and hashes the opened bytes", async () => {
  const sourceRoot = await fixtureRoot();
  let workspace;
  try {
    const contents = {
      questions: Buffer.from("pinned question bytes"),
      answers: Buffer.from("pinned answer bytes"),
      media: Buffer.from("pinned media bytes"),
    };
    const files = [];
    for (const [role, bytes] of Object.entries(contents)) {
      const relativePath = `level-one/${role}.${role === "media" ? "zip" : "docx"}`;
      const fullPath = path.join(sourceRoot, relativePath);
      await mkdir(path.dirname(fullPath), { recursive: true });
      await writeFile(fullPath, bytes);
      files.push({ role, level: 1, path: relativePath, sha256: hash(bytes) });
    }
    const manifestBytes = Buffer.from(
      JSON.stringify({ schemaVersion: 1, files }),
    );
    const manifestPath = path.join(
      sourceRoot,
      "owner-approved-source-manifest.json",
    );
    await writeFile(manifestPath, manifestBytes);

    const result = await materializeLevelSources({
      sourceRoot,
      manifestPath,
      manifestSha256: hash(manifestBytes),
      requestedLevel: 1,
    });
    workspace = result.workspace;

    assert.equal(result.openedFiles.length, 3);
    assert.ok(result.openedFiles.every((entry) => entry.level === 1));
    for (const [role, bytes] of Object.entries(contents)) {
      assert.equal(
        await readFile(result.sourcePaths[role]).then(hash),
        hash(bytes),
      );
    }
  } finally {
    if (workspace) await cleanupSourceWorkspace(workspace);
    await rm(sourceRoot, { recursive: true, force: true });
  }
});

test("Level 1 request fails before opening any source when its allowlist is incomplete", async () => {
  const sourceRoot = await fixtureRoot();
  try {
    const manifestBytes = Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        files: [
          {
            role: "questions",
            level: 4,
            path: "level-four/questions.docx",
            sha256: "4".repeat(64),
          },
          {
            role: "answers",
            level: 4,
            path: "level-four/answers.docx",
            sha256: "4".repeat(64),
          },
          {
            role: "media",
            level: 4,
            path: "level-four/media.zip",
            sha256: "4".repeat(64),
          },
        ],
      }),
    );
    const manifestPath = path.join(
      sourceRoot,
      "owner-approved-source-manifest.json",
    );
    await writeFile(manifestPath, manifestBytes);
    const openedPaths = [];

    await assert.rejects(
      materializeLevelSources({
        sourceRoot,
        manifestPath,
        manifestSha256: hash(manifestBytes),
        requestedLevel: 1,
        openAllowedFile: async (filePath, entry) => {
          openedPaths.push(entry.path);
          return readFile(filePath);
        },
      }),
      /level 1 must have exactly one questions, answers, and media source/,
    );
    assert.deepEqual(openedPaths, []);
  } finally {
    await rm(sourceRoot, { recursive: true, force: true });
  }
});

test("missing owner-pinned manifest rejects before source-open callback", async () => {
  let openCount = 0;
  await assert.rejects(
    materializeLevelSources({
      sourceRoot: "/not-opened/source-root",
      requestedLevel: 1,
      openAllowedFile: async () => {
        openCount += 1;
        return Buffer.alloc(0);
      },
    }),
    /owner-approved source manifest is required before source files can be opened/,
  );
  assert.equal(openCount, 0);
});

test("owner manifest digest mismatch rejects before source-open callback", async () => {
  const sourceRoot = await fixtureRoot();
  try {
    const manifestBytes = Buffer.from(
      JSON.stringify({ schemaVersion: 1, files: [] }),
    );
    const manifestPath = path.join(sourceRoot, "source-manifest.json");
    await writeFile(manifestPath, manifestBytes);
    let openCount = 0;
    await assert.rejects(
      materializeLevelSources({
        sourceRoot,
        manifestPath,
        manifestSha256: "0".repeat(64),
        requestedLevel: 1,
        openAllowedFile: async () => {
          openCount += 1;
          return Buffer.alloc(0);
        },
      }),
      /source manifest SHA-256 does not match the owner-approved digest/,
    );
    assert.equal(openCount, 0);
  } finally {
    await rm(sourceRoot, { recursive: true, force: true });
  }
});

test("Level 1 importer rejects missing manifest before touching mixed source paths", async () => {
  const sourceRoot = await fixtureRoot();
  try {
    await assert.rejects(
      run({
        ...defaultOptions,
        sourceRoot,
        questions: path.join(sourceRoot, "mixed-question-source.docx"),
        answers: path.join(sourceRoot, "mixed-answer-source.docx"),
        media: path.join(sourceRoot, "mixed-media-source.zip"),
        contentRepairs: path.join(sourceRoot, "missing-repair-ledger.json"),
        output: path.join(sourceRoot, "output"),
        level: 1,
      }),
      /owner-approved source manifest is required before source files can be opened/,
    );
  } finally {
    await rm(sourceRoot, { recursive: true, force: true });
  }
});

test("Level mode must be explicit and cannot combine a Level 1 request with --all", async () => {
  const sourceRoot = await fixtureRoot();
  try {
    const sourceOptions = {
      ...defaultOptions,
      sourceRoot,
      questions: path.join(sourceRoot, "unopened-questions.docx"),
      answers: path.join(sourceRoot, "unopened-answers.docx"),
      media: path.join(sourceRoot, "unopened-media.zip"),
      contentRepairs: path.join(sourceRoot, "unopened-repair-ledger.json"),
      output: path.join(sourceRoot, "output"),
    };
    await assert.rejects(
      run(sourceOptions),
      /pass one --level with an owner-approved manifest or explicitly pass --all/,
    );
    await assert.rejects(
      run({ ...sourceOptions, all: true, level: 1 }),
      /use either --all or one --level, not both/,
    );
  } finally {
    await rm(sourceRoot, { recursive: true, force: true });
  }
});
