/**
 * Fail-closed path guards for migration inputs and outputs.
 */

const fsPromises = require("node:fs/promises");
const fsConstants = require("node:fs").constants;
const { dirname, isAbsolute, relative, resolve, sep } = require("node:path");

class PathSecurityError extends Error {
  constructor(code) {
    super(code);
    this.name = "PathSecurityError";
    this.code = code;
  }
}

function securityError(code) {
  return new PathSecurityError(code);
}

function lexicalPath(targetPath, allowedRoot, options = {}) {
  if (typeof targetPath !== "string" || typeof allowedRoot !== "string") {
    throw securityError(options.code || "OUTPUT_PATH_ESCAPE");
  }
  if (process.platform !== "win32" && targetPath.includes("\\")) {
    throw securityError(options.code || "OUTPUT_PATH_ESCAPE");
  }
  const root = resolve(allowedRoot);
  const target = resolve(targetPath);
  const rel = relative(root, target);
  const outside = rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel);
  if (outside || (!options.allowRoot && rel === "")) {
    throw securityError(options.code || "OUTPUT_PATH_ESCAPE");
  }
  return { root, target, rel };
}

async function lstatOrNull(path) {
  try {
    return await fsPromises.lstat(path);
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw securityError("PATH_INSPECTION_FAILED");
  }
}

async function assertDirectory(path, symlinkCode, missingCode) {
  const stats = await lstatOrNull(path);
  if (!stats) throw securityError(missingCode);
  if (stats.isSymbolicLink()) throw securityError(symlinkCode);
  if (!stats.isDirectory()) throw securityError("OUTPUT_PATH_NOT_DIRECTORY");
  return stats;
}

/**
 * Validate an existing path beneath an existing, non-symlink root.
 */
async function guardPath(targetPath, allowedRoot) {
  const { root, target, rel } = lexicalPath(targetPath, allowedRoot, {
    allowRoot: true,
    code: "PATH_ESCAPE",
  });
  await assertDirectory(root, "SYMLINK_DIR", "OUTPUT_ROOT_NOT_FOUND");
  if (rel === "") return root;

  let current = root;
  for (const part of rel.split(sep).filter(Boolean)) {
    current = resolve(current, part);
    const stats = await lstatOrNull(current);
    if (!stats) throw securityError("OUTPUT_PATH_NOT_FOUND");
    if (stats.isSymbolicLink()) throw securityError("SYMLINK_DIR");
    if (!stats.isDirectory()) throw securityError("OUTPUT_PATH_NOT_DIRECTORY");
  }
  return target;
}

/**
 * Validate the complete lexical boundary before creating directories, then
 * create missing components one at a time and verify each resulting inode.
 */
async function ensureSafeDir(filePath, allowedRoot) {
  const { root, target } = lexicalPath(filePath, allowedRoot);
  const parent = dirname(target);
  const parentRel = relative(root, parent);
  await assertDirectory(root, "SYMLINK_DIR", "OUTPUT_ROOT_NOT_FOUND");

  let current = root;
  for (const part of parentRel.split(sep).filter(Boolean)) {
    current = resolve(current, part);
    const stats = await lstatOrNull(current);
    if (stats) {
      if (stats.isSymbolicLink()) throw securityError("SYMLINK_DIR");
      if (!stats.isDirectory())
        throw securityError("OUTPUT_PATH_NOT_DIRECTORY");
      continue;
    }
    try {
      await fsPromises.mkdir(current);
    } catch (error) {
      if (!(error && error.code === "EEXIST")) {
        throw securityError("OUTPUT_DIRECTORY_CREATE_FAILED");
      }
    }
    await assertDirectory(
      current,
      "SYMLINK_DIR",
      "OUTPUT_DIRECTORY_CREATE_FAILED",
    );
  }

  // Re-walk after creation so a replaced ancestor is rejected before writing.
  await assertOutputAncestors(target, root);
}

async function assertOutputAncestors(filePath, allowedRoot) {
  const { root, target } = lexicalPath(filePath, allowedRoot);
  await assertDirectory(root, "SYMLINK_DIR", "OUTPUT_ROOT_NOT_FOUND");
  const parentRel = relative(root, dirname(target));
  let current = root;
  for (const part of parentRel.split(sep).filter(Boolean)) {
    current = resolve(current, part);
    await assertDirectory(current, "SYMLINK_DIR", "OUTPUT_PATH_NOT_FOUND");
  }
}

