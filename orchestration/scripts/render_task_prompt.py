#!/usr/bin/env python3
import json
import sys
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit("Usage: render_task_prompt.py TASK-ID")

root = Path(__file__).resolve().parents[1]
task_path = root / "tasks" / f"{sys.argv[1].upper()}.json"
task = json.loads(task_path.read_text(encoding="utf-8"))

lines = [
    "你正在参与语赞心声 yuzan-next 多 AI 并发开发。",
    "",
    f"任务：{task['id']} — {task['title']}",
    f"角色：{task['recommended_role']}",
    f"状态：{task['status']}",
    f"分支：{task['branch']}",
    f"worktree：{task['worktree']}",
    f"依赖：{', '.join(task['depends_on']) or '无'}",
    "",
    "目标：",
    task["objective"],
    "",
    "只允许修改：",
    *[f"- {p}" for p in task["allowed_paths"]],
    "",
    "验收：",
    *[f"- {a}" for a in task["acceptance_criteria"]],
    "",
    "开始前必须阅读：",
    *[f"- {p}" for p in task["required_reading"]],
    "",
    "严格遵循：",
    "- 不修改白名单外文件；",
    "- 不私自改变 OpenAPI、Prisma、设计 token 和根配置；",
    "- 有契约需求先提交 Contract Change Request；",
    "- 不用硬编码假数据冒充功能完成；",
    "- 功能必须覆盖权限、异常、失败恢复和测试；",
    "- UI 必须覆盖 loading/empty/error/offline/permission，并提供 1440/1024/390 截图；",
    "- 完成后填写 handoff 模板并列出真实执行的测试。",
    "",
    "现在先检查依赖和当前代码，输出实施计划、可能的契约冲突和需要人工确认的问题；不要立即大规模改动。",
]
print("\n".join(lines))
