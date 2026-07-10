/**
 * Privacy leak scanner for migration outputs.
 *
 * Detects likely PII, credentials, local machine paths and binary payloads.
 * Scanning is conservative: findings are flagged for review rather than
 * silently redacted, so callers can decide how to handle them.
 */

const CN_PHONE_RE = /(?<![\d])1[3-9]\d{9}(?![\d])/;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const ID_CARD_RE = /\b\d{17}[\dXx]|\b\d{15}\b/;
const TOKEN_RE =
  /(?:token|api[-_]?key|secret|password|credential|authorization)\s*[:=]\s*["']?[^\s"']{8,}/i;
const PRIVATE_KEY_RE = /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/;
const HOME_PATH_RE = /\/home\/[a-zA-Z0-9_-]+|C:\\\\Users\\\\[a-zA-Z0-9_-]+/;
const FILE_URI_RE = /file:\/\/[^\s"']+/i;
const BASE64_RE = /data:image\/[a-z]+;base64,[A-Za-z0-9+/]{100,}={0,2}/;
const BASE64_AUDIO_RE = /data:audio\/[a-z]+;base64,[A-Za-z0-9+/]{100,}={0,2}/;
const ABSOLUTE_UNIX_RE = /\/etc\/|\/usr\/|\/var\/|\/home\/|\/tmp\//;
const ABSOLUTE_WINDOWS_RE = /[A-Za-z]:\\\\/;

const SCAN_RULES = [
  { name: "cnPhone", regex: CN_PHONE_RE, severity: "high" },
  { name: "email", regex: EMAIL_RE, severity: "high" },
  { name: "idCard", regex: ID_CARD_RE, severity: "high" },
  { name: "token", regex: TOKEN_RE, severity: "high" },
  { name: "privateKey", regex: PRIVATE_KEY_RE, severity: "high" },
  { name: "homePath", regex: HOME_PATH_RE, severity: "medium" },
  { name: "fileUri", regex: FILE_URI_RE, severity: "high" },
  { name: "base64Image", regex: BASE64_RE, severity: "medium" },
  { name: "base64Audio", regex: BASE64_AUDIO_RE, severity: "medium" },
  { name: "absoluteUnixPath", regex: ABSOLUTE_UNIX_RE, severity: "medium" },
  {
    name: "absoluteWindowsPath",
    regex: ABSOLUTE_WINDOWS_RE,
    severity: "medium",
  },
];

/**
 * @typedef {object} PiiFinding
 * @property {string} rule
 * @property {string} severity
 * @property {string} path
 * @property {string} snippet
 */

/**
 * Recursively scan a JSON-serializable value for PII patterns.
 *
 * @param {unknown} value
 * @param {string} [path]
 * @returns {PiiFinding[]}
 */
function scanForPii(value, path = "$") {
  /** @type {PiiFinding[]} */
  const findings = [];

  if (value === null || value === undefined) {
    return findings;
  }

  if (typeof value === "string") {
    for (const rule of SCAN_RULES) {
      const match = value.match(rule.regex);
      if (match) {
        findings.push({
          rule: rule.name,
          severity: rule.severity,
          path,
          snippet: match[0].slice(0, 80),
        });
      }
    }
    return findings;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return findings;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      findings.push(...scanForPii(value[i], `${path}[${i}]`));
    }
    return findings;
  }

  if (typeof value === "object") {
    for (const [key, val] of Object.entries(value)) {
      findings.push(...scanForPii(val, `${path}.${key}`));
    }
  }

  return findings;
}

/**
 * Redact a snippet so the raw value is not used as a review reason.
 *
 * @param {string} value
 * @returns {string}
 */
function redactSnippet(value) {
  if (value.length <= 4) {
    return "[REDACTED]";
  }
  return `${value.slice(0, 2)}[REDACTED]${value.slice(-2)}`;
}

module.exports = { scanForPii, redactSnippet, SCAN_RULES };
