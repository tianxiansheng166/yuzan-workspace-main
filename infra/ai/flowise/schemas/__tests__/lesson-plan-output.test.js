/**
 * Unit tests for lesson-plan-output.schema.json
 *
 * Self-contained: no external dependencies (no Ajv needed).
 * Uses a lightweight validator that covers the schema constraints.
 *
 * Validates:
 *  1. Golden fixture passes all schema constraints
 *  2. Schema rejects invalid outputs (missing required, wrong types, extra props, bad enums)
 *  3. Business rule: lessonFlow minutes total must be within 10 of durationMinutes
 *
 * Run: node infra/ai/flowise/schemas/__tests__/lesson-plan-output.test.js
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ── Resolve files ──────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, "..", "..");
const SCHEMA_PATH = path.join(ROOT, "schemas", "lesson-plan-output.schema.json");
const GOLDEN_PATH = path.join(ROOT, "fixtures", "golden-v0.json");

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, "utf8"));

// ── Lightweight schema validator (no Ajv dependency) ───────────────────────
function validateAgainstSchema(data, schemaDef) {
  const errors = [];
  _validate(data, schemaDef, "$", errors);
  return errors;
}

function _validate(data, s, path, errors) {
  // type check
  if (s.type === "object") {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      errors.push(`${path}: expected object, got ${typeof data}`);
      return;
    }
    // additionalProperties
    if (s.additionalProperties === false && s.properties) {
      for (const key of Object.keys(data)) {
        if (!(key in s.properties)) {
          errors.push(`${path}.${key}: additional property not allowed`);
        }
      }
    }
    // required
    if (s.required) {
      for (const req of s.required) {
        if (!(req in data)) {
          errors.push(`${path}.${req}: required property missing`);
        }
      }
    }
    // properties
    if (s.properties) {
      for (const [key, propSchema] of Object.entries(s.properties)) {
        if (key in data) {
          _validate(data[key], propSchema, `${path}.${key}`, errors);
        }
      }
    }
  } else if (s.type === "array") {
    if (!Array.isArray(data)) {
      errors.push(`${path}: expected array, got ${typeof data}`);
      return;
    }
    if (s.minItems !== undefined && data.length < s.minItems) {
      errors.push(`${path}: array length ${data.length} < minItems ${s.minItems}`);
    }
    if (s.maxItems !== undefined && data.length > s.maxItems) {
      errors.push(`${path}: array length ${data.length} > maxItems ${s.maxItems}`);
    }
    if (s.items) {
      for (let i = 0; i < data.length; i++) {
        _validate(data[i], s.items, `${path}[${i}]`, errors);
      }
    }
  } else if (s.type === "string") {
    if (typeof data !== "string") {
      errors.push(`${path}: expected string, got ${typeof data}`);
      return;
    }
    if (s.minLength !== undefined && data.length < s.minLength) {
      errors.push(`${path}: string length ${data.length} < minLength ${s.minLength}`);
    }
    if (s.maxLength !== undefined && data.length > s.maxLength) {
      errors.push(`${path}: string length ${data.length} > maxLength ${s.maxLength}`);
    }
    if (s.const !== undefined && data !== s.const) {
      errors.push(`${path}: expected const "${s.const}", got "${data}"`);
    }
    if (s.enum !== undefined && !s.enum.includes(data)) {
      errors.push(`${path}: value "${data}" not in enum [${s.enum.join(", ")}]`);
    }
  } else if (s.type === "integer") {
    if (typeof data !== "number" || !Number.isInteger(data)) {
      errors.push(`${path}: expected integer, got ${typeof data}`);
      return;
    }
    if (s.minimum !== undefined && data < s.minimum) {
      errors.push(`${path}: value ${data} < minimum ${s.minimum}`);
    }
    if (s.maximum !== undefined && data > s.maximum) {
      errors.push(`${path}: value ${data} > maximum ${s.maximum}`);
    }
  } else if (s.type === "boolean") {
    if (typeof data !== "boolean") {
      errors.push(`${path}: expected boolean, got ${typeof data}`);
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

function assertValid(data, label) {
  const errs = validateAgainstSchema(data, schema);
  assert(errs.length === 0, `${label} should be valid: ${errs.join("; ")}`);
}

function assertInvalid(data, label) {
  const errs = validateAgainstSchema(data, schema);
  assert(errs.length > 0, `${label} should be invalid (got 0 errors)`);
}

// ── Test 1: golden fixture passes schema ───────────────────────────────────
console.log("1. Golden fixture must pass schema validation");
assertValid(golden, "golden fixture");

// ── Test 2: golden fixture passes business rule ────────────────────────────
console.log("2. Golden fixture lessonFlow minutes must match durationMinutes");
{
  const totalMinutes = golden.lessonFlow.reduce((sum, s) => sum + s.minutes, 0);
  const duration = golden.context.durationMinutes;
  const diff = Math.abs(totalMinutes - duration);
  assert(diff <= 10, `totalMinutes=${totalMinutes}, durationMinutes=${duration}, diff=${diff} > 10`);
}

// ── Test 3: missing required fields → invalid ─────────────────────────────
console.log("3. Missing required fields must fail");
{
  const required = ["schemaVersion", "title", "summary", "context", "objectives", "keyPoints", "difficulties", "lessonFlow", "teacherReviewChecklist"];
  for (const field of required) {
    const copy = JSON.parse(JSON.stringify(golden));
    delete copy[field];
    assertInvalid(copy, `missing "${field}"`);
  }
}

// ── Test 4: wrong schemaVersion → invalid ──────────────────────────────────
console.log("4. Wrong schemaVersion must fail");
{
  const copy = JSON.parse(JSON.stringify(golden));
  copy.schemaVersion = "wrong-version";
  assertInvalid(copy, "wrong schemaVersion");
}

// ── Test 5: additionalProperties → invalid ─────────────────────────────────
console.log("5. Additional properties must fail");
{
  const copy = JSON.parse(JSON.stringify(golden));
  copy.unexpectedField = "should not be here";
  assertInvalid(copy, "extra top-level property");
}

// ── Test 6: invalid gradeBand → invalid ────────────────────────────────────
console.log("6. Invalid gradeBand must fail");
{
  const copy = JSON.parse(JSON.stringify(golden));
  copy.context.gradeBand = "INVALID";
  assertInvalid(copy, "invalid gradeBand");
}

// ── Test 7: invalid domain → invalid ───────────────────────────────────────
console.log("7. Invalid objective domain must fail");
{
  const copy = JSON.parse(JSON.stringify(golden));
  copy.objectives[0].domain = "invalid-domain";
  assertInvalid(copy, "invalid domain");
}

// ── Test 8: empty lessonFlow → invalid ─────────────────────────────────────
console.log("8. Empty lessonFlow must fail (minItems: 2)");
{
  const copy = JSON.parse(JSON.stringify(golden));
  copy.lessonFlow = [];
  assertInvalid(copy, "empty lessonFlow");
}

// ── Test 9: minutes out of range → invalid ─────────────────────────────────
console.log("9. Stage minutes out of range must fail");
{
  const copy = JSON.parse(JSON.stringify(golden));
  copy.lessonFlow[0].minutes = 0;
  assertInvalid(copy, "minutes=0");

  const copy2 = JSON.parse(JSON.stringify(golden));
  copy2.lessonFlow[0].minutes = 61;
  assertInvalid(copy2, "minutes=61");
}

// ── Test 10: practiceDraft invalid modeRecommendation → invalid ────────────
console.log("10. Invalid practiceDraft modeRecommendation must fail");
{
  const copy = JSON.parse(JSON.stringify(golden));
  copy.practiceDraft.modeRecommendation = "INVALID_MODE";
  assertInvalid(copy, "invalid modeRecommendation");
}

// ── Test 11: glossary without required fields → invalid ────────────────────
console.log("11. Glossary item missing required field must fail");
{
  const copy = JSON.parse(JSON.stringify(golden));
  delete copy.glossary[0].term;
  assertInvalid(copy, "glossary missing term");
}

// ── Test 12: worksheetDraft missing required → invalid ─────────────────────
console.log("12. WorksheetDraft section missing required field must fail");
{
  const copy = JSON.parse(JSON.stringify(golden));
  delete copy.worksheetDraft.sections[0].type;
  assertInvalid(copy, "worksheet section missing type");
}

// ── Test 13: schema $id matches schemaVersion ──────────────────────────────
console.log("13. Schema $id must match schemaVersion const");
{
  assert(schema.$id === "lesson-plan-output.v0", `schema $id is "${schema.$id}"`);
  const svProp = schema.properties.schemaVersion;
  assert(svProp.const === "lesson-plan.v0", `schemaVersion const is "${svProp.const}"`);
}

// ── Test 14: schema has additionalProperties: false at top level ────────────
console.log("14. Schema must have additionalProperties: false at top level");
{
  assert(schema.additionalProperties === false, "top-level additionalProperties must be false");
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${"=".repeat(50)}`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
if (failed > 0) {
  console.error("SOME TESTS FAILED");
  process.exit(1);
} else {
  console.log("ALL TESTS PASSED");
}
