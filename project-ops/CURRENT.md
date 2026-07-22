# CURRENT: 中心恢复点

更新时间：2026-07-22

## 当前主项目

- 路径：`D:/program/test_program/yuzanxinsheng/three/yuzan-next`
- 治理分支：`task/gov-root-001`
- 提升前集成提交：`49b8277c3b8cd7572b7c087db0eb79dda3fc5c0b`
- 当前迁移提交：`ee8991e6ec08ad256d8c9707ffa63b52df0f39ef`
- GitHub：`git@github.com:tianxiansheng166/yuzan-workspace-main.git`
- 旧本地仓库：`../legacy-archive/root-before-p0-20260722/yuzan-next`

## 当前迁移状态

- 当前 `p0-integration` 已提升到标准主路径；
- 旧主仓库、旧 worker 和旧依赖均已保存在 `legacy-archive`；
- 新依赖已用 Node 24 和 pnpm 锁文件重建；
- Docker/环境配置已统一到主目录，既有 MinIO/Redis 可由新路径管理；
- 旧 worker 的未整合提交仍保留在各自归档 Git 仓库，尚未判定可删除；
- GitHub `main` 尚未更新，必须在验证和集成审核后快进。

## 已知阻塞与风险

- P0 worker 分支仍需补丁等价性审查；
- Web typecheck 在 `useRecordingUpload.ts:98` 的 nullable 参数处失败；
- worker 语音测试使用错误的 `../../src` 导入路径，测试套件未加载；
- 语音评分服务来自旧主仓库的未跟踪源码，已恢复并通过 `/health`，仍需正式代码审查；
- 当前 PostgreSQL 容器不由主 Compose 管理，接管前必须先备份数据卷；
- 旧空 `workers/p0-integration` 仍被当前会话占用；退出后运行归档中的一次性清理脚本。

## 下一恢复动作

1. 审核旧 P0 worker 的未整合提交，优先检查 `p0-tests`。
2. 修复 Web typecheck 和 worker 语音测试加载门禁。
3. 完成 `GOV-ROOT-001` 复核。
4. 由集成负责人决定 GitHub `main` 快进时间。
