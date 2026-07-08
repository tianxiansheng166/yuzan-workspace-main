import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function findGov003MigrationDir() {
  const migrationsDir = resolve(__dirname, "./migrations");
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const dirs = entries
    .filter(
      (entry) => entry.isDirectory() && entry.name.endsWith("_gov_003_mvp"),
    )
    .map((entry) => resolve(migrationsDir, entry.name));

  if (dirs.length === 0) {
    throw new Error(
      "No GOV-003 migration directory found in prisma/migrations",
    );
  }
  if (dirs.length > 1) {
    throw new Error(
      `Expected exactly one GOV-003 migration directory, found ${dirs.length}: ${dirs.join(", ")}`,
    );
  }
  return dirs[0];
}

function extractCheckBody(sql, constraintName) {
  const startMarker = `CONSTRAINT "${constraintName}" CHECK (`;
  const startIndex = sql.indexOf(startMarker);
  if (startIndex === -1) return null;

  let depth = 1;
  let i = startIndex + startMarker.length;
  while (i < sql.length && depth > 0) {
    if (sql[i] === "(") depth++;
    else if (sql[i] === ")") depth--;
    i++;
  }

  return depth === 0 ? sql.slice(startIndex + startMarker.length, i - 1) : null;
}

describe("GOV-003 migration contract", () => {
  let migrationPath;
  let sql;

  it("discovers exactly one GOV-003 migration directory", async () => {
    const dir = await findGov003MigrationDir();
    migrationPath = resolve(dir, "migration.sql");
    sql = await readFile(migrationPath, "utf-8");
    assert.ok(sql.length > 0, "migration.sql is empty");
  });

  it("contains the AssignmentTarget target type CHECK constraint", () => {
    const checkBody = extractCheckBody(sql, "AssignmentTarget_target_check");
    assert.ok(checkBody, "Missing AssignmentTarget_target_check constraint");

    assert.match(
      checkBody,
      /"targetType"\s*=\s*'CLASS'/,
      "CHECK must reference CLASS target type",
    );
    assert.match(
      checkBody,
      /"targetType"\s*=\s*'STUDENT'/,
      "CHECK must reference STUDENT target type",
    );
    assert.match(
      checkBody,
      /"classId"\s+IS\s+NOT\s+NULL/,
      "CHECK must require classId for CLASS target",
    );
    assert.match(
      checkBody,
      /"enrollmentId"\s+IS\s+NULL/,
      "CHECK must forbid enrollmentId for CLASS target",
    );
    assert.match(
      checkBody,
      /"enrollmentId"\s+IS\s+NOT\s+NULL/,
      "CHECK must require enrollmentId for STUDENT target",
    );
    assert.match(
      checkBody,
      /"classId"\s+IS\s+NULL/,
      "CHECK must forbid classId for STUDENT target",
    );

    const orCount = (checkBody.match(/\bOR\b/gi) ?? []).length;
    assert.ok(
      orCount >= 1,
      "CHECK must combine CLASS and STUDENT branches with OR",
    );
  });

  it("preserves Submission idempotencyKey NOT NULL and unique constraints", () => {
    assert.doesNotMatch(
      sql,
      /ALTER\s+TABLE\s+"Submission"\s+ALTER\s+COLUMN\s+"idempotencyKey"\s+DROP\s+NOT\s+NULL/,
      "Submission.idempotencyKey must remain NOT NULL",
    );

    assert.match(
      sql,
      /CREATE\s+UNIQUE\s+INDEX\s+"Submission_assignmentId_enrollmentId_attemptNo_key"\s+ON\s+"Submission"\("assignmentId",\s*"enrollmentId",\s*"attemptNo"\)/,
      "Missing Submission (assignmentId, enrollmentId, attemptNo) unique constraint",
    );

    assert.match(
      sql,
      /CREATE\s+UNIQUE\s+INDEX\s+"Submission_enrollmentId_idempotencyKey_key"\s+ON\s+"Submission"\("enrollmentId",\s*"idempotencyKey"\)/,
      "Missing Submission (enrollmentId, idempotencyKey) unique constraint",
    );
  });

  it("requires SyncOperation schoolId and syncJobId columns", () => {
    assert.match(
      sql,
      /ALTER\s+TABLE\s+"SyncOperation"[^;]*ADD\s+COLUMN\s+"schoolId"\s+UUID\s+NOT\s+NULL/s,
      "SyncOperation.schoolId must be added as UUID NOT NULL",
    );
    assert.match(
      sql,
      /ALTER\s+TABLE\s+"SyncOperation"[^;]*ADD\s+COLUMN\s+"syncJobId"\s+UUID\s+NOT\s+NULL/s,
      "SyncOperation.syncJobId must be added as UUID NOT NULL",
    );
  });

  it("declares SyncJob composite unique key for relation target", () => {
    assert.match(
      sql,
      /CREATE\s+UNIQUE\s+INDEX\s+"SyncJob_schoolId_deviceId_id_key"\s+ON\s+"SyncJob"\("schoolId",\s*"deviceId",\s*"id"\)/,
      "Missing SyncJob (schoolId, deviceId, id) unique key for composite FK target",
    );
  });

  it("declares SyncOperation composite foreign key to SyncJob with CASCADE", () => {
    const fkMatch = sql.match(
      /ALTER\s+TABLE\s+"SyncOperation"\s+ADD\s+CONSTRAINT\s+"SyncOperation_schoolId_deviceId_syncJobId_fkey"\s+FOREIGN\s+KEY\s+\(([^)]+)\)\s+REFERENCES\s+"SyncJob"\(([^)]+)\)\s+ON\s+DELETE\s+(\w+)\s+ON\s+UPDATE\s+(\w+)/,
    );
    assert.ok(
      fkMatch,
      "Missing SyncOperation -> SyncJob composite foreign key",
    );

    const [, sourceCols, targetCols, onDelete] = fkMatch;
    assert.match(
      sourceCols,
      /"schoolId".*"deviceId".*"syncJobId"/s,
      "FK source columns must include schoolId, deviceId, syncJobId",
    );
    assert.match(
      targetCols,
      /"schoolId".*"deviceId".*"id"/s,
      "FK target columns must include schoolId, deviceId, id",
    );
    assert.equal(
      onDelete.toUpperCase(),
      "CASCADE",
      "SyncOperation -> SyncJob FK must use ON DELETE CASCADE",
    );
  });

  it("scopes SyncOperation operationId uniqueness by schoolId", () => {
    assert.match(
      sql,
      /CREATE\s+UNIQUE\s+INDEX\s+"SyncOperation_schoolId_actorUserId_operationId_key"\s+ON\s+"SyncOperation"\("schoolId",\s*"actorUserId",\s*"operationId"\)/,
      "Missing SyncOperation (schoolId, actorUserId, operationId) unique constraint",
    );
  });
});
