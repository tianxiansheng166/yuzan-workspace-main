#!/usr/bin/env python3
from pathlib import Path
import re, sys

root = Path(__file__).resolve().parents[1] / "apps" / "web"
patterns = {
    "emoji UI": re.compile(r"[\U0001F300-\U0001FAFF]"),
    "runtime DOM patch": re.compile(r"(document\.querySelector|innerHTML\s*=)"),
}
violations = []
for path in root.rglob("*"):
    if not path.is_file() or path.suffix not in {".vue", ".ts", ".css"}:
        continue
    text = path.read_text(encoding="utf-8", errors="ignore")
    for label, pattern in patterns.items():
        if pattern.search(text):
            violations.append(f"{path.relative_to(root)}: {label}")
if violations:
    print("Review required:")
    print("\n".join(violations))
    sys.exit(1)
print("OK: no simple UI antipattern matches")
