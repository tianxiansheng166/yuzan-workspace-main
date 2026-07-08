#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
forbidden = [
    "site-polish.js",
    "yx-design-upgrade.css",
    "db/users.json",
    "two - 副本",
    "legacy/source-archives",
]
extensions = {".ts", ".tsx", ".js", ".mjs", ".cjs", ".vue", ".css", ".html"}
violations = []
for path in root.rglob("*"):
    if not path.is_file() or path.suffix.lower() not in extensions:
        continue
    text = path.read_text(encoding="utf-8", errors="ignore")
    for token in forbidden:
        if token in text:
            violations.append(f"{path.relative_to(root)} references forbidden legacy token: {token}")
if violations:
    print("\n".join(violations))
    sys.exit(1)
print("OK: no forbidden legacy runtime references")
