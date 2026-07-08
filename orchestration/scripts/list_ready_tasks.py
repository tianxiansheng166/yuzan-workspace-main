#!/usr/bin/env python3
import csv
from pathlib import Path

board = Path(__file__).resolve().parents[1] / "task-board.csv"
with board.open(encoding="utf-8-sig") as f:
    rows = list(csv.DictReader(f))
for row in rows:
    if row["status"] == "READY":
        print(f'{row["id"]}: {row["title"]}')
        print(f'  role: {row["recommended_role"]}')
        print(f'  branch: {row["branch"]}')
        print(f'  paths: {row["allowed_paths"]}')
