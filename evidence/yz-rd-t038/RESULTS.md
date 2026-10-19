# YZ-RD-T038｜录音练习与模拟训练的醒目可见入口｜开发检查点

TASK_ID: YZ-RD-T038
STATUS: DEVELOPMENT_CHECKPOINT / NATIVE_E2E_PENDING
BASE: d2ed5c8ca7b01f6c955e23cae6a2a9202d815e49 (T036 verified student history)
BRANCH: feat/yz-rd-t038-speech-practice-exam-showcase

## 已实现
- 真实学生 `/student/practices/` 的练习目录上方突出三张能力入口：录音跟读与口语／机考式模拟练习／专项巩固训练，并给出本人的历史与正式报告路径。
- “口语”仅为授权已加载 `requiresRecording===true` 定义生成动态 `/student/practices/{id}/` 链接；尚无合格数据时通过现有 `requiresRecording=true` 服务端 facet 请求筛选，绝不假造口语练习。
- “模拟”复用真实 `catalogType=MOCK` 过滤，“专项”复用 `catalogType=SPECIALIZED`；页面明确注明非官方考试。
- 沿用已有 `data-tab` / `data-filter-key` 事件和 API 请求，不造第二套状态与伪结果；显示纯 CSS 波形和高原米白配色，390–1440 响应式。
- 本次不改学生历史来源与已有录音提交/报告服务端合同；仅改善用户实际看到的导览。

## 检查
- PASS: `node --test frontend/tests/assessment/*.test.mjs`: 92 PASS / 0 FAIL / 0 SKIP。
- PASS: T038 专项授权动态链接与服务器模式过滤：2 PASS。
- PASS: JS syntax, git diff --check。
- NOT_RUN: 真实 Chrome/NestJS/PG17/MinIO 新入口逐个点击及 4 视口截图，真实物理麦克风、学校试点；当前仅开发检查点。
- 不可宣称专家审核藏文字幕、官方考试认证或已校准语音自动评分。

## 安全
- 工作树独立于 T037、T034、T033 与受保护 T005；历史 L4 OPEN 未触碰；未运行 Docker/Compose/Worker。
- 后续需要专属原生浏览器+API+PG E2E 非跳过证明，方可验收与提议集成。
