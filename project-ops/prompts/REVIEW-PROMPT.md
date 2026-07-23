# AI 自审 / Reviewer 提示词

```text
审查 TASK_FILE=<project-ops/tasks/active/...json> 对应任务。

先运行 `scripts/repo/task-context.ps1 -Mode resume`，自动读取
AI-DEVELOPMENT-CONTRACT、TASK_FILE、context.required、handoff 和 Git 现场。检查
base_commit...HEAD、staged、unstaged、untracked 的全部差异，但不要修改代码。

按严重度报告可复现问题：
P0：会造成数据/安全损失、方向严重偏离或无法回滚；
P1：用户结果不成立、契约/权限错误、假成功、测试证据虚假；
P2：重要边界或失败状态缺失、白名单/交接/回滚不完整；
P3：不会阻断结果的清晰度或维护性问题。

必须回答：
1. 改动是否只推进声明的 P0 环节，有没有偷偷扩展非目标？
2. changed paths 是否全在 allowed_paths，共享事实与 CCR 是否齐全？
3. 是否复用现有模型/契约，是否存在固定 ID、静态业务数据或假成功？
4. tenant/resource/user scope 与相关失败状态是否 fail closed？
5. minimal_tests 是否直接覆盖改动和最高风险，证据是否真实可复跑？
6. 是否有密钥、真实学生数据、受限资产或敏感日志？
7. handoff 能否让陌生集成人员验证、回滚和按顺序合并？
8. 分支是否领先正确 base，finish 是否通过，Git 是否干净？

先列 findings（文件和行号、证据、影响、最小修复）；没有问题时明确写“无阻断
findings”，再列残余风险。不要用泛化建议代替具体证据。
```
