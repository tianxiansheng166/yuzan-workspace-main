import type { WrittenQuestion } from "./assessment-types";

export const assessmentTitle = "AI 智能测评";

export const assessmentReadingPrompt = {
  title: "朗读热身",
  summary:
    "请自然、完整地朗读下面的短文。录音只用于本次测评提交流程，真实模式不会在学生端生成 AI 分数。",
  paragraphs: [
    "清晨的校园刚刚醒来，树叶上还挂着细小的露珠。值日生推开教室的窗户，凉风带着桂花香轻轻吹进来。",
    "操场上传来整齐的脚步声，同学们一边晨跑，一边互相提醒保持节奏。太阳慢慢升起，把教学楼的窗子照得发亮。",
    "老师常说，读书和说话一样，需要认真倾听自己的声音。只有先把每一个字读清楚，表达才会越来越自信。",
  ],
};

export const assessmentWrittenQuestions: WrittenQuestion[] = [
  {
    id: "q-choice-tone",
    kind: "choice",
    prompt: "短文里哪一项最能体现“校园刚刚醒来”的感觉？",
    helperText: "单选题",
    options: [
      { value: "a", label: "树叶上挂着露珠" },
      { value: "b", label: "食堂已经打烊" },
      { value: "c", label: "操场空无一人" },
      { value: "d", label: "窗外正在下大雨" },
    ],
  },
  {
    id: "q-judgement-expression",
    kind: "judgement",
    prompt: "判断：老师认为把每一个字读清楚，有助于提升表达自信。",
    helperText: "判断题",
    options: [
      { value: "true", label: "正确" },
      { value: "false", label: "错误" },
    ],
  },
  {
    id: "q-fill-blank-scene",
    kind: "fill-blank",
    prompt: "填空：根据短文内容补全句子。",
    helperText: "填空题",
    blanks: [
      {
        id: "blank-1",
        label: "值日生推开教室的___。",
        placeholder: "填写名词",
      },
      {
        id: "blank-2",
        label: "太阳把教学楼的___照得发亮。",
        placeholder: "填写名词",
      },
    ],
  },
  {
    id: "q-short-answer-reflection",
    kind: "short-answer",
    prompt: "简答：如果你来朗读这段短文，你会怎样让自己的声音更自然？",
    helperText: "简答题",
    minLength: 20,
    placeholder: "请结合停顿、语速或情感表达，说说你的做法。",
  },
];

export const assessmentValuePoints = [
  "真实录音、试听与重录都在浏览器本地完成。",
  "书面题支持自动保存草稿，刷新后可继续作答。",
  "历史记录会保留每次提交，便于前后对比。",
];
