import { WAITING_BACKEND, type CoreResult } from "../teacher/core-adapter";
export interface StudentCourse { id: string; title: string; enrollment: "available" | "enrolled"; progress: number; offline: "not-downloaded" | "downloading" | "downloaded" | "update-required"; activityId?: string; }
export interface StudentCoursesAdapter { listCourses(): Promise<CoreResult<StudentCourse[]>>; }
export function createWaitingStudentCoursesAdapter(): StudentCoursesAdapter {
  return { async listCourses() { return { status: WAITING_BACKEND, capability: "learning", message: "课程学习接口等待 B31-101 契约；当前不展示虚构课程或推荐。" }; } };
}
