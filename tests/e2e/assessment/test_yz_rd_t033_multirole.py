"""Cross-role acceptance of the integrated T029-T032 source on one T033 runtime."""

from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = Path(os.environ["YZ_T033_EVIDENCE_DIR"])
DATABASE_URL = os.environ["DATABASE_URL"]
DATABASE_NAME = os.environ["POSTGRES_DB"]
DATABASE_USER = os.environ["POSTGRES_USER"]
DATABASE_PORT = os.environ["POSTGRES_PORT"]
PSQL = os.environ["YZ_T033_PSQL"]
PG_LIBRARY = os.environ["YZ_T033_PG_LIBRARY"]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load integrated acceptance source: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def sql(statement: str, *, capture: bool = False) -> str:
    parsed = urlparse(DATABASE_URL)
    if (
        parsed.scheme != "postgresql"
        or parsed.hostname != "127.0.0.1"
        or parsed.port != int(DATABASE_PORT)
        or unquote(parsed.username or "") != DATABASE_USER
        or unquote(parsed.path.lstrip("/")) != DATABASE_NAME
    ):
        raise AssertionError("T033 E2E database URL escaped its task-owned loopback database")
    password = unquote(parsed.password or "")
    env = {
        **os.environ,
        "PGHOST": parsed.hostname,
        "PGPORT": str(parsed.port),
        "PGUSER": DATABASE_USER,
        "PGPASSWORD": password,
        "PGDATABASE": DATABASE_NAME,
        "LD_LIBRARY_PATH": os.pathsep.join(
            filter(None, [PG_LIBRARY, os.environ.get("LD_LIBRARY_PATH", "")])
        ),
    }
    result = subprocess.run(
        [PSQL, "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t"],
        input=statement,
        text=True,
        capture_output=True,
        env=env,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.replace(password, "<redacted>")[-1200:])
    return result.stdout.strip() if capture else ""


def verify_t033_database() -> dict[str, str]:
    identity = sql(
        "SELECT current_database() || '|' || current_user || '|' || version();",
        capture=True,
    )
    name, user, version = identity.split("|", 2)
    if (name, user) != (DATABASE_NAME, DATABASE_USER) or not version.startswith("PostgreSQL 17."):
        raise AssertionError("T033 E2E is not using its isolated PostgreSQL 17 database and role")
    return {"database": name, "role": user, "version": "PostgreSQL 17"}


