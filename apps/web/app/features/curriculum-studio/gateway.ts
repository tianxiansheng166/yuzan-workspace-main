import {
  curriculumStudioDashboardDemo,
  curriculumStudioDrafts,
} from "./demo-data";
import type {
  CurriculumDraftDetail,
  CurriculumStudioDashboardData,
  CurriculumVersionSummary,
  GatewayResult,
  StudioScenario,
} from "./model";

export type SaveDraftResult =
  | { status: "success"; data: CurriculumDraftDetail }
  | { status: "conflict"; message: string }
  | { status: "failed"; message: string }
  | { status: "unauthorized"; message: string };

export interface CurriculumStudioGateway {
  getDashboard(
    scenario: Exclude<StudioScenario, "loading">,
  ): Promise<GatewayResult<CurriculumStudioDashboardData>>;
  getDraftDetail(
    draftId: string,
    scenario: Exclude<StudioScenario, "loading">,
  ): Promise<GatewayResult<CurriculumDraftDetail>>;
  saveDraftDetail?(
    draftId: string,
    detail: CurriculumDraftDetail,
    baseline: CurriculumVersionSummary,
  ): Promise<SaveDraftResult>;
}

export function createDemoCurriculumStudioGateway(): CurriculumStudioGateway {
  return {
    async getDashboard(scenario) {
      switch (scenario) {
        case "demo":
          return {
            kind: "ready",
            source: "demo",
            data: curriculumStudioDashboardDemo,
            note: "demo 数据仅用于 CUR-002 前端骨架与状态检查。",
          };
        case "empty":
          return {
            kind: "empty",
            title: "当前没有可展示的课程草稿",
            detail: "请等待 CUR-001 接入真实目录后再查看课程与测评素材。",
          };
        case "error":
          return {
            kind: "error",
            title: "内容目录暂时不可读",
            detail:
              "真实服务未接入时，统一返回 demo / pending / unavailable，而不是伪造发布结果。",
          };
        case "permission":
          return {
            kind: "permission",
            title: "你当前没有教研内容工作台权限",
            detail: "请由管理员确认是否授予课程版本编辑与版权检查范围。",
          };
        case "unavailable":
          return {
            kind: "unavailable",
            title: "课程内容服务暂不可用",
            detail:
              "版权回执、推荐课程与媒体库依赖未齐备，当前只保留 unavailable 提示。",
          };
      }
    },
    async getDraftDetail(draftId, scenario) {
      if (scenario !== "demo") {
        const dashboardResult = await this.getDashboard(scenario);
        if (dashboardResult.kind === "ready") {
          return {
            kind: "unavailable",
            title: "草稿详情暂不可读",
            detail: "当前场景不是 demo 详情模式。",
          };
        }

        return dashboardResult;
      }

      const detail = curriculumStudioDrafts[draftId];

      if (!detail) {
        return {
          kind: "unavailable",
          title: "未找到该课程草稿",
          detail: "当前 demo 数据中不存在这个草稿编号。",
        };
      }

      return {
        kind: "ready",
        source: "demo",
        data: detail,
        note: "草稿详情由 demo gateway 提供，等待 CUR-001 接入真实课程 API。",
      };
    },
    async saveDraftDetail(draftId, detail, baseline) {
      const current = curriculumStudioDrafts[draftId];
      if (!current) {
        return {
          status: "failed",
          message: "草稿不存在，无法保存。",
        };
      }

      if (current.version.updatedAt !== baseline.updatedAt) {
        return {
          status: "conflict",
          message: "服务端草稿已被其他会话修改。",
        };
      }

      const nextVersion: CurriculumVersionSummary = {
        ...current.version,
        updatedAt: new Date().toISOString(),
      };
      const nextDetail: CurriculumDraftDetail = {
        ...detail,
        version: nextVersion,
      };
      curriculumStudioDrafts[draftId] = nextDetail;
      return { status: "success", data: nextDetail };
    },
  };
}
