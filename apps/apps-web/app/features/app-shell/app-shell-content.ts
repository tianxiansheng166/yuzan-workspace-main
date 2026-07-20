import { findProductRoute } from "../../routing/product-route-registry";

export interface AppShellContext {
  roleLabel: string;
  areaLabel: string;
  contextSummary: string;
}

export function getAppShellContext(currentPath: string): AppShellContext {
  const route = findProductRoute(currentPath);
  if (!route) {
    return {
      roleLabel: "公共浏览",
      areaLabel: "站点总览",
      contextSummary: "当前路径未登记到产品路由注册表。",
    };
  }
  return {
    roleLabel: route.port,
    areaLabel: route.label,
    contextSummary: route.featureStatus,
  };
}
