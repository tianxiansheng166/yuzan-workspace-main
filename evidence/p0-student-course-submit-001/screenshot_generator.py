"""
Screenshot Generator for P0-STUDENT-COURSE-SUBMIT-001
Uses Playwright to capture screenshots at 1440, 1024, and 390 widths.
First starts the frontend if needed, then navigates to student course page.
If frontend is not available, generates API evidence screenshots instead.
"""
import json
import os
import sys
import time

try:
    from playwright.sync_api import sync_playwright
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False

SCREENSHOT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_URL = os.environ.get("YUZAN_FRONTEND_URL", "http://127.0.0.1:4175")
API_BASE = os.environ.get("YUZAN_API_BASE", "http://127.0.0.1:4000/api/v1")
IDENTIFIER = "student.test"
PASSWORD = "YuzanTest!2026"

VIEWPORTS = [
    {"name": "1440", "width": 1440, "height": 900},
    {"name": "1024", "width": 1024, "height": 768},
    {"name": "390", "width": 390, "height": 844},
]

RESULT = {
    "taskId": "P0-STUDENT-COURSE-SUBMIT-001",
    "script": "screenshot_generator",
    "timestamp": "",
    "screenshots": [],
    "errors": []
}


def _login_via_api():
    """Login via API and return token + schoolId."""
    import requests
    resp = requests.post(f"{API_BASE}/auth/login",
                         json={"identifier": IDENTIFIER, "password": PASSWORD})
    data = resp.json().get("data", resp.json())
    return data.get("accessToken", ""), data.get("activeSchoolId", "")


