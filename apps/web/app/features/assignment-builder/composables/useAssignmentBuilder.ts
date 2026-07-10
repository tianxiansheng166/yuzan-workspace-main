import { reactive, ref } from "vue";
import type {
  AssignmentDraft,
  AssignmentType,
  ContentKind,
  SaveDraftResult,
  PublishResult,
} from "../types";
import {
  publishAssignment,
  saveAssignmentDraft,
} from "../gateway/assignment.gateway";
import {
  findFirstErrorField,
  validateAssignmentDraft,
  type FieldError,
} from "../validation/assignment.validation";

export interface BuilderState {
  classId: string;
  type: AssignmentType;
  title: string;
  description: string;
  selectedContents: { id: string; kind: ContentKind; title: string }[];
  startsAt: string;
  dueAt: string;
  allowRetest: boolean;
  includeSpeech: boolean;
  includeWritten: boolean;
  recommendNextCourse: boolean;
}

function createInitialState(): BuilderState {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const formatLocal = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  return {
    classId: "",
    type: "learning",
    title: "",
    description: "",
    selectedContents: [],
    startsAt: formatLocal(now),
    dueAt: formatLocal(tomorrow),
    allowRetest: false,
    includeSpeech: false,
    includeWritten: false,
    recommendNextCourse: false,
  };
}

export function useAssignmentBuilder(role: "teacher" | "unknown") {
  const state = reactive<BuilderState>(createInitialState());
  const errors = ref<FieldError[]>([]);
  const firstErrorField = ref<string | null>(null);
  const isSubmitting = ref(false);
  const lastResult = ref<{ kind: "draft" | "publish"; message: string } | null>(
    null,
  );

  const canEdit = role === "teacher";

  function addContent(kind: ContentKind, title: string) {
    const id = `cnt-demo-${state.selectedContents.length + 1}`;
    state.selectedContents.push({ id, kind, title });
  }

  function removeContent(id: string) {
    state.selectedContents = state.selectedContents.filter((c) => c.id !== id);
  }

  function toDraft(): AssignmentDraft {
    return {
      classId: state.classId,
      type: state.type,
      title: state.title,
      description: state.description,
      selectedContents: state.selectedContents,
      startsAt: state.startsAt,
      dueAt: state.dueAt,
      allowRetest: state.allowRetest,
      includeSpeech: state.includeSpeech,
      includeWritten: state.includeWritten,
      recommendNextCourse: state.recommendNextCourse,
    };
  }

  function runValidation(): boolean {
    const result = validateAssignmentDraft(toDraft());
    errors.value = result.errors;
    firstErrorField.value = findFirstErrorField(result.errors);
    return result.valid;
  }

  async function saveDraft(): Promise<SaveDraftResult | null> {
    if (!canEdit) {
      errors.value = [{ field: "role", message: "当前角色没有保存草稿的权限" }];
      return null;
    }
    if (!runValidation()) return null;
    isSubmitting.value = true;
    try {
      const result = await saveAssignmentDraft(toDraft());
      lastResult.value = { kind: "draft", message: result.message };
      return result;
    } finally {
      isSubmitting.value = false;
    }
  }

  async function publish(): Promise<PublishResult | null> {
    if (!canEdit) {
      errors.value = [{ field: "role", message: "当前角色没有发布任务的权限" }];
      return null;
    }
    if (!runValidation()) return null;
    isSubmitting.value = true;
    try {
      const result = await publishAssignment(toDraft());
      lastResult.value = { kind: "publish", message: result.message };
      return result;
    } finally {
      isSubmitting.value = false;
    }
  }

  function fieldError(field: string): string | undefined {
    return errors.value.find((e) => e.field === field)?.message;
  }

  return {
    state,
    errors,
    firstErrorField,
    isSubmitting,
    lastResult,
    canEdit,
    addContent,
    removeContent,
    saveDraft,
    publish,
    fieldError,
    runValidation,
  };
}
