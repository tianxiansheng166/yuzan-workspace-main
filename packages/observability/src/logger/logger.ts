import pino from "pino";
import { getContext, type ObservabilityContext } from "../context/context.js";
import { redact, type RedactionOptions } from "../redaction/redaction.js";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface LogEvent {
  timestamp: string;
  level: LogLevel;
  service: string;
  environment: string;
  event: string;
  requestId?: string;
  correlationId?: string;
  safeTenantRef?: string;
  safeUserRef?: string;
  durationMs?: number;
  status?: string | number;
  [key: string]: unknown;
}

export interface LoggerOptions {
  service: string;
  environment?: string;
  level?: LogLevel;
  redaction?: RedactionOptions;
  destination?: NodeJS.WritableStream;
}

export interface Logger {
  trace(event: Partial<LogEvent>): void;
  debug(event: Partial<LogEvent>): void;
  info(event: Partial<LogEvent>): void;
  warn(event: Partial<LogEvent>): void;
  error(event: Partial<LogEvent>): void;
  fatal(event: Partial<LogEvent>): void;
  child(bindings: Record<string, unknown>): Logger;
}

class PinoLogger implements Logger {
  private readonly logger: pino.Logger;
  private readonly redaction: RedactionOptions;

  constructor(options: LoggerOptions) {
    this.redaction = options.redaction ?? {};
    this.logger = pino(
      {
        level: options.level ?? (process.env.LOG_LEVEL as LogLevel) ?? "info",
        base: {
          service: options.service,
          environment:
            options.environment ?? process.env.NODE_ENV ?? "development",
        },
        formatters: {
          level: (label: string) => ({ level: label }),
        },
        timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
        redact: {
          paths: [
            "privateKey",
            "*.privateKey",
            "*.*.privateKey",
            "private_key",
            "*.private_key",
            "*.*.private_key",
            "databaseUrl",
            "*.databaseUrl",
            "*.*.databaseUrl",
            "database_url",
            "*.database_url",
            "*.*.database_url",
            "connectionString",
            "*.connectionString",
            "*.*.connectionString",
            "connection_string",
            "*.connection_string",
            "*.*.connection_string",
            "dsn",
            "*.dsn",
            "*.*.dsn",
            "*.password",
            "*.passwordHash",
            "*.token",
            "*.accessToken",
            "*.refreshToken",
            "*.authorization",
            "*.cookie",
            "*.setCookie",
            "*.audio",
            "*.recording",
          ],
          censor: "[REDACTED]",
        },
      },
      options.destination,
    );
  }

  private mergeContext(event: Partial<LogEvent>): Record<string, unknown> {
    const ctx: ObservabilityContext = getContext();
    const merged: Record<string, unknown> = {
      ...this.redact(event),
      service: event.service ?? this.logger.bindings().service ?? ctx.service,
      environment:
        event.environment ??
        this.logger.bindings().environment ??
        ctx.environment,
      event: event.event ?? "log",
    };

    if (ctx.requestId && ctx.requestId !== "unknown") {
      merged.requestId = ctx.requestId;
    }
    if (ctx.correlationId) {
      merged.correlationId = ctx.correlationId;
    }
    if (ctx.safeTenantRef) {
      merged.safeTenantRef = ctx.safeTenantRef;
    }
    if (ctx.safeUserRef) {
      merged.safeUserRef = ctx.safeUserRef;
    }

    return merged;
  }

  private redact(event: Partial<LogEvent>): Record<string, unknown> {
    const options: RedactionOptions = {
      maxDepth: this.redaction.maxDepth ?? 16,
    };
    if (this.redaction.censor !== undefined) {
      options.censor = this.redaction.censor;
    }
    return redact(event as Record<string, unknown>, options);
  }

  trace(event: Partial<LogEvent>): void {
    this.logger.trace(this.mergeContext(event));
  }

  debug(event: Partial<LogEvent>): void {
    this.logger.debug(this.mergeContext(event));
  }

  info(event: Partial<LogEvent>): void {
    this.logger.info(this.mergeContext(event));
  }

  warn(event: Partial<LogEvent>): void {
    this.logger.warn(this.mergeContext(event));
  }

  error(event: Partial<LogEvent>): void {
    this.logger.error(this.mergeContext(event));
  }

  fatal(event: Partial<LogEvent>): void {
    this.logger.fatal(this.mergeContext(event));
  }

  child(bindings: Record<string, unknown>): Logger {
    const child = new PinoLogger({
      service: String(bindings.service ?? this.logger.bindings().service),
      environment: String(
        bindings.environment ?? this.logger.bindings().environment,
      ),
      level: this.logger.level as LogLevel,
      redaction: this.redaction,
    });
    return child;
  }
}

export function createLogger(options: LoggerOptions): Logger {
  return new PinoLogger(options);
}
