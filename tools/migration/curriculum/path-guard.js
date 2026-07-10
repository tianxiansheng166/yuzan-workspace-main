/**
 * Path and symlink boundary guards.
 *
 * Prevents directory traversal, symlink escapes and accidental writes outside
 * the designated output roots. All boundary checks use realpath resolution
 * rather than simple string prefix matching.
 */

const { lstat, realpath, mkdir } = require("node:fs/promises");
const { dirname } = require("node:path");

/**
 * Resolve a path and verify it does not escape the allowed root.
 *
 * @param {string} targetPath
 * @param {string} allowedRoot - must be a real directory
 * @returns {Promise<string>} the realpath of targetPath
 */
async function guardPath(targetPath, allowedRoot) {
  const realRoot = await realpath(allowedRoot);
  const realTarget = await realpath(targetPath);

  if (realTarget !== realRoot && !realTarget.startsWith(`${realRoot}/`)) {
    throw new Error(
      `PATH_ESCAPE: ${targetPath} resolves outside ${allowedRoot}`,
    );
  }

  return realTarget;
}

/**
 * Ensure parent directories exist, validating each newly created component.
 *
 * @param {string} filePath
 * @param {string} allowedRoot
 */
async function ensureSafeDir(filePath, allowedRoot) {
  const realRoot = await realpath(allowedRoot);
  const parent = dirname(filePath);

  if (parent === realRoot || parent.startsWith(`${realRoot}/`)) {
    await mkdir(parent, { recursive: true });
    return;
  }

  // When parent is deeper than root, validate it after creation by realpath.
  await mkdir(parent, { recursive: true });
  const realParent = await realpath(parent);
  if (realParent !== realRoot && !realParent.startsWith(`${realRoot}/`)) {
    throw new Error(
      `OUTPUT_DIR_ESCAPE: ${filePath} parent resolves outside ${allowedRoot}`,
    );
  }
}

/**
 * Verify a file write target is safe: no symlink trickery on the file or its
 * parent directory, and the resolved path stays inside the allowed root.
 *
 * @param {string} filePath
 * @param {string} allowedRoot
 */
async function guardWriteTarget(filePath, allowedRoot) {
  const realRoot = await realpath(allowedRoot);

  try {
    const stats = await lstat(filePath);
    if (stats.isSymbolicLink()) {
      throw new Error(`SYMLINK_FILE: ${filePath} is a symlink`);
    }
  } catch (err) {
    if (!(err instanceof Error && "code" in err && err.code === "ENOENT")) {
      throw err;
    }
  }

  const parent = dirname(filePath);
  try {
    const parentStats = await lstat(parent);
    if (parentStats.isSymbolicLink()) {
      throw new Error(`SYMLINK_DIR: ${parent} is a symlink`);
    }
  } catch (err) {
    if (!(err instanceof Error && "code" in err && err.code === "ENOENT")) {
      throw err;
    }
  }

  await ensureSafeDir(filePath, allowedRoot);

  const realFile = await realpath(filePath).catch((err) => {
    if (err.code === "ENOENT") {
      return null;
    }
    throw err;
  });

  if (realFile) {
    const realParent = dirname(realFile);
    if (realParent !== realRoot && !realParent.startsWith(`${realRoot}/`)) {
      throw new Error(`REALPATH_ESCAPE: ${filePath} resolves outside root`);
    }
  }
}

module.exports = { guardPath, ensureSafeDir, guardWriteTarget };