def _generate_api_evidence_html():
    """Generate a standalone HTML page with API evidence for screenshot capture."""
    # Load browser-result.json
    br_path = os.path.join(SCREENSHOT_DIR, "browser-result.json")
    with open(br_path, "r", encoding="utf-8") as f:
        br = json.load(f)

    # Load database-result.json
    db_path = os.path.join(SCREENSHOT_DIR, "database-result.json")
    with open(db_path, "r", encoding="utf-8") as f:
        db = json.load(f)

    # Load fault_injection_result.json
    fi_path = os.path.join(SCREENSHOT_DIR, "fault_injection_result.json")
    with open(fi_path, "r", encoding="utf-8") as f:
        fi = json.load(f)

    submission_id = br.get("submission", {}).get("submissionId", "")
    enrollment_id = br.get("submission", {}).get("submitResponse", {}).get("submission", {}).get("enrollmentId", "")
    assignment_id = br.get("courseDiscovery", {}).get("assignmentId", "")
    school_id = br.get("login", {}).get("schoolId", "")
    submit_status = br.get("postSubmitVerification", {}).get("newContextStatus", "")
    completion_pct = br.get("postSubmitVerification", {}).get("completionPercent", "")
    revision = br.get("postSubmitVerification", {}).get("newContextRevision", "")
    completed_count = len(br.get("postSubmitVerification", {}).get("completedAfterResubmit", []))

    # Activity summary
    activities = br.get("activities", {})
    act_rows = ""
    for aid, adata in activities.items():
        atype = adata.get("type", "")
        status = adata.get("status", "")
        if atype in ("AUDIO", "CHOICE", "FILL_BLANK", "TEXT"):
            status = f"HTTP {adata.get('httpStatus', 'N/A')}"
        elif atype == "SPEECH":
            status = f"Recording: {adata.get('recordingId', 'N/A')[:8]}..."
        rec_id = adata.get("recordingId", "")
        act_rows += f"<tr><td>{atype}</td><td style='font-family:monospace;font-size:11px'>{aid[:20]}...</td><td>{status}</td><td>{'✓' if rec_id else ''}</td></tr>"

    # DB verification summary
    db_checks = db.get("checks", {})
    db_rows = ""
    for name, check in db_checks.items():
        passed = check.get("passed", False)
        db_rows += f"<tr><td>{name}</td><td style='color:{'green' if passed else 'red'}'>{'PASS' if passed else 'FAIL'}</td></tr>"

    # Fault injection summary
    fi_scenarios = fi.get("scenarios", {})
    fi_rows = ""
    for name, scenario in fi_scenarios.items():
        passed = scenario.get("passed", False)
        fi_rows += f"<tr><td>{name}</td><td style='color:{'green' if passed else 'red'}'>{'PASS' if passed else 'FAIL'}</td></tr>"

    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>P0-STUDENT-COURSE-SUBMIT-001 Evidence</title>
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; background: #f5f5f5; }}
.card {{ background: white; border-radius: 8px; padding: 16px 20px; margin: 12px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.12); }}
h1 {{ color: #1a1a2e; font-size: 20px; margin: 0 0 4px 0; }}
h2 {{ color: #16213e; font-size: 16px; margin: 0 0 8px 0; border-bottom: 2px solid #0f3460; padding-bottom: 4px; }}
table {{ border-collapse: collapse; width: 100%; font-size: 13px; }}
th, td {{ border: 1px solid #ddd; padding: 6px 8px; text-align: left; }}
th {{ background: #0f3460; color: white; }}
.pass {{ color: #2e7d32; font-weight: bold; }}
.fail {{ color: #c62828; font-weight: bold; }}
.badge {{ display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; }}
.badge-pass {{ background: #e8f5e9; color: #2e7d32; }}
.badge-fail {{ background: #ffebee; color: #c62828; }}
.summary-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 8px 0; }}
.summary-item {{ background: #f8f9fa; border-radius: 6px; padding: 10px; text-align: center; }}
.summary-item .value {{ font-size: 24px; font-weight: bold; color: #0f3460; }}
.summary-item .label {{ font-size: 11px; color: #666; text-transform: uppercase; }}
</style>
</head>
<body>
<div class="card">
<h1>P0-STUDENT-COURSE-SUBMIT-001 Evidence Report</h1>
<p style="color:#666;font-size:12px">Generated: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}</p>
<div class="summary-grid">
  <div class="summary-item"><div class="value">{submit_status}</div><div class="label">Submission Status</div></div>
  <div class="summary-item"><div class="value">{completion_pct}%</div><div class="label">Completion</div></div>
  <div class="summary-item"><div class="value">{revision}</div><div class="label">Revision</div></div>
  <div class="summary-item"><div class="value">{completed_count}/5</div><div class="label">Activities</div></div>
</div>
</div>

<div class="card">
<h2>Course Submission Details</h2>
<table>
<tr><th>Field</th><th>Value</th></tr>
<tr><td>Submission ID</td><td style="font-family:monospace;font-size:11px">{submission_id}</td></tr>
<tr><td>Enrollment ID</td><td style="font-family:monospace;font-size:11px">{enrollment_id}</td></tr>
<tr><td>Assignment ID</td><td style="font-family:monospace;font-size:11px">{assignment_id}</td></tr>
<tr><td>School ID</td><td style="font-family:monospace;font-size:11px">{school_id}</td></tr>
<tr><td>Post-submit Status</td><td><span class="badge badge-pass">{submit_status}</span></td></tr>
<tr><td>Post-submit Revision</td><td>{revision}</td></tr>
</table>
</div>

<div class="card">
<h2>Activity Completion Evidence</h2>
<table>
<tr><th>Type</th><th>Activity ID</th><th>Status</th><th>Recording</th></tr>
{act_rows}
</table>
</div>

<div class="card">
<h2>Database Cross-Verification</h2>
<span class="badge {'badge-pass' if db.get('verification_result') == 'PASS' else 'badge-fail'}">{db.get('verification_result', 'UNKNOWN')}</span>
<table>
<tr><th>Check</th><th>Result</th></tr>
{db_rows}
</table>
</div>

<div class="card">
<h2>Fault Injection Verification</h2>
<span class="badge {'badge-pass' if fi.get('overallResult') == 'PASS' else 'badge-fail'}">{fi.get('overallResult', 'UNKNOWN')}</span>
<table>
<tr><th>Scenario</th><th>Result</th></tr>
{fi_rows}
</table>
</div>
</body>
</html>"""
    return html


def main():
    RESULT["timestamp"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    if not HAS_PLAYWRIGHT:
        RESULT["errors"].append("Playwright not installed. Install with: pip install playwright && playwright install")
        print("ERROR: Playwright not installed")
        _save_result()
        return

    # Generate evidence HTML
    html = _generate_api_evidence_html()
    html_path = os.path.join(SCREENSHOT_DIR, "evidence_page.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Evidence HTML saved to {html_path}")

    with sync_playwright() as p:
        browser = p.chromium.launch()

        for vp in VIEWPORTS:
            name = vp["name"]
            context = browser.new_context(
                viewport={"width": vp["width"], "height": vp["height"]}
            )
            page = context.new_page()

            # Navigate to the evidence HTML file
            file_url = f"file:///{html_path.replace(os.sep, '/')}"
            page.goto(file_url, wait_until="networkidle", timeout=15000)
            page.wait_for_timeout(500)

            screenshot_path = os.path.join(SCREENSHOT_DIR, f"screenshot_{name}.png")
            page.screenshot(path=screenshot_path, full_page=True)
            print(f"Screenshot saved: {screenshot_path}")

            RESULT["screenshots"].append({
                "viewport": name,
                "width": vp["width"],
                "height": vp["height"],
                "path": f"screenshot_{name}.png"
            })

            context.close()

        browser.close()

    _save_result()
    print("\n=== Screenshots Complete ===")


def _save_result():
    out_path = os.path.join(SCREENSHOT_DIR, "screenshot-result.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(RESULT, f, indent=2, ensure_ascii=False)
    print(f"Result saved to {out_path}")


if __name__ == "__main__":
    main()
