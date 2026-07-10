/**
 * Safe output writer for migration artifacts.
 */

const fsPromises = require("node:fs/promises");
const fsConstants = require("node:fs").constants;
const { dirname, resolve } = require("node:path");
const { createHash } = require("node:crypto");
const { guardWriteTarget } = require("./path-guard.js");

/**
 * Write a JSON file atomically: first to a temp file in the same directory,
 * then rename. This avoids half-written files on crash.
 *
 * @param {string} filePath
 * @param {unknown} data
 * @param {string} allowedRoot
 */
function deterministicTempName(filePath) {
  const hash = createHash("sha256").update(resolve(filePath)).digest("hex");
  return `.mig002-${hash.slice(0, 16)}.tmp`;
}

async function writeJsonFile(filePath, data, allowedRoot, options) {
  await writeAtomic(
    filePath,
    JSON.stringify(data, null, 2) + "\n",
    allowedRoot,
    options,
  );
}

/**
 * Write a UTF-8 text file atomically.
 *
 * @param {string} filePath
 * @param {string} content
 * @param {string} allowedRoot
 */
async function writeTextFile(filePath, content, allowedRoot, options) {
  await writeAtomic(filePath, content, allowedRoot, options);
}

async function writeAtomic(filePath, content, allowedRoot, options = {}) {
  const resolved = await guardWriteTarget(filePath, allowedRoot);
  const tempPath = resolve(dirname(resolved), deterministicTempName(filePath));
  let handle;
  let tempCreated = false;
  try {
    await guardWriteTarget(tempPath, allowedRoot);
    if (typeof options.beforeTempOpen === "function") {
      await options.beforeTempOpen();
    }
    // Revalidate immediately before creating the temp file. O_EXCL and
    // O_NOFOLLOW ensure an attacker-controlled temp entry is never followed.
    await guardWriteTarget(tempPath, allowedRoot);
    if (
      typeof fsConstants.O_NOFOLLOW !== "number" ||
      fsConstants.O_NOFOLLOW === 0
    ) {
      const error = new Error("OUTPUT_SAFE_OPEN_UNSUPPORTED");
      error.code = "OUTPUT_SAFE_OPEN_UNSUPPORTED";
      throw error;
    }
    handle = await fsPromises
      .open(
        tempPath,
        fsConstants.O_WRONLY |
          fsConstants.O_CREAT |
          fsConstants.O_EXCL |
          fsConstants.O_NOFOLLOW,
        0o600,
      )
      .catch(() => {
        const error = new Error("OUTPUT_TEMP_CREATE_FAILED");
        error.code = "OUTPUT_TEMP_CREATE_FAILED";
        throw error;
      });
    tempCreated = true;
    await handle.writeFile(content, "utf8").catch(() => {
      const error = new Error("OUTPUT_TEMP_WRITE_FAILED");
      error.code = "OUTPUT_TEMP_WRITE_FAILED";
      throw error;
    });
    await handle.sync().catch(() => {
      const error = new Error("OUTPUT_TEMP_WRITE_FAILED");
      error.code = "OUTPUT_TEMP_WRITE_FAILED";
      throw error;
    });
    await handle.close();
    handle = undefined;

    if (typeof options.beforeRename === "function") {
      await options.beforeRename();
    }
    await guardWriteTarget(resolved, allowedRoot);
    await guardWriteTarget(tempPath, allowedRoot);
    await fsPromises.rename(tempPath, resolved).catch(() => {
      const error = new Error("OUTPUT_PUBLISH_FAILED");
      error.code = "OUTPUT_PUBLISH_FAILED";
      throw error;
    });
  } finally {
    if (handle) await handle.close().catch(() => {});
    if (tempCreated) {
      try {
        await fsPromises.unlink(tempPath);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Convert an array of objects to CSV.
 *
 * @param {readonly object[]} rows
 * @param {readonly string[]} columns
 * @returns {string}
 */
function toCsv(rows, columns) {
  const header = columns.join(",");
  const lines = rows.map((row) =>
    columns
      .map((col) => {
        const value = row[col];
        if (value === undefined || value === null) {
          return "";
        }
        const text = String(value).replace(/"/g, '""');
        if (/[",\n\r]/.test(text)) {
          return `"${text}"`;
        }
        return text;
      })
      .join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}

module.exports = { writeJsonFile, writeTextFile, toCsv };
