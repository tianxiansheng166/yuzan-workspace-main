import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = "openapi/openapi.yaml";
const generatedPath = "src/generated.ts";

function runChecked(run, label, command, args) {
  const result = run(command, args, {
    cwd: packageRoot,
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.error) {
    throw new Error(`${label} failed to start`, { cause: result.error });
  }
  if (result.signal) {
    throw new Error(`${label} terminated by signal ${result.signal}`);
  }
  if (result.status !== 0) {
    throw new Error(`${label} exited with status ${String(result.status)}`);
  }
}

export function runGenerateTypes({ run = spawnSync } = {}) {
  const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const outputPath = resolve(packageRoot, generatedPath);
  const temporaryDirectory = mkdtempSync(
    join(dirname(outputPath), ".generate-types-"),
  );
  const temporaryOutput = join(temporaryDirectory, "generated.ts");
  const relativeTemporaryOutput = relative(packageRoot, temporaryOutput);

  try {
    runChecked(run, "OpenAPI type generator", packageManager, [
      "exec",
      "openapi-typescript",
      schemaPath,
      "-o",
      relativeTemporaryOutput,
    ]);
    runChecked(run, "Prettier", packageManager, [
      "exec",
      "prettier",
      "--write",
      relativeTemporaryOutput,
    ]);

    writeFileSync(outputPath, readFileSync(temporaryOutput));
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }
}

const isDirectExecution =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  runGenerateTypes();
}
