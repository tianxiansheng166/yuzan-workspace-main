import { ApiError, ApiUnavailableError } from "../../lib/api/client";
import type {
  ApiEnvelope,
  CourseVersionSummary,
  CurrentUserResponse,
  MembershipRole,
} from "../../lib/api/types";

export interface ProductApiPort {
  currentUser(): Promise<CurrentUserResponse>;
  request<T>(path: string, init?: RequestInit): Promise<T>;
}

export interface SchoolContext {
  schoolId: string;
  schoolName: string;
  role: MembershipRole;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ClassSummary {
  id: string;
  name: string;
  grade: string;
  studentCount: number;
}

export interface AssignmentSummary {
  id: string;
  schoolId: string;
  title: string;
  status: "DRAFT" | "SCHEDULED" | "OPEN" | "CLOSED" | "CANCELLED" | "ARCHIVED";
  startsAt: string;
  dueAt: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentDetail extends AssignmentSummary {
  courseVersionId: string;
  targets: Array<{
    id: string;
    targetType: "CLASS" | "STUDENT";
    classId?: string;
    enrollmentId?: string;
  }>;
}

export interface LearningTask {
  assignmentId: string;
  title: string;
  status: string;
  dueAt: string;
  courseVersionId: string;
  courseTitle: string;
}

export interface ActivityProgress {
  id: string;
  activityId: string;
  enrollmentId: string;
  position: number;
  completed: boolean;
  revision: number;
  updatedAt: string;
}

export interface LearningActivity {
  activityId: string;
  title: string;
  type: string;
  instruction?: string;
  sortOrder: number;
  required: boolean;
  progress?: ActivityProgress;
}

export interface Submission {
  id: string;
  schoolId: string;
  assignmentId: string;
  enrollmentId: string;
  attemptNo: number;
  status: string;
  revision: number;
  submittedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Feedback {
  id: string;
  submissionId: string;
  decision: string;
  comment: string;
  score?: number;
  releasedAt: string;
}

export interface ReportSummary {
  id: string;
  type: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  generatedAt?: string | null;
  dataCompleteness?: number;
  revision?: number;
  enrollmentId?: string | null;
  classId?: string | null;
}

export interface ReportDetail extends ReportSummary {
  schoolId: string;
  generatedAt: string | null;
  providerDisclosure: string;
  filters?: Record<string, unknown> | null;
  data?: Record<string, unknown> | null;
  createdAt: string;
}

export interface StudentGrowthProfile {
  enrollmentId: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  dataCompleteness: number;
  providerDisclosure: string;
  data?: Record<string, unknown>;
}

export interface TeacherOverview {
  context: SchoolContext;
  courses: CourseVersionSummary[];
  classes: ClassSummary[];
  assignments: AssignmentSummary[];
  reports: ReportSummary[];
}

export interface LiveFailure {
  kind: "unauthenticated" | "permission" | "unavailable" | "error";
  code?: string;
  message: string;
}

export class ActiveSchoolRequiredError extends Error {
  constructor() {
    super("请先选择学校，再读取学校范围内的数据。");
    this.name = "ActiveSchoolRequiredError";
  }
}

export function describeLiveFailure(error: unknown): LiveFailure {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return {
        kind: "unauthenticated",
        code: error.code,
        message: "登录状态已失效，请重新登录。",
      };
    if (error.status === 403)
      return {
        kind: "permission",
        code: error.code,
        message: "当前账号没有读取这项学校资源的权限。",
      };
    if (error.status === 503)
      return { kind: "unavailable", code: error.code, message: error.message };
    return { kind: "error", code: error.code, message: error.message };
  }
  if (error instanceof ApiUnavailableError)
    return { kind: "unavailable", message: error.message };
  if (error instanceof ActiveSchoolRequiredError)
    return { kind: "permission", message: error.message };
  return { kind: "error", message: "请求未完成，请稍后重试。" };
}

export function createLiveCoreGateway(api: ProductApiPort) {
  async function context(): Promise<SchoolContext> {
    const response = await api.currentUser();
    const schoolId = response.data.activeSchoolId;
    if (!schoolId) throw new ActiveSchoolRequiredError();
    const membership = response.data.memberships.find(
      (item) => item.schoolId === schoolId,
    );
    if (!membership) throw new ActiveSchoolRequiredError();
    return {
      schoolId,
      schoolName: membership.schoolName,
      role: membership.role,
    };
  }

  const schoolPath = (schoolId: string, path: string) =>
    `/schools/${schoolId}${path}`;

  return {
    context,
    async teacherOverview(): Promise<TeacherOverview> {
      const active = await context();
      const [courses, classes, assignments, reports] = await Promise.all([
        api.request<ApiEnvelope<CourseVersionSummary[]>>(
          schoolPath(active.schoolId, "/course-versions"),
        ),
        api.request<ApiEnvelope<Paginated<ClassSummary>>>(
          schoolPath(active.schoolId, "/classes?limit=50"),
        ),
        api.request<ApiEnvelope<Paginated<AssignmentSummary>>>(
          schoolPath(active.schoolId, "/assignments?limit=50"),
        ),
        api.request<ApiEnvelope<Paginated<ReportSummary>>>(
          schoolPath(active.schoolId, "/reports?limit=20"),
        ),
      ]);
      return {
        context: active,
        courses: courses.data,
        classes: classes.data.items,
        assignments: assignments.data.items,
        reports: reports.data.items,
      };
    },
    async listCourses() {
      const active = await context();
      const response = await api.request<ApiEnvelope<CourseVersionSummary[]>>(
        schoolPath(active.schoolId, "/course-versions"),
      );
      return { context: active, items: response.data };
    },
    async createCourse(input: {
      title: string;
      description?: string;
      gradeBand?: string;
    }) {
      const active = await context();
      const response = await api.request<ApiEnvelope<CourseVersionSummary>>(
        schoolPath(active.schoolId, "/course-versions"),
        { method: "POST", body: JSON.stringify(input) },
      );
      return response.data;
    },
    async listClasses() {
      const active = await context();
      const response = await api.request<ApiEnvelope<Paginated<ClassSummary>>>(
        schoolPath(active.schoolId, "/classes?limit=50"),
      );
      return { context: active, items: response.data.items };
    },
    async createClass(input: { name: string; grade: string; termId: string }) {
      const active = await context();
      const response = await api.request<ApiEnvelope<ClassSummary>>(
        schoolPath(active.schoolId, "/classes"),
        { method: "POST", body: JSON.stringify(input) },
      );
      return response.data;
    },
    async listAssignments() {
      const active = await context();
      const response = await api.request<
        ApiEnvelope<Paginated<AssignmentSummary>>
      >(schoolPath(active.schoolId, "/assignments?limit=50"));
      return { context: active, items: response.data.items };
    },
    async createAssignment(input: {
      title: string;
      courseVersionId: string;
      startsAt: string;
      dueAt: string;
      classId: string;
      offlineRequired?: boolean;
    }) {
      const active = await context();
      const response = await api.request<ApiEnvelope<AssignmentDetail>>(
        schoolPath(active.schoolId, "/assignments"),
        {
          method: "POST",
          body: JSON.stringify({
            title: input.title,
            courseVersionId: input.courseVersionId,
            startsAt: input.startsAt,
            dueAt: input.dueAt,
            offlineRequired: input.offlineRequired ?? false,
            targets: [{ targetType: "CLASS", classId: input.classId }],
          }),
        },
      );
      return response.data;
    },
    async transitionAssignment(
      assignment: AssignmentSummary,
      action: "open" | "close",
    ) {
      const active = await context();
      const response = await api.request<ApiEnvelope<AssignmentDetail>>(
        schoolPath(active.schoolId, `/assignments/${assignment.id}/${action}`),
        {
          method: "POST",
          body: JSON.stringify({ expectedRevision: assignment.revision }),
        },
      );
      return response.data;
    },
    async listLearningTasks() {
      const active = await context();
      const response = await api.request<ApiEnvelope<LearningTask[]>>(
        schoolPath(active.schoolId, "/learning/tasks"),
      );
      return { context: active, items: response.data };
    },
    async getLearningTask(assignmentId: string) {
      const active = await context();
      const response = await api.request<ApiEnvelope<LearningActivity[]>>(
        schoolPath(active.schoolId, `/learning/tasks/${assignmentId}`),
      );
      return { context: active, items: response.data };
    },
    async updateProgress(
      activityId: string,
      progress: {
        enrollmentId: string;
        position: number;
        completed: boolean;
        expectedRevision?: number;
      },
    ) {
      const active = await context();
      const response = await api.request<ApiEnvelope<ActivityProgress>>(
        schoolPath(
          active.schoolId,
          `/learning/activities/${activityId}/progress`,
        ),
        { method: "PUT", body: JSON.stringify(progress) },
      );
      return response.data;
    },
    async createAndSubmit(
      assignmentId: string,
      enrollmentId: string,
      idempotencyKey: string,
    ) {
      const active = await context();
      const created = await api.request<ApiEnvelope<Submission>>(
        schoolPath(active.schoolId, "/submissions"),
        {
          method: "POST",
          headers: { "idempotency-key": idempotencyKey },
          body: JSON.stringify({ assignmentId, enrollmentId }),
        },
      );
      const submitted = await api.request<ApiEnvelope<Submission>>(
        schoolPath(active.schoolId, `/submissions/${created.data.id}/submit`),
        {
          method: "POST",
          body: JSON.stringify({ expectedRevision: created.data.revision }),
        },
      );
      return submitted.data;
    },
    async listAssignmentSubmissions(assignmentId: string) {
      const active = await context();
      const response = await api.request<ApiEnvelope<Paginated<Submission>>>(
        schoolPath(
          active.schoolId,
          `/assignments/${assignmentId}/submissions?limit=50`,
        ),
      );
      return { context: active, items: response.data.items };
    },
    async getFeedback(submissionId: string) {
      const active = await context();
      const response = await api.request<ApiEnvelope<Feedback[]>>(
        schoolPath(active.schoolId, `/submissions/${submissionId}/feedback`),
      );
      return response.data;
    },
    async createFeedback(
      submissionId: string,
      input: { decision: "ACCEPT" | "RETURN"; comment: string; score?: number },
    ) {
      const active = await context();
      const response = await api.request<ApiEnvelope<Feedback>>(
        schoolPath(active.schoolId, `/submissions/${submissionId}/feedback`),
        { method: "POST", body: JSON.stringify(input) },
      );
      return response.data;
    },
    async listReports() {
      const active = await context();
      const response = await api.request<ApiEnvelope<Paginated<ReportSummary>>>(
        schoolPath(active.schoolId, "/reports?limit=50"),
      );
      return { context: active, items: response.data.items };
    },
    async getReport(reportId: string) {
      const active = await context();
      const response = await api.request<ApiEnvelope<ReportDetail>>(
        schoolPath(active.schoolId, `/reports/${reportId}`),
      );
      return { context: active, item: response.data };
    },
    async getStudentGrowth(enrollmentId: string) {
      const active = await context();
      const response = await api.request<ApiEnvelope<StudentGrowthProfile>>(
        schoolPath(active.schoolId, `/student-growth/${enrollmentId}`),
      );
      return { context: active, item: response.data };
    },
  };
}
