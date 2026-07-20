import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../shared/database/prisma.service.js";
import type { OperationsStatus, SystemStatus } from "./domain/operations.types.js";

@Injectable()
export class OperationsService {
  private readonly logger = new Logger(OperationsService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getStatus(): Promise<OperationsStatus> {
    let database: "connected" | "disconnected" = "connected";
    let activeSchools = 0;

    try {
      activeSchools = await this.prisma.school.count({
        where: { isActive: true, deletedAt: null },
      });
    } catch (err) {
      this.logger.warn(`Database health check failed: ${(err as Error).message}`);
      database = "disconnected";
    }

    const status: SystemStatus = database === "connected" ? "ok" : "degraded";

    return {
      status,
      timestamp: new Date(),
      version: process.env.npm_package_version ?? "0.1.0",
      database,
      activeSchools,
    };
  }
}
