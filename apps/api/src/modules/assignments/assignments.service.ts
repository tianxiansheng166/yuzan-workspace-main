import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import { MembershipRole } from "../../common/security/index.js";
import {
  AssignmentForbiddenException,
  AssignmentNotFoundException,
  AssignmentStatusException,
} from "./domain/assignment.errors.js";
import { validateTransition } from "./domain/assignment.state-machine.js";
import type {
  CreateAssignmentInput,
  UpdateAssignmentInput,
} from "./domain/assignment.types.js";
import {
  toAssignmentResponse,
  toAssignmentSummaryResponse,
} from "./dto/assignment.response.js";
import type {
  AssignmentRepositoryPort,
  ListAssignmentsOptions,
} from "./ports/assignment-repository.port.js";
import { ASSIGNMENT_REPOSITORY } from "./ports/assignment-repository.port.js";
import { AssignmentsPolicy } from "./assignments.policy.js";

@Injectable()
export class AssignmentsService {
  private readonly policy = new AssignmentsPolicy();

  constructor(
    @Inject(ASSIGNMENT_REPOSITORY)
    private readonly assignmentRepo: AssignmentRepositoryPort,
  ) {}

  async listAssignments(
    auth: AuthContext,
    schoolId: string,
    options: ListAssignmentsOptions,
  ) {
    if (!this.policy.canReadAssignment(auth, schoolId)) {
      throw new AssignmentForbiddenException();
    }

    const isStudent = auth.principal.roles.includes(MembershipRole.STUDENT);
    const isTeacherOrAdmin =
      auth.principal.roles.includes(MembershipRole.TEACHER) ||
      auth.principal.roles.includes(MembershipRole.SCHOOL_ADMIN);

    if (isStudent && !isTeacherOrAdmin) {
      // Students see assignments targeted at their enrollments
      const studentOptions: ListAssignmentsOptions = {
        ...options,
        studentUserId: auth.principal.userId,
      };
      const result = await this.assignmentRepo.list(schoolId, studentOptions);
      return {
        items: result.items.map(toAssignmentSummaryResponse),
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      };
    }

    const result = await this.assignmentRepo.list(schoolId, options);
    return {
      items: result.items.map(toAssignmentSummaryResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async getAssignment(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
  ) {
    if (!this.policy.canReadAssignment(auth, schoolId)) {
      throw new AssignmentForbiddenException();
    }

    const assignment = await this.assignmentRepo.findById(
      schoolId,
      assignmentId,
    );
    if (!assignment) {
      throw new AssignmentNotFoundException();
    }

    const isStudent = auth.principal.roles.includes(MembershipRole.STUDENT);
    const isTeacherOrAdmin =
      auth.principal.roles.includes(MembershipRole.TEACHER) ||
      auth.principal.roles.includes(MembershipRole.SCHOOL_ADMIN);

    if (isTeacherOrAdmin) {
      return toAssignmentResponse(assignment);
    }

    if (isStudent) {
      const studentAssignments = await this.assignmentRepo.list(schoolId, {
        studentUserId: auth.principal.userId,
        limit: 1000,
      });
      if (studentAssignments.items.some((s) => s.id === assignmentId)) {
        return toAssignmentResponse(assignment);
      }
    }

    throw new AssignmentNotFoundException();
  }

  async createAssignment(
    auth: AuthContext,
    schoolId: string,
    input: CreateAssignmentInput,
  ) {
    if (!this.policy.canCreateAssignment(auth, schoolId)) {
      throw new AssignmentForbiddenException();
    }

    const assignment = await this.assignmentRepo.save(
      { ...input, schoolId },
      auth.principal.userId,
    );
    return toAssignmentResponse(assignment);
  }

  async updateAssignment(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
    data: UpdateAssignmentInput,
    expectedRevision: number,
  ) {
    if (!this.policy.canUpdateAssignment(auth, schoolId)) {
      throw new AssignmentForbiddenException();
    }

    const existing = await this.assignmentRepo.findById(
      schoolId,
      assignmentId,
    );
    if (!existing) {
      throw new AssignmentNotFoundException();
    }

    if (existing.status !== "DRAFT") {
      throw new AssignmentStatusException("只能修改草稿状态的作业");
    }

    const updated = await this.assignmentRepo.update(
      schoolId,
      assignmentId,
      data,
      expectedRevision,
    );
    return toAssignmentResponse(updated);
  }

  async openAssignment(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
    expectedRevision: number,
  ) {
    if (!this.policy.canTransitionStatus(auth, schoolId)) {
      throw new AssignmentForbiddenException();
    }

    const existing = await this.assignmentRepo.findById(
      schoolId,
      assignmentId,
    );
    if (!existing) {
      throw new AssignmentNotFoundException();
    }

    validateTransition(existing.status, "OPEN");

    const updated = await this.assignmentRepo.updateStatus(
      schoolId,
      assignmentId,
      "OPEN",
      expectedRevision,
    );
    return toAssignmentResponse(updated);
  }

  async closeAssignment(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
    expectedRevision: number,
  ) {
    if (!this.policy.canTransitionStatus(auth, schoolId)) {
      throw new AssignmentForbiddenException();
    }

    const existing = await this.assignmentRepo.findById(
      schoolId,
      assignmentId,
    );
    if (!existing) {
      throw new AssignmentNotFoundException();
    }

    validateTransition(existing.status, "CLOSED");

    const updated = await this.assignmentRepo.updateStatus(
      schoolId,
      assignmentId,
      "CLOSED",
      expectedRevision,
    );
    return toAssignmentResponse(updated);
  }

  async cancelAssignment(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
    expectedRevision: number,
  ) {
    if (!this.policy.canTransitionStatus(auth, schoolId)) {
      throw new AssignmentForbiddenException();
    }

    const existing = await this.assignmentRepo.findById(
      schoolId,
      assignmentId,
    );
    if (!existing) {
      throw new AssignmentNotFoundException();
    }

    validateTransition(existing.status, "CANCELLED");

    const updated = await this.assignmentRepo.updateStatus(
      schoolId,
      assignmentId,
      "CANCELLED",
      expectedRevision,
    );
    return toAssignmentResponse(updated);
  }

  async deleteAssignment(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
  ) {
    if (!this.policy.canDeleteAssignment(auth, schoolId)) {
      throw new AssignmentForbiddenException();
    }

    const existing = await this.assignmentRepo.findById(
      schoolId,
      assignmentId,
    );
    if (!existing) {
      throw new AssignmentNotFoundException();
    }

    await this.assignmentRepo.softDelete(schoolId, assignmentId);
  }
}
