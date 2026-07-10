# 手动生图工作区

本目录为“语赞心声”援藏教育公益平台 v2.1 前端视觉重构整理的手动生图工作区。

## 使用前必读

- 打开任一子目录；
- 读取其中的 `prompt.md`；
- 将提示词完整复制到网页版 GPT；
- 每次只生成一张图片；
- 将生成的图片直接放入同一目录的 `images/`；
- 图片不需要重命名、不需要创建 JSON、不需要挑选最佳图；
- 后续由多模态 AI 统一处理。

## 生图前职责

- Trae：整理提示词、目录结构和索引；
- 用户：只负责在网页版 GPT 手动生图并把图片放入对应 `images/`。

## 生图后职责

- Codex：逐文件夹读取图片，对比 `prompt.md`；
- 选择合格候选，自动重命名、生成 `asset.json`、写入 `generated-asset-map.json`；
- 复制到 `visual-reference/generated` 或 `design-lab`；
- 不合格图记录但不进入项目运行目录；
- 用户不需要手动处理。

## 开发阶段约定

- 前端 AI 只读取已经过多模态整理并提交的图片；
- 不直接使用 `images/` 原始候选；
- 不把整页 PNG 作为页面背景；
- 不裁切位图按钮；
- 不用图片替代真实数据和接口。

## 推荐生图顺序

1. **第一批：Foundation（基础页面与系统）**
2. **第二批：Teacher（教师工作流）**
3. **第三批：Student（学生学习流）**
4. **第四批：Assessment（测评与报告）**
5. **第五批：Assets（生产候选素材）**

## 目录总览

