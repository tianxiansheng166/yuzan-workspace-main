#!/usr/bin/env python3
"""Re-run the T109 task-card offline checks and save bounded result receipts."""

import json
import os
import re
import subprocess
import tarfile
import tempfile
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = Path(__file__).resolve().parent
LOG_DIR = EVIDENCE / "offline-verification"
BASE = "8974c2a7d5842bb20dbfcd091b63cac5674dcc32"


def parse_counts(output):
    taps = {}
    for key in ("tests", "pass", "fail", "skipped", "todo"):
        match = re.findall(rf"^(?:#|ℹ) {key} (\d+)\s*$", output, flags=re.M)
        if match:
            taps[key] = int(match[-1])
    vitest = re.findall(r"^\s*Tests\s+([\d,]+)\s+passed(?:\s*\|\s*([\d,]+)\s+skipped)?", output, flags=re.M)
    eslint = re.findall(r"(\d+) problems? \((\d+) errors?, (\d+) warnings?\)", output)
    ts_errors = len(re.findall(r"error TS\d+:", output))
    prettier_warns = len(re.findall(r"^\[warn\] ", output, flags=re.M))
    parser_errors = len(re.findall(r"(?:SyntaxError|Error): .*", output))
    lines = [line.strip() for line in output.splitlines() if line.strip()]
    return {
        "tap": taps or None,
        "vitest": ({"passed": int(vitest[-1][0].replace(",", "")), "skipped": int((vitest[-1][1] or "0").replace(",", ""))} if vitest else None),
        "eslint": ({"problems": int(eslint[-1][0]), "errors": int(eslint[-1][1]), "warnings": int(eslint[-1][2])} if eslint else None),
        "typescriptErrorCount": ts_errors,
        "prettierWarningLines": prettier_warns,
        "parserErrorLines": parser_errors,
        "tail": lines[-8:],
    }


def normalized_log(output):
    """Keep diagnostic text while removing whitespace rejected by git diff --check."""
    lines = [line.rstrip() for line in output.splitlines()]
    return "\n".join(lines).rstrip("\n") + ("\n" if lines else "")


