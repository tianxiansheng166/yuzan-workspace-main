import type { ClassDetail, ClassGrowthStage, PronunciationClusterItem } from "../domain/class-detail.types.js";

export function toClassDetailResponse(detail: ClassDetail) {
  return {
    classId: detail.classId,
    className: detail.className,
    grade: detail.grade,
    termName: detail.termName,
    studentCount: detail.studentCount,
    currentCourse: detail.currentCourse,
    overallProgress: detail.overallProgress,
    pendingReviewCount: detail.pendingReviewCount,
    stages: detail.stages.map(toClassGrowthStageResponse),
    pronunciationClusters: detail.pronunciationClusters.map(toPronunciationClusterResponse),
  };
}

function toClassGrowthStageResponse(stage: ClassGrowthStage) {
  return {
    id: stage.id,
    title: stage.title,
    completionRate: stage.completionRate,
    participantCount: stage.participantCount,
    totalCount: stage.totalCount,
  };
}

function toPronunciationClusterResponse(item: PronunciationClusterItem) {
  return {
    type: item.type,
    label: item.label,
    affectedCount: item.affectedCount,
    percentage: item.percentage,
  };
}
