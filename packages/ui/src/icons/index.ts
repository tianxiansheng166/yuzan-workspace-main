import type { IconName } from "../icon-types";

export interface IconDefinition {
  name: IconName;
  paths: string[];
  viewBox?: string;
}

export const ICON_REGISTRY: Record<IconName, IconDefinition> = {
  assessment: {
    name: "assessment",
    paths: [
      "M9 2h6v2h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4V2z",
      "M8 10h8M8 14h8M8 18h5",
    ],
  },
  reading: {
    name: "reading",
    paths: [
      "M4 19.5A2.5 2.5 0 0 1 6.5 17H20",
      "M4 4.5A2.5 2.5 0 0 0 6.5 7H20",
      "M20 7v10",
    ],
  },
  writing: {
    name: "writing",
    paths: [
      "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7",
      "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
    ],
  },
  report: {
    name: "report",
    paths: [
      "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
      "M14 2v6h6",
      "M8 18v-6M12 18v-4M16 18v-8",
    ],
  },
  history: {
    name: "history",
    paths: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7v5l3 3"],
  },
  student: {
    name: "student",
    paths: [
      "M12 3l10 5-10 5-10-5 10-5z",
      "M22 12v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3",
    ],
  },
  teacher: {
    name: "teacher",
    paths: [
      "M12 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
      "M4 22a8 8 0 0 1 16 0",
      "M16 2h6v4h-6",
    ],
  },
  tools: {
    name: "tools",
    paths: [
      "M12.5 6.5l5-5a3 3 0 0 1 4.2 4.2l-5 5a2 2 0 0 1-1.4.6H13v2.2a2 2 0 0 1-.6 1.4l-5 5a3 3 0 0 1-4.2-4.2l5-5a2 2 0 0 1 1.4-.6H11V7.9a2 2 0 0 1 .6-1.4z",
    ],
  },
  training: {
    name: "training",
    paths: [
      "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
      "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
      "M12 12h.01",
    ],
  },
  translation: {
    name: "translation",
    paths: ["M5 7h7", "M8.5 7v10", "M15 7l5 10", "M17.5 12h-5"],
  },
  product: {
    name: "product",
    paths: [
      "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
      "M3.27 6.96L12 12l8.73-5.04",
      "M12 22.08V12",
    ],
  },
  settings: {
    name: "settings",
    paths: [
      "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
      "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9 1.65 1.65 0 0 0 4.27 7.18l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
    ],
  },
  link: {
    name: "link",
    paths: [
      "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71",
      "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
    ],
  },
  copy: {
    name: "copy",
    paths: [
      "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2",
      "M9 2h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z",
    ],
  },
  warning: {
    name: "warning",
    paths: [
      "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
      "M12 9v4",
      "M12 17h.01",
    ],
  },
  pending: {
    name: "pending",
    paths: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7v5l3 3"],
  },
  unavailable: {
    name: "unavailable",
    paths: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M5 5l14 14"],
  },
  demo: {
    name: "demo",
    paths: ["M9 3L7 17a5 5 0 0 0 10 0L15 3", "M8 3h8"],
  },
  success: {
    name: "success",
    paths: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M9 12l2 2 4-4"],
  },
  error: {
    name: "error",
    paths: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M9 9l6 6M15 9l-6 6"],
  },
};

export const UNKNOWN_ICON: IconDefinition = {
  name: "error",
  paths: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 16v.01", "M12 8v5"],
  viewBox: "0 0 24 24",
};
