export interface BrandAssetMetadata {
  id: string;
  title: string;
  description: string;
  kind: "svg" | "token";
  source: "local-original";
}

export const brandAssetMetadata: BrandAssetMetadata[] = [
  {
    id: "plateau-signal-routes",
    title: "高原路径主视觉",
    description:
      "使用本地 SVG 曲线、路径节点与信息层叠，表现弱网环境中的持续学习路径。",
    kind: "svg",
    source: "local-original",
  },
  {
    id: "student-learning-rhythm",
    title: "学生学习节奏视觉",
    description:
      "使用本地 SVG 与 token 组合，区分首测、复测、推荐课程和待接入状态。",
    kind: "svg",
    source: "local-original",
  },
  {
    id: "brand-surface-tokens",
    title: "品牌表面与描边组合",
    description: "依赖现有 UI token 组合页面氛围，不修改设计系统 tokens 本体。",
    kind: "token",
    source: "local-original",
  },
];
