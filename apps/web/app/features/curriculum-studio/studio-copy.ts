import type {
  ChecklistState,
  CourseVersionStatus,
  LibraryAssetKind,
  ResourceState,
} from "./model";

export function getVersionStatusMeta(status: CourseVersionStatus) {
  const meta = {
    draft: {
      label: "草稿",
      tone: "neutral",
      description: "可继续编辑与补齐素材，尚未进入正式发布。",
    },
    review: {
      label: "审核中",
      tone: "warning",
      description: "等待教研或版权检查完成，不代表已发布。",
    },
    published: {
      label: "已发布",
      tone: "success",
      description: "仅表示 demo 版本快照可见，未宣称真实服务发布成功。",
    },
    unavailable: {
      label: "不可用",
      tone: "danger",
      description: "当前版本因依赖缺失或权限限制不可继续发布。",
    },
  } as const;

  return meta[status];
}

export function getChecklistMeta(state: ChecklistState) {
  const meta = {
    ready: {
      label: "已满足",
      tone: "success",
    },
    pending: {
      label: "待补齐",
      tone: "warning",
    },
    blocked: {
      label: "阻塞",
      tone: "danger",
    },
  } as const;

  return meta[state];
}

export function getResourceStateLabel(state: ResourceState) {
  const labels = {
    demo: "demo",
    pending: "pending",
    unavailable: "unavailable",
  } as const;

  return labels[state];
}

export function getLibraryKindLabel(kind: LibraryAssetKind) {
  const labels = {
    "course-unit": "课程单元",
    "assessment-text": "朗读测评文本",
    worksheet: "书面练习题",
    "recommended-course": "推荐课程",
    "reference-audio": "参考音频",
  } as const;

  return labels[kind];
}
