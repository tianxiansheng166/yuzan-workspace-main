import { describe, expect, it, vi } from "vitest";
import { AuditStubController } from "../../../src/modules/mvp-gaps/audit-stub.controller.js";
import { MembershipRole } from "../../../src/common/security/index.js";

const schoolId = "11111111-1111-4111-8111-111111111111";
const principal = { userId: "33333333-3333-4333-8333-333333333333", roles: [MembershipRole.SCHOOL_ADMIN], membershipStatus: "ACTIVE" as const, source: "test" };

describe("AuditStubController persistence implementation", () => {
  it("only queries the current school for school administrators", async () => {
    const prisma = { auditLog: { findMany: vi.fn().mockResolvedValue([]) } } as any;
    const controller = new AuditStubController(prisma);
    const result = await controller.searchLogs({ limit: 10 }, principal, { schoolId });

    expect(result.scope).toEqual({ schoolId });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ schoolId }) }));
  });

  it("keeps platform audit queries explicitly global", async () => {
    const prisma = { auditLog: { findMany: vi.fn().mockResolvedValue([{ id: "log-1" }]) } } as any;
    const controller = new AuditStubController(prisma);
    const platform = { ...principal, roles: [MembershipRole.PLATFORM_ADMIN] };
    const result = await controller.searchLogs({ action: "ADMIN_SCHOOL_UPDATED", limit: 10 }, platform, { schoolId });

    expect(result.scope).toEqual({ allSchools: true });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { action: "ADMIN_SCHOOL_UPDATED" } }));
  });

  it("exports filtered audit rows as escaped CSV within the same scope", async () => {
    const prisma = { auditLog: { findMany: vi.fn().mockResolvedValue([{ id: "log-1", schoolId, actorUserId: principal.userId, action: "ADMIN_SCHOOL_UPDATED", resourceType: "School", resourceId: "school-1", requestId: "req-1", beforeSummary: null, afterSummary: null, createdAt: new Date("2026-07-18T12:00:00.000Z") }]) } } as any;
    const controller = new AuditStubController(prisma);

    const csv = await controller.exportLogs({ action: "ADMIN_SCHOOL_UPDATED", limit: 10 }, principal, { schoolId });

    expect(csv).toContain("id,schoolId,actorUserId,action");
    expect(csv).toContain("log-1");
    expect(csv).toContain("2026-07-18T12:00:00.000Z");
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { schoolId, action: "ADMIN_SCHOOL_UPDATED" } }));
  });
});
