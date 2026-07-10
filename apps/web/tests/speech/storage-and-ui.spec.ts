import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createOfflineRecordingStore } from "../../app/features/speech/storage/offline-recording-store";
import type { OfflineStoragePort } from "../../app/features/offline/ports/offline-storage-port";

describe("speech offline adapter", () => {
  it("uses a private versioned key and local-only reference", async () => {
    const set = vi.fn(async (key, value) => ({
      key,
      namespace: "test",
      value,
      updatedAt: "now",
    }));
    const port = {
      set,
      get: vi.fn(async () => null),
      remove: vi.fn(async () => undefined),
      list: vi.fn(async () => []),
      clearNamespace: vi.fn(async () => undefined),
      clearForAccountSwitch: vi.fn(async () => undefined),
    } as unknown as OfflineStoragePort;
    const store = createOfflineRecordingStore(port);
    await store.save({
      id: "local-1",
      createdAt: "2026-07-10T00:00:00.000Z",
      durationMs: 2000,
      size: 3,
      mimeType: "audio/webm",
      syncState: "local-only",
      blob: new Blob(["a"]),
    });
    expect(set.mock.calls[0]?.[0]).toBe("speech-recording:v1:local-1");
    expect(set.mock.calls[0]?.[1].syncState).toBe("local-only");
  });

  it("deletes through the same private key boundary", async () => {
    const remove = vi.fn(async () => undefined);
    const port = { remove } as unknown as OfflineStoragePort;
    await createOfflineRecordingStore(port).delete("local-2");
    expect(remove).toHaveBeenCalledWith("speech-recording:v1:local-2");
  });
});

describe("speech recorder accessibility guardrails", () => {
  const source = readFileSync(
    join(
      process.cwd(),
      "app/features/speech/components/SpeechRecorderPanel.vue",
    ),
    "utf8",
  );

  it("provides live state and accessible operation names", () => {
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('aria-label="暂停录音"');
    expect(source).toContain('aria-label="停止录音并进入本地试听"');
    expect(source).toContain('aria-label="删除本地录音"');
  });

  it("supports reduced motion and 390px", () => {
    expect(source).toContain("prefers-reduced-motion: reduce");
    expect(source).toContain("max-width: 24.375rem");
  });

  it("does not autoplay audio or claim false scoring", () => {
    expect(source).not.toMatch(/<audio[^>]+autoplay/);
    expect(source).toContain("不会生成发音分数或诊断");
    expect(source).not.toMatch(/准确率|音素评分|流利度分数|CEFR 等级|口音判断/);
  });

  it("explains privacy before the permission action", () => {
    expect(source.indexOf("麦克风只用于采集本次朗读")).toBeLessThan(
      source.indexOf("允许使用麦克风"),
    );
    expect(source).toContain("默认不自动上传、不自动提交");
  });
});
