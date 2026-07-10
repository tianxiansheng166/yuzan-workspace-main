import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "./logger.js";
import { runWithContext } from "../context/context.js";

function captureStream(): {
  stream: Writable;
  messages: () => Record<string, unknown>[];
} {
  const chunks: Buffer[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      callback();
    },
  });
  return {
    stream,
    messages: () =>
      Buffer.concat(chunks)
        .toString("utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

describe("logger", () => {
  it("logs event with service and environment", () => {
    const { stream, messages } = captureStream();
    const logger = createLogger({
      service: "test-service",
      environment: "test",
      level: "info",
      destination: stream,
    });

    logger.info({ event: "test", status: 200 });
    const msg = messages()[0]!;
    expect(msg.service).toBe("test-service");
    expect(msg.environment).toBe("test");
    expect(msg.event).toBe("test");
    expect(msg.status).toBe(200);
    expect(msg.level).toBe("info");
    expect(typeof msg.timestamp).toBe("string");
  });

  it("pulls requestId from context", () => {
    const { stream, messages } = captureStream();
    const logger = createLogger({
      service: "api",
      level: "info",
      destination: stream,
    });

    runWithContext({ requestId: "ctx-req-123" }, () => {
      logger.info({ event: "with-context" });
    });

    expect(messages()[0]!.requestId).toBe("ctx-req-123");
  });

  it("uses safe references instead of raw identifiers", () => {
    const { stream, messages } = captureStream();
    const logger = createLogger({
      service: "api",
      level: "info",
      destination: stream,
    });

    runWithContext(
      {
        requestId: "r1",
        safeTenantRef: "tenant-digest",
        safeUserRef: "user-digest",
      },
      () => {
        logger.info({ event: "audit" });
      },
    );

    const msg = messages()[0]!;
    expect(msg.safeTenantRef).toBe("tenant-digest");
    expect(msg.safeUserRef).toBe("user-digest");
  });

  it("redacts sensitive fields from log events", () => {
    const { stream, messages } = captureStream();
    const logger = createLogger({
      service: "api",
      level: "info",
      destination: stream,
    });

    logger.info({
      event: "request",
      headers: { authorization: "Bearer secret" },
      body: { password: "plain" },
    });

    const msg = messages()[0]!;
    expect((msg.headers as Record<string, unknown>).authorization).toBe(
      "[REDACTED]",
    );
    expect((msg.body as Record<string, unknown>).password).toBe("[REDACTED]");
  });

  it("redacts private keys and connection credentials in final logger output", () => {
    const { stream, messages } = captureStream();
    const logger = createLogger({ service: "api", destination: stream });

    const privateKeySentinel = "OPS001_PRIVATE_KEY_SENTINEL";
    const databasePasswordSentinel = "OPS001_DATABASE_PASSWORD_SENTINEL";
    logger.info({
      event: "security",
      privateKey: privateKeySentinel,
      detail: `postgresql://user:${databasePasswordSentinel}@db.internal/app`,
      nested: [{ private_key: "pk-array-secret" }],
      error: new Error("mysql://user:db-error-secret@db.internal/app", {
        cause: { privateKey: "pk-cause-secret" },
      }),
    });

    const output = JSON.stringify(messages());
    for (const secret of [
      privateKeySentinel,
      databasePasswordSentinel,
      "pk-array-secret",
      "db-error-secret",
      "pk-cause-secret",
    ]) {
      expect(output).not.toContain(secret);
    }
  });

  it("never logs a rejected correlation id", () => {
    const { stream, messages } = captureStream();
    const logger = createLogger({ service: "api", destination: stream });
    const correlationSentinel = "OPS001_CORRELATION_CRLF_SENTINEL";
    const oversizedSentinel = "OPS001_CORRELATION_OVERSIZED_SENTINEL";
    const malicious = `${correlationSentinel}\r\nInjected: true`;

    runWithContext({ correlationId: malicious } as never, () => {
      logger.info({ event: "correlation" });
    });
    runWithContext(
      { correlationId: `${oversizedSentinel}${"a".repeat(129)}` },
      () => logger.info({ event: "oversized-correlation" }),
    );

    const output = JSON.stringify(messages());
    expect(output).not.toContain(correlationSentinel);
    expect(output).not.toContain(oversizedSentinel);
    for (const message of messages()) {
      expect(message.correlationId).toMatch(/^[A-Za-z0-9._-]{1,128}$/);
    }
  });
});
