import {
  roleNavigationGroups,
  roleNavigationStatuses,
  type RoleNavigationGroup,
  type RoleNavigationItem,
  type RoleNavigationStatusDefinition,
  type RoleNavigationStatusId,
} from "./role-navigation.config";

export interface ActiveNavigationState {
  currentGroup: RoleNavigationGroup | null;
  currentItem: RoleNavigationItem | null;
}

export function isNavigationItemActive(
  item: RoleNavigationItem,
  currentPath: string,
): boolean {
  const exactPaths = item.exactPaths ?? [];

  if (exactPaths.includes(currentPath)) {
    return true;
  }

  return item.matchPrefixes.some((prefix) => {
    if (prefix.endsWith("/")) {
      return currentPath.startsWith(prefix);
    }

    return currentPath === prefix || currentPath.startsWith(`${prefix}/`);
  });
}

export function resolveActiveNavigation(
  currentPath: string,
): ActiveNavigationState {
  for (const group of roleNavigationGroups) {
    for (const item of group.items) {
      if (isNavigationItemActive(item, currentPath)) {
        return {
          currentGroup: group,
          currentItem: item,
        };
      }
    }
  }

  return {
    currentGroup: null,
    currentItem: null,
  };
}

export function getStatusDefinition(
  statusId: RoleNavigationStatusId,
): RoleNavigationStatusDefinition {
  const match = roleNavigationStatuses.find((status) => status.id === statusId);

  if (!match) {
    throw new Error(`Unknown role navigation status: ${statusId}`);
  }

  return match;
}

export function listGroupLabels(
  groups: RoleNavigationGroup[] = roleNavigationGroups,
) {
  return groups.map((group) => group.label);
}
