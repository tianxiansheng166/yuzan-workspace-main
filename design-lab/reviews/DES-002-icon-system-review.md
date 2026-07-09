# DES-002 自定义核心图标系统评审

## 目标

为项目建立一套统一、可访问、可复用的自定义核心图标系统，覆盖首页、学习路径、测评、录音、练习、报告、历史、任务、班级、课程、翻译、培训、设置和状态场景。

## 设计原则

- **原创绘制**：所有图标均为自定义 SVG 路径，不复制现成图标库源码，不使用 emoji 或未授权素材。
- **统一几何规范**：
  - `viewBox="0 0 24 24"`
  - `stroke-width="2"`
  - `stroke-linecap="round"`
  - `stroke-linejoin="round"`
  - 默认尺寸 24×24
- **主题适配**：图标使用 `currentColor` 描边，可随父级文字颜色或 CSS 变量变化。
- **尺寸控制**：通过 `size` prop 接受数字或字符串，映射到 `width` 与 `height`。
- **可访问性**：
  - 无 `title` 时设置 `aria-hidden="true"`，避免装饰图标干扰屏幕阅读器；
  - 提供 `title` 时设置 `role="img"`、`aria-label` 并渲染 `<title>`；
  - 语义图标由调用方提供明确的 `title`。

## 图标清单

| 类别     | Vue 组件            | SVG 源文件        | 用途          |
| -------- | ------------------- | ----------------- | ------------- |
| 首页     | `YxIconHome`        | `home.svg`        | 首页入口      |
| 学习路径 | `YxIconPath`        | `path.svg`        | 学习路径/路线 |
| 测评     | `YxIconAssessment`  | `assessment.svg`  | 测评/测验     |
| 录音     | `YxIconRecord`      | `record.svg`      | 录音/语音输入 |
| 练习     | `YxIconPractice`    | `practice.svg`    | 练习/训练     |
| 报告     | `YxIconReport`      | `report.svg`      | 学习报告/统计 |
| 历史     | `YxIconHistory`     | `history.svg`     | 历史记录      |
| 任务     | `YxIconTask`        | `task.svg`        | 作业/任务     |
| 班级     | `YxIconClass`       | `class.svg`       | 班级/学生群体 |
| 课程     | `YxIconCourse`      | `course.svg`      | 课程/课本     |
| 翻译     | `YxIconTranslate`   | `translate.svg`   | 翻译/多语言   |
| 培训     | `YxIconTraining`    | `training.svg`    | 教师培训/研修 |
| 设置     | `YxIconSettings`    | `settings.svg`    | 设置          |
| 状态     | `YxIconStatus`      | `status.svg`      | 通用状态指示  |
| 成功     | `YxIconSuccess`     | `success.svg`     | 成功状态      |
| 警告     | `YxIconWarning`     | `warning.svg`     | 警告状态      |
| 危险     | `YxIconDanger`      | `danger.svg`      | 错误/危险状态 |
| 信息     | `YxIconInformation` | `information.svg` | 提示信息      |

## 组件结构

```text
packages/ui/src/icons/
├── YxIconBase.vue
├── YxIconHome.vue
├── YxIconPath.vue
├── YxIconAssessment.vue
├── YxIconRecord.vue
├── YxIconPractice.vue
├── YxIconReport.vue
├── YxIconHistory.vue
├── YxIconTask.vue
├── YxIconClass.vue
├── YxIconCourse.vue
├── YxIconTranslate.vue
├── YxIconTraining.vue
├── YxIconSettings.vue
├── YxIconStatus.vue
├── YxIconSuccess.vue
├── YxIconWarning.vue
├── YxIconDanger.vue
├── YxIconInformation.vue
└── icon-system.test.ts
```

`YxIconBase.vue` 提供统一的 SVG 容器、默认 props 和可访问性策略；各图标组件仅声明路径并复用基础组件。

## 使用方式

```vue
<script setup lang="ts">
import YxIconHome from "@yuzan/ui/icons/YxIconHome.vue";
import YxIconSuccess from "@yuzan/ui/icons/YxIconSuccess.vue";
</script>

<template>
  <YxIconHome size="20" title="返回首页" />
  <YxIconSuccess size="16" title="提交成功" />
  <YxIconSettings :size="24" />
</template>
```

## 产出物

- `packages/ui/src/icons/`：18 个 Vue 图标组件 + 1 个基础组件 + 测试。
- `design-lab/generated/icons/`：18 个对应 SVG 源文件，供设计稿、文档或静态引用。
- `design-lab/reviews/DES-002-icon-system-review.md`：本评审文档。

## 未修改区域

- 未修改 `packages/ui/src/index.ts` 共享注册入口；
- 未修改 tokens、组件或应用代码；
- 未引入外部图标库依赖。
