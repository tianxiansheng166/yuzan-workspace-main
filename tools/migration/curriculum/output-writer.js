/**
 * Safe output writer for migration artifacts.
 */

const { writeFile, rename, unlink } = require("node:fs/promises");
const { resolve } = require("node:path");
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

async function writeJsonFile(filePath, data, allowedRoot) {
  await guardWriteTarget(filePath, allowedRoot);

  const resolved = resolve(filePath);
  const tempPath = resolve(allowedRoot, deterministicTempName(filePath));

  try {
    await writeFile(tempPath, JSON.stringify(data, null, 2) + "\n", "utf8");
    await rename(tempPath, resolved);
  } finally {
    // Best-effort cleanup of temp file on failure; ignore errors.
    try {
      await unlink(tempPath);
    } catch {
      // ignore
    }
  }
}

/**
 * Write a UTF-8 text file atomically.
 *
 * @param {string} filePath
 * @param {string} content
 * @param {string} allowedRoot
 */
async function writeTextFile(filePath, content, allowedRoot) {
  await guardWriteTarget(filePath, allowedRoot);

  const resolved = resolve(filePath);
  const tempPath = resolve(allowedRoot, deterministicTempName(filePath));

  try {
    await writeFile(tempPath, content, "utf8");
    await rename(tempPath, resolved);
  } finally {
    try {
      await unlink(tempPath);
    } catch {
      // ignore
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
