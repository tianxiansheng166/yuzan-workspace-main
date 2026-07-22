import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/database/index.js";
import type { Prisma } from "@yuzan/database";
import type { WrittenAnswer } from "../domain/assessment.types.js";
import type { WrittenAnswerRepositoryPort, SaveWrittenAnswerData } from "../ports/written-answer-repository.port.js";

@Injectable()
export class PrismaWrittenAnswerRepository implements WrittenAnswerRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByItemId(itemId: string): Promise<WrittenAnswer | null> {
    const row = await this.prisma.writtenAnswer.findUnique({ where: { itemId } });
    return row ? this.toDomain(row) : null;
  }

  async findBySessionId(sessionId: string): Promise<WrittenAnswer[]> {
    const rows = await this.prisma.writtenAnswer.findMany({
      where: { item: { sessionId } },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async upsert(data: SaveWrittenAnswerData): Promise<WrittenAnswer> {
    const row = await this.prisma.writtenAnswer.upsert({
      where: { itemId: data.itemId },
      create: {
        item: { connect: { id: data.itemId } },
        content: data.content as unknown as Prisma.InputJsonValue,
        wordCount: data.wordCount,
        charCount: data.charCount,
        autoSavedAt: new Date(),
      },
      update: {
        content: data.content as unknown as Prisma.InputJsonValue,
        wordCount: data.wordCount,
        charCount: data.charCount,
        autoSavedAt: new Date(),
      },
    });
    return this.toDomain(row);
  }

  async finalize(itemId: string): Promise<WrittenAnswer> {
    const row = await this.prisma.writtenAnswer.update({
      where: { itemId },
      data: { finalSubmittedAt: new Date() },
    });
    return this.toDomain(row);
  }

  private toDomain(row: Record<string, unknown>): WrittenAnswer {
    return {
      id: row.id as string,
      itemId: row.itemId as string,
      content: (row.content as Record<string, unknown>) ?? {},
      wordCount: row.wordCount as number,
      charCount: row.charCount as number,
      autoSavedAt: (row.autoSavedAt as Date) ?? null,
      finalSubmittedAt: (row.finalSubmittedAt as Date) ?? null,
      revision: row.revision as number,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    };
  }
}
