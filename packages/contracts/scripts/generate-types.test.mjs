import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const generatorPath = resolve(packageRoot, "scripts/generate-types.mjs");
const generatedPath = resolve(packageRoot, "src/generated.ts");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: packageRoot,
    encoding: "utf8",
    ...options,
  });
}

function hashGeneratedTypes() {
  return createHash("sha256").update(readFileSync(generatedPath)).digest("hex");
}

function repositoryStatus() {
  const result = spawnSync(
    "git",
    ["status", "--porcelain", "--untracked-files=all"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function runFailureFixture(mode) {
  const fixturePath = resolve(
    tmpdir(),
    `gov002-generate-types-${mode}-${process.pid}.mjs`,
  );
  const moduleUrl = pathToFileURL(generatorPath).href;
  const fixture = `
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runGenerateTypes } from ${JSON.stringify(moduleUrl)};

let call = 0;
runGenerateTypes({
  run(command, args, options) {
    call += 1;
    if (${JSON.stringify(mode)} === "generator") {
      return { status: 17, error: undefined, signal: null };
    }
    if (call === 1) {
      const output = resolve(options.cwd, args[args.indexOf("-o") + 1]);
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, "export type Fixture = string;\\n");
      return { status: 0, error: undefined, signal: null };
    }
    return { status: 23, error: undefined, signal: null };
  },
});
`;
  writeFileSync(fixturePath, fixture);
  const result = spawnSync(process.execPath, [fixturePath], {
    cwd: packageRoot,
    encoding: "utf8",
  });
  rmSync(fixturePath, { force: true });
  return result;
}

test("the production generator succeeds without leaking machine-specific output", () => {
  const statusBefore = repositoryStatus();
  const result = run(process.execPath, [generatorPath]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(repositoryStatus(), statusBefore);

  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  const generated = readFileSync(generatedPath, "utf8");
  const userName = process.env.USER ?? process.env.USERNAME;

  assert.doesNotMatch(
    combinedOutput,
    new RegExp(repositoryRoot.replaceAll("\\", "\\\\"), "i"),
  );
  if (userName) {
    assert.doesNotMatch(combinedOutput, new RegExp(userName, "i"));
  }
  assert.doesNotMatch(generated, /\/home\/tian/i);
  assert.doesNotMatch(
    generated,
    new RegExp(repositoryRoot.replaceAll("\\", "\\\\"), "i"),
  );
  if (userName) assert.doesNotMatch(generated, new RegExp(userName, "i"));
  assert.doesNotMatch(
    generated.slice(0, 500),
    /generated (?:at|on):?\s*\d{4}-\d{2}-\d{2}/i,
  );
});

test("two production runs produce identical hashes", () => {
  const first = run(process.execPath, [generatorPath]);
  assert.equal(first.status, 0, first.stderr);
  const firstHash = hashGeneratedTypes();

  const second = run(process.execPath, [generatorPath]);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(hashGeneratedTypes(), firstHash);
});

test("generated types satisfy Prettier", () => {
  const result = run(pnpm, ["exec", "prettier", "--check", "src/generated.ts"]);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("contract sources and documentation satisfy Prettier", () => {
  const result = run(pnpm, [
    "exec",
    "prettier",
    "--check",
    "openapi/openapi.yaml",
    "../../docs/03-architecture/02-API与契约规范.md",
  ]);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("generator failures make the command fail", () => {
  const result = runFailureFixture("generator");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /OpenAPI type generator exited with status 17/);
});

test("formatter failures make the command fail", () => {
  const result = runFailureFixture("formatter");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Prettier exited with status 23/);
});
