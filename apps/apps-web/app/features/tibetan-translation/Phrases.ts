import type { TranslationDirection } from "./types";

export interface LocalPhrase {
  zh: string;
  bo: string;
  label: string;
}

export const LOCAL_PHRASE_LABEL = "本地教学短语，不是实时翻译";

export const COMMON_TEACHING_PHRASES: LocalPhrase[] = [
  { zh: "你好", bo: "khyed rang bde mo", label: "问候" },
  { zh: "谢谢", bo: "thug rje che", label: "礼貌" },
  { zh: "请坐", bo: "sdod", label: "课堂" },
  { zh: "我们一起读", bo: "nged tshos mnyam du klog", label: "课堂" },
  { zh: "非常好", bo: "shin tu legs pa", label: "鼓励" },
  { zh: "再试一次", bo: "yang lan re gnang rogs", label: "鼓励" },
  {
    zh: "你叫什么名字",
    bo: "khyed rang gi ming la ci zhes bya",
    label: "交流",
  },
  { zh: "我帮助你", bo: "ngas khyed rang la rogs pa byed", label: "交流" },
];

export function findLocalPhrase(
  text: string,
  direction: TranslationDirection,
): LocalPhrase | undefined {
  const normalized = text.trim();
  if (!normalized) return undefined;

  return COMMON_TEACHING_PHRASES.find((phrase) => {
    if (direction === "zh-to-bo") {
      return phrase.zh === normalized;
    }
    return phrase.bo === normalized;
  });
}

export function phraseToResult(
  phrase: LocalPhrase,
  direction: TranslationDirection,
): { source: string; target: string } {
  if (direction === "zh-to-bo") {
    return { source: phrase.zh, target: phrase.bo };
  }
  return { source: phrase.bo, target: phrase.zh };
}
