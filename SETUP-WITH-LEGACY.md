# 旧项目隔离与恢复

当前目录布局：

```text
three/
├── yuzan-next/       # 唯一主项目
├── worktrees/        # 活动并发任务
└── legacy-archive/   # 旧项目、旧 worker、依赖和迁移证据
```

## 规则

- 只从 `yuzan-next` 创建 worktree 和运行正式开发命令。
- `legacy-archive` 默认只读，仅用于恢复、补丁差异和资产来源审计。
- 旧 worker 的提交必须经过 cherry/patch 等价性检查，不直接覆盖当前主目录。
- 旧 `.env` 只用于比较变量名和端口，不覆盖当前密钥。
- 旧 Docker volume 在完成备份和迁移说明前不删除。
- 需要恢复文件时，复制到任务 worktree，记录来源和哈希，再进入代码审查。

详细映射见 `project-ops/MIGRATION-MANIFEST-20260722.md`。
