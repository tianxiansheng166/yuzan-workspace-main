import { describe, expect, it } from "vitest";
import {
  TrainingConflictException,
  TrainingEnrollmentNotFoundException,
  TrainingExamNotFoundException,
  TrainingForbiddenException,
  TrainingProgramNotFoundException,
  TrainingUnavailableException,
} from "../../../src/modules/training/domain/training.errors.js";
import { UnavailableTrainingRepository } from "../../../src/modules/training/ports/unavailable-training.repository.js";
import { TrainingService } from "../../../src/modules/training/training.service.js";
import { FakeTrainingRepository } from "./fakes/fake-training.repository.js";
import {
  trainingProgram,
  trainingEnrollment,
  trainingProgress,
  trainingExam,
  trainingModule,
} from "./fixtures/training.js";
import {
  studentAuth,
  teacherAuth,
  volunteerAuth,
  schoolAdminAuth,
  platformAdminAuth,
} from "./fixtures/users.js";

function createService(repo?: FakeTrainingRepository) {
  const r = repo ?? new FakeTrainingRepository();
  return { service: new TrainingService(r as any), repo: r };
}

const schoolId = "school-1";

// ---------------------------------------------------------------------------
// createProgram
// ---------------------------------------------------------------------------

describe("TrainingService", () => {
  describe("createProgram", () => {
    it("allows SCHOOL_ADMIN to create a program with DRAFT status", async () => {
      const { service } = createService();
      const auth = schoolAdminAuth(schoolId);

      const result = await service.createProgram(auth, schoolId, {
        title: "新培训项目",
        objectives: ["目标1"],
        locale: "zh-CN",
      });

      expect(result.status).toBe("DRAFT");
      expect(result.title).toBe("新培训项目");
    });

    it("allows TEACHER to create a program", async () => {
      const { service } = createService();
      const auth = teacherAuth(schoolId);

      const result = await service.createProgram(auth, schoolId, {
        title: "教师培训",
        objectives: ["目标1"],
        locale: "zh-CN",
      });

      expect(result.status).toBe("DRAFT");
    });

    it("denies PLATFORM_ADMIN from creating a program (requires TEACHER/SCHOOL_ADMIN role)", async () => {
      const { service } = createService();
      const auth = platformAdminAuth("platform-school");

      await expect(
        service.createProgram(auth, schoolId, {
          title: "平台管理培训",
          objectives: ["目标1"],
          locale: "zh-CN",
        }),
      ).rejects.toThrow(TrainingForbiddenException);
    });

    it("denies STUDENT from creating a program", async () => {
      const { service } = createService();
      const auth = studentAuth(schoolId);

      await expect(
        service.createProgram(auth, schoolId, {
          title: "学生尝试",
          objectives: ["目标1"],
          locale: "zh-CN",
        }),
      ).rejects.toThrow(TrainingForbiddenException);
    });

    it("denies cross-tenant SCHOOL_ADMIN from creating a program", async () => {
      const { service } = createService();
      const auth = schoolAdminAuth("other-school");

      await expect(
        service.createProgram(auth, schoolId, {
          title: "跨租户尝试",
          objectives: ["目标1"],
          locale: "zh-CN",
        }),
      ).rejects.toThrow(TrainingForbiddenException);
    });

    it("persists optional description and dialect", async () => {
      const { service } = createService();
      const auth = schoolAdminAuth(schoolId);

      const result = await service.createProgram(auth, schoolId, {
        title: "带描述培训",
        objectives: ["目标1"],
        locale: "zh-CN",
        description: "详细描述",
        dialect: "ug-CN",
      });

      expect(result.description).toBe("详细描述");
      expect(result.dialect).toBe("ug-CN");
    });
  });

  // ---------------------------------------------------------------------------
  // getProgram
  // ---------------------------------------------------------------------------

  describe("getProgram", () => {
    it("returns an existing program", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId });
      repo.addProgram(p);
      const auth = teacherAuth(schoolId);

      const result = await service.getProgram(auth, schoolId, p.id);

      expect(result.id).toBe(p.id);
      expect(result.title).toBe(p.title);
    });

    it("throws not found for missing program", async () => {
      const { service } = createService();
      const auth = teacherAuth(schoolId);

      await expect(
        service.getProgram(auth, schoolId, "missing-id"),
      ).rejects.toThrow(TrainingProgramNotFoundException);
    });

    it("denies cross-tenant access", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId });
      repo.addProgram(p);
      const auth = teacherAuth("other-school");

      await expect(service.getProgram(auth, schoolId, p.id)).rejects.toThrow(
        TrainingForbiddenException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // listPrograms
  // ---------------------------------------------------------------------------

  describe("listPrograms", () => {
    it("allows SCHOOL_ADMIN to list programs", async () => {
      const { service, repo } = createService();
      repo.addProgram(trainingProgram({ schoolId }));
      const auth = schoolAdminAuth(schoolId);

      const result = await service.listPrograms(auth, schoolId, { limit: 20 });

      expect(result.items).toHaveLength(1);
    });

    it("allows STUDENT to list programs", async () => {
      const { service, repo } = createService();
      repo.addProgram(trainingProgram({ schoolId }));
      const auth = studentAuth(schoolId);

      const result = await service.listPrograms(auth, schoolId, { limit: 20 });

      expect(result.items).toHaveLength(1);
    });

    it("denies cross-tenant listing", async () => {
      const { service } = createService();
      const auth = studentAuth("other-school");

      await expect(
        service.listPrograms(auth, schoolId, { limit: 20 }),
      ).rejects.toThrow(TrainingForbiddenException);
    });

    it("filters by status", async () => {
      const { service, repo } = createService();
      repo.addProgram(trainingProgram({ schoolId, status: "DRAFT" }));
      repo.addProgram(trainingProgram({ schoolId, status: "PUBLISHED" }));
      const auth = studentAuth(schoolId);

      const result = await service.listPrograms(auth, schoolId, {
        limit: 20,
        status: "PUBLISHED",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.status).toBe("PUBLISHED");
    });
  });

  // ---------------------------------------------------------------------------
  // updateProgram
  // ---------------------------------------------------------------------------

  describe("updateProgram", () => {
    it("allows SCHOOL_ADMIN to update a DRAFT program", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "DRAFT" });
      repo.addProgram(p);
      const auth = schoolAdminAuth(schoolId);

      const result = await service.updateProgram(auth, schoolId, p.id, {
        title: "更新标题",
      });

      expect(result.title).toBe("更新标题");
    });

    it("rejects updating a PUBLISHED program", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const auth = schoolAdminAuth(schoolId);

      await expect(
        service.updateProgram(auth, schoolId, p.id, { title: "新标题" }),
      ).rejects.toThrow(TrainingConflictException);
    });

    it("rejects updating an ARCHIVED program", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "ARCHIVED" });
      repo.addProgram(p);
      const auth = schoolAdminAuth(schoolId);

      await expect(
        service.updateProgram(auth, schoolId, p.id, { title: "新标题" }),
      ).rejects.toThrow(TrainingConflictException);
    });

    it("denies STUDENT from updating", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "DRAFT" });
      repo.addProgram(p);
      const auth = studentAuth(schoolId);

      await expect(
        service.updateProgram(auth, schoolId, p.id, { title: "新标题" }),
      ).rejects.toThrow(TrainingForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // enroll
  // ---------------------------------------------------------------------------

  describe("enroll", () => {
    it("allows VOLUNTEER to enroll in a PUBLISHED program", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const auth = volunteerAuth(schoolId, { userId: "user-1" });

      const result = await service.enroll(auth, schoolId, p.id, "user-1");

      expect(result.status).toBe("ENROLLED");
      expect(result.programId).toBe(p.id);
      expect(result.volunteerUserId).toBe("user-1");
    });

    it("allows TEACHER to enroll", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const auth = teacherAuth(schoolId, { userId: "teacher-1" });

      const result = await service.enroll(auth, schoolId, p.id, "teacher-1");

      expect(result.status).toBe("ENROLLED");
    });

    it("rejects enrollment in a DRAFT program", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "DRAFT" });
      repo.addProgram(p);
      const auth = volunteerAuth(schoolId, { userId: "user-1" });

      await expect(
        service.enroll(auth, schoolId, p.id, "user-1"),
      ).rejects.toThrow(TrainingConflictException);
    });

    it("rejects enrollment in an ARCHIVED program", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "ARCHIVED" });
      repo.addProgram(p);
      const auth = volunteerAuth(schoolId, { userId: "user-1" });

      await expect(
        service.enroll(auth, schoolId, p.id, "user-1"),
      ).rejects.toThrow(TrainingConflictException);
    });

    it("throws not found for missing program", async () => {
      const { service } = createService();
      const auth = volunteerAuth(schoolId, { userId: "user-1" });

      await expect(
        service.enroll(auth, schoolId, "missing-id", "user-1"),
      ).rejects.toThrow(TrainingProgramNotFoundException);
    });

    it("denies cross-tenant enrollment", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const auth = studentAuth("other-school");

      await expect(
        service.enroll(auth, schoolId, p.id, "user-1"),
      ).rejects.toThrow(TrainingForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // updateProgress
  // ---------------------------------------------------------------------------

  describe("updateProgress", () => {
    it("allows the enrolled student to update progress", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const e = trainingEnrollment({
        schoolId,
        programId: p.id,
        volunteerUserId: "user-1",
      });
      repo.addEnrollment(e);
      const auth = studentAuth(schoolId, { userId: "user-1" });

      const result = await service.updateProgress(
        auth,
        schoolId,
        e.id,
        "mod-1",
        true,
        95,
      );

      expect(result.completed).toBe(true);
      expect(result.score).toBe(95);
    });

    it("allows SCHOOL_ADMIN to update progress for any enrollment", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const e = trainingEnrollment({
        schoolId,
        programId: p.id,
        volunteerUserId: "user-1",
      });
      repo.addEnrollment(e);
      const auth = schoolAdminAuth(schoolId);

      const result = await service.updateProgress(
        auth,
        schoolId,
        e.id,
        "mod-1",
        true,
      );

      expect(result.completed).toBe(true);
    });

    it("denies a different student from updating progress", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const e = trainingEnrollment({
        schoolId,
        programId: p.id,
        volunteerUserId: "user-1",
      });
      repo.addEnrollment(e);
      const auth = studentAuth(schoolId, { userId: "other-user" });

      await expect(
        service.updateProgress(auth, schoolId, e.id, "mod-1", true),
      ).rejects.toThrow(TrainingForbiddenException);
    });

    it("throws not found for missing enrollment", async () => {
      const { service } = createService();
      const auth = studentAuth(schoolId, { userId: "user-1" });

      await expect(
        service.updateProgress(auth, schoolId, "missing-id", "mod-1", true),
      ).rejects.toThrow(TrainingEnrollmentNotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // scheduleExam
  // ---------------------------------------------------------------------------

  describe("scheduleExam", () => {
    it("allows TEACHER to schedule exam for examReady enrollment", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const e = trainingEnrollment({
        schoolId,
        programId: p.id,
        volunteerUserId: "user-1",
        examReady: true,
      });
      repo.addEnrollment(e);
      const auth = teacherAuth(schoolId);

      const scheduledAt = new Date(Date.now() + 86400000);
      const result = await service.scheduleExam(
        auth,
        schoolId,
        e.id,
        scheduledAt,
        60,
      );

      expect(result.status).toBe("SCHEDULED");
      expect(result.passingScore).toBe(60);
    });

    it("allows SCHOOL_ADMIN to schedule exam", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const e = trainingEnrollment({
        schoolId,
        programId: p.id,
        volunteerUserId: "user-1",
        examReady: true,
      });
      repo.addEnrollment(e);
      const auth = schoolAdminAuth(schoolId);

      const scheduledAt = new Date(Date.now() + 86400000);
      const result = await service.scheduleExam(
        auth,
        schoolId,
        e.id,
        scheduledAt,
        70,
      );

      expect(result.status).toBe("SCHEDULED");
    });

    it("rejects scheduling exam when enrollment is not examReady", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const e = trainingEnrollment({
        schoolId,
        programId: p.id,
        volunteerUserId: "user-1",
        examReady: false,
      });
      repo.addEnrollment(e);
      const auth = teacherAuth(schoolId);

      const scheduledAt = new Date(Date.now() + 86400000);
      await expect(
        service.scheduleExam(auth, schoolId, e.id, scheduledAt, 60),
      ).rejects.toThrow(TrainingConflictException);
    });

    it("denies STUDENT from scheduling exam", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const e = trainingEnrollment({
        schoolId,
        programId: p.id,
        volunteerUserId: "user-1",
        examReady: true,
      });
      repo.addEnrollment(e);
      const auth = studentAuth(schoolId);

      const scheduledAt = new Date(Date.now() + 86400000);
      await expect(
        service.scheduleExam(auth, schoolId, e.id, scheduledAt, 60),
      ).rejects.toThrow(TrainingForbiddenException);
    });

    it("throws not found for missing enrollment", async () => {
      const { service } = createService();
      const auth = teacherAuth(schoolId);
      const scheduledAt = new Date(Date.now() + 86400000);

      await expect(
        service.scheduleExam(auth, schoolId, "missing-id", scheduledAt, 60),
      ).rejects.toThrow(TrainingEnrollmentNotFoundException);
    });

    it("denies cross-tenant scheduling", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const e = trainingEnrollment({
        schoolId,
        programId: p.id,
        volunteerUserId: "user-1",
        examReady: true,
      });
      repo.addEnrollment(e);
      const auth = teacherAuth("other-school");
      const scheduledAt = new Date(Date.now() + 86400000);

      await expect(
        service.scheduleExam(auth, schoolId, e.id, scheduledAt, 60),
      ).rejects.toThrow(TrainingForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // submitAttempt
  // ---------------------------------------------------------------------------

  describe("submitAttempt", () => {
    it("allows the enrolled student to submit a passing attempt", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const e = trainingEnrollment({
        schoolId,
        programId: p.id,
        volunteerUserId: "user-1",
        examReady: true,
      });
      repo.addEnrollment(e);
      const exam = trainingExam({
        schoolId,
        programId: p.id,
        enrollmentId: e.id,
        passingScore: 60,
      });
      repo.addExam(exam);
      const auth = studentAuth(schoolId, { userId: "user-1" });

      const result = await service.submitAttempt(auth, schoolId, exam.id, 85);

      expect(result.score).toBe(85);
      expect(result.passed).toBe(true);
    });

    it("records a failed attempt when score is below passingScore", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const e = trainingEnrollment({
        schoolId,
        programId: p.id,
        volunteerUserId: "user-1",
        examReady: true,
      });
      repo.addEnrollment(e);
      const exam = trainingExam({
        schoolId,
        programId: p.id,
        enrollmentId: e.id,
        passingScore: 60,
      });
      repo.addExam(exam);
      const auth = studentAuth(schoolId, { userId: "user-1" });

      const result = await service.submitAttempt(auth, schoolId, exam.id, 45);

      expect(result.score).toBe(45);
      expect(result.passed).toBe(false);
    });

    it("allows SCHOOL_ADMIN to submit attempt", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const e = trainingEnrollment({
        schoolId,
        programId: p.id,
        volunteerUserId: "user-1",
        examReady: true,
      });
      repo.addEnrollment(e);
      const exam = trainingExam({
        schoolId,
        programId: p.id,
        enrollmentId: e.id,
        passingScore: 60,
      });
      repo.addExam(exam);
      const auth = schoolAdminAuth(schoolId);

      const result = await service.submitAttempt(auth, schoolId, exam.id, 90);

      expect(result.passed).toBe(true);
    });

    it("updates enrollment status to COMPLETED on pass", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const e = trainingEnrollment({
        schoolId,
        programId: p.id,
        volunteerUserId: "user-1",
        examReady: true,
      });
      repo.addEnrollment(e);
      const exam = trainingExam({
        schoolId,
        programId: p.id,
        enrollmentId: e.id,
        passingScore: 60,
      });
      repo.addExam(exam);
      const auth = studentAuth(schoolId, { userId: "user-1" });

      await service.submitAttempt(auth, schoolId, exam.id, 80);

      const updatedEnrollment = repo.getEnrollment(e.id);
      expect(updatedEnrollment?.status).toBe("COMPLETED");
      expect(updatedEnrollment?.completedAt).toBeDefined();
    });

    it("does not update enrollment status to COMPLETED on fail", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const e = trainingEnrollment({
        schoolId,
        programId: p.id,
        volunteerUserId: "user-1",
        examReady: true,
      });
      repo.addEnrollment(e);
      const exam = trainingExam({
        schoolId,
        programId: p.id,
        enrollmentId: e.id,
        passingScore: 60,
      });
      repo.addExam(exam);
      const auth = studentAuth(schoolId, { userId: "user-1" });

      await service.submitAttempt(auth, schoolId, exam.id, 30);

      const updatedEnrollment = repo.getEnrollment(e.id);
      expect(updatedEnrollment?.status).not.toBe("COMPLETED");
    });

    it("updates exam status to PASSED on pass", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const e = trainingEnrollment({
        schoolId,
        programId: p.id,
        volunteerUserId: "user-1",
        examReady: true,
      });
      repo.addEnrollment(e);
      const exam = trainingExam({
        schoolId,
        programId: p.id,
        enrollmentId: e.id,
        passingScore: 60,
      });
      repo.addExam(exam);
      const auth = studentAuth(schoolId, { userId: "user-1" });

      await service.submitAttempt(auth, schoolId, exam.id, 80);

      const updatedExam = repo.getExam(exam.id);
      expect(updatedExam?.status).toBe("PASSED");
    });

    it("updates exam status to FAILED on fail", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const e = trainingEnrollment({
        schoolId,
        programId: p.id,
        volunteerUserId: "user-1",
        examReady: true,
      });
      repo.addEnrollment(e);
      const exam = trainingExam({
        schoolId,
        programId: p.id,
        enrollmentId: e.id,
        passingScore: 60,
      });
      repo.addExam(exam);
      const auth = studentAuth(schoolId, { userId: "user-1" });

      await service.submitAttempt(auth, schoolId, exam.id, 30);

      const updatedExam = repo.getExam(exam.id);
      expect(updatedExam?.status).toBe("FAILED");
    });

    it("throws not found for missing exam", async () => {
      const { service } = createService();
      const auth = studentAuth(schoolId, { userId: "user-1" });

      await expect(
        service.submitAttempt(auth, schoolId, "missing-id", 80),
      ).rejects.toThrow(TrainingExamNotFoundException);
    });

    it("denies a different student from submitting attempt", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const e = trainingEnrollment({
        schoolId,
        programId: p.id,
        volunteerUserId: "user-1",
        examReady: true,
      });
      repo.addEnrollment(e);
      const exam = trainingExam({
        schoolId,
        programId: p.id,
        enrollmentId: e.id,
        passingScore: 60,
      });
      repo.addExam(exam);
      const auth = studentAuth(schoolId, { userId: "other-user" });

      await expect(
        service.submitAttempt(auth, schoolId, exam.id, 80),
      ).rejects.toThrow(TrainingForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // getProgress
  // ---------------------------------------------------------------------------

  describe("getProgress", () => {
    it("allows the enrolled student to view progress", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const e = trainingEnrollment({
        schoolId,
        programId: p.id,
        volunteerUserId: "user-1",
      });
      repo.addEnrollment(e);
      const prog = trainingProgress({
        enrollmentId: e.id,
        moduleId: "mod-1",
        completed: true,
      });
      repo.addProgress(prog);
      const auth = studentAuth(schoolId, { userId: "user-1" });

      const result = await service.getProgress(auth, schoolId, e.id);

      expect(result).toHaveLength(1);
      expect(result[0]!.completed).toBe(true);
    });

    it("denies a different student from viewing progress", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const e = trainingEnrollment({
        schoolId,
        programId: p.id,
        volunteerUserId: "user-1",
      });
      repo.addEnrollment(e);
      const auth = studentAuth(schoolId, { userId: "other-user" });

      await expect(service.getProgress(auth, schoolId, e.id)).rejects.toThrow(
        TrainingForbiddenException,
      );
    });

    it("allows SCHOOL_ADMIN to view any enrollment progress", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const e = trainingEnrollment({
        schoolId,
        programId: p.id,
        volunteerUserId: "user-1",
      });
      repo.addEnrollment(e);
      const auth = schoolAdminAuth(schoolId);

      const result = await service.getProgress(auth, schoolId, e.id);

      expect(result).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getMyEnrollments
  // ---------------------------------------------------------------------------

  describe("getMyEnrollments", () => {
    it("returns enrollments for the current user", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const e = trainingEnrollment({
        schoolId,
        programId: p.id,
        volunteerUserId: "user-1",
      });
      repo.addEnrollment(e);
      const auth = studentAuth(schoolId, { userId: "user-1" });

      const result = await service.getMyEnrollments(auth, schoolId, {
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.volunteerUserId).toBe("user-1");
    });

    it("denies cross-tenant access", async () => {
      const { service } = createService();
      const auth = studentAuth("other-school", { userId: "user-1" });

      await expect(
        service.getMyEnrollments(auth, schoolId, { limit: 20 }),
      ).rejects.toThrow(TrainingForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // listEnrollments
  // ---------------------------------------------------------------------------

  describe("listEnrollments", () => {
    it("allows TEACHER to list enrollments for a program", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const e = trainingEnrollment({
        schoolId,
        programId: p.id,
        volunteerUserId: "user-1",
      });
      repo.addEnrollment(e);
      const auth = teacherAuth(schoolId);

      const result = await service.listEnrollments(auth, schoolId, p.id, {
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
    });

    it("denies STUDENT from listing enrollments", async () => {
      const { service } = createService();
      const auth = studentAuth(schoolId);

      await expect(
        service.listEnrollments(auth, schoolId, "prog-1", { limit: 20 }),
      ).rejects.toThrow(TrainingForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // getExamResults
  // ---------------------------------------------------------------------------

  describe("getExamResults", () => {
    it("allows the enrolled student to view exam results", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const e = trainingEnrollment({
        schoolId,
        programId: p.id,
        volunteerUserId: "user-1",
        examReady: true,
      });
      repo.addEnrollment(e);
      const exam = trainingExam({
        schoolId,
        programId: p.id,
        enrollmentId: e.id,
      });
      repo.addExam(exam);
      const auth = studentAuth(schoolId, { userId: "user-1" });

      const result = await service.getExamResults(auth, schoolId, exam.id);

      expect(result.id).toBe(exam.id);
    });

    it("denies a different student from viewing exam results", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const e = trainingEnrollment({
        schoolId,
        programId: p.id,
        volunteerUserId: "user-1",
        examReady: true,
      });
      repo.addEnrollment(e);
      const exam = trainingExam({
        schoolId,
        programId: p.id,
        enrollmentId: e.id,
      });
      repo.addExam(exam);
      const auth = studentAuth(schoolId, { userId: "other-user" });

      await expect(
        service.getExamResults(auth, schoolId, exam.id),
      ).rejects.toThrow(TrainingForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // fail-closes when repository is unavailable
  // ---------------------------------------------------------------------------

  describe("fail-closes when repository is unavailable", () => {
    it("throws unavailable for all operations", async () => {
      const service = new TrainingService(
        new UnavailableTrainingRepository() as any,
      );
      const auth = teacherAuth(schoolId);

      await expect(
        service.listPrograms(auth, schoolId, { limit: 20 }),
      ).rejects.toThrow(TrainingUnavailableException);

      await expect(
        service.getProgram(auth, schoolId, "any-id"),
      ).rejects.toThrow(TrainingUnavailableException);

      await expect(
        service.createProgram(auth, schoolId, {
          title: "test",
          objectives: [],
          locale: "zh-CN",
        }),
      ).rejects.toThrow(TrainingUnavailableException);

      await expect(
        service.enroll(auth, schoolId, "prog-1", "user-1"),
      ).rejects.toThrow(TrainingUnavailableException);

      await expect(
        service.updateProgress(auth, schoolId, "enr-1", "mod-1", true),
      ).rejects.toThrow(TrainingUnavailableException);

      await expect(
        service.scheduleExam(auth, schoolId, "enr-1", new Date(), 60),
      ).rejects.toThrow(TrainingUnavailableException);

      await expect(
        service.submitAttempt(auth, schoolId, "exam-1", 80),
      ).rejects.toThrow(TrainingUnavailableException);
    });
  });

  // ---------------------------------------------------------------------------
  // cross-tenant access
  // ---------------------------------------------------------------------------

  describe("cross-tenant access", () => {
    it("denies SCHOOL_ADMIN from accessing a different school", async () => {
      const { service } = createService();
      const auth = schoolAdminAuth("school-1");

      await expect(
        service.listPrograms(auth, "school-2", { limit: 20 }),
      ).rejects.toThrow(TrainingForbiddenException);
    });

    it("denies STUDENT from enrolling in a different school", async () => {
      const { service } = createService();
      const auth = studentAuth("school-1");

      await expect(
        service.enroll(auth, "school-2", "prog-1", "user-1"),
      ).rejects.toThrow(TrainingForbiddenException);
    });

    it("denies TEACHER from scheduling exam in a different school", async () => {
      const { service } = createService();
      const auth = teacherAuth("school-1");

      await expect(
        service.scheduleExam(auth, "school-2", "enr-1", new Date(), 60),
      ).rejects.toThrow(TrainingForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // PLATFORM_ADMIN cross-tenant bypass
  // ---------------------------------------------------------------------------

  describe("PLATFORM_ADMIN cross-tenant access", () => {
    it("allows PLATFORM_ADMIN to list programs in any school", async () => {
      const { service, repo } = createService();
      repo.addProgram(trainingProgram({ schoolId }));
      const auth = platformAdminAuth("platform-school");

      const result = await service.listPrograms(auth, schoolId, { limit: 20 });

      expect(result.items).toHaveLength(1);
    });

    it("denies PLATFORM_ADMIN from creating a program cross-tenant (requires TEACHER/SCHOOL_ADMIN role)", async () => {
      const { service } = createService();
      const auth = platformAdminAuth("platform-school");

      await expect(
        service.createProgram(auth, schoolId, {
          title: "平台培训",
          objectives: ["目标1"],
          locale: "zh-CN",
        }),
      ).rejects.toThrow(TrainingForbiddenException);
    });

    it("denies PLATFORM_ADMIN from self-enrolling in any school", async () => {
      const { service, repo } = createService();
      const p = trainingProgram({ schoolId, status: "PUBLISHED" });
      repo.addProgram(p);
      const auth = platformAdminAuth("platform-school");

      await expect(
        service.enroll(auth, schoolId, p.id, "platform-admin-1"),
      ).rejects.toThrow(TrainingForbiddenException);
    });
  });
});
