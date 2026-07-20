import { Controller, Get, HttpCode, HttpStatus, Query } from "@nestjs/common";
import { Public } from "../../common/security/index.js";
import { PrismaService } from "../../shared/database/prisma.service.js";

@Controller("plans")
export class PlansStubController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  async listPublicPlans(@Query("limit") limit = "50") {
    const take = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 100);
    const rows = await this.prisma.productPlan.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
      take,
      select: { id: true, code: true, name: true, version: true, priceCents: true, currency: true, trialDays: true, entitlements: { where: { enabled: true }, select: { key: true, limitValue: true, config: true } } },
    });
    return {
      data: {
        items: rows,
        nextCursor: null,
        hasMore: false,
      },
      meta: { requestId: "plans-public-list" },
    };
  }
}
