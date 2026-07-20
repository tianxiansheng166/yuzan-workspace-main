import { ref } from "vue";
import { teacherToolsConfig } from "../config/teacher-tools.config";

export type MindGraphStatus =
  "idle" | "loading" | "unavailable" | "error" | "complete";

export type MindGraphType =
  (typeof teacherToolsConfig.mindGraph.types)[number]["value"];

export interface MindGraphNode {
  id: string;
  label: string;
}

export interface MindGraphEdge {
  source: string;
  target: string;
}

export interface MindGraphResult {
  id: string;
  type: MindGraphType;
  title: string;
  nodes: MindGraphNode[];
  edges: MindGraphEdge[];
}

export interface UseMindGraphReturn {
  status: ReturnType<typeof ref<MindGraphStatus>>;
  result: ReturnType<typeof ref<MindGraphResult | null>>;
  errorMessage: ReturnType<typeof ref<string>>;
  generate: (prompt: string, type: MindGraphType) => Promise<void>;
  reset: () => void;
}

function isMindGraphResult(value: unknown): value is MindGraphResult {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<MindGraphResult>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    Array.isArray(candidate.nodes) &&
    Array.isArray(candidate.edges)
  );
}

export function useMindGraph(): UseMindGraphReturn {
  const status = ref<MindGraphStatus>("idle");
  const result = ref<MindGraphResult | null>(null);
  const errorMessage = ref<string>("");

  async function generate(prompt: string, type: MindGraphType) {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    status.value = "loading";
    result.value = null;
    errorMessage.value = "";

    try {
      const response = await $fetch(teacherToolsConfig.mindGraph.apiEndpoint, {
        method: "POST",
        body: { prompt: trimmed, type },
      });

      if (isMindGraphResult(response)) {
        result.value = response;
        status.value = "complete";
      } else {
        status.value = "unavailable";
        errorMessage.value = "生成服务返回格式异常，暂不可用。";
      }
    } catch {
      status.value = "unavailable";
      errorMessage.value =
        "生成服务尚未接入或暂不可用，请稍后重试。服务上线前不会显示伪造结果。";
    }
  }

  function reset() {
    status.value = "idle";
    result.value = null;
    errorMessage.value = "";
  }

  return {
    status,
    result,
    errorMessage,
    generate,
    reset,
  };
}
