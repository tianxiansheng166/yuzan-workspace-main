# Goal：多路线审查、集成、硬化与收尾

```text
你是 P0-MULTITRACK-INTEGRATION-001 的 Integration Lead。只集成已经 finish、推送、
远端 HEAD 一致且 reviewer 无阻断 findings 的任务。不要替任务 owner 补造证据。

先读取：
- project-ops/multitrack-tasks.json
- project-ops/accepted-baselines.json
- project-ops/MULTITRACK-BOARD.md
- project-ops/runbooks/MULTITRACK-INTEGRATION.md
- project-ops/prompts/REVIEW-PROMPT.md
- 各 task JSON/handoff/evidence

只读核实 canonical、remote、所有目标 branch HEAD、worktree status。保留任何脏
工作，不在 canonical 直接合并。创建或恢复唯一
integration/p0-multitrack-001 worktree。若这是一次性 bootstrap，必须先完成规划
分支 review/finish/push，使用其远端完整 HEAD 创建 control branch，再只在 control
branch 接受规划任务、设 status=ACTIVE、登记初始 checkpoint 并推送。若控制分支
已经存在，则 origin/integration/p0-multitrack-001 是 registry、accepted baselines
和看板的唯一事实，不得改从规划 task branch 读取。

每个任务先按 project-ops/prompts/REVIEW-PROMPT.md 独立审查 base...HEAD、未提交
差异、allowed paths、CCR、权限、假成功、证据可复跑性和回滚。P0/P1 finding
退回任务分支以新提交修复。

合并顺序：
1. P0-AI-TOOL-CONTRACTS-001；
2. P0-STUDENT-COURSE-SUBMIT-001；
3. P0-STUDENT-INDEPENDENT-PRACTICE-001；
4. P0-TEACHER-AI-LESSON-PLAN-001；
5. P0-TIBETAN-TRANSLATION-TOOL-001；
6. P0-STUDENT-COURSE-VIDEO-PROGRESS-001；
7. P0-STUDENT-COURSE-VIDEO-NOTE-001；
8. 满足依赖时再合 P1-TIBETAN-BILINGUAL-COURSE-001。

实际只合本轮已就绪子集，但不得改变相对依赖顺序。使用非快进 merge commit，冲突
时停止判断 owner，不全选 ours/theirs，不重写共享历史。

你是持续控制面，不是最后一次性收尾任务。Contracts 与 Course Submit 均接受后立刻
按 rank 合入并生成同时包含二者的 checkpoint，登记并推送后才解锁 Video Progress。
Translation Tool 与 Video Note 均进入同一 checkpoint 后才解锁 Bilingual。所有
dispatch-ready 依赖必须在 accepted-baselines 中，且 recorded commit 等于远端 task
branch HEAD；evidence_status 不能替代 acceptance。

每合一个任务跑 focused tests、相关 contract/schema validate 和一条 live smoke。
每合 2–3 个任务进入硬化窗口：Node/pnpm、OpenAPI、Prisma、API/worker/frontend
typecheck/build/tests、登录与三条泳道 smoke、1440/1024/390、console/page/network
审计。失败用新的 integration repair task/commit，不能把任务 JSON 改绿。

最终动态 E2E 必须证明：
- 学生课程/练习持久化；
- 教师真实 AI 草稿→修改→批准；
- 藏汉真实机器结果→人工修订→批准；
- provider unavailable 没有假结果；
- 网页双语如已合入，只消费 APPROVED 且不阻塞原文。

完成后更新 accepted-baselines、CURRENT、MULTITRACK-BOARD、registry 的
integration_status、current_checkpoint_commit 和集成 handoff；运行全套集成验证、review prompt 与
git diff --check，提交并推送 integration branch，核对 remote HEAD 和 Git clean。
integration 分支不是普通 active task，不伪用 task-gate。没有用户明确授权不得
合并 main、部署或删除其他 worktree。
```
