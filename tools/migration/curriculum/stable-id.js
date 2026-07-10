/**
 * Deterministic, non-sensitive stable identifier generation.
 *
 * IDs are derived from a normalized input string using SHA-256 and are
 * intended to be repeatable across runs, machines and worktrees as long as
 * the same logical input is provided.
 */

const { createHash } = require("node:crypto");

const FORBIDDEN_ID_INPUTS = [
  "Date.now",
  "Math.random",
  "process.hrtime",
  "new Date",
  "hostname",
  "username",
  "worktree",
  "HEAD",
];

/**
 * @param {string} input
 * @param {string} [prefix]
 * @returns {string}
 */
function stableId(input, prefix = "mig002") {
  if (typeof input !== "string" || input.length === 0) {
    throw new TypeError("stableId requires a non-empty string input");
  }

  const normalized = input
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const digest = createHash("sha256").update(normalized).digest("hex");
  const shortDigest = digest.slice(0, 16);
  return `${prefix}_${shortDigest}`;
}

/**
 * Create a stable ID for a node within a course structure.
 *
 * @param {string} courseId
 * @param {string} nodeType
 * @param {string} localKey
 * @returns {string}
 */
function stableNodeId(courseId, nodeType, localKey) {
  return stableId(`${courseId}:${nodeType}:${localKey}`, "mig002");
}

module.exports = { stableId, stableNodeId, FORBIDDEN_ID_INPUTS };
