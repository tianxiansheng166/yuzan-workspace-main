# Goal：修复普通课程提交任务的证据与交付真实性

```text
你负责恢复并收好现有任务 P0-STUDENT-COURSE-SUBMIT-001。不要创建新分支，不要
重做已经存在的实现；只有证据证明业务缺陷时才用新提交修复代码。

目标 worktree：
D:/program/test_program/yuzanxinsheng/three/worktrees/P0-STUDENT-COURSE-SUBMIT-001

目标分支：
task/p0-student-course-submit-001

权威控制面固定为：
D:/program/test_program/yuzanxinsheng/three/worktrees/p0-multitrack-integration-001

先确认该 worktree 的 HEAD 等于 origin/integration/p0-multitrack-001，再运行：
& D:/program/test_program/yuzanxinsheng/three/worktrees/p0-multitrack-integration-001/project-ops/scripts/resolve-multitrack-task.ps1 `
  -TaskId P0-STUDENT-COURSE-SUBMIT-001 -CreateWorktree
只使用脚本返回的完整 base_commit；若 acceptance、远端 HEAD 或 dispatch 不成立就
停止，不以本提示词中的历史快照覆盖控制面。

已核实现状：
- base 是 ca14c57f0534e4e8ddf3e273128668b6c12e685e；
- local HEAD 是 3182ced6bcf7574d20b72be5f6e27529baacdf03；
- remote HEAD 是 1fe5e94a8a49fd26089ed1a7dae4023512994ca8；
- task/handoff 仍自称已完成并与远端一致；
- evidence 只有两个简短 JSON，没有提交可复跑 E2E/DB 脚本和三尺寸截图；
- SPEECH 证据使用 API-level linkRecording，不是真实浏览器录音；
- DB 证据使用已知 seed ID，未证明真实音频 bytes/objectKey/duration。

第一条命令运行：
& .\scripts\repo\task-context.ps1 -Mode auto

立即把 task status 恢复为 IN_PROGRESS，并在 handoff 记录本地/远端差异。保留现有
提交，不 reset、不 rebase、不删除实现。

本任务在 Wave 0 只拥有课程核心和 evidence 修复，不拥有共享 OpenAPI。若真实证据
暴露的代码缺陷必须修改 packages/contracts/openapi/openapi.yaml 或公共 API client，
先记录 BLOCKED，等待 P0-AI-TOOL-CONTRACTS-001 释放共享锁或由 Integration Lead
明确重新指派 owner；不得与另一个 Goal 并发覆盖。

唯一结果：
真实登录学生动态发现一门普通课程，完成 TEXT/AUDIO/CHOICE/FILL_BLANK/SPEECH
活动；SPEECH 使用浏览器 MediaRecorder 和受控 fake-media-device 产生非空音频；
笔记/活动进度刷新可恢复；使用服务端当前 revision 提交课程；新浏览器上下文仍为
已提交/完成。

必须提交到 evidence 目录的可复跑脚本：
- 浏览器 E2E；
- API/数据库交叉核验；
- 运行说明；
- 1440、1024、390 关键截图；
- browser-result.json、database-result.json。

所有 schoolId/enrollmentId/assignmentId/submissionId/activityId/recordingId 必须从
当前登录/API 动态发现。证明录音 bytes > 0、objectKey、duration、活动绑定和课程
提交 revision；不得用 API link、空 Blob、固定 UUID 或直接写数据库冒充浏览器。

必须故障注入并证明：
- 旧 revision 409 后重新读取；
- 上传或绑定失败不显示完成；
- 提交重试幂等；
- 另一学生/学校不能读写；
- console/page/request/HTTP 错误为 0 或逐项解释。

运行 task JSON 中所有 focused tests、OpenAPI validation、typecheck/build 和真实
E2E。不要把既有全 API lint 基线问题写成本任务失败，但要原样记录。

完成时更新 task test_evidence、handoff 和 status=READY_FOR_REVIEW；先 review，
提交新修复/证据，再 finish。随后推送同一任务分支并比较本地/远端完整 HEAD。
git status --porcelain 必须无输出。不要合并 main/integration。

最终只报告：真实用户结果、实际测试数量、证据路径、最终 branch/commit/remote、
已知限制。缺少任何正式证据时不得声称完成。
```
