import type {
  AssessmentMaterial,
  AssessmentMaterialStatus,
  ListMaterialsOptions,
  PaginatedResult,
} from "../../../src/modules/privacy/domain/assessment.types.js";
import type { AssessmentMaterialRepositoryPort } from "../../../src/modules/privacy/ports/assessment-material-repository.port.js";

export class FakeAssessmentMaterialRepository implements AssessmentMaterialRepositoryPort {
  private readonly materials = new Map<string, AssessmentMaterial>();

  private key(schoolId: string, id: string): string {
    return `${schoolId}:${id}`;
  }

  add(...materials: AssessmentMaterial[]): void {
    for (const material of materials) {
      this.materials.set(this.key(material.schoolId, material.id), material);
    }
  }

  async list(
    options: ListMaterialsOptions,
  ): Promise<PaginatedResult<AssessmentMaterial>> {
    let all = Array.from(this.materials.values())
      .filter((m) => m.schoolId === options.schoolId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    if (options.type) {
      all = all.filter((m) => m.type === (options.type as AssessmentMaterial["type"]));
    }
    if (options.status) {
      all = all.filter(
        (m) => m.status === (options.status as AssessmentMaterialStatus),
      );
    }

    const limit = options.limit;
    const start = options.cursor ? parseInt(options.cursor, 10) : 0;
    const items = all.slice(start, start + limit);
    const hasMore = all.length > start + limit;
    const nextCursor = hasMore ? String(start + limit) : null;

    return { items, nextCursor, hasMore };
  }

  async findById(
    schoolId: string,
    id: string,
  ): Promise<AssessmentMaterial | null> {
    return this.materials.get(this.key(schoolId, id)) ?? null;
  }

  async save(material: AssessmentMaterial): Promise<AssessmentMaterial> {
    this.materials.set(this.key(material.schoolId, material.id), material);
    return material;
  }

  async nextVersion(schoolId: string, type: string): Promise<number> {
    const existing = Array.from(this.materials.values()).filter(
      (m) => m.schoolId === schoolId && m.type === type,
    );

    if (existing.length === 0) {
      return 1;
    }

    const maxVersion = Math.max(...existing.map((m) => m.version));
    return maxVersion + 1;
  }
}
