import type { AuthContext } from "../../../common/security/auth.types.js";
import type { ResourceLookupPort } from "../../resources/ports/resource-lookup.port.js";
import type {
  CourseVersion,
  CourseVersionStatus,
} from "../domain/course-version.types.js";
import {
  CurriculumConflictException,
  CurriculumNotFoundException,
  CurriculumValidationException,
  type PublishValidationError,
} from "../domain/curriculum.errors.js";
import type { CourseVersionRepositoryPort } from "../ports/course-version-repository.port.js";
import {
  validateCourseVersionForPublish,
  type PublishingValidationContext,
} from "./publishing.validator.js";

const PUBLISHABLE_STATUSES: readonly CourseVersionStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
];

export async function executePublish(
  repo: CourseVersionRepositoryPort,
  resourceRepo: ResourceLookupPort,
  auth: AuthContext,
  schoolId: string,
  courseVersionId: string,
  now: Date,
): Promise<CourseVersion> {
  const version = await repo.findById(schoolId, courseVersionId);

  if (!version) {
    throw new CurriculumNotFoundException();
  }

  if (version.status === "PUBLISHED") {
    return version;
  }

  if (version.status === "RETIRED") {
    throw new CurriculumConflictException("已归档版本不能重新发布");
  }

  if (!PUBLISHABLE_STATUSES.includes(version.status)) {
    throw new CurriculumConflictException(
      `当前状态 ${version.status} 不允许发布`,
    );
  }

  const resourceIds = collectResourceIds(version);
  const resources = await resourceRepo.findByIds(resourceIds);
  const resourcesById = new Map(resources.map((r) => [r.id, r]));

  const context: PublishingValidationContext = { resourcesById };
  const result = validateCourseVersionForPublish(version, context);

  if (!result.ok) {
    throw new CurriculumValidationException(result.errors);
  }

  const published = await repo.publish(schoolId, courseVersionId, now);

  if (!published) {
    throw new CurriculumNotFoundException(
      "发布失败：课程版本不存在或状态已变更",
    );
  }

  const previousPublished = await repo.findPublishedByCourseId(
    schoolId,
    published.courseId,
  );

  if (previousPublished && previousPublished.id !== published.id) {
    await repo.retire(schoolId, previousPublished.id, now);
  }

  return published;
}

function collectResourceIds(version: CourseVersion): string[] {
  const ids = new Set<string>();
  for (const unit of version.units) {
    for (const lesson of unit.lessons) {
      for (const activity of lesson.activities) {
        for (const resource of activity.resources) {
          ids.add(resource.id);
        }
      }
    }
  }
  return Array.from(ids);
}

export function formatValidationErrors(
  errors: readonly PublishValidationError[],
): string {
  return errors.map((e) => `${e.path}: ${e.message}`).join("; ");
}
