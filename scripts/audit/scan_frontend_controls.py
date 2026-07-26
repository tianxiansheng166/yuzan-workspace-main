from __future__ import annotations

import argparse
import json
import re
import subprocess
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


ACTION_TAGS = {"button", "a", "select", "textarea"}
ACTION_INPUT_TYPES = {"button", "submit", "reset", "checkbox", "radio", "file", "image"}
API_PATTERN = re.compile(r"(?:['\"])(/api/v\d+/[^'\"?#\s]*)")
RISK_PATTERNS = {
    "FIXED_SUBMISSION_ID": re.compile(r"submission-1", re.I),
    "DEMO_TOKEN": re.compile(r"demo-token", re.I),
    "DEMO_FALLBACK": re.compile(r"演示模式|演示数据|demo\s*(?:mode|fallback)", re.I),
    "DIRECT_FETCH": re.compile(r"\bfetch\s*\("),
}


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()[:160]


@dataclass
class Control:
    tag: str
    attrs: dict[str, str]
    line: int
    text: list[str] = field(default_factory=list)

    def as_dict(self, scripts_text: str) -> dict[str, Any]:
        control_id = self.attrs.get("id", "")
        classes = [item for item in self.attrs.get("class", "").split() if item]
        data_action = self.attrs.get("data-action", "")
        onclick = self.attrs.get("onclick", "")
        href = self.attrs.get("href", "")
        label = clean_text(" ".join(self.text)) or self.attrs.get("aria-label", "") or self.attrs.get("title", "")
        selectors = []
        if control_id:
            selectors.append("#" + control_id)
        selectors.extend("." + item for item in classes[:3])
        if data_action:
            selectors.append(f'[data-action="{data_action}"]')

        handler_signals = []
        if onclick:
            handler_signals.append("inline-onclick")
        if control_id and re.search(rf"(?:getElementById\s*\(\s*['\"]{re.escape(control_id)}['\"]|#{re.escape(control_id)}\b)", scripts_text):
            handler_signals.append("id-reference")
        if data_action and data_action in scripts_text:
            handler_signals.append("data-action-reference")
        for class_name in classes:
            if re.search(rf"\.{re.escape(class_name)}\b", scripts_text):
                handler_signals.append("class-reference")
                break

        internal_href = bool(href and not href.startswith(("#", "javascript:", "http://", "https://", "mailto:", "tel:")))
        if handler_signals:
            static_status = "HANDLER_REFERENCE_PRESENT"
        elif self.tag == "a" and internal_href:
            static_status = "STATIC_NAVIGATION"
        else:
            static_status = "UNRESOLVED_CONTROL"

        return {
            "tag": self.tag,
            "line": self.line,
            "id": control_id or None,
            "classes": classes,
            "label": label or None,
            "type": self.attrs.get("type"),
            "href": href or None,
            "role": self.attrs.get("role"),
            "data_action": data_action or None,
            "selector_candidates": selectors,
            "handler_signals": sorted(set(handler_signals)),
            "static_status": static_status,
        }


class ControlParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.controls: list[Control] = []
        self.capture_stack: list[int] = []
        self.scripts: list[str] = []
        self.inline_scripts: list[str] = []
        self.in_script = False

    def handle_starttag(self, tag: str, attrs_list: list[tuple[str, str | None]]) -> None:
        attrs = {key: value or "" for key, value in attrs_list}
        if tag == "script":
            if attrs.get("src"):
                self.scripts.append(attrs["src"])
            self.in_script = not bool(attrs.get("src"))

        input_action = tag == "input" and attrs.get("type", "text").lower() in ACTION_INPUT_TYPES
        role_action = attrs.get("role") in {"button", "link", "menuitem", "tab"}
        card_action = "card" in attrs.get("class", "").lower() and any(
            key in attrs for key in ("onclick", "data-action", "data-href", "tabindex")
        )
        explicit_action = any(key in attrs for key in ("onclick", "data-action"))
        if tag in ACTION_TAGS or input_action or role_action or card_action or explicit_action:
            self.controls.append(Control(tag=tag, attrs=attrs, line=self.getpos()[0]))
            self.capture_stack.append(len(self.controls) - 1)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script":
            self.in_script = False
        if self.capture_stack and self.controls[self.capture_stack[-1]].tag == tag:
            self.capture_stack.pop()

    def handle_data(self, data: str) -> None:
        if self.in_script:
            self.inline_scripts.append(data)
        if self.capture_stack and clean_text(data):
            self.controls[self.capture_stack[-1]].text.append(data)


def resolve_script(html_file: Path, frontend_root: Path, src: str) -> Path | None:
    src = src.split("?", 1)[0].split("#", 1)[0]
    if not src or src.startswith(("http://", "https://", "//")):
        return None
    if src.startswith("/"):
        candidate = frontend_root / src.lstrip("/")
    else:
        candidate = html_file.parent / src
    try:
        candidate = candidate.resolve()
        candidate.relative_to(frontend_root.resolve())
    except (ValueError, OSError):
        return None
    return candidate if candidate.is_file() else None


