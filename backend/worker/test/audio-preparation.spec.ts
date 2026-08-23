import { describe, expect, it } from "vitest";
import { inspectPcmWav, prepareSpeechAudio, SpeechAudioPreparationError } from "../src/speech/audio-preparation.js";

function wav(sampleRate = 16000, channels = 1, bitDepth = 16, payload = new Uint8Array([1, 2, 3, 4])): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + payload.byteLength, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * (bitDepth / 8), 28);
  header.writeUInt16LE(channels * (bitDepth / 8), 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(payload.byteLength, 40);
  return Buffer.concat([header, Buffer.from(payload)]);
}

describe("speech provider audio preparation", () => {
  it("accepts canonical 16k/16-bit/mono PCM WAV without changing source bytes", async () => {
    const source = wav();
    expect(inspectPcmWav(source)).toMatchObject({ sampleRate: 16000, channels: 1, bitDepth: 16 });
    const prepared = await prepareSpeechAudio(source);
    expect(prepared.normalized).toBe(false);
    expect(prepared.data.equals(source)).toBe(true);
  });

  it("fails closed for wrong sample rate, stereo input, and corrupt audio when ffmpeg is unavailable", async () => {
    await expect(prepareSpeechAudio(wav(8000), { ffmpegPath: "/no/such/ffmpeg" })).rejects.toBeInstanceOf(SpeechAudioPreparationError);
    await expect(prepareSpeechAudio(wav(16000, 2), { ffmpegPath: "/no/such/ffmpeg" })).rejects.toBeInstanceOf(SpeechAudioPreparationError);
    await expect(prepareSpeechAudio(Buffer.from("not audio"), { ffmpegPath: "/no/such/ffmpeg" })).rejects.toBeInstanceOf(SpeechAudioPreparationError);
  });
});
