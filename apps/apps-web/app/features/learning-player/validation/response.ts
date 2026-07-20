import type { LearningActivity } from "../types";

export function validateResponse(activity: LearningActivity, response: string) {
  if (
    ["speaking", "retest", "initial-assessment"].includes(activity.type) &&
    activity.speechCapability === "unavailable"
  ) {
    return {
      valid: false,
      message: "录音功能暂不可用。你可以先练习，稍后再回来提交。",
    };
  }
  if (activity.type === "writing" && response.trim().length < 10) {
    return { valid: false, message: "再补充一点，让句子至少有 10 个字。" };
  }
  if (!response.trim())
    return { valid: false, message: "先完成这一小步，再继续检查。" };
  return { valid: true, message: "可以继续。" };
}
