import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "@yuzan/database";

function normalizeJsonValue(value: unknown): Prisma.InputJsonValue | null {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new BadRequestException("JSON numbers must be finite");
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) =>
      entry === undefined ? null : normalizeJsonValue(entry),
    );
  }
  if (typeof value === "object") {
    if (Object.prototype.toString.call(value) !== "[object Object]") {
      throw new BadRequestException("JSON objects must be plain objects");
    }
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, normalizeJsonValue(entry)] as const);
    return Object.fromEntries<Prisma.InputJsonValue | null>(entries);
  }
  throw new BadRequestException("Value is not JSON serializable");
}

export function toPrismaJsonObject(value: unknown): Prisma.InputJsonObject {
  const normalized = normalizeJsonValue(value);
  if (
    normalized === null ||
    typeof normalized !== "object" ||
    Array.isArray(normalized) ||
    ("toJSON" in normalized && typeof normalized.toJSON === "function")
  ) {
    throw new BadRequestException("Expected a JSON object");
  }
  return normalized as Prisma.InputJsonObject;
}
