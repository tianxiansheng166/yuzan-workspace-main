import { resolveActiveNavigation } from "../role-navigation/role-navigation.helpers";

export interface AppShellContext {
  roleLabel: string;
  areaLabel: string;
  contextSummary: string;
}

export function getAppShellContext(currentPath: string): AppShellContext {
  const { currentGroup, currentItem } = resolveActiveNavigation(currentPath);

  if (!currentGroup || !currentItem) {
    return {
      roleLabel: "公共浏览",
      areaLabel: "站点总览",
      contextSummary:
        "当前页面未映射到某个真实角色，只使用统一应用壳承接公共入口。",
    };
  }

  return {
    roleLabel: currentGroup.label,
    areaLabel: currentItem.label,
    contextSummary: currentItem.routeStatusText,
  };
}
