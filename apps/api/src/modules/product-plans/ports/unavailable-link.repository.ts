import { Injectable } from "@nestjs/common";
import type {
  AssessmentLink,
  ListLinksOptions,
  PaginatedResult,
} from "../domain/link.types.js";
import { LinkNotFoundException } from "../domain/link.errors.js";
import type { LinkRepositoryPort } from "./link-repository.port.js";

@Injectable()
export class UnavailableLinkRepository implements LinkRepositoryPort {
  private fail(): never {
    throw new LinkNotFoundException("测评链接服务暂不可用");
  }

  async list(
    _options: ListLinksOptions,
  ): Promise<PaginatedResult<AssessmentLink>> {
    this.fail();
  }

  async findById(
    _schoolId: string,
    _id: string,
  ): Promise<AssessmentLink | null> {
    this.fail();
  }

  async save(_link: AssessmentLink): Promise<AssessmentLink> {
    this.fail();
  }

  async incrementUsageCount(_schoolId: string, _id: string): Promise<void> {
    this.fail();
  }
}
