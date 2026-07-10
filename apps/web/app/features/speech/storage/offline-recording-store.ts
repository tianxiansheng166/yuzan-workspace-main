import type { OfflineStoragePort } from "~/features/offline/ports/offline-storage-port";
import type { LocalRecordingReference, LocalRecordingStore } from "../types";

const RECORDING_KEY_PREFIX = "speech-recording:v1:";

export function createOfflineRecordingStore(
  offlineStorage: OfflineStoragePort,
): LocalRecordingStore {
  const key = (id: string) => `${RECORDING_KEY_PREFIX}${id}`;
  return {
    async save(recording) {
      await offlineStorage.set(key(recording.id), recording, {
        classification: "non-sensitive",
      });
      return recording;
    },
    async get(id) {
      const record = await offlineStorage.get<LocalRecordingReference>(key(id));
      return record?.value ?? null;
    },
    async delete(id) {
      await offlineStorage.remove(key(id));
    },
  };
}

export function createMemoryRecordingStore(): LocalRecordingStore {
  const records = new Map<string, LocalRecordingReference>();
  return {
    async save(recording) {
      records.set(recording.id, recording);
      return recording;
    },
    async get(id) {
      return records.get(id) ?? null;
    },
    async delete(id) {
      records.delete(id);
    },
  };
}
