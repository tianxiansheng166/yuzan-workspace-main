import type {
  ClassSummary,
  ClassDetail,
  UserRole,
} from "~/features/classes/types";

export interface ClassListResult {
  role: UserRole;
  classes: ClassSummary[];
}

export interface ClassDetailResult {
  role: UserRole;
  class: ClassDetail | null;
}

/**
 * Gateway for class workspace data.
 * Current implementation returns demo/pending data for UI scaffolding.
 * ORG-001 will replace this with real API calls while keeping the adapter boundary.
 */
export async function fetchClassList(): Promise<ClassListResult> {
  // Simulate network latency to surface loading states.
  await new Promise((resolve) => setTimeout(resolve, 300));

  return {
    role: "teacher",
    classes: [
      {
        id: "cls-demo-01",
        name: "三年级一班",
        grade: "三年级",
        studentCount: 3,
        courseCount: 2,
        assessmentCount: 1,
        syncStatus: "synced",
      },
      {
        id: "cls-demo-02",
        name: "三年级二班",
        grade: "三年级",
        studentCount: 2,
        courseCount: 1,
        assessmentCount: 0,
        syncStatus: "pending",
      },
    ],
  };
}

export async function fetchClassDetail(
  classId: string,
): Promise<ClassDetailResult> {
  await new Promise((resolve) => setTimeout(resolve, 300));

  if (classId === "cls-empty") {
    return {
      role: "teacher",
      class: {
        id: classId,
        name: "空班级示例",
        grade: "三年级",
        students: [],
        assessments: [],
      },
    };
  }

  if (classId === "cls-error") {
    throw new Error("Failed to load class detail");
  }

  return {
    role: "teacher",
    class: {
      id: classId,
      name: classId === "cls-demo-02" ? "三年级二班" : "三年级一班",
      grade: "三年级",
      students: [
        {
          id: "stu-demo-01",
          displayName: "示例学生甲（demo）",
          isDemo: true,
          assessmentStatus: "submitted",
          retestStatus: "not-started",
          reportStatus: "generating",
        },
        {
          id: "stu-demo-02",
          displayName: "示例学生乙（demo）",
          isDemo: true,
          assessmentStatus: "in-progress",
          retestStatus: "pending",
          reportStatus: "unavailable",
        },
        {
          id: "stu-demo-03",
          displayName: "示例学生丙（demo）",
          isDemo: true,
          assessmentStatus: "not-started",
          retestStatus: "unavailable",
          reportStatus: "pending",
        },
      ],
      assessments: [
        {
          id: "asm-demo-01",
          title: "第三单元形成性测评",
          type: "formative",
          status: "open",
          dueDate: "2026-07-15",
        },
      ],
    },
  };
}


