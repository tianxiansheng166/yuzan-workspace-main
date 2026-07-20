import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { createIndexedDbOfflineStoragePort } from "~/features/offline/storage/indexeddb-offline-storage";
import { createBrowserRecorderAdapter } from "../adapters/browser-recorder.adapter";
import { createBrowserSpeechCapability } from "../capabilities/browser-speech-capability";
import { createOfflineRecordingStore } from "../storage/offline-recording-store";
import { createRecordingController } from "./create-recording-controller";

export function useSpeechRecorder() {
  const controller = createRecordingController({
    capability: createBrowserSpeechCapability(),
    recorder: createBrowserRecorderAdapter(),
    store: createOfflineRecordingStore(createIndexedDbOfflineStoragePort()),
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
