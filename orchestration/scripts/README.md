# 调度脚本

```bash
python list_ready_tasks.py
python validate_task_files.py
python render_task_prompt.py CUR-001
./bootstrap_worktree.sh CUR-001 /path/to/yuzan-next
```

Windows：

```powershell
python .\list_ready_tasks.py
python .\render_task_prompt.py CUR-001
.\bootstrap_worktree.ps1 -TaskId CUR-001 -Repo C:\path\to\yuzan-next
```

任务状态仍应由 Integration Lead 审核后修改，脚本不会自动决定依赖是否真正完成。
