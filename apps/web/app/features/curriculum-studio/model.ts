export type StudioScenario =
  "demo" | "loading" | "empty" | "error" | "permission" | "unavailable";

export type CourseVersionStatus =
  "draft" | "review" | "published" | "unavailable";

export type ResourceState = "demo" | "pending" | "unavailable";

export type ChecklistState = "ready" | "pending" | "blocked";

export type LibraryAssetKind =
  | "course-unit"
  | "assessment-text"
  | "worksheet"
  | "recommended-course"
  | "reference-audio";

export interface LibraryAsset {
  id: string;
  title: string;
  subtitle: string;
  kind: LibraryAssetKind;
  languageCoverage: "bilingual" | "zh-only" | "pending";
  resourceState: ResourceState;
  copyrightStatus: "cleared" | "pending" | "restricted";
  accessibilityStatus: "ready" | "needs-review";
  owner: string;
}

export interface CurriculumVersionSummary {
  id: string;
  title: string;
  subtitle: string;
  status: CourseVersionStatus;
  resourceState: ResourceState;
  updatedAt: string;
  owner: string;
  bilingualCoverage: "complete" | "partial" | "missing";
  copyrightStatus: "cleared" | "pending" | "restricted";
  accessibilityStatus: "ready" | "needs-review";
  materialCompleteness: number;
  note: string;
}

export interface CurriculumAssociation {
  id: string;
  readingTextTitle: string;
  worksheetTitle: string;
  recommendedCourseTitle: string;
  relationNote: string;
  resourceState: ResourceState;
}

export interface PublicationChecklistItem {
  id: string;
  label: string;
  state: ChecklistState;
  detail: string;
}

export interface CopyrightReference {
  id: string;
  title: string;
  rightsOwner: string;
  status: "cleared" | "pending" | "restricted";
  proof: string;
  nextAction: string;
}

export interface CurriculumDraftDetail {
  version: CurriculumVersionSummary;
  summary: string;
  releaseBoundary: string;
  readingAssessments: Array<{
    id: string;
    title: string;
    textState: ResourceState;
    scoringMode: "demo" | "pending";
    note: string;
  }>;
  writtenExercises: Array<{
    id: string;
    title: string;
    mode: "demo" | "pending";
    note: string;
  }>;
  recommendedCourses: Array<{
    id: string;
    title: string;
    fit: string;
    state: ResourceState;
  }>;
  checklist: PublicationChecklistItem[];
  copyrightReferences: CopyrightReference[];
}

export interface CurriculumStudioDashboardData {
  introNote: string;
  libraryAssets: LibraryAsset[];
  versions: CurriculumVersionSummary[];
  associations: CurriculumAssociation[];
  checklist: PublicationChecklistItem[];
  copyrightReferences: CopyrightReference[];
  highlightedDraftId: string;
}

export type GatewayResult<T> =
  | {
      kind: "ready";
      source: "demo";
      data: T;
      note: string;
    }
  | {
      kind: "empty";
      title: string;
      detail: string;
    }
  | {
      kind: "error";
      title: string;
      detail: string;
    }
  | {
      kind: "permission";
      title: string;
      detail: string;
    }
  | {
      kind: "unavailable";
      title: string;
      detail: string;
    };