async function guardWriteTarget(filePath, allowedRoot) {
  const { target } = lexicalPath(filePath, allowedRoot);
  await ensureSafeDir(target, allowedRoot);
  await assertOutputAncestors(target, allowedRoot);
  const finalStats = await lstatOrNull(target);
  if (finalStats && finalStats.isSymbolicLink()) {
    throw securityError("SYMLINK_FILE");
  }
  if (finalStats && !finalStats.isFile()) {
    throw securityError("OUTPUT_PATH_NOT_REGULAR_FILE");
  }
  return target;
}

function sameIdentity(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.isFile() &&
    right.isFile()
  );
}

/**
 * Safely open, verify and read a regular input file. The optional hook exists
 * only to make real filesystem race tests deterministic.
 */
async function safeReadTextFile(filePath, allowedRoot, options = {}) {
  const { root, target, rel } = lexicalPath(filePath, allowedRoot, {
    code: "PATH_ESCAPE",
  });
  await assertDirectory(
    root,
    "SOURCE_ROOT_SYMLINK_REJECTED",
    "SOURCE_ROOT_NOT_FOUND",
  );

  const parts = rel.split(sep).filter(Boolean);
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = resolve(current, part);
    const stats = await lstatOrNull(current);
    if (!stats) throw securityError("INPUT_NOT_FOUND");
    if (stats.isSymbolicLink()) {
      throw securityError("SOURCE_PATH_ANCESTOR_SYMLINK_REJECTED");
    }
    if (!stats.isDirectory())
      throw securityError("INPUT_ANCESTOR_NOT_DIRECTORY");
  }

  const beforeStats = await lstatOrNull(target);
  if (!beforeStats) throw securityError("INPUT_NOT_FOUND");
  if (beforeStats.isSymbolicLink()) {
    throw securityError("SOURCE_PATH_ANCESTOR_SYMLINK_REJECTED");
  }
  if (!beforeStats.isFile()) throw securityError("INPUT_NOT_REGULAR_FILE");

  if (typeof options.beforeOpen === "function") await options.beforeOpen();
  if (
    typeof fsConstants.O_NOFOLLOW !== "number" ||
    fsConstants.O_NOFOLLOW === 0
  ) {
    throw securityError("SOURCE_SAFE_OPEN_UNSUPPORTED");
  }

  let handle;
  try {
    handle = await fsPromises.open(
      target,
      fsConstants.O_RDONLY |
        fsConstants.O_NOFOLLOW |
        (fsConstants.O_NONBLOCK || 0),
    );
  } catch (error) {
    if (error && ["ELOOP", "ENOENT", "EISDIR", "ENXIO"].includes(error.code)) {
      throw securityError("SOURCE_PATH_CHANGED_DURING_READ");
    }
    throw securityError("SOURCE_SAFE_OPEN_FAILED");
  }

  try {
    const openedStats = await handle.stat().catch(() => {
      throw securityError("SOURCE_DESCRIPTOR_STAT_FAILED");
    });
    if (!sameIdentity(beforeStats, openedStats)) {
      throw securityError("SOURCE_PATH_CHANGED_DURING_READ");
    }
    const content = await handle.readFile("utf8").catch(() => {
      throw securityError("SOURCE_READ_FAILED");
    });

    const afterStats = await lstatOrNull(target);
    if (!afterStats || !sameIdentity(openedStats, afterStats)) {
      throw securityError("SOURCE_PATH_CHANGED_DURING_READ");
    }
    return content;
  } finally {
    await handle.close().catch(() => {});
  }
}

async function safeReadJsonFile(filePath, allowedRoot, options) {
  const text = await safeReadTextFile(filePath, allowedRoot, options);
  return JSON.parse(text);
}

module.exports = {
  PathSecurityError,
  lexicalPath,
  guardPath,
  ensureSafeDir,
  guardWriteTarget,
  safeReadTextFile,
  safeReadJsonFile,
};
