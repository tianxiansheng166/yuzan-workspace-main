import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  open,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const roles = ["questions", "answers", "media"];
const stagedNames = {
  questions: "questions.docx",
  answers: "answers.docx",
  media: "media.zip",
};

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function fail(message) {
  throw new Error(`Question Bank source boundary rejected input: ${message}`);
}

function sourcePath(root, candidate) {
  if (
    typeof candidate !== "string" ||
    candidate.length === 0 ||
    candidate.includes("\0") ||
    path.isAbsolute(candidate) ||
    path.win32.isAbsolute(candidate)
  )
    fail("manifest paths must be non-empty relative paths");

  const segments = candidate.replaceAll("\\", "/").split("/");
  if (
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    fail("manifest paths cannot contain empty, dot, or parent segments");
  }
  const resolved = path.resolve(root, ...segments);
  const relative = path.relative(root, resolved);
  if (
    !relative ||
    relative.startsWith(`..${path.sep}`) ||
    relative === ".." ||
    path.isAbsolute(relative)
  ) {
    fail("manifest path escapes the approved source root");
  }
  return resolved;
}

function parseManifest(bytes) {
  let manifest;
  try {
    manifest = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("source manifest is not valid JSON");
  }
  if (
    !manifest ||
    manifest.schemaVersion !== 1 ||
    !Array.isArray(manifest.files)
  ) {
    fail("source manifest must use schemaVersion 1 and contain files");
  }
  if (
    Object.keys(manifest).some(
      (key) => !["schemaVersion", "files"].includes(key),
    )
  ) {
    fail("source manifest contains unsupported properties");
  }

  const seenRoleLevels = new Set();
  const seenPaths = new Set();
  const entries = manifest.files.map((entry) => {
    if (
      !entry ||
      !roles.includes(entry.role) ||
      !Number.isInteger(entry.level) ||
      entry.level < 1 ||
      entry.level > 6 ||
      typeof entry.path !== "string" ||
      !/^[a-f\d]{64}$/i.test(entry.sha256 ?? "")
    )
      fail("each file must declare role, level, relative path, and SHA-256");
    if (
      Object.keys(entry).some(
        (key) => !["role", "level", "path", "sha256"].includes(key),
      )
    ) {
      fail("source file entries contain unsupported properties");
    }

    const roleLevel = `${entry.role}:${entry.level}`;
    if (seenRoleLevels.has(roleLevel))
      fail(`duplicate ${roleLevel} manifest entry`);
    seenRoleLevels.add(roleLevel);

    const normalizedPath = entry.path.replaceAll("\\", "/");
    if (seenPaths.has(normalizedPath))
      fail("a source path cannot be assigned to multiple levels or roles");
    seenPaths.add(normalizedPath);
    return { ...entry, sha256: entry.sha256.toLowerCase(), normalizedPath };
  });

  return entries;
}

async function readRegularFileNoFollow(filePath) {
  if (typeof constants.O_NOFOLLOW !== "number")
    fail("this platform cannot enforce no-follow source opens");
  const handle = await open(
    filePath,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) fail("allowlisted source is not a regular file");
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

/**
 * Verify the owner-pinned manifest, build the requested level's exact file
 * allowlist, and only then open and stage those files. Other-level paths are
 * validated as manifest strings but are never resolved or opened.
 */
export async function materializeLevelSources({
  sourceRoot,
  manifestPath,
  manifestSha256,
  requestedLevel,
  workspaceParent = os.tmpdir(),
  openAllowedFile = readRegularFileNoFollow,
}) {
  if (
    !Number.isInteger(requestedLevel) ||
    requestedLevel < 1 ||
    requestedLevel > 6
  ) {
    fail("a single requested level from 1 through 6 is required");
  }
  if (typeof manifestPath !== "string" || manifestPath.length === 0) {
    fail(
      "an owner-approved source manifest is required before source files can be opened",
    );
  }
  if (!/^[a-f\d]{64}$/i.test(manifestSha256 ?? "")) {
    fail(
      "the owner-approved source manifest SHA-256 must be supplied before source files can be opened",
    );
  }

  const manifestBytes = await readFile(manifestPath);
  const actualManifestSha256 = sha256(manifestBytes);
  if (actualManifestSha256 !== manifestSha256.toLowerCase()) {
    fail("source manifest SHA-256 does not match the owner-approved digest");
  }

  const entries = parseManifest(manifestBytes);
  const root = path.resolve(sourceRoot);
  const requestedEntries = entries.filter(
    (entry) => entry.level === requestedLevel,
  );
  const selectedByRole = new Map(
    requestedEntries.map((entry) => [entry.role, entry]),
  );
  if (
    requestedEntries.length !== roles.length ||
    roles.some((role) => !selectedByRole.has(role))
  ) {
    fail(
      `level ${requestedLevel} must have exactly one questions, answers, and media source`,
    );
  }

  const canonicalRoot = await realpath(root);
  const allowlist = roles.map((role) => {
    const entry = selectedByRole.get(role);
    const filePath = sourcePath(canonicalRoot, entry.path);
    return { ...entry, filePath };
  });

  const workspace = await mkdtemp(
    path.join(workspaceParent, "yuzan-qb-source-"),
  );
  const sourcePaths = {};
  const openedFiles = [];
  try {
    for (const entry of allowlist) {
      const canonicalFile = await realpath(entry.filePath);
      const relative = path.relative(canonicalRoot, canonicalFile);
      if (
        !relative ||
        relative.startsWith(`..${path.sep}`) ||
        relative === ".." ||
        path.isAbsolute(relative)
      ) {
        fail("allowlisted source resolves outside the approved source root");
      }
      if (canonicalFile !== entry.filePath)
        fail("allowlisted source paths cannot traverse symlinks");

      const bytes = await openAllowedFile(entry.filePath, entry);
      const actualSha256 = sha256(bytes);
      if (actualSha256 !== entry.sha256) {
        fail(
          `level ${requestedLevel} ${entry.role} source SHA-256 does not match the manifest`,
        );
      }

      const stagedPath = path.join(workspace, stagedNames[entry.role]);
      await writeFile(stagedPath, bytes, { flag: "wx", mode: 0o600 });
      sourcePaths[entry.role] = stagedPath;
      openedFiles.push({
        path: entry.filePath,
        role: entry.role,
        level: entry.level,
        sha256: actualSha256,
        bytes: bytes.length,
      });
    }
    return {
      workspace,
      sourcePaths,
      openedFiles,
      manifest: {
        path: path.resolve(manifestPath),
        sha256: actualManifestSha256,
      },
    };
  } catch (error) {
    await rm(workspace, { recursive: true, force: true });
    throw error;
  }
}

export async function cleanupSourceWorkspace(workspace) {
  if (
    typeof workspace === "string" &&
    workspace.startsWith(os.tmpdir() + path.sep)
  ) {
    await rm(workspace, { recursive: true, force: true });
  }
}