def run_step(step_id, argv, cwd, env, expected_exit=0):
    started = time.monotonic()
    result = subprocess.run(argv, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    output = result.stdout
    log_path = LOG_DIR / f"{step_id}.txt"
    log_path.write_text(normalized_log(output), encoding="utf-8")
    accepted_exits = expected_exit if isinstance(expected_exit, (list, tuple)) else [expected_exit]
    status = (
        "UNEXPECTED_EXIT" if result.returncode not in accepted_exits else
        "BASELINE_DEBT" if any(code != 0 for code in accepted_exits) else
        "PASS"
    )
    row = {
        "id": step_id,
        "command": " ".join(argv),
        "cwd": str(cwd.relative_to(ROOT)) if cwd.is_relative_to(ROOT) else "<temporary exact-BASE archive>",
        "exitCode": result.returncode,
        "expectedExitCode": accepted_exits,
        "status": status,
        "durationSeconds": round(time.monotonic() - started, 3),
        "log": str(log_path.relative_to(ROOT)),
        "summary": parse_counts(output),
    }
    print(json.dumps({"step": step_id, "status": row["status"], "exitCode": row["exitCode"], "durationSeconds": row["durationSeconds"]}), flush=True)
    return row


def exact_base_prettier(prettier_bin, env):
    with tempfile.TemporaryDirectory(prefix="yz-rd-t109-base-format-") as temporary:
        temporary = Path(temporary)
        archive = temporary / "base.tar"
        base_root = temporary / "source"
        base_root.mkdir()
        with archive.open("wb") as output:
            subprocess.run(["git", "archive", BASE], cwd=ROOT, stdout=output, check=True)
        with tarfile.open(archive, "r") as tar:
            tar.extractall(base_root)
        return run_step("prettier-exact-t108-base", [str(prettier_bin), "--check", "."], base_root, env, expected_exit=[1, 2])


def main():
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    removed = []
    for key in ("DATABASE_URL", "DIRECT_URL", "QB_RUNTIME_DATABASE_URL", "TEST_DATABASE_URL", "DATABASE_TEST_URL"):
        if key in env:
            removed.append(key)
            env.pop(key)

    frontend_files = [
        "student/courses/courses.test.mjs",
        "student/courses/course-detail/course-api-adapter.test.mjs",
        "student/courses/course-detail/course-player-state.test.mjs",
        "student/courses/course-detail/course-practice-sync.test.mjs",
        "student/courses/course-detail/course-shell-visibility.test.mjs",
        "student/courses/course-detail/media-controller.test.mjs",
    ]
    media_files = [
        "student/courses/course-detail/media-controller.test.mjs",
        "student/courses/course-detail/course-player-state.test.mjs",
    ]
    frontend_cwd = ROOT / "frontend"
    api_cwd = ROOT / "backend/api"
    repo_node = ROOT / "node_modules/.bin"
    api_node = ROOT / "backend/api/node_modules/.bin"
    steps = []

    steps.append(run_step("frontend-node-tests", ["node", "--test"], frontend_cwd, env))
    steps.append(run_step("frontend-runtime-verifier", ["node", "scripts/verify-runtime.mjs"], frontend_cwd, env))
    steps.append(run_step("course-focused-34", ["node", "--test", *frontend_files], frontend_cwd, env))
    steps.append(run_step("media-player-22", ["node", "--test", *media_files], frontend_cwd, env))
    steps.append(run_step("t099-unanswered-10", ["node", "--test", "tests/assessment/t102-unanswered-submit.test.mjs"], frontend_cwd, env))
    steps.append(run_step("api-suite-db-urls-unset", [str(api_node / "vitest"), "run", "--passWithNoTests", "--pool=forks", "--poolOptions.forks.singleFork"], api_cwd, env))
    steps.append(run_step("api-source-typecheck", [str(api_node / "tsc"), "-p", "tsconfig.json", "--noEmit"], api_cwd, env))
    steps.append(run_step("frontend-package-typecheck", ["node", "--check", "server.mjs"], frontend_cwd, env))
    steps.append(run_step("frontend-runtime-typecheck", ["node", "--check", "scripts/verify-runtime.mjs"], frontend_cwd, env))
    steps.append(run_step("api-build", [str(api_node / "nest"), "build"], api_cwd, env))
    steps.append(run_step("api-eslint-baseline", [str(api_node / "eslint"), "src", "test"], api_cwd, env, expected_exit=1))
    steps.append(exact_base_prettier(repo_node / "prettier", env))
    steps.append(run_step("api-test-tsconfig-baseline", [str(api_node / "tsc"), "-p", "test/tsconfig.json", "--noEmit"], api_cwd, env, expected_exit=[1, 2]))
    steps.append(run_step("git-diff-check", ["git", "diff", "--check", BASE, "--"], ROOT, env))

    result = {
        "taskId": "YZ-RD-T109",
        "baseSourceSha": BASE,
        "productSourceDiffFromBase": subprocess.check_output(["git", "diff", "--name-only", BASE, "--", "backend", "frontend", "packages", "infra"], cwd=ROOT, text=True).splitlines(),
        "databaseUrlEnvironmentVariablesUnset": ["DATABASE_URL", "DIRECT_URL", "QB_RUNTIME_DATABASE_URL", "TEST_DATABASE_URL", "DATABASE_TEST_URL"],
        "databaseUrlVariablesRemovedFromInvoker": removed,
        "logNormalization": "Trailing whitespace and terminal blank lines are stripped from captured stdout; test and diagnostic lines are retained.",
        "allExpectedExitsObserved": all(step["status"] != "UNEXPECTED_EXIT" for step in steps),
        "baselineDebtSteps": [step["id"] for step in steps if step["status"] == "BASELINE_DEBT"],
        "steps": steps,
    }
    target = EVIDENCE / "offline-verification.json"
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"summaryFile": str(target.relative_to(ROOT)), "allExpectedExitsObserved": result["allExpectedExitsObserved"], "stepCount": len(steps)}, ensure_ascii=False), flush=True)
    return 0 if result["allExpectedExitsObserved"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
