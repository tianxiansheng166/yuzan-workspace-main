import type { AssessmentSession, AssessmentType, AssessmentSessionStatus } from "../domain/assessment.types.js";

export const ASSESSMENT_SESSION_REPOSITORY = Symbol("ASSESSMENT_SESSION_REPOSITORY");

export interface CreateAssessmentSessionData {
  readonly schoolId: string;
  readonly enrollmentId: string;
  readonly classId: string;
  readonly initiatorUserId: string;
  readonly type: AssessmentType;
  readonly retestOfSessionId?: string;
}

export interface ListSessionsOptions {
  readonly enrollmentId?: string;
  readonly classId?: string;
  readonly status?: AssessmentSessionStatus;
  readonly limit: number;
  readonly cursor?: string;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface AssessmentSessionRepositoryPort {
  findById(sessionId: string): Promise<AssessmentSession | null>;
  findByIdAndSchool(sessionId: string, schoolId: string): Promise<AssessmentSession | null>;
  list(schoolId: string, options: ListSessionsOptions): Promise<PaginatedResult<AssessmentSession>>;
  create(data: CreateAssessmentSessionData): Promise<AssessmentSession>;
  updateStatus(sessionId: string, status: AssessmentSessionStatus, extra?: Partial<AssessmentSession>): Promise<AssessmentSession>;
}
