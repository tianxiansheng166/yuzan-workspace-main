# YZ-RD-T037｜听·说·练·测特色首页｜开发检查点

TASK_ID: YZ-RD-T037
STATUS: DEVELOPMENT_CHECKPOINT / NATIVE_E2E_PENDING
BASE: b3a731bb32f404f4a55f4d4f56d265514d324d40 (T033 integrated branch; known full API lint debt remains)
BRANCH: feat/yz-rd-t037-listen-speak-practice-exam-home

## 已实现
- 学生 Today 第一屏紧接欢迎区出现“听·说·练·测”四张可导航、代码绘制的特色卡片，保留原“今日优先任务”、恢复进度与老师布置作业。
- “说”只在已授权 PracticeDefinition 的 `requiresRecording===true` 时直达动态定义 ID，否则显示真实未开放状态并链接练习清单。
- “听”只在真实返回 Course assignmentId 时直达课程详情，否则链接课程中心并说明未开放／尚未确认。
- “测”依照已授权 Today BASELINE 实际 definitionId 链到练习详情，否则进入测评与练习清单，绝不虚构正式考试。
- “评”只在 Today 服务端提供有限数值的正式分数时引导成长报告；真正 0 分保留，null／缺分绝不当成0分。
- CSS 以高原纸张底色、清晰字阶与手工波形标识四步；390/768 宽度使用两列响应式布局；无自动炫光动画、键盘焦点可见。

## 检查
- PASS: `node --test frontend/tests/assessment/*.test.mjs`: 119 PASS / 0 FAIL / 0 SKIP。
- PASS: T037 专项数据派生／安全转义／动态地址／0 与 null 区别：4 PASS。
- PASS: JS syntax, git diff --check。
- NOT_RUN: 真实 Chromium + NestJS API + PostgreSQL + MinIO 端到端动态点击、4 视口实际截图、物理麦克风和真实学校试点；本检查点不是正式验收。
- 遗留：T033 API 全量 lint 已知 1201 errors/1 warning，T037 不修改后端，不声称解除该质量债务。

## 安全
- 不触碰 T005 原脏工作树及资源、T034 教师端、T036 History、T038 练习中心或历史 L4 事故。
- 本次不启动、不停止任何其他研发线进程／数据库；No Docker/Compose/P1SIM。
- 独立分支提交推送后仍 NOT_SHARED_MERGED，下一步由任务执行者用独占原生运行时完成可点击真实业务 E2E。
