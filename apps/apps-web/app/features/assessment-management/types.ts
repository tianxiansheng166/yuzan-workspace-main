export type PreviewState = "complete" | "loading" | "empty" | "error";

export type AssessmentTaskStatus = "scheduled" | "live" | "inactive";

export type StudentReportStatus = "ready" | "in_progress" | "unavailable";

export interface MaterialOption {
  id: string;
  title: string;
  summary: string;
  type: "reading" | "writing";
  level: string;
  estimatedMinutes: number;
}

export interface TargetOption {
  id: string;
  name: string;
  kind: "school" | "class" | "student";
  description: string;
  studentIds: string[];
}

export interface DemoLink {
  url: string;
  code: string;
  qrAvailable: false;
  qrReason: string;
  deactivatedAt?: string;
}

export interface AssessmentProgressSnapshot {
  completedLabel: string;
  incompleteLabel: string;
  note: string;
}

export interface AssessmentTask {
  id: string;
  title: string;
  readingMaterialId: string;
  writingTaskId: string;
  opensAt: string;
  closesAt: string;
  targetIds: string[];
  targetSummary: string;
  anonymous: boolean;
  status: AssessmentTaskStatus;
  demoLink: DemoLink;
  progress: AssessmentProgressSnapshot;
  reportStudentIds: string[];
  createdBy: string;
  createdAt: string;
}

export interface ReportSnapshot {
  id: string;
  assessedAt: string;
  fluencyScore: number;
  expressionScore: number;
  writingScore: number;
  summary: string;
  strengths: string[];
  nextStep: string;
}

export interface StudentAssessmentReport {
  studentId: string;
  studentName: string;
  className: string;
  schoolName: string;
  status: StudentReportStatus;
  latest: ReportSnapshot | null;
  history: ReportSnapshot[];
  comparisonSummary: string;
}

export interface AssessmentDashboardData {
  tasks: AssessmentTask[];
  readingMaterials: MaterialOption[];
  writingTasks: MaterialOption[];
  targets: TargetOption[];
}

export interface AssessmentTaskDetailData {
  task: AssessmentTask;
  readingMaterial: MaterialOption;
  writingTask: MaterialOption;
  reports: StudentAssessmentReport[];
}

export interface StudentAssessmentReportsData {
  report: StudentAssessmentReport;
  relatedTasks: Array<{
    id: string;
    title: string;
    status: AssessmentTaskStatus;
    opensAt: string;
  }>;
}

export interface CreateAssessmentTaskInput {
  title: string;
  readingMaterialId: string;
  writingTaskId: string;
  opensAt: string;
  closesAt: string;
  targetIds: string[];
  anonymous: boolean;
}

export interface AssessmentManagementGateway {
  getDashboardData(
    previewState?: PreviewState,
  ): Promise<AssessmentDashboardData>;
  getAssessmentTaskDetail(
    taskId: string,
    previewState?: PreviewState,
  ): Promise<AssessmentTaskDetailData | null>;
  createAssessmentTask(
    input: CreateAssessmentTaskInput,
  ): Promise<AssessmentTask>;
  deactivateAssessmentTask(taskId: string): Promise<AssessmentTask>;
  getStudentAssessmentReports(
    studentId: string,
    previewState?: PreviewState,
  ): Promise<StudentAssessmentReportsData | null>;
}
