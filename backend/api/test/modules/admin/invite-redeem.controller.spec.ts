import { describe, expect, it, vi } from "vitest";
import { InviteRedeemController } from "../../../src/modules/mvp-gaps/invite-redeem.controller.js";
import { MembershipRole } from "../../../src/common/security/index.js";

const schoolId = "11111111-1111-4111-8111-111111111111";

function fixture() {
  const tx = {
    inviteCode: { findUnique: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    membership: { create: vi.fn() },
    notification: { create: vi.fn() },
  };
  const prisma = { $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)) };
  return { tx, prisma };
}

describe("InviteRedeemController", () => {
  it("redeems a valid code once and creates an active membership", async () => {
    const { tx, prisma } = fixture();
    tx.inviteCode.findUnique.mockResolvedValue({ id: "invite-1", schoolId, createdByUserId: "admin-1", maxUses: 1, usedCount: 0, expiresAt: new Date(Date.now() + 60_000), revokedAt: null });
    tx.user.findUnique.mockResolvedValue(null);
    tx.inviteCode.updateMany.mockResolvedValue({ count: 1 });
    tx.user.create.mockResolvedValue({ id: "user-1" });
    tx.membership.create.mockResolvedValue({ id: "membership-1", schoolId, role: "STUDENT", status: "ACTIVE" });
    const controller = new InviteRedeemController(prisma as any, { hash: vi.fn().mockResolvedValue("hash") } as any);

    const result = await controller.redeem({ code: " yz-abcd ", identifier: "student@example.com", password: "secret1", role: MembershipRole.STUDENT });

    expect(result.next).toBe("LOGIN_REQUIRED");
    expect(tx.inviteCode.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ usedCount: { lt: 1 } }), data: { usedCount: { increment: 1 } } }));
    expect(tx.membership.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ schoolId, role: "STUDENT", status: "ACTIVE" }) }));
    expect(tx.notification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ recipientUserId: "admin-1", type: "SYSTEM", relatedEntityType: "InviteCode" }) }));
  });

  it("rejects revoked or exhausted codes before creating an account", async () => {
    const { tx, prisma } = fixture();
    tx.inviteCode.findUnique.mockResolvedValue({ id: "invite-1", schoolId, maxUses: 1, usedCount: 1, expiresAt: new Date(Date.now() + 60_000), revokedAt: null });
    const controller = new InviteRedeemController(prisma as any, { hash: vi.fn() } as any);

    await expect(controller.redeem({ code: "YZ-ABCD", identifier: "student@example.com", password: "secret1", role: MembershipRole.STUDENT })).rejects.toThrow("使用次数已达上限");
    expect(tx.user.create).not.toHaveBeenCalled();
  });
});