| 批次 | 目录 | 用途 | 是否必须 | 推荐候选数 | 比例 | 对应路由 | 是否允许文字 | 分类 |
|---|---|---|---|---|---|---|---|---|
| 01 | 01-foundation/01-home-desktop | 首页桌面端完整页面 | 是 | 3 | 16:10 | / | 少量 | 设计参考 |
| 01 | 01-foundation/02-login | 登录页面 | 是 | 3 | 16:9 | /login | 少量 | 设计参考 |
| 01 | 01-foundation/03-school-select | 学校选择页面 | 是 | 3 | 16:9 | /select-school | 少量 | 设计参考 |
| 01 | 01-foundation/04-icon-system | 定制图标系统 | 是 | 2 | 16:9 | global | 少量 | 设计参考 |
| 01 | 01-foundation/05-button-system | 沉浸式按钮系统 | 是 | 2 | 4:3 | global | 少量 | 设计参考 |
| 01 | 01-foundation/06-content-objects | 业务对象组件 | 是 | 2 | 4:3 | global | 少量 | 设计参考 |
| 01 | 01-foundation/07-motion-storyboard | 交互动效分镜 | 是 | 2 | 16:9 | global | 少量 | 设计参考 |
| 02 | 02-teacher/01-course-studio | 教师课程工作台 | 是 | 3 | 3:2 | /teacher/courses/:id/studio | 少量 | 设计参考 |
| 02 | 02-teacher/02-assignments | 教师教学任务 | 是 | 3 | 16:9 | /teacher/assignments | 少量 | 设计参考 |
| 02 | 02-teacher/03-teacher-review | 教师提交复核 | 是 | 3 | 3:2 | /teacher/reviews/:id | 少量 | 设计参考 |
| 03 | 03-student/01-student-today-mobile | 学生今日学习（移动端） | 是 | 3 | 9:19.5 | /student/today | 少量 | 设计参考 |
| 03 | 03-student/02-student-today-desktop | 学生今日学习（桌面端） | 是 | 3 | 16:9 | /student/today | 少量 | 设计参考 |
| 03 | 03-student/03-learning-player-desktop | 学生学习播放器（桌面端） | 是 | 3 | 16:9 | /student/learn/:activityId | 少量 | 设计参考 |
| 03 | 03-student/04-learning-player-mobile | 学生学习播放器（移动端） | 是 | 3 | 9:19.5 | /student/learn/:activityId | 少量 | 设计参考 |
| 03 | 03-student/05-growth-report | 学生成长报告 | 是 | 3 | 7:5 | /student/growth | 少量 | 设计参考 |
| 04 | 04-assessment/01-assessment-entry | AI 智能测评入口 | 是 | 3 | 16:9 | /assessment | 少量 | 设计参考 |
| 04 | 04-assessment/02-reading-recording | 朗读测评操作页 | 是 | 3 | 16:9 | /assessment/reading/:step | 少量 | 设计参考 |
| 04 | 04-assessment/03-written-exercise | 书面练习页面 | 是 | 3 | 16:9 | /assessment/written | 少量 | 设计参考 |
| 04 | 04-assessment/04-assessment-report | 测评报告详情 | 是 | 3 | 7:5 | /assessment/report/:id | 少量 | 设计参考 |
| 04 | 04-assessment/05-assessment-history | 历史复测对比 | 是 | 3 | 16:9 | /assessment/history | 少量 | 设计参考 |
| 05 | 05-assets/01-home-background-wide | 首页宽屏抽象背景 | 是 | 3 | 16:9 | / | 否 | 生产候选 |
| 05 | 05-assets/02-ridge-valley-layer | 红色山脊与绿色谷地层 | 是 | 3 | 16:9 | global | 否 | 生产候选 |
| 05 | 05-assets/03-contour-texture | 高原等高线透明纹理 | 是 | 3 | 1:1 | global | 否 | 生产候选 |
| 05 | 05-assets/04-sound-wave-layer | 语言声波与声场轨迹 | 是 | 3 | 1:1 | global | 否 | 生产候选 |
| 05 | 05-assets/05-cover-spring-highland | 课程封面：高原上的春天 | 是 | 3 | 4:5 | course-cover | 否 | 生产候选 |
| 05 | 05-assets/06-cover-year-of-barley | 课程封面：青稞的一年 | 是 | 3 | 4:5 | course-cover | 否 | 生产候选 |
| 05 | 05-assets/07-cover-morning-valley | 课程封面：河谷的早晨 | 是 | 3 | 4:5 | course-cover | 否 | 生产候选 |
| 05 | 05-assets/08-cover-initials-finals | 课程封面：声母与韵母 | 是 | 3 | 4:5 | course-cover | 否 | 生产候选 |
| 05 | 05-assets/09-cover-hear-progress | 课程封面：听见自己的进步 | 是 | 3 | 4:5 | course-cover | 否 | 生产候选 |
| 05 | 05-assets/10-cover-volunteer-training | 课程封面：志愿教师培训 | 是 | 3 | 4:5 | course-cover | 否 | 生产候选 |
| 05 | 05-assets/11-cover-thinking-tools | 课程封面：教师思维教学工具 | 是 | 3 | 4:5 | course-cover | 否 | 生产候选 |
| 05 | 05-assets/12-cover-translation-culture | 课程封面：藏汉翻译与文化理解 | 是 | 3 | 4:5 | course-cover | 否 | 生产候选 |

## 索引文件

- `index.json`：包含所有目录的元数据，用户无需手动编辑。

## 全局视觉基因

- 公益红/高原红、青稞绿/高原绿、藏式蓝、高原金、雪山白/自然白；
- 母题：红色山脊、绿色谷地、等高线、学习路径、语言声波；
- 气质：克制、可信、尊重、清晰、有文化温度、现代编辑式。

## 全局禁止

- 紫蓝霓虹科技渐变；
- 玻璃拟态；
- 卡片墙；
- 巨大黑体字压满画面；
- 3D 光球/宇宙/机器人；
- 旅游海报式雪山/寺庙/经幡堆砌；
- 未授权儿童照片或写实人物；
- 假学校/假公益数字/假合作单位；
- emoji 图标；
- 按钮整体轻微上浮作为主要交互；
- 将页面全部文字烘焙进背景图；
- 暖黄色主导画面。
