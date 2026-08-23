import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface PreparedSpeechAudio {
  data: Buffer;
  format: "wav";
  sampleRate: 16000;
  bitDepth: 16;
  channels: 1;
  normalized: boolean;
  sourceBytes: number;
}

export class SpeechAudioPreparationError extends Error {
  readonly code = "AUDIO_NORMALIZATION_FAILED";

  constructor(message: string) {
    super(message);
    this.name = "SpeechAudioPreparationError";
  }
}

interface WavInfo {
  sampleRate: number;
  bitDepth: number;
  channels: number;
  dataOffset: number;
  dataSize: number;
}

function readU16(data: Uint8Array, offset: number): number {
  return data[offset]! | (data[offset + 1]! << 8);
}

function readU32(data: Uint8Array, offset: number): number {
  return (
    data[offset]! |
    (data[offset + 1]! << 8) |
    (data[offset + 2]! << 16) |
    (data[offset + 3]! << 24)
  ) >>> 0;
}

/** Parse only the PCM WAV facts required by the vendor contracts. */
export function inspectPcmWav(data: Uint8Array): WavInfo | null {
  if (data.byteLength < 12 ||
      new TextDecoder().decode(data.slice(0, 4)) !== "RIFF" ||
      new TextDecoder().decode(data.slice(8, 12)) !== "WAVE") {
    return null;
  }

  let offset = 12;
  let fmt: { sampleRate: number; bitDepth: number; channels: number } | null = null;
  let audioData: { offset: number; size: number } | null = null;
  while (offset + 8 <= data.byteLength) {
    const id = new TextDecoder().decode(data.slice(offset, offset + 4));
    const size = readU32(data, offset + 4);
    const body = offset + 8;
    if (body + size > data.byteLength) return null;
    if (id === "fmt " && size >= 16) {
      fmt = {
        // AudioFormat 1 is PCM. Non-PCM is intentionally not accepted as-is.
        channels: readU16(data, body + 2),
        sampleRate: readU32(data, body + 4),
        bitDepth: readU16(data, body + 14),
      };
      if (readU16(data, body) !== 1) return null;
    } else if (id === "data") {
      audioData = { offset: body, size };
    }
    offset = body + size + (size % 2);
  }
  if (!fmt || !audioData) return null;
  return { ...fmt, dataOffset: audioData.offset, dataSize: audioData.size };
}

function isCanonicalWav(data: Uint8Array, info: WavInfo | null): info is WavInfo {
  return Boolean(
    info &&
    info.sampleRate === 16000 &&
    info.bitDepth === 16 &&
    info.channels === 1 &&
    info.dataSize > 0,
  );
}

async function downloadAudio(source: string): Promise<Buffer> {
  let response: Response;
  try {
    response = await fetch(source);
  } catch (error) {
    throw new SpeechAudioPreparationError(
      `audio download failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    throw new SpeechAudioPreparationError(`audio download failed with HTTP ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) throw new SpeechAudioPreparationError("audio is empty");
  return bytes;
}

async function normalizeWithFfmpeg(input: Buffer, ffmpegPath: string): Promise<Buffer> {
  const directory = await mkdtemp(`${tmpdir()}/yuzan-speech-`);
  const inputPath = `${directory}/input.bin`;
  const outputPath = `${directory}/output.wav`;
  try {
    await writeFile(inputPath, input);
    await execFileAsync(
      ffmpegPath,
      ["-hide_banner", "-loglevel", "error", "-y", "-i", inputPath, "-ar", "16000", "-ac", "1", "-sample_fmt", "s16", "-f", "wav", outputPath],
      { timeout: 30_000, maxBuffer: 1024 * 1024 },
    );
    const normalized = await readFile(outputPath);
    if (!isCanonicalWav(normalized, inspectPcmWav(normalized))) {
      throw new SpeechAudioPreparationError("ffmpeg output is not canonical PCM WAV");
    }
    return normalized;
  } catch (error) {
    if (error instanceof SpeechAudioPreparationError) throw error;
    throw new SpeechAudioPreparationError(
      `audio normalization failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/**
 * Download and normalize provider input without mutating the Recording or its
 * source object. Canonical WAV is returned unchanged; all other input is sent
 * through a short-lived ffmpeg workspace and cleaned up in finally.
 */
export async function prepareSpeechAudio(
  source: string | Uint8Array,
  options: { ffmpegPath?: string } = {},
): Promise<PreparedSpeechAudio> {
  const input = typeof source === "string" ? await downloadAudio(source) : Buffer.from(source);
  const info = inspectPcmWav(input);
  if (isCanonicalWav(input, info)) {
    return {
      data: input,
      format: "wav",
      sampleRate: 16000,
      bitDepth: 16,
      channels: 1,
      normalized: false,
      sourceBytes: input.length,
    };
  }
  const configuredFfmpeg = options.ffmpegPath ?? process.env.FFMPEG_PATH;
  const ffmpegPath = configuredFfmpeg ??
    (process.env.FFMPEG_DIR ? `${process.env.FFMPEG_DIR}/ffmpeg` : "ffmpeg");
  const normalized = await normalizeWithFfmpeg(input, ffmpegPath);
  return {
    data: normalized,
    format: "wav",
    sampleRate: 16000,
    bitDepth: 16,
    channels: 1,
    normalized: true,
    sourceBytes: input.length,
  };
}
