import { describe, expect, it, vi } from "vitest";
import { PrismaAssignmentRepository } from "../../../src/modules/assignments/infra/prisma-assignment.repository.js";

describe("PrismaAssignmentRepository.list", () => {
  it("applies class, title, status and due-date filters inside the teacher scope", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new PrismaAssignmentRepository({ assignment: { findMany } } as never);
    const dueAtFrom = new Date("2026-10-01T00:00:00.000Z");
    const dueAtTo = new Date("2026-10-08T23:59:59.999Z");

    await repository.list("school-1", {
      limit: 20,
      cursor: "cursor-id",
      teacherUserId: "teacher-1",
      classId: "class-1",
      status: "OPEN",
      search: "  reading  ",
      dueAtFrom,
      dueAtTo,
    });

    const query = findMany.mock.calls[0]?.[0];
    expect(query).toMatchObject({
      where: {
        schoolId: "school-1",
        deletedAt: null,
        status: "OPEN",
        title: { contains: "  reading  ", mode: "insensitive" },
        dueAt: { gte: dueAtFrom, lte: dueAtTo },
        targets: { some: { AND: expect.arrayContaining([
          { OR: [
            { class: { enrollments: { some: { schoolId: "school-1", userId: "teacher-1", role: "TEACHER", status: "ACTIVE" } } } },
            { enrollment: { class: { enrollments: { some: { schoolId: "school-1", userId: "teacher-1", role: "TEACHER", status: "ACTIVE" } } } } },
          ] },
          { OR: [{ classId: "class-1" }, { enrollment: { classId: "class-1" } }] },
        ]) } },
      },
      cursor: { id: "cursor-id" },
      skip: 1,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 21,
    });
    expect(query.include.targets.where).toEqual(query.where.targets.some);
  });
});