def test_01_teacher_invitation_student_join_revoke_and_roster():
    module = load_module(
        "yz_rd_t033_integrated_t029",
        ROOT / "tests/e2e/assessment/test_yz_rd_t029_onboarding_revocation.py",
    )
    module.test_t029_merged_real_teacher_student_onboarding_and_revocation()

    result_path = (
        EVIDENCE
        / "invitation"
        / "t028"
        / "t028-browser-database-evidence.json"
    )
    if not result_path.is_file():
        raise AssertionError("Integrated browser invitation and revocation evidence is missing")
    result = json.loads(result_path.read_text(encoding="utf-8"))
    ids = result["fictionalUserIds"]
    school_id = result["schoolId"]
    class_id = result["teacherClassId"]
    if not all((ids.get("teacher_c"), ids.get("student_a"), ids.get("student_b"), school_id, class_id)):
        raise AssertionError("Integrated invitation test did not produce dynamic teacher, student, school and class IDs")
    for key in ("student_a", "student_b"):
        count = sql(
            f'''SELECT count(*) FROM "Enrollment"
                 WHERE "schoolId"='{school_id}' AND "classId"='{class_id}'
                   AND "userId"='{ids[key]}' AND role='STUDENT' AND status='ACTIVE';''',
            capture=True,
        )
        if count != "1":
            raise AssertionError(f"{key} is not present exactly once in the real authorized class roster")
    summary = {
        "database": verify_t033_database(),
        "teacherId": ids["teacher_c"],
        "schoolId": school_id,
        "classId": class_id,
        "activeStudentEnrollmentsAfterInvitationRevocation": 2,
        "browserRosterAndRevocation": "PASS",
    }
    (EVIDENCE / "invitation" / "t033-roster-join-parity.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def test_02_teacher_exports_live_authorized_roster_csv():
    module = load_module(
        "yz_rd_t033_integrated_t032",
        ROOT / "tests/e2e/assessment/test_yz_rd_t032_roster_csv_export.py",
    )
    module.sql = lambda statement: sql(statement, capture=True)
    module.verify_runtime_identity = verify_t033_database
    module.test_t032_authorized_teacher_downloads_live_csv_and_isolated_scope_negatives()

    result_path = EVIDENCE / "csv" / "t032-browser-database-evidence.json"
    if not result_path.is_file():
        raise AssertionError("Integrated CSV browser/database evidence is missing")
    result = json.loads(result_path.read_text(encoding="utf-8"))
    widths = [item["width"] for item in result.get("responsive", [])]
    if widths != [390, 768, 1280, 1440]:
        raise AssertionError(f"CSV responsive evidence is incomplete: {widths}")
    if result.get("unpaginatedSqlParity") != "PASS: three CSV rows match three ACTIVE STUDENT Enrollment joins":
        raise AssertionError("CSV rows were not verified against the authorized live SQL roster")


def test_03_student_growth_formal_report_and_remediation_runner():
    module = load_module(
        "yz_rd_t033_integrated_t030",
        ROOT / "tests/e2e/assessment/test_yz_rd_t030_student_growth.py",
    )

    def verify_resource_identity() -> None:
        identity = module.sql(
            "SELECT current_database() || '|' || current_user || '|' || version();",
            capture=True,
        )
        if not identity.startswith(f"{DATABASE_NAME}|{DATABASE_USER}|PostgreSQL 17."):
            raise AssertionError("Growth/remediation E2E database identity mismatch")
        if module.S3_BUCKET != os.environ["YZ_T030_S3_BUCKET"]:
            raise AssertionError("Growth/remediation E2E is not using the isolated T033 MinIO bucket")

    module.verify_resource_identity = verify_resource_identity
    module.test_growth_feedback_remediation_recovery_and_identity_isolation()

    result_path = EVIDENCE / "growth" / "native-evidence.json"
    if not result_path.is_file():
        raise AssertionError("Growth formal-report and remediation evidence is missing")
    result = json.loads(result_path.read_text(encoding="utf-8"))
    creation = result.get("remediationCreationResponse", {})
    if not result.get("assessmentReportId") or int(result.get("formalResultCount", 0)) < 1:
        raise AssertionError("Student Growth did not display a server-generated formal report")
    if (
        not result.get("remediationSessionId")
        or creation.get("sourceSessionId") != result.get("sourceSessionId")
        or int(creation.get("itemCount", 0)) != 15
        or len(result.get("remediationItemQuestionVersionIds", [])) != 15
    ):
        raise AssertionError("Formal report did not open its linked 15-item remediation retry")
    if result.get("remediationResult", {}).get("status") not in {"PROCESSING", "SUBMITTED"}:
        raise AssertionError("Remediation Runner submission did not persist its real server state")


def test_04_course_activity_runner_submit_complete_and_return():
    module = load_module(
        "yz_rd_t033_integrated_t031",
        ROOT / "evidence/yz-rd-t031/native_return_e2e.py",
    )
    module.test_yz_rd_t031_real_course_activity_runner_return()

    result_path = EVIDENCE / "course" / "browser-proof.json"
    if not result_path.is_file():
        raise AssertionError("Integrated course Runner browser proof is missing")
    result = json.loads(result_path.read_text(encoding="utf-8"))
    runner = result.get("runner", {})
    statuses = [
        int(item["status"])
        for item in runner.get("apiResponses", [])
        if item.get("path", "").endswith("/submit")
    ]
    if (
        statuses.count(201) != 1
        or 201 not in runner.get("courseCompletionBackendStatuses", [])
        or runner.get("returnNavigationCount") != 1
    ):
        raise AssertionError(f"Course Runner submission and completion did not both return HTTP 201: {statuses}")
