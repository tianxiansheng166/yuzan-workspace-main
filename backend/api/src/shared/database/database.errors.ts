/**
 * Structured database error types for the shared runtime.
 *
 * These errors never expose raw SQL, connection strings, passwords,
 * or internal schema details. They carry only a stable error code,
 * an optional operation category, a correlation/request ID, and
 * a retryability hint.
 */

export type DatabaseErrorCode =
  | "DATABASE_UNAVAILABLE"
  | "DATABASE_CONFLICT"
  | "DATABASE_CONSTRAINT_VIOLATION"
  | "DATABASE_TRANSACTION_FAILED"
  | "DATABASE_CONFIG_INVALID"
  | "DATABASE_QUERY_FAILED";

export class DatabaseError extends Error {
  constructor(
    public readonly code: DatabaseErrorCode,
    message: string,
    public readonly operation?: string,
    public readonly requestId?: string,
    public readonly retryable?: boolean,
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

/**
 * Redact the userinfo portion of a PostgreSQL connection string.
 * `postgresql://user:pass@host/db` → `postgresql://***@host/db`
 * Returns `[REDACTED]` if the URL cannot be safely parsed.
 */
export function redactConnectionString(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) {
      parsed.username = "***";
      parsed.password = "";
    }
    // Remove query params that might contain schema or other internals.
    parsed.search = "";
    return parsed.toString();
  } catch {
    return "[REDACTED]";
  }
}

/**
 * Sanitize a raw driver error so that no credentials, SQL text,
 * or internal schema details leak into logs or responses.
 */
export function sanitizeDriverError(error: unknown): {
  code: DatabaseErrorCode;
  message: string;
  retryable: boolean;
} {
  if (error && typeof error === "object") {
    const pgError = error as { code?: string; message?: string };

    // PostgreSQL error codes
    // 08xxx: connection exception
    if (typeof pgError.code === "string" && pgError.code.startsWith("08")) {
      return {
        code: "DATABASE_UNAVAILABLE",
        message: "Database connection failed",
        retryable: true,
      };
    }
    // 23505: unique violation
    if (pgError.code === "23505") {
      return {
        code: "DATABASE_CONFLICT",
        message: "A record with this key already exists",
        retryable: false,
      };
    }
    // 23xxx: integrity constraint violation
    if (typeof pgError.code === "string" && pgError.code.startsWith("23")) {
      return {
        code: "DATABASE_CONSTRAINT_VIOLATION",
        message: "A database constraint was violated",
        retryable: false,
      };
    }
    // 40001: serialization failure (transaction)
    if (pgError.code === "40001") {
      return {
        code: "DATABASE_TRANSACTION_FAILED",
        message: "Transaction failed due to concurrent modification",
        retryable: true,
      };
    }
  }

  return {
    code: "DATABASE_QUERY_FAILED",
    message: "An unexpected database error occurred",
    retryable: false,
  };
}
