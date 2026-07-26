# P0-SPEECH-ASSESSMENT-CLOSURE-002 Handoff

- Owner: Codex Task Owner
- Reviewer: Integration Lead
- Branch: `task/p0-speech-assessment-closure-002`
- Base commit: `25b774a413bedb446c010be7a9918555ec697237`
- Status: `READY_FOR_REVIEW`

## 用户结果

学生录音完成后会使用服务端 AssessmentItem 的标准文本创建真实 SpeechJob，Worker
调用本机 FunASR 完成识别和多维评分，并将真实结果或明确的待教师复核状态写回题目、
报告和测评历史。旧数据中已经 COMPLETE、但漏建 SpeechJob 的录音可通过幂等完成接口
恢复，不会重复上传或重复制造有效任务。

本次对现有两条 MinIO 录音进行了真实恢复。第一条被识别为“一七。”，评分 6；第二条
为静音，评分 0。两条均如实进入 `NEEDS_REVIEW`，没有伪造成高分。Session 已从
`PROCESSING` 进入 `COMPLETED`，生成 overallScore 3 的真实 AssessmentReport，因此
正式历史查询不再为空。

## 实现范围

- 前端统一解析 `targetText/text/sentence/stimulus`，修复真实题目使用
  `prompt.targetText` 时未触发评分的问题。
- 完成接口从数据库读取归属当前学校和学生的标准文本，不信任客户端传入文本。
- COMPLETE/PROCESSING/READY 录音允许幂等恢复缺失 SpeechJob。
- SpeechJob 复用既有非 FAILED 任务，并使用确定性 BullMQ job id 防重复调度。
- 处理页自动检测旧录音缺失任务并恢复，轮询全部口语题；全部终态后重读 Session/报告。
- 主启动脚本启动或复用健康的 8100 语音服务，并只清理由本次脚本拥有的进程。
- FastAPI 保留显式 HTTP 错误状态；新增健康和 provider-unavailable 最小契约测试。

## 实际验证

| 检查 | 结果 |
|---|---|
| API typecheck | PASS |
| Recording/SpeechJob focused tests | PASS，28/28 |
| Worker speech consumer | PASS，8/8 |
| Speech scoring pytest | PASS，2/2 |
| Full workspace typecheck | PASS，6/6 projects |
| Full workspace build | PASS，6/6 projects |
| Frontend runtime verification | PASS |
| Real FunASR + MinIO + BullMQ + API + DB | PASS，2 jobs terminal，1 report，session COMPLETED |
| Playwright history/report | PASS，待教师复核与总分 3 可见，console/page/request errors 0 |

数据库证据：

- `evidence/p0-speech-assessment-closure-002/database-result.json`
- `evidence/p0-speech-assessment-closure-002/browser-result.json`
- `evidence/p0-speech-assessment-closure-002/01-history-1440.png`
- `evidence/p0-speech-assessment-closure-002/02-report-1440.png`

## 状态与安全

- 未启用 `MOCK_SPEECH_SCORING`，没有写入固定 transcript 或静态成绩。
- 一条录音主要为无关短音频，另一条为静音；因此 `NEEDS_REVIEW` 是当前真实结果，
  不是服务故障。教师复核仍然必要。
- 标准朗读文本从服务端题目读取，跨学生或跨学校 item 会被拒绝。
- 没有 Prisma migration，也没有删除或覆盖原录音。
- 用户提供的 AI key 仅位于主目录 gitignored 本地 provider 文件，未进入本任务 diff、
  日志或证据；教案和藏文翻译 provider 接入不属于本语音任务。

## 集成后浏览器复验

1. 将任务分支合入 `integration/p0-multitrack-001`，完成集成检查后提升到 `main`。
2. 只从主目录运行 `scripts/local-runtime/start-main.ps1`；确认 4175、4000、8100 健康。
3. 使用真实学生会话访问该 Session 的 processing/report 与 `/assessment/history`。
4. 确认页面显示待教师复核、报告总分 3、历史条目可见，且 console/page/request 错误为 0。

## 回滚

Revert 本任务提交即可恢复旧的创建与启动行为。已生成的 SpeechJob、题目 autoResult、
AssessmentReport 和 Session COMPLETED 是真实审计数据，不应随代码回滚删除。
