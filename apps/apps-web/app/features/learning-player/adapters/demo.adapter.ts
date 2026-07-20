import type { LearningActivity } from "../types";

const activities: LearningActivity[] = [
  {
    id: "read-plateau-morning",
    title: "读懂《高原的早晨》",
    type: "reading",
    goal: "读懂清晨发生了什么，并找到描写声音的句子。",
    material: [
      "太阳越过山脊时，村庄还很安静。远处传来铃声，孩子们沿着小路走向学校。",
      "风从草坡上经过，像有人轻轻翻动书页。大家放慢脚步，听见新一天正在开始。",
    ],
    tip: "长句可以在逗号处停一下。先理解，再读出节奏。",
    prompt: "哪一句描写了声音？写下你找到的句子。",
    completion: "读完两段并写下一个答案。",
    state: "ready",
    speechCapability: "unavailable",
    aiResult: "unavailable",
  },
  {
    id: "write-morning-sentence",
    title: "补写一个清晨句子",
    type: "writing",
    goal: "用完整句子写出清晨看到和听到的事物。",
    material: ["示例：风吹过树叶，我听见沙沙的声音。"],
    tip: "先写看到什么，再用“我听见”补充声音。",
    prompt: "写一句你的清晨观察。",
    completion: "写满 10 个字并保存到本机。",
    state: "paused",
    speechCapability: "unavailable",
    aiResult: "unavailable",
  },
  {
    id: "retest-greeting-rhythm",
    title: "问候语节奏复测",
    type: "retest",
    goal: "逐句练习问候语，留意句尾停顿。",
    material: ["早上好，今天见到你很高兴。", "你准备好一起学习了吗？"],
    tip: "每句读完后安静停一拍。",
    prompt: "录音能力尚未接入，你可以先逐句默读和跟读。",
    completion: "录音服务可用后完成两句录音。",
    state: "retest-recommended",
    speechCapability: "unavailable",
    aiResult: "pending",
  },
  {
    id: "listen-rain-words",
    title: "回顾雨声词句",
    type: "listening",
    goal: "回顾已完成的词句。",
    material: ["滴答、沙沙、哗啦。"],
    tip: "这是只读回顾，不会改变完成状态。",
    prompt: "回想这些词分别适合描述怎样的声音。",
    completion: "已完成。",
    state: "completed",
    speechCapability: "unavailable",
    aiResult: "unavailable",
  },
];

export function cloneDemoActivity(id: string) {
  const item = activities.find((activity) => activity.id === id);
  return item ? structuredClone(item) : null;
}

export function unavailableActivity(id: string): LearningActivity {
  return {
    id,
    title: "学习活动暂不可用",
    type: "integrated",
    goal: "稍后重新打开，或返回今日页选择其他任务。",
    material: [],
    tip: "你的操作不会被显示为已经同步。",
    prompt: "当前没有可操作内容。",
    completion: "等待服务恢复。",
    state: "unavailable",
    speechCapability: "unavailable",
    aiResult: "unavailable",
  };
}
