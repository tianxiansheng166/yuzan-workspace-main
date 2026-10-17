import { describe, it, expect, vi } from "vitest";
import { validate } from "class-validator";
import { AssignmentsService } from "../../../src/modules/assignments/assignments.service.js";
import { TransitionAssignmentDto } from "../../../src/modules/assignments/dto/transition-assignment.dto.js";
import {
  createAuthContext,
  MembershipRole,
  MembershipStatus,
} from "../../../src/common/security/index.js";
import { FakeAssignmentRepository } from "./fakes/fake-assignment.repository.js";
import { assignment } from "./fixtures/assignments.js";
import { createFakePrismaService } from "../../helpers/fake-prisma.service.js";
import type { PrismaService } from "../../../src/shared/database/prisma.service.js";

function setup(
  options: {
    course?: boolean;
    teacher?: boolean;
    student?: boolean;
    failNotification?: boolean;
  } = {},
) {
  const repo = new FakeAssignmentRepository();
  const notify = vi.fn(async (_payload: { data: { actionUrl: string }[] }) => {
    if (options.failNotification) throw new Error("notification unavailable");
    return { count: 1 };
  });
  const prisma = createFakePrismaService({
    courseVersion: {
      findFirst: async () => (options.course === false ? null : { id: "cv-1" }),
    },
    class: { findFirst: async () => ({ id: "class-1" }) },
    enrollment: {
      findFirst: async (query) =>
        (query.where.role === "TEACHER" ? options.teacher : options.student) ===
        false
          ? null
          : { id: "enrollment", classId: "class-1", userId: "student" },
      findMany: async () => [{ userId: "student" }, { userId: "student" }],
    },
    notification: { createMany: notify },
  });
  const service = new AssignmentsService(
    repo,
    prisma as unknown as PrismaService,
  );
  const auth = createAuthContext(
    "test",
    {
      userId: "teacher",
      roles: [MembershipRole.TEACHER],
      membershipStatus: MembershipStatus.ACTIVE,
      source: "test",
    },
    { schoolId: "school-a" },
  );
  const input = assignment();
  return { service, repo, auth, input, notify };
}

describe("real publication boundary", () => {
  it("draft and scheduled never notify; only the successful OPEN notifies once with assignment identity", async () => {
    const { service, auth, input, notify } = setup();
    const draft = await service.createAssignment(auth, "school-a", input);
    expect(notify).not.toHaveBeenCalled();
    await expect(
      service.openAssignment(auth, "school-a", draft.id, 1),
    ).rejects.toMatchObject({ status: 409 });
    const scheduled = await service.scheduleAssignment(
      auth,
      "school-a",
      draft.id,
      draft.revision,
    );
    expect(scheduled.status).toBe("SCHEDULED");
    expect(notify).not.toHaveBeenCalled();
    await expect(
      service.openAssignment(auth, "school-a", draft.id, 1),
    ).rejects.toThrow();
    expect(notify).not.toHaveBeenCalled();
    const opened = await service.openAssignment(
      auth,
      "school-a",
      draft.id,
      scheduled.revision,
    );
    expect(opened).toMatchObject({ status: "OPEN", revision: 3 });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0]?.[0]?.data).toHaveLength(1);
    expect(notify.mock.calls[0]?.[0]?.data[0].actionUrl).toContain(draft.id);
    await expect(
      service.openAssignment(auth, "school-a", draft.id, 3),
    ).rejects.toMatchObject({ status: 409 });
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("rejects a future revision before a competing transition can consume it", async () => {
    const { service, auth, repo, notify } = setup();
    repo.add(assignment({ status: "SCHEDULED", revision: 2 }));
    await expect(
      service.openAssignment(auth, "school-a", "assignment-1", 3),
    ).rejects.toMatchObject({ status: 409 });
    expect(await repo.findById("school-a", "assignment-1")).toMatchObject({
      status: "SCHEDULED",
      revision: 2,
    });
    expect(notify).not.toHaveBeenCalled();
  });

  it("notification failure leaves the assignment truly OPEN and readable", async () => {
    const { service, auth, input, repo } = setup({ failNotification: true });
    const draft = await service.createAssignment(auth, "school-a", input);
    await service.scheduleAssignment(auth, "school-a", draft.id, 1);
    expect(
      await service.openAssignment(auth, "school-a", draft.id, 2),
    ).toMatchObject({ status: "OPEN" });
    expect(await repo.findById("school-a", draft.id)).toMatchObject({
      status: "OPEN",
      revision: 3,
    });
  });

  it.each([{ course: false }, { teacher: false }])(
    "fails closed for unavailable course/class permission %j",
    async (options) => {
      const { service, auth, input, notify } = setup(options);
      await expect(
        service.createAssignment(auth, "school-a", input),
      ).rejects.toMatchObject({ status: options.course === false ? 404 : 403 });
      expect(notify).not.toHaveBeenCalled();
    },
  );

  it("rechecks revoked teacher permission and retired course before publishing", async () => {
    for (const options of [{ teacher: false }, { course: false }]) {
      const { service, auth, repo } = setup(options);
      repo.add(assignment({ status: "SCHEDULED" }));
      await expect(
        service.openAssignment(auth, "school-a", "assignment-1", 1),
      ).rejects.toThrow();
      expect(await repo.findById("school-a", "assignment-1")).toMatchObject({
        status: "SCHEDULED",
      });
    }
  });

  it("rejects empty/malformed targets, inactive student and reversed dates", async () => {
    const { service, auth, input } = setup({ student: false });
    for (const targets of [
      [],
      [{ targetType: "CLASS" as const }],
      [{ targetType: "STUDENT" as const, enrollmentId: "missing" }],
    ]) {
      await expect(
        service.createAssignment(auth, "school-a", { ...input, targets }),
      ).rejects.toThrow();
    }
    await expect(
      service.createAssignment(auth, "school-a", {
        ...input,
        dueAt: new Date(0),
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it.each([undefined, null, 0, -1, 1.5, "1"])(
    "rejects invalid revision %s",
    async (expectedRevision) => {
      expect(
        (
          await validate(
            Object.assign(new TransitionAssignmentDto(), { expectedRevision }),
          )
        ).length,
      ).toBeGreaterThan(0);
    },
  );
});
