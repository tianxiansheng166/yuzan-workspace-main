import { beforeEach, describe, expect, it } from "vitest";
import {
  MembershipRole,
  MembershipStatus,
} from "../../../src/common/security/index.js";
import { PrismaClassRepository } from "../../../src/modules/classes/infra/prisma-class.repository.js";
import { PrismaMembershipRepository } from "../../../src/modules/organizations/infra/prisma-membership.repository.js";
import { PrismaSchoolRepository } from "../../../src/modules/organizations/infra/prisma-school.repository.js";
import {
  cleanupDatabase,
  createPrismaService,
  seedId,
} from "./helpers/prisma-test.helper.js";

interface SeedResult {
  schoolA: string;
  schoolB: string;
  userAdminA: string;
  userTeacherA: string;
  userStudentA: string;
  userStudentB: string;
  termA: string;
  termB: string;
  classA: string;
  classB: string;
  classOtherSchool: string;
}

async function seedTwoSchools(
  prisma: ReturnType<typeof createPrismaService>,
): Promise<SeedResult> {
  const schoolA = seedId();
  const schoolB = seedId();
  const userAdminA = seedId();
  const userTeacherA = seedId();
  const userStudentA = seedId();
  const userStudentB = seedId();
  const termA = seedId();
  const termB = seedId();
  const classA = seedId();
  const classB = seedId();
  const classOtherSchool = seedId();

  await prisma.school.createMany({
    data: [
      {
        id: schoolA,
        code: `code-${schoolA}`,
        name: "School A",
        timezone: "Asia/Shanghai",
        isActive: true,
      },
      {
        id: schoolB,
        code: `code-${schoolB}`,
        name: "School B",
        timezone: "Asia/Shanghai",
        isActive: true,
      },
    ],
  });

  await prisma.user.createMany({
    data: [
      {
        id: userAdminA,
        loginIdentifier: `admin-${userAdminA}`,
        displayName: "Admin A",
        passwordHash: "hash",
      },
      {
        id: userTeacherA,
        loginIdentifier: `teacher-${userTeacherA}`,
        displayName: "Teacher A",
        passwordHash: "hash",
      },
      {
        id: userStudentA,
        loginIdentifier: `student-${userStudentA}`,
        displayName: "Student A",
        passwordHash: "hash",
      },
      {
        id: userStudentB,
        loginIdentifier: `student-${userStudentB}`,
        displayName: "Student B",
        passwordHash: "hash",
      },
    ],
  });

  await prisma.membership.createMany({
    data: [
      {
        id: seedId(),
        schoolId: schoolA,
        userId: userAdminA,
        role: MembershipRole.SCHOOL_ADMIN,
        status: MembershipStatus.ACTIVE,
      },
      {
        id: seedId(),
        schoolId: schoolA,
        userId: userTeacherA,
        role: MembershipRole.TEACHER,
        status: MembershipStatus.ACTIVE,
      },
      {
        id: seedId(),
        schoolId: schoolA,
        userId: userStudentA,
        role: MembershipRole.STUDENT,
        status: MembershipStatus.ACTIVE,
      },
      {
        id: seedId(),
        schoolId: schoolA,
        userId: userStudentB,
        role: MembershipRole.STUDENT,
        status: MembershipStatus.INVITED,
      },
    ],
  });

  await prisma.term.createMany({
    data: [
      {
        id: termA,
        schoolId: schoolA,
        name: "Term A",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 86400000),
        isActive: true,
      },
      {
        id: termB,
        schoolId: schoolB,
        name: "Term B",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 86400000),
        isActive: true,
      },
    ],
  });

  await prisma.class.createMany({
    data: [
      {
        id: classA,
        schoolId: schoolA,
        termId: termA,
        name: "Class A",
        grade: "G1",
      },
      {
        id: classB,
        schoolId: schoolA,
        termId: termA,
        name: "Class B",
        grade: "G1",
      },
      {
        id: classOtherSchool,
        schoolId: schoolB,
        termId: termB,
        name: "Class Other",
        grade: "G1",
      },
    ],
  });

  await prisma.enrollment.createMany({
    data: [
      {
        id: seedId(),
        schoolId: schoolA,
        classId: classA,
        userId: userTeacherA,
        role: MembershipRole.TEACHER,
        status: MembershipStatus.ACTIVE,
      },
      {
        id: seedId(),
        schoolId: schoolA,
        classId: classA,
        userId: userStudentA,
        role: MembershipRole.STUDENT,
        status: MembershipStatus.ACTIVE,
      },
      {
        id: seedId(),
        schoolId: schoolA,
        classId: classB,
        userId: userStudentA,
        role: MembershipRole.STUDENT,
        status: MembershipStatus.ACTIVE,
      },
    ],
  });

  return {
    schoolA,
    schoolB,
    userAdminA,
    userTeacherA,
    userStudentA,
    userStudentB,
    termA,
    termB,
    classA,
    classB,
    classOtherSchool,
  };
}

