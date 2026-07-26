# MVP-CONTINUOUS-CONTROL-PLANE-001 Handoff

## 用户可观察结果

本任务没有修改业务页面。它把后续开发从“页面/接口分别完成”改成以 FeatureChain 为最小
单位的持续循环，并提供可执行的弹性调度、上下文恢复和独立证据门。

当前唯一 Goal 已冻结为：教师发布动态任务 → 学生新会话提交真实录音与答案 → 教师新会话
复核 → 报告/巩固/复测 → 同一集成 commit 的浏览器/API/DB/权限负向复验。

## 已实现

- `mvp-control.ps1`：init/register/tick/claim/context/heartbeat/emit/status；支持 DAG、能力匹配、
  写集/语义锁/容量、租约、fencing epoch、事件归并、独立 verifier、返工、集成接受与 Goal 重算；
- `test-mvp-control.ps1`：在独立临时 runtime 模拟安全并发、拒绝、返工、旧 epoch 拒收和上下文恢复；
- `goal.json`、DAG、scheduler policy、三类 Codex role、稳定 prompts；
- `context_manifest + SHA256 + 48 KiB hard limit + CONTEXT_ACK`；旧 docs/prompt 默认不自动加载；
- 文档生命周期、冲突优先级、反馈只改动态 ticket、Goal 变化需 authority revision；
- 独立 evidence manifest 语义校验器，拒绝 mock、固定 ID、demo token、静态截图和缺失 L3/L4/L5；
- 静态控件与运行时控件侦察脚本；当前静态结果为 79 页面/1882 控件/962 unresolved；
- 五条 P0 FeatureChain 基线，均诚实保持 `DISCOVERED/HANDLER_PRESENT`，未冒充已闭环。

## 首轮真实开发顺序

1. `P0-SEC-AUTH-DEMO-FALLBACK-REMOVAL`：移除登录假成功并做 fresh-context 负向；
2. `P0-DYNAMIC-ID-ROUTING-CLEANUP`：移除 `submission-1` 活动路由；
3. `P0-RUNTIME-IDEMPOTENT-STARTUP`：得到可重复的 canonical runtime；
4. 三项集成接受后，执行 `P0-TEACHER-STUDENT-ASSIGNMENT-CLOSURE-001`；
5. 再接录音处理/复核、报告/干预/复测；最后只在集成 commit 跑黄金链。

并发不固定：前三项可在 write set/资源不冲突且 Worker 能力满足时并行；共享数据库、canonical
runtime、integration writer 和黄金浏览器旅程始终串行。

## 验证

```powershell
& .\scripts\repo\test-mvp-control.ps1 -Mode all
git diff --check
```

结果：全部 PASS。模拟曾真实发现并修复 PowerShell ISO 时间反序列化造成的租约立即过期问题。

## 已知限制

- 当前控制器是同一 Windows 主机的 runtime-local + named mutex 版本；跨机器扩展需迁移到
  SQLite/Redis 等事务状态存储；
- App heartbeat/线程派发尚未启用；仓库脚本只生成 actions/work orders，不假装已启动常驻 Agent；
- 静态控件扫描不能证明点击有效；`scan_rendered_controls.py` 只做运行时侦察，真实功能关闭仍需
  journey + evidence manifest；
- 旧 docs 暂不物理移动，只做逻辑隔离。后续应先生成引用图，再单独归档确认废止材料；
- 当前任务只建立控制面，不代表任一业务 FeatureChain 已完成。

## 回滚

回退本任务提交即可移除 Git 中的控制面；`runtime-local/control-plane` 是忽略的本机状态，先备份
证据后可单独清理，不触碰业务数据。不要清理其他 worktree 或用户脏改动。
