import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { createBrowserRecorderAdapter } from "../adapters/browser-recorder.adapter";
import { createBrowserSpeechCapability } from "../capabilities/browser-speech-capability";
import { createMemoryRecordingStore } from "../storage/offline-recording-store";
import { createRecordingController } from "./create-recording-controller";

export function useSpeechRecorder() {
  const controller = createRecordingController({
    capability: createBrowserSpeechCapability(),
    recorder: createBrowserRecorderAdapter(),
    store: createMemoryRecordingStore(),
  });
  const revision = ref(0);
  const refresh = () => revision.value++;
  const snapshot = computed(() => (revision.value, controller.snapshot));
  const quality = computed(() => (revision.value, controller.quality));
  const previewUrl = computed(() => (revision.value, controller.previewUrl));

  const visibilityHandler = () => {
    if (document.hidden) {
      controller.handlePageHidden();
      refresh();
    }
  };
  onMounted(() =>
    document.addEventListener("visibilitychange", visibilityHandler),
  );
  onBeforeUnmount(() => {
    document.removeEventListener("visibilitychange", visibilityHandler);
    controller.cleanup();
  });

  return { controller, snapshot, quality, previewUrl, refresh };
}
