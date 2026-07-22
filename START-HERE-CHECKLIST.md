# 开工检查清单

## 项目入口

- [ ] 当前路径是 `three/yuzan-next`。
- [ ] 已阅读 `README-FIRST.md`、`PROJECT-CHARTER.md` 和 `project-ops/CURRENT.md`。
- [ ] 已领取 `project-ops/tasks/active/` 中的任务 JSON。
- [ ] 已确认 `base_commit`、依赖、允许路径和共享文件 owner。

## 工作区

- [ ] 功能开发位于 `three/worktrees/<task-id>`，不在 `main` 直接开发。
- [ ] 没有从 `legacy-archive` 启动或修改旧项目。
- [ ] 没有创建新的完整 worker clone。
- [ ] 当前 worktree 在开工前无未知未提交变化。

## 本地环境

- [ ] Node 版本为 24–26，pnpm 为 10。
- [ ] `.env` 来自当前 `.env.example`，真实密钥未进入 Git。
- [ ] PostgreSQL、Redis、MinIO 端口与 `project-ops/runbooks/LOCAL-RUNTIME.md` 一致。
- [ ] 任务需要 Flowise 或语音服务时，已检查对应嵌套配置和健康端点。

## 交付

- [ ] 只修改 `allowed_paths`。
- [ ] 实际运行并记录相关测试；失败结果同样记录。
- [ ] 覆盖适用的异常、离线和权限状态。
- [ ] UI 任务完成 1440、1024、390 截图。
- [ ] 填写 handoff、迁移/回滚和已知限制。
- [ ] 集成负责人验收后更新 `project-ops/CURRENT.md`。
