import { PATH_METADATA } from "@nestjs/common/constants";
import { CurriculumController } from "../modules/curriculum/curriculum.controller.js";

const PUBLISH_ROUTE = ":courseVersionId/publish";

/**
 * Normalize approved integration route metadata that predates Nest 11's
 * path-to-regexp rules. Keep this root-only shim until the owning module can
 * safely correct its controller in a separately approved change.
 */
export function applyRootRouteCompatibility(): void {
  const handler = CurriculumController.prototype.publishCourseVersion;
  Reflect.defineMetadata(PATH_METADATA, PUBLISH_ROUTE, handler);
}