def route_guess(html_file: Path, frontend_root: Path) -> str:
    relative = html_file.relative_to(frontend_root).as_posix()
    if relative == "index.html":
        return "/"
    if relative.endswith("/index.html"):
        return "/" + relative[: -len("/index.html")]
    return "/" + relative


def git_head(repo_root: Path) -> str:
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"], cwd=repo_root, text=True, capture_output=True, check=True
    )
    return result.stdout.strip()


def scan(repo_root: Path) -> dict[str, Any]:
    frontend_root = repo_root / "frontend"
    pages = []
    totals = {"pages": 0, "controls": 0, "unresolved": 0, "handler_reference": 0, "navigation": 0}
    risk_totals: dict[str, int] = {}

    for html_file in sorted(frontend_root.rglob("*.html")):
        if any(part in {"node_modules", "dist", "build", "evidence"} for part in html_file.parts):
            continue
        source = html_file.read_text(encoding="utf-8", errors="replace")
        parser = ControlParser()
        parser.feed(source)

        script_files = []
        scripts_text_parts = list(parser.inline_scripts)
        for src in parser.scripts:
            resolved = resolve_script(html_file, frontend_root, src)
            if resolved:
                script_files.append(resolved.relative_to(repo_root).as_posix())
                scripts_text_parts.append(resolved.read_text(encoding="utf-8", errors="replace"))
        for conventional in ("app.js", "index.js", "login.js"):
            candidate = html_file.parent / conventional
            if candidate.is_file() and candidate.relative_to(repo_root).as_posix() not in script_files:
                script_files.append(candidate.relative_to(repo_root).as_posix())
                scripts_text_parts.append(candidate.read_text(encoding="utf-8", errors="replace"))
        scripts_text = "\n".join(scripts_text_parts)
        combined = source + "\n" + scripts_text

        controls = [control.as_dict(scripts_text) for control in parser.controls]
        endpoints = sorted(set(API_PATTERN.findall(combined)))
        risks = sorted(name for name, pattern in RISK_PATTERNS.items() if pattern.search(combined))
        for risk in risks:
            risk_totals[risk] = risk_totals.get(risk, 0) + 1

        status_counts: dict[str, int] = {}
        for control in controls:
            status = control["static_status"]
            status_counts[status] = status_counts.get(status, 0) + 1
        totals["pages"] += 1
        totals["controls"] += len(controls)
        totals["unresolved"] += status_counts.get("UNRESOLVED_CONTROL", 0)
        totals["handler_reference"] += status_counts.get("HANDLER_REFERENCE_PRESENT", 0)
        totals["navigation"] += status_counts.get("STATIC_NAVIGATION", 0)

        pages.append(
            {
                "source": html_file.relative_to(repo_root).as_posix(),
                "route_guess": route_guess(html_file, frontend_root),
                "script_files": script_files,
                "control_count": len(controls),
                "control_status_counts": status_counts,
                "page_api_references": endpoints,
                "risk_flags": risks,
                "controls": controls,
                "static_limit": "源码关联不证明真实点击、请求、持久化或跨角色可见",
            }
        )

    return {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_commit": git_head(repo_root),
        "frontend_root": "frontend",
        "totals": totals,
        "risk_page_counts": risk_totals,
        "pages": pages,
    }


def write_markdown(report: dict[str, Any], output: Path) -> None:
    totals = report["totals"]
    lines = [
        "# 前端控件静态盘点",
        "",
        f"- Source commit: `{report['source_commit']}`",
        f"- Pages: {totals['pages']}",
        f"- Controls: {totals['controls']}",
        f"- Unresolved controls: {totals['unresolved']}",
        f"- Handler references: {totals['handler_reference']}",
        f"- Static navigation: {totals['navigation']}",
        "",
        "> 本报告只做源码侦察，不把 handler/API 引用声明为功能完成。",
        "",
        "| Page | Controls | Unresolved | Handler refs | API refs | Risks |",
        "| --- | ---: | ---: | ---: | ---: | --- |",
    ]
    for page in sorted(report["pages"], key=lambda item: (-item["control_count"], item["source"])):
        counts = page["control_status_counts"]
        lines.append(
            f"| `{page['source']}` | {page['control_count']} | "
            f"{counts.get('UNRESOLVED_CONTROL', 0)} | {counts.get('HANDLER_REFERENCE_PRESENT', 0)} | "
            f"{len(page['page_api_references'])} | {', '.join(page['risk_flags']) or '-'} |"
        )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Inventory static frontend controls without claiming runtime completion.")
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--json", type=Path, required=True)
    parser.add_argument("--markdown", type=Path)
    args = parser.parse_args()

    report = scan(args.repo.resolve())
    args.json.parent.mkdir(parents=True, exist_ok=True)
    args.json.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.markdown:
        write_markdown(report, args.markdown)
    print(json.dumps(report["totals"], ensure_ascii=False))


if __name__ == "__main__":
    main()

