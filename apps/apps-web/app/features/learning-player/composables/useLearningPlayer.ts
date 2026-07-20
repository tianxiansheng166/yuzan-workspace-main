import { computed, ref } from "vue";
import {
  demoActivityGateway,
  demoProgressGateway,
} from "../gateway/player.gateway";
import {
  needsExitConfirmation,
  playerSteps,
  transitionPlayer,
} from "../state/player-machine";
import type { LearningActivity, PlayerEvent, PlayerSnapshot } from "../types";
import { validateResponse } from "../validation/response";

export function useLearningPlayer(activityId: string) {
  const viewState = ref<"loading" | "ready" | "unknown" | "unavailable">(
    "loading",
  );
  const activity = ref<LearningActivity | null>(null);
  const response = ref("");
  const message = ref("");
  const snapshot = ref<PlayerSnapshot>({
    stepIndex: 0,
    status: "ready",
    dirty: false,
    busy: false,
  });
  const currentStep = computed(() => playerSteps[snapshot.value.stepIndex]);
  const readOnly = computed(() => activity.value?.state === "completed");

  async function load() {
    const result = await demoActivityGateway.get(activityId);
    if (!result) return void (viewState.value = "unknown");
    activity.value = result;
    snapshot.value.status = result.state;
    viewState.value = result.state === "unavailable" ? "unavailable" : "ready";
  }

  function send(event: PlayerEvent) {
    snapshot.value = transitionPlayer(snapshot.value, event);
  }

  async function saveLocal() {
    if (snapshot.value.busy || readOnly.value) return;
    snapshot.value.busy = true;
    const result = await demoProgressGateway.saveLocal(
      activityId,
      snapshot.value,
    );
    snapshot.value = {
      ...transitionPlayer(snapshot.value, "SAVE_LOCAL"),
      busy: false,
    };
    message.value =
      result === "local-only" ? "已保存在本机，尚未同步到服务器。" : "";
  }

  async function submit() {
    if (!activity.value || snapshot.value.busy || readOnly.value) return;
    const check = validateResponse(activity.value, response.value);
    message.value = check.message;
    if (!check.valid) return;
    snapshot.value.busy = true;
    await demoProgressGateway.submit(activityId, snapshot.value);
    snapshot.value = { ...snapshot.value, busy: false, status: "unavailable" };
    message.value = "提交服务暂不可用。内容仍保留在本机，没有显示为已同步。";
  }

  return {
    viewState,
    activity,
    response,
    snapshot,
    currentStep,
    readOnly,
    message,
    load,
    send,
    saveLocal,
    submit,
    needsExitConfirmation: computed(() =>
      needsExitConfirmation(snapshot.value),
    ),
  };
}
