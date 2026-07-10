/**
 * Case-insensitive substring matches for field names whose values must be
 * redacted from logs.
 */
const SENSITIVE_NAME_PARTS = [
  "password",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "apikey",
  "secret",
  "credential",
  "session",
];

/**
 * Case-insensitive substring matches for PII / student-sensitive field names.
 */
const PII_NAME_PARTS = [
  "displayname",
  "realname",
  "phone",
  "email",
  "idcard",
  "address",
  "audio",
  "recording",
  "avatar",
  "profile",
];

const REDACTED = "[REDACTED]";

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_]/g, "");
  return (
    SENSITIVE_NAME_PARTS.some((part) => normalized.includes(part)) ||
    PII_NAME_PARTS.some((part) => normalized.includes(part))
  );
}

/**
 * Recursively redact sensitive values from an arbitrary payload.
 *
 * - Plain strings are returned unchanged (callers should not pass raw secrets).
 * - Objects/arrays have sensitive field values replaced with [REDACTED].
 * - Nested structures are traversed depth-first.
 *
 * @param value - any value captured for logging
 * @returns a clone with sensitive fields redacted
 */
export function redact<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item)) as unknown as T;
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = isSensitiveKey(key) ? REDACTED : redact(val);
    }
    return result as unknown as T;
  }

  return value;
}
