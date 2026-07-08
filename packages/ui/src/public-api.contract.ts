import { h } from "vue";

import { YxButton, YxInput, YxLink, YxStatus } from "@yuzan/ui";

h(YxButton, { type: "reset", loading: true, loadingLabel: "保存中" });
h(YxInput, {
  label: "任务标题",
  modelValue: "朗读第五课",
  required: true,
  readonly: true,
  disabled: false,
  "onUpdate:modelValue": (value: string) => value,
});
h(YxLink, {
  href: "https://example.com/resource",
  target: "_blank",
  rel: "noopener noreferrer",
});
h(YxStatus, { tone: "information", surface: "contrast" });