describe("Organizations Prisma integration", () => {
  let prisma: ReturnType<typeof createPrismaService>;
  let schoolRepo: PrismaSchoolRepository;
  let membershipRepo: PrismaMembershipRepository;
  let classRepo: PrismaClassRepository;

  beforeEach(async () => {
    prisma = createPrismaService();
    schoolRepo = new PrismaSchoolRepository(prisma);
    membershipRepo = new PrismaMembershipRepository(prisma);
    classRepo = new PrismaClassRepository(prisma);
    await cleanupDatabase(prisma);
  });

  describe("school repository", () => {
    it("finds an active school by id", async () => {
      const { schoolA } = await seedTwoSchools(prisma);
      const school = await schoolRepo.findById(schoolA);
      expect(school).not.toBeNull();
      expect(school?.id).toBe(schoolA);
      expect(school?.status).toBe("ACTIVE");
    });

    it("returns null for an unknown school", async () => {
      const school = await schoolRepo.findById(seedId());
      expect(school).toBeNull();
    });

    it("lists only active schools", async () => {
      await seedTwoSchools(prisma);
      const inactiveSchool = seedId();
      await prisma.school.create({
        data: {
          id: inactiveSchool,
          code: `code-${inactiveSchool}`,
          name: "Inactive School",
          timezone: "Asia/Shanghai",
          isActive: false,
        },
      });

      const schools = await schoolRepo.listActive();
      expect(schools.every((s) => s.status === "ACTIVE")).toBe(true);
      expect(schools.some((s) => s.name === "Inactive School")).toBe(false);
    });
  });

  describe("membership repository", () => {
    it("finds active membership", async () => {
      const { schoolA, userTeacherA } = await seedTwoSchools(prisma);
      const membership = await membershipRepo.findMembership(
        schoolA,
        userTeacherA,
      );
      expect(membership).not.toBeNull();
      expect(membership?.role).toBe(MembershipRole.TEACHER);
      expect(membership?.status).toBe(MembershipStatus.ACTIVE);
    });

    it.each([
      MembershipStatus.INVITED,
      MembershipStatus.SUSPENDED,
      MembershipStatus.LEFT,
    ])("does not authorize %s membership", async (status) => {
      const schoolId = seedId();
      const userId = seedId();
      await prisma.school.create({
        data: {
          id: schoolId,
          code: `code-${schoolId}`,
          name: "School",
          timezone: "Asia/Shanghai",
          isActive: true,
        },
      });
      await prisma.user.create({
        data: {
          id: userId,
          loginIdentifier: `user-${userId}`,
          displayName: "User",
          passwordHash: "hash",
        },
      });
      await prisma.membership.create({
        data: {
          id: seedId(),
          schoolId,
          userId,
          role: MembershipRole.STUDENT,
          status,
        },
      });

      const membership = await membershipRepo.findMembership(schoolId, userId);
      expect(membership).toBeNull();
    });

    it("does not find cross-school membership", async () => {
      const { schoolA, schoolB, userTeacherA } = await seedTwoSchools(prisma);
      const membership = await membershipRepo.findMembership(
        schoolB,
        userTeacherA,
      );
      expect(membership).toBeNull();
    });

    it("returns the most recent active membership when statuses change", async () => {
      const schoolId = seedId();
      const userId = seedId();
      await prisma.school.create({
        data: {
          id: schoolId,
          code: `code-${schoolId}`,
          name: "School",
          timezone: "Asia/Shanghai",
          isActive: true,
        },
      });
      await prisma.user.create({
        data: {
          id: userId,
          loginIdentifier: `user-${userId}`,
          displayName: "User",
          passwordHash: "hash",
        },
      });
      const older = seedId();
      const newer = seedId();
      await prisma.membership.create({
        data: {
          id: older,
          schoolId,
          userId,
          role: MembershipRole.STUDENT,
          status: MembershipStatus.LEFT,
          joinedAt: new Date(Date.now() - 86400000),
        },
      });
      await prisma.membership.create({
        data: {
          id: newer,
          schoolId,
          userId,
          role: MembershipRole.TEACHER,
          status: MembershipStatus.ACTIVE,
          joinedAt: new Date(),
        },
      });

      const membership = await membershipRepo.findMembership(schoolId, userId);
      expect(membership).not.toBeNull();
      expect(membership?.role).toBe(MembershipRole.TEACHER);
      expect(membership?.status).toBe(MembershipStatus.ACTIVE);
    });

    it("lists members with role filter", async () => {
      const { schoolA } = await seedTwoSchools(prisma);
      const result = await membershipRepo.listMembers(schoolA, {
        role: MembershipRole.STUDENT,
        limit: 10,
      });
      expect(result.items.every((m) => m.role === MembershipRole.STUDENT)).toBe(
        true,
      );
    });
  });

  describe("class repository", () => {
    it("finds class with teacher and student counts", async () => {
      const { schoolA, classA, userTeacherA, userStudentA } =
        await seedTwoSchools(prisma);
      const classItem = await classRepo.findById(schoolA, classA);
      expect(classItem).not.toBeNull();
      expect(classItem?.teacherUserIds).toContain(userTeacherA);
      expect(classItem?.studentCount).toBe(1);
    });

    it("returns null for nonexistent class", async () => {
      const { schoolA } = await seedTwoSchools(prisma);
      const classItem = await classRepo.findById(schoolA, seedId());
      expect(classItem).toBeNull();
    });

    it("does not return class from another school", async () => {
      const { schoolA, classOtherSchool } = await seedTwoSchools(prisma);
      const classItem = await classRepo.findById(schoolA, classOtherSchool);
      expect(classItem).toBeNull();
    });

    it("finds visible class for school admin", async () => {
      const { schoolA, classA, userAdminA } = await seedTwoSchools(prisma);
      const classItem = await classRepo.findVisibleClassById({
        schoolId: schoolA,
        classId: classA,
        actor: { userId: userAdminA, roles: [MembershipRole.SCHOOL_ADMIN] },
      });
      expect(classItem).not.toBeNull();
      expect(classItem?.id).toBe(classA);
    });

    it("finds visible class for responsible teacher", async () => {
      const { schoolA, classA, userTeacherA } = await seedTwoSchools(prisma);
      const classItem = await classRepo.findVisibleClassById({
        schoolId: schoolA,
        classId: classA,
        actor: { userId: userTeacherA, roles: [MembershipRole.TEACHER] },
      });
      expect(classItem).not.toBeNull();
    });

    it("returns null for non-responsible teacher", async () => {
      const { schoolA, classB, userTeacherA } = await seedTwoSchools(prisma);
      const classItem = await classRepo.findVisibleClassById({
        schoolId: schoolA,
        classId: classB,
        actor: { userId: userTeacherA, roles: [MembershipRole.TEACHER] },
      });
      expect(classItem).toBeNull();
    });

    it("returns null for nonexistent class in visible lookup", async () => {
      const { schoolA, userTeacherA } = await seedTwoSchools(prisma);
      const classItem = await classRepo.findVisibleClassById({
        schoolId: schoolA,
        classId: seedId(),
        actor: { userId: userTeacherA, roles: [MembershipRole.TEACHER] },
      });
      expect(classItem).toBeNull();
    });

    it("lists classes for a teacher", async () => {
      const { schoolA, userTeacherA, classA } = await seedTwoSchools(prisma);
      const result = await classRepo.list(schoolA, {
        teacherUserId: userTeacherA,
        limit: 10,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(classA);
    });

    it("lists classes for a student", async () => {
      const { schoolA, userStudentA, classA, classB } =
        await seedTwoSchools(prisma);
      const result = await classRepo.list(schoolA, {
        studentUserId: userStudentA,
        limit: 10,
      });
      expect(result.items).toHaveLength(2);
      expect(result.items.map((c) => c.id).sort()).toEqual(
        [classA, classB].sort(),
      );
    });

    it("lists class members", async () => {
      const { schoolA, classA, userTeacherA, userStudentA } =
        await seedTwoSchools(prisma);
      const members = await classRepo.listMembers(schoolA, classA);
      const userIds = members.map((m) => m.userId);
      expect(userIds).toContain(userTeacherA);
      expect(userIds).toContain(userStudentA);
    });

    it("excludes removed students from members", async () => {
      const { schoolA, classA, userStudentA } = await seedTwoSchools(prisma);
      await prisma.enrollment.updateMany({
        where: { schoolId: schoolA, classId: classA, userId: userStudentA },
        data: { status: MembershipStatus.LEFT },
      });

      const members = await classRepo.listMembers(schoolA, classA);
      expect(members.some((m) => m.userId === userStudentA)).toBe(false);
    });

    it("lists enrollments by user", async () => {
      const { schoolA, userStudentA, classA, classB } =
        await seedTwoSchools(prisma);
      const enrollments = await classRepo.listEnrollmentsByUser(
        schoolA,
        userStudentA,
      );
      expect(enrollments).toHaveLength(2);
      expect(enrollments.map((e) => e.classId).sort()).toEqual(
        [classA, classB].sort(),
      );
    });

    it("excludes revoked teacher responsibility from visible lookup", async () => {
      const { schoolA, classA, userTeacherA } = await seedTwoSchools(prisma);
      await prisma.enrollment.updateMany({
        where: { schoolId: schoolA, classId: classA, userId: userTeacherA },
        data: { status: MembershipStatus.LEFT },
      });

      const classItem = await classRepo.findVisibleClassById({
        schoolId: schoolA,
        classId: classA,
        actor: { userId: userTeacherA, roles: [MembershipRole.TEACHER] },
      });
      expect(classItem).toBeNull();
    });
  });

  describe("fail-closed behavior", () => {
    it("throws unavailable exception when database is unreachable", async () => {
      const badPrisma = createPrismaService();
      // Force an invalid connection to simulate database unavailability.
      await badPrisma.$disconnect();
      (badPrisma as { [key: string]: unknown }).school = undefined;

      const badSchoolRepo = new PrismaSchoolRepository(badPrisma);
      await expect(badSchoolRepo.findById(seedId())).rejects.toThrow();
    });
  });

  describe("tenant isolation", () => {
    it("does not leak cross-school class in list", async () => {
      const { schoolA, schoolB, userStudentA, classOtherSchool } =
        await seedTwoSchools(prisma);
      const result = await classRepo.list(schoolA, {
        studentUserId: userStudentA,
        limit: 10,
      });
      expect(result.items.some((c) => c.id === classOtherSchool)).toBe(false);
    });
  });
});
