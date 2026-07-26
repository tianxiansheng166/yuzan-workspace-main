from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright


def load_routes(path: Path) -> list[str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return [str(item) for item in data]
    if isinstance(data, dict) and isinstance(data.get("routes"), list):
        return [str(item) for item in data["routes"]]
    raise ValueError("Routes file must be a JSON array or an object with a routes array")


def main() -> None:
    parser = argparse.ArgumentParser(description="Reconnaissance-only rendered control inventory.")
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--routes", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--timeout-ms", type=int, default=15000)
    args = parser.parse_args()

    report = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_url": args.base_url,
        "mode": "RECONNAISSANCE_ONLY_NO_CLICKS",
        "pages": [],
    }

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        for route in load_routes(args.routes):
            context = browser.new_context(viewport={"width": 390, "height": 844})
            page = context.new_page()
            console_errors: list[str] = []
            page_errors: list[str] = []
            request_failures: list[str] = []
            page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            page.on("requestfailed", lambda request: request_failures.append(f"{request.method} {request.url}"))
            url = urljoin(args.base_url.rstrip("/") + "/", route.lstrip("/"))
            entry = {"route": route, "url": url, "status": "UNKNOWN"}
            try:
                response = page.goto(url, wait_until="networkidle", timeout=args.timeout_ms)
                controls = page.locator(
                    "button, a, input[type=button], input[type=submit], input[type=checkbox], "
                    "input[type=radio], input[type=file], select, textarea, [role=button], [role=link], "
                    "[data-action], [onclick]"
                )
                items = []
                for index in range(controls.count()):
                    locator = controls.nth(index)
                    box = locator.bounding_box()
                    items.append(
                        {
                            "tag": locator.evaluate("el => el.tagName.toLowerCase()"),
                            "text": " ".join(locator.inner_text(timeout=1000).split())[:160],
                            "id": locator.get_attribute("id"),
                            "role": locator.get_attribute("role"),
                            "href": locator.get_attribute("href"),
                            "data_action": locator.get_attribute("data-action"),
                            "visible": locator.is_visible(),
                            "enabled": locator.is_enabled(),
                            "box": box,
                        }
                    )
                overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
                entry.update(
                    {
                        "status": "RENDERED",
                        "http_status": response.status if response else None,
                        "title": page.title(),
                        "final_url": page.url,
                        "controls": items,
                        "visible_controls": sum(1 for item in items if item["visible"]),
                        "horizontal_overflow_390": bool(overflow),
                        "console_errors": console_errors,
                        "page_errors": page_errors,
                        "request_failures": request_failures,
                        "runtime_limit": "侦察未点击控件，不能证明业务功能",
                    }
                )
            except Exception as exc:  # report the route failure instead of hiding it
                entry.update(
                    {
                        "status": "FAILED",
                        "error": str(exc),
                        "console_errors": console_errors,
                        "page_errors": page_errors,
                        "request_failures": request_failures,
                    }
                )
            finally:
                context.close()
            report["pages"].append(entry)
        browser.close()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"pages": len(report["pages"]), "failed": sum(1 for p in report["pages"] if p["status"] == "FAILED")}))


if __name__ == "__main__":
    main()

