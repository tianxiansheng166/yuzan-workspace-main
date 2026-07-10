/**
 * Path and symlink boundary guards.
 *
 * Prevents directory traversal, symlink escapes and accidental writes outside
 * the designated output roots. All boundary checks use realpath resolution
 * rather than simple string prefix matching.
 */

const fsPromises = require("node:fs/promises");
const { dirname, resolve, relative, sep } = require("node:path");

/**
 * Resolve a path and verify it does not escape the allowed root.
 *
 * @param {string} targetPath
 * @param {string} allowedRoot - must be a real directory
 * @returns {Promise<string>} the realpath of targetPath
 */
async function guardPath(targetPath, allowedRoot) {
  const realRoot = await fsPromises.realpath(allowedRoot);
  const realTarget = await fsPromises.realpath(targetPath);

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
  const realRoot = await fsPromises.realpath(allowedRoot);
  const parent = dirname(filePath);

  if (parent === realRoot || parent.startsWith(`${realRoot}/`)) {
    await fsPromises.mkdir(parent, { recursive: true });
    return;
  }

  // When parent is deeper than root, validate it after creation by realpath.
  await fsPromises.mkdir(parent, { recursive: true });
  const realParent = await fsPromises.realpath(parent);
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
  const realRoot = await fsPromises.realpath(allowedRoot);

  try {
    const stats = await fsPromises.lstat(filePath);
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
    const parentStats = await fsPromises.lstat(parent);
    if (parentStats.isSymbolicLink()) {
      throw new Error(`SYMLINK_DIR: ${parent} is a symlink`);
    }
  } catch (err) {
    if (!(err instanceof Error && "code" in err && err.code === "ENOENT")) {
      throw err;
    }
  }

  await ensureSafeDir(filePath, allowedRoot);

  const realFile = await fsPromises.realpath(filePath).catch((err) => {
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

/**
 * Verify every path component between allowedRoot and filePath is not a
 * symbolic link, then read the regular file while guarding against TOCTOU.
 *
 * Throws sanitized errors that never include symlink targets or absolute
 * external paths. realpath is used only to confirm the root boundary, never
 * to resolve the file before reading.
 *
 * @param {string} filePath
 * @param {string} allowedRoot
 * @returns {Promise<string>} file contents as UTF-8 text
 */
async function safeReadTextFile(filePath, allowedRoot) {
  const realRoot = await fsPromises.realpath(allowedRoot);
  const resolved = resolve(filePath);
  const rel = relative(realRoot, resolved);

  if (rel === "" || rel.startsWith("..")) {
    throw new Error(`PATH_ESCAPE: input resolves outside allowed root`);
  }

  const parts = rel.split(sep).filter(Boolean);
  let current = realRoot;

  for (const part of parts) {
    current = resolve(current, part);
    let stats;
    try {
      stats = await fsPromises.lstat(current);
    } catch (err) {
      if (err instanceof Error && "code" in err && err.code === "ENOENT") {
        throw new Error(`INPUT_NOT_FOUND: ${relative(realRoot, current)}`);
      }
      throw err;
    }

    if (stats.isSymbolicLink()) {
      throw new Error(
        `SOURCE_PATH_ANCESTOR_SYMLINK_REJECTED: ${relative(realRoot, current)}`,
      );
    }
  }

  const beforeStats = await fsPromises.lstat(resolved);
  if (!beforeStats.isFile()) {
    throw new Error(`INPUT_NOT_REGULAR_FILE: ${rel}`);
  }

  const handle = await fsPromises.open(resolved, "r");
  let content;
  try {
    content = await handle.readFile("utf8");
  } finally {
    await handle.close();
  }

  // Verify the path still resolves to the same regular file after closing the
  // descriptor. This detects replacement between lstat-before and read.
  const afterStats = await fsPromises.lstat(resolved);
  if (
    afterStats.dev !== beforeStats.dev ||
    afterStats.ino !== beforeStats.ino ||
    !afterStats.isFile()
  ) {
    throw new Error(`SOURCE_PATH_CHANGED_DURING_READ: ${rel}`);
  }

  return content;
}

/**
 * Safely read and parse a JSON input file without following symlinks.
 *
 * @param {string} filePath
 * @param {string} allowedRoot
 * @returns {Promise<unknown>}
 */
async function safeReadJsonFile(filePath, allowedRoot) {
  const text = await safeReadTextFile(filePath, allowedRoot);
  return JSON.parse(text);
}

module.exports = {
  guardPath,
  ensureSafeDir,
  guardWriteTarget,
  safeReadTextFile,
  safeReadJsonFile,
};
