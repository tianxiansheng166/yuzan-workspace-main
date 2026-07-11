import { describe, it, expect } from "vitest";
import { ReportNotFoundException, ReportForbiddenException, ReportConflictException } from "../../src/modules/reporting/domain/report.errors.js";
import { OfflinePackageNotFoundException, SyncBatchConflictException } from "../../src/modules/offline/domain/offline.errors.js";

describe("Error sanitization", () => {
  it("report errors do not leak internal details", () => {
    const notFound = new ReportNotFoundException();
    const body = notFound.getResponse() as Record<string, unknown>;
    const error = body.error ?? body;
    expect(JSON.stringify(error)).not.toMatch(/sql|token|password|schema|host/i);
  });

  it("offline errors do not leak internal details", () => {
    const notFound = new OfflinePackageNotFoundException();
    const body = notFound.getResponse() as Record<string, unknown>;
    expect(JSON.stringify(body)).not.toMatch(/sql|token|password|schema|host/i);
  });

  it("error codes follow SNAKE_CASE_ALL_CAPS convention", () => {
    const errors = [
      new ReportNotFoundException(),
      new ReportForbiddenException(),
      new ReportConflictException(),
      new OfflinePackageNotFoundException(),
      new SyncBatchConflictException(),
    ];
    for (const err of errors) {
      const body = err.getResponse() as Record<string, unknown>;
      const error = body.error ?? body;
      const code = (error as Record<string, unknown>).code as string;
      expect(code).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });
});
