import { beforeEach, describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";

import { getDirtyStateRegistry } from "../../app/features/dirty-state/composables/useDirtyStateRegistry";
import { useCourseDraftEditor } from "../../app/features/curriculum-studio/useCourseDraftEditor";
import { curriculumStudioDrafts } from "../../app/features/curriculum-studio/demo-data";

const originalDraftSnapshot = structuredClone(
  curriculumStudioDrafts["plateau-route-v3"],
);

describe("useCourseDraftEditor dirty state integration", () => {
  beforeEach(() => {
    getDirtyStateRegistry().clear();
    curriculumStudioDrafts["plateau-route-v3"] = structuredClone(
      originalDraftSnapshot,
    );
  });

  async function createEditor(draftId = "plateau-route-v3") {
    const draftIdRef = ref(draftId);
    const scenarioRef = ref("demo" as const);
    const editor = useCourseDraftEditor(draftIdRef, scenarioRef);

    await nextTick();
    await nextTick();

    return { draftIdRef, scenarioRef, editor };
  }

  it("starts clean after initial load", async () => {
    const { editor } = await createEditor();

    expect(editor.result.value?.kind).toBe("ready");
    expect(editor.isDirty()).toBe(false);
    expect(getDirtyStateRegistry().has("course-draft:plateau-route-v3")).toBe(
      true,
    );
    expect(
      getDirtyStateRegistry().get("course-draft:plateau-route-v3")?.status,
    ).toBe("CLEAN");
  });

  it("marks dirty when summary is edited", async () => {
    const { editor } = await createEditor();

    editor.summary.value = "modified summary";
    await nextTick();

    expect(editor.isDirty()).toBe(true);
    expect(
      getDirtyStateRegistry().get("course-draft:plateau-route-v3")?.status,
    ).toBe("DIRTY");
  });

  it("returns to clean after a successful save", async () => {
    const { editor } = await createEditor();

    editor.summary.value = "modified summary";
    await nextTick();

    const saveResult = await editor.dirtyEntry.save();

    expect(saveResult.status).toBe("success");
    expect(editor.isDirty()).toBe(false);
    expect(
      getDirtyStateRegistry().get("course-draft:plateau-route-v3")?.status,
    ).toBe("CLEAN");
  });

  it("reports SAVE_FAILED when save fails", async () => {
    const { editor, scenarioRef } = await createEditor();
    scenarioRef.value = "error";
    await nextTick();
    await nextTick();

    const saveResult = await editor.dirtyEntry.save();

    expect(saveResult.status).toBe("failed");
    expect(
      getDirtyStateRegistry().get("course-draft:plateau-route-v3")?.status,
    ).toBe("SAVE_FAILED");
  });

  it("reports CONFLICT when save callback returns conflict", async () => {
    const { editor } = await createEditor();

    editor.summary.value = "conflicting edit";
    await nextTick();

    const gateway = (await import("../../app/features/curriculum-studio/gateway"))
      .createDemoCurriculumStudioGateway();
    const originalVersion = { ...editor.result.value!.data.version };
    await gateway.saveDraftDetail(
      "plateau-route-v3",
      editor.result.value!.data,
      originalVersion,
    );

    const saveResult = await editor.dirtyEntry.save();

    expect(saveResult.status).toBe("conflict");
    expect(
      getDirtyStateRegistry().get("course-draft:plateau-route-v3")?.status,
    ).toBe("CONFLICT");
  });

  it("restores original values on discard", async () => {
    const { editor } = await createEditor();
    const originalSummary = editor.result.value?.data.summary;

    editor.summary.value = "modified summary";
    await nextTick();
    expect(editor.isDirty()).toBe(true);

    await editor.dirtyEntry.discard();
    await nextTick();

    expect(editor.summary.value).toBe(originalSummary);
    expect(editor.isDirty()).toBe(false);
  });

  it("keeps entry clean when edited value matches baseline", async () => {
    const { editor } = await createEditor();

    editor.summary.value = editor.result.value!.data.summary;
    await nextTick();

    expect(editor.isDirty()).toBe(false);
    expect(
      getDirtyStateRegistry().get("course-draft:plateau-route-v3")?.status,
    ).toBe("CLEAN");
  });
});
