export const ICON_NAMES = [
  "assessment",
  "reading",
  "writing",
  "report",
  "history",
  "student",
  "teacher",
  "tools",
  "training",
  "translation",
  "product",
  "settings",
  "link",
  "copy",
  "warning",
  "pending",
  "unavailable",
  "demo",
  "success",
  "error",
] as const;

export type IconName = (typeof ICON_NAMES)[number];
