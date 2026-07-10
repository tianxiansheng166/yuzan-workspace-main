# 图片参考如何进入前端实现

## 1. 图片的角色

`visual-reference/png` 中的图片是：

- 构图事实源；
- 色彩关系事实源；
- 信息密度事实源；
- 组件形态事实源；
- 动效分镜事实源。

它们不是要直接作为整页背景贴进网页。

## 2. 可以直接使用的内容

### 可以直接进入产品的资源

- 旧项目 Logo，但需要保留来源和深浅色适配；
- 后续根据 Prompt 生成并登记的背景纹理、山脊、等高线、声波和课程封面；
- 纯装饰 SVG；
- 静态低带宽 fallback。

### 必须用代码重建

- 导航；
- 页面布局；
- 按钮；
- 表单；
- 列表和表格；
- 学习路径；
- 测评状态；
- 报告数据；
- 动效状态机。

不要把整张页面 PNG 切片后当网页。

## 3. 逐图映射

| 图片 | 对应路由/模块 | 开发用途 |
|---|---|---|
| `01-home-desktop.png` | `/` | 公共首页整体构图、红绿比例、首屏叙事 |
| `01-home-mobile.png` | `/` | 移动首屏、按钮顺序、路径纵向化 |
| `02-teacher-studio.png` | `/studio`, `/studio/[draftId]` | 结构树—编辑区—属性栏三栏工作台 |
| `03-teacher-assignments.png` | `/teacher/assignments` | 列表与关注面板，不用卡片墙 |
| `04-student-today-mobile.png` | `/student/today` | 今日路径、离线状态、单一主要 CTA |
| `05-assessment-reading.png` | 朗读测评 | 文本、录音机器区、设备流程 |
| `06-assessment-report.png` | 测评报告 | 证据、能力线、建议时间轴 |
| `07-teacher-review.png` | `/teacher/review` | 提交—证据—反馈三栏复核 |
| `08-components-buttons.png` | 组件与封面 | 沉浸式按钮、对象行、封面语言 |
| `09-motion-storyboard.png` | 全局交互 | 进入、定位、输入、处理、确认、移交 |

## 4. 背景资源使用

公共首页允许使用一张响应式主视觉背景，但必须拆成：

```text
背景色层
+ 地形线 SVG
+ 红色山脊 SVG
+ 绿色谷地 SVG
+ 金色太阳/路径节点
+ 声波 SVG 或 CSS
```

这样移动端、低带宽和 reduced-motion 可以分别裁切、关闭和替换。

功能页不得使用完整大背景图覆盖主要内容，只使用局部纹理或页首色带。

## 5. 按钮实现

`08-components-buttons.png` 中的按钮不是图片按钮。

必须实现为 HTML button/link：

- 可聚焦；
- 可读文本；
- disabled/loading/offline 状态；
- 轨迹、声波和节点使用 CSS/SVG；
- 动画不影响文本；
- reduced-motion 下静态显示；
- 不把文字烘焙到图片。

## 6. 课程封面

封面可以根据 Prompt 生成，但必须预留：

- 无文字版本；
- 4:5、16:9、1:1 裁切；
- 亮暗文字安全区；
- 低分辨率占位；
- 本地缓存；
- 资产登记。

课程名称由 HTML 渲染，通常不要生成在封面图片里。
