import { redact } from "./log-redaction.js";

export interface SecurityLogEvent {
  readonly event: string;
  readonly requestId: string;
  readonly code?: string;
  readonly userId?: string;
  readonly schoolId?: string;
  readonly path?: string;
  readonly method?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Structured security logger.
 *
 * All values are redacted before emission so that tokens, passwords and
 * student PII never reach application logs.
 */
export class SecurityLogger {
  log(event: SecurityLogEvent): void {
    const redacted = redact(event);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ type: "SECURITY", ...redacted }));
  }

  logDenial(event: Omit<SecurityLogEvent, "event">): void {
    this.log({ ...event, event: "AUTHORIZATION_DENIED" });
  }
}

export const securityLogger = new SecurityLogger();
