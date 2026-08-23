import {
  IflytekSpeechReadingProvider,
} from "./iflytek.provider.js";
import {
  TencentSoeSpeechReadingProvider,
} from "./tencent.provider.js";
import type {
  SpeechProviderName,
  SpeechReadingProvider,
} from "./speech-provider.js";

export type SpeechReadingProviderFactory = (
  provider: Exclude<SpeechProviderName, "disabled" | "local">,
) => SpeechReadingProvider;

export const createSpeechReadingProvider: SpeechReadingProviderFactory = (provider) => {
  if (provider === "iflytek") return new IflytekSpeechReadingProvider();
  if (provider === "tencent") return new TencentSoeSpeechReadingProvider();
  throw new Error(`Unsupported cloud speech provider: ${provider}`);
};
