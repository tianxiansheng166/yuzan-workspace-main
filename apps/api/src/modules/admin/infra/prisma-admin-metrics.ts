import { Injectable } from "@nestjs/common";
import { CourseVersionStatus, UserStatus } from "@yuzan/database";
import { PrismaService } from "../../../shared/database/prisma.service.js";
import { AdminUnavailableException } from "../domain/admin.errors.js";
import type {
  PlatformMetrics,
  ProviderStatus,
  SchoolUsageStats,
} from "../domain/admin.types.js";
import type { AdminMetricsPort } from "../ports/admin-metrics.port.js";

@Injectable()
export class PrismaAdminMetrics implements AdminMetricsPort {
  constructor(private readonly prisma: PrismaService) {}

  async getPlatformMetrics(): Promise<PlatformMetrics> {
    try {
      const [
        schoolCount,
        activeUserCount,
        publishedCourseCount,
        pendingReviewCount,
        assessmentTaskCount,
        systemErrorCount,
        providers,
      ] = await Promise.all([
        this.prisma.school.count({ where: { deletedAt: null } }),
        this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
        this.prisma.courseVersion.count({
          where: { status: CourseVersionStatus.PUBLISHED },
        }),
        this.prisma.courseVersion.count({
          where: { status: CourseVersionStatus.IN_REVIEW },
        }),
        this.prisma.assignment.count(),
        0, // Reserved for future error-log aggregation
        this.prisma.systemProvider.findMany({
          where: { enabled: true },
          orderBy: { type: "asc" },
        }),
      ]);

      const providerStatuses: ProviderStatus[] = providers.map((p) => ({
        type: p.type,
        healthStatus: mapHealthStatus(p.healthStatus),
        lastCheckedAt: p.lastCheckedAt ?? new Date(),
      }));

      // Derive a simplistic completion rate from submissions vs assignments.
      const assignmentCount = await this.prisma.assignment.count();
      const submissionCount = await this.prisma.submission.count();
      const learningCompletionRate =
        assignmentCount === 0 ? 0 : submissionCount / assignmentCount;

      return {
        schoolCount,
        activeUserCount,
        publishedCourseCount,
        pendingReviewCount,
        assessmentTaskCount,
        learningCompletionRate,
        systemErrorCount,
        providerStatuses,
      };
    } catch (err) {
      if (err instanceof AdminUnavailableException) throw err;
      throw new AdminUnavailableException();
    }
  }

  async getSchoolUsageStats(schoolId: string): Promise<SchoolUsageStats> {
    try {
      const [
        membershipCount,
        classCount,
        courseCount,
        assignmentCount,
        submissionCount,
      ] = await Promise.all([
        this.prisma.membership.count({ where: { schoolId } }),
        this.prisma.class.count({ where: { schoolId } }),
        this.prisma.course.count({ where: { schoolId } }),
        this.prisma.assignment.count({ where: { schoolId } }),
        this.prisma.submission.count({ where: { schoolId } }),
      ]);

      return {
        membershipCount,
        classCount,
        courseCount,
        assignmentCount,
        submissionCount,
      };
    } catch (err) {
      if (err instanceof AdminUnavailableException) throw err;
      throw new AdminUnavailableException();
    }
  }
}

function mapHealthStatus(status: string): string {
  switch (status) {
    case "HEALTHY":
      return "healthy";
    case "DEGRADED":
      return "degraded";
    case "DOWN":
      return "down";
    default:
      return "unknown";
  }
}
