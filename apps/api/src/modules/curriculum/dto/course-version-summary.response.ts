import type { CourseVersionStatus } from "../domain/course-version.types.js";

export class CourseVersionSummaryResponse {
  readonly id!: string;
  readonly courseId!: string;
  readonly version!: number;
  readonly title!: string;
  readonly status!: CourseVersionStatus;
  readonly gradeBand!: string | null;
  readonly updatedAt!: Date;
}
