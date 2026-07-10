import type { LocalQualityResult, RecordedAudio } from "../types";

export interface QualityThresholds {
  minimumDurationMs: number;
  silenceLevel: number;
  clippingLevel: number;
  lowInputLevel: number;
}

const defaults: QualityThresholds = {
  minimumDurationMs: 1200,
  silenceLevel: 0.01,
  clippingLevel: 0.98,
  lowInputLevel: 0.04,
};

export function inspectLocalQuality(
  audio: RecordedAudio,
  thresholds: QualityThresholds = defaults,
): LocalQualityResult {
  const checks: LocalQualityResult["checks"] = [];
  if (audio.size === 0 || audio.capturedSamples === 0) {
    checks.push({
      code: "empty",
      level: "warning",
      message: "可能没有捕获到有效音频，可以重新录制。",
    });
  }
  if (audio.durationMs < thresholds.minimumDurationMs) {
    checks.push({
      code: "too-short",
      level: "warning",
      message: "录音可能过短，建议检查任务内容后重新录制。",
    });
  }
  if (
    audio.averageLevel !== undefined &&
    audio.averageLevel <= thresholds.silenceLevel
  ) {
    checks.push({
      code: "silence",
      level: "warning",
      message: "录音可能接近全程静音，建议检查麦克风和输入设备。",
    });
  } else if (
    audio.averageLevel !== undefined &&
    audio.averageLevel < thresholds.lowInputLevel
  ) {
    checks.push({
      code: "low-input",
      level: "notice",
      message: "输入电平可能偏低，建议检查距离或设备音量。",
    });
  }
  if (
    audio.peakLevel !== undefined &&
    audio.peakLevel >= thresholds.clippingLevel
  ) {
    checks.push({
      code: "clipping",
      level: "warning",
      message: "音频可能存在明显削波，建议检查输入音量，可以重新录制。",
    });
  }
  checks.push({
    code: "format",
    level: audio.mimeType.startsWith("audio/") ? "ok" : "notice",
    message: audio.mimeType.startsWith("audio/")
      ? `已捕获 ${audio.mimeType} 格式，仅用于设备与信号检查。`
      : "录音格式可能不完整，建议检查浏览器支持情况。",
  });
  return {
    status: checks.some((item) => item.code === "empty")
      ? "empty"
      : checks.some((item) => item.level === "warning")
        ? "review"
        : "pass",
    checks,
  };
}
