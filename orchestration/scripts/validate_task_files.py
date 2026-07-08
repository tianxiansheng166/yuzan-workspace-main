#!/usr/bin/env python3
import csv, json, sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
with (root / "task-board.csv").open(encoding="utf-8-sig") as f:
    board = {r["id"]: r for r in csv.DictReader(f)}
errors = []
for task_file in (root / "tasks").glob("*.json"):
    try:
        task = json.loads(task_file.read_text(encoding="utf-8"))
    except Exception as e:
        errors.append(f"{task_file.name}: invalid JSON: {e}")
        continue
    if task["id"] not in board:
        errors.append(f'{task["id"]}: not in board')
    for dep in task.get("depends_on", []):
        if dep not in board:
            errors.append(f'{task["id"]}: unknown dependency {dep}')
    if not task.get("allowed_paths"):
        errors.append(f'{task["id"]}: no allowed_paths')
missing = set(board) - {p.stem for p in (root / "tasks").glob("*.json")}
for item in sorted(missing):
    errors.append(f"{item}: missing task JSON")
if errors:
    print("\n".join(errors))
    sys.exit(1)
print(f"OK: {len(board)} task records validated")
