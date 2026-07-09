# 与旧项目并置使用

解压后建议目录：

```text
workspace/
├─ 语赞心声-yuzan-next-并发开发工作区-v2.0/
│  ├─ yuzan-next/                 新项目 Git 仓库
│  ├─ legacy/                     旧项目只读压缩档案
│  ├─ docs/
│  └─ orchestration/
└─ old-project-readonly/          可选：你自己解压的旧项目副本
```

## 规则

- 只在 `yuzan-next/` 初始化 Git 和写生产代码。
- 旧项目副本设为只读，避免 AI “顺手修旧文件”。
- 迁移工具只能从环境变量 `LEGACY_SOURCE_DIR` 读取旧路径。
- 新代码不得 import、fetch 或静态引用旧项目路径。
- 旧项目用于阅读课程与内容、对照用户流程、视觉前后对比和生成迁移输入。
- 旧项目不用于运行时数据库、生产认证、直接复制页面或继续维护 DOM 修补脚本。

## Windows 示例

```powershell
cd .\语赞心声-yuzan-next-并发开发工作区-v2.0\yuzan-next
git init
git add .
git commit -m "chore: initialize yuzan-next baseline"
Copy-Item .env.example .env
docker compose up -d postgres minio
corepack enable
pnpm install
```

然后由 Integration Lead 解锁 `GOV-001`，实际验证命令并生成 lockfile。
