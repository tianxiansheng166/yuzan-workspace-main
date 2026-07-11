import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import { MembershipRole } from "../../common/security/index.js";
import {
  ClassConflictException,
  ClassForbiddenException,
  ClassNotFoundException,
} from "./domain/class.errors.js";
import type {
  ClassEnrollment,
  CreateClassInput,
  UpdateClassInput,
} from "./domain/class.types.js";
import {
  toClassMemberResponse,
  toClassResponse,
  toClassSummaryResponse,
} from "./dto/class.response.js";
import { toEnrollmentResponse } from "./dto/enrollment.response.js";
import type {
  ClassRepositoryPort,
  ListClassesOptions,
} from "./ports/class-repository.port.js";
import { CLASS_REPOSITORY } from "./ports/class-repository.port.js";
import { ClassesPolicy } from "./classes.policy.js";

@Injectable()
export class ClassesService {
  private readonly policy = new ClassesPolicy();

  constructor(
    @Inject(CLASS_REPOSITORY)
    private readonly classRepo: ClassRepositoryPort,
  ) {}

  async listClasses(
    auth: AuthContext,
    schoolId: string,
    options: ListClassesOptions,
  ) {
    if (!this.policy.canReadClassList(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    const listOptions: ListClassesOptions = {
      limit: options.limit,
      ...(options.cursor ? { cursor: options.cursor } : {}),
      ...(auth.principal.roles.includes(MembershipRole.STUDENT)
        ? { studentUserId: auth.principal.userId }
        : {}),
      ...(auth.principal.roles.includes(MembershipRole.TEACHER) &&
      !auth.principal.roles.includes(MembershipRole.SCHOOL_ADMIN)
        ? { teacherUserId: auth.principal.userId }
        : {}),
    };

    const result = await this.classRepo.list(schoolId, listOptions);
    return {
      items: result.items.map(toClassSummaryResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async getClass(auth: AuthContext, schoolId: string, classId: string) {
    if (!this.policy.canReadClass(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    const classItem = await this.classRepo.findById(schoolId, classId);
    if (!classItem) {
      throw new ClassNotFoundException();
    }

    const isSchoolAdmin = auth.principal.roles.includes(
      MembershipRole.SCHOOL_ADMIN,
    );
    const isResponsibleTeacher =
      auth.principal.roles.includes(MembershipRole.TEACHER) &&
      classItem.teacherUserIds.includes(auth.principal.userId);
    const isEnrolledStudent =
      auth.principal.roles.includes(MembershipRole.STUDENT) &&
      !auth.principal.roles.includes(MembershipRole.TEACHER) &&
      !auth.principal.roles.includes(MembershipRole.SCHOOL_ADMIN);

    if (isSchoolAdmin || isResponsibleTeacher) {
      return toClassResponse(classItem);
    }

    if (isEnrolledStudent) {
      const enrollments = await this.classRepo.listEnrollmentsByUser(
        schoolId,
        auth.principal.userId,
      );
      if (
        enrollments.some(
          (e) =>
            e.classId === classId && e.roleInClass === MembershipRole.STUDENT,
        )
      ) {
        return toClassResponse(classItem);
      }
    }

    throw new ClassNotFoundException();
  }

  async listClassMembers(auth: AuthContext, schoolId: string, classId: string) {
    if (!this.policy.canReadClassMembers(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    const classItem = await this.classRepo.findVisibleClassById({
      schoolId,
      classId,
      actor: {
        userId: auth.principal.userId,
        roles: auth.principal.roles,
      },
    });
    if (!classItem) {
      throw new ClassNotFoundException();
    }

    const members = await this.classRepo.listMembers(schoolId, classId);
    return members.map(toClassMemberResponse);
  }

  async listMyClasses(auth: AuthContext, schoolId: string) {
    if (auth.tenant.schoolId !== schoolId) {
      throw new ClassForbiddenException();
    }

    const options: ListClassesOptions = {
      limit: 100,
      ...(auth.principal.roles.includes(MembershipRole.STUDENT)
        ? { studentUserId: auth.principal.userId }
        : {}),
      ...(auth.principal.roles.includes(MembershipRole.TEACHER)
        ? { teacherUserId: auth.principal.userId }
        : {}),
    };

    const result = await this.classRepo.list(schoolId, options);
    return result.items.map(toClassSummaryResponse);
  }

  async createClass(auth: AuthContext, schoolId: string, input: CreateClassInput) {
    if (!this.policy.canCreateClass(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    const classItem = await this.classRepo.save({
      ...input,
      schoolId,
    });
    return toClassResponse(classItem);
  }

  async updateClass(
    auth: AuthContext,
    schoolId: string,
    classId: string,
    data: UpdateClassInput,
    expectedUpdatedAt: Date,
  ) {
    if (!this.policy.canUpdateClass(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    const existing = await this.classRepo.findById(schoolId, classId);
    if (!existing) {
      throw new ClassNotFoundException();
    }

    const updated = await this.classRepo.update(
      schoolId,
      classId,
      data,
      expectedUpdatedAt,
    );
    return toClassResponse(updated);
  }

  async deleteClass(auth: AuthContext, schoolId: string, classId: string) {
    if (!this.policy.canDeleteClass(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    const existing = await this.classRepo.findById(schoolId, classId);
    if (!existing) {
      throw new ClassNotFoundException();
    }

    await this.classRepo.softDelete(schoolId, classId);
  }

  async addEnrollment(
    auth: AuthContext,
    schoolId: string,
    classId: string,
    userId: string,
    role: MembershipRole,
  ) {
    if (!this.policy.canManageEnrollment(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    const existing = await this.classRepo.findById(schoolId, classId);
    if (!existing) {
      throw new ClassNotFoundException();
    }

    const enrollment = await this.classRepo.addEnrollment(
      schoolId,
      classId,
      userId,
      role,
    );
    return toEnrollmentResponse(enrollment);
  }

  async removeEnrollment(
    auth: AuthContext,
    schoolId: string,
    classId: string,
    enrollmentId: string,
  ) {
    if (!this.policy.canManageEnrollment(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    await this.classRepo.removeEnrollment(schoolId, classId, enrollmentId);
  }

  async listEnrollments(
    auth: AuthContext,
    schoolId: string,
    classId: string,
  ): Promise<readonly ClassEnrollment[]> {
    if (!this.policy.canReadClassMembers(auth, schoolId)) {
      throw new ClassForbiddenException();
    }

    const existing = await this.classRepo.findById(schoolId, classId);
    if (!existing) {
      throw new ClassNotFoundException();
    }

    const enrollments = await this.classRepo.listEnrollmentsByClass(
      schoolId,
      classId,
    );
    return enrollments;
  }
}
