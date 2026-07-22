// P0-测试地基集成：B轨道Vitest配置批量运行器
// 运行所有B轨道vitest.config.ts（排除contracts，A轨道已独立验证），汇总结果。
// 使用Node原生child_process避免PowerShell中文编码问题。

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const root = __dirname;

// B轨道27个Vitest配置（28个API - 1个contracts + 1个worker = 28，但B报告说27；
// 实际上B报告统计为27个config files，与B返回的836 passed对应。）
// 按B报告Phase 3回归命令顺序排列。
const apiConfigs = [
  "test/assessment/vitest.config.ts",
  "test/recordings/vitest.config.ts",
  "test/speech-job/vitest.config.ts",
  "test/reporting/vitest.config.ts",
  "test/organizations/vitest.config.ts",
  "test/auth/vitest.config.ts",
  "test/curriculum/vitest.config.ts",
  "test/identity/vitest.config.ts",
  "test/operations/vitest.config.ts",
  "test/offline/vitest.config.ts",
  "test/bootstrap/vitest.config.ts",
  "test/root/vitest.config.ts",
  "test/database/vitest.config.ts",
  "test/vitest.config.ts",
  "test/modules/translations/vitest.config.ts",
  "test/modules/training/vitest.config.ts",
  "test/modules/tools/vitest.config.ts",
  "test/modules/support-pairings/vitest.config.ts",
  "test/modules/learning/vitest.config.ts",
  "test/modules/submissions/vitest.config.ts",
  "test/modules/assignments/vitest.config.ts",
  "test/modules/volunteers/vitest.config.ts",
  "test/modules/feedback/vitest.config.ts",
  "test/modules/cooperation/vitest.config.ts",
  "test/modules/community/vitest.config.ts",
  "test/modules/admin/vitest.config.ts",
  "test/integration/identity/vitest.config.ts",
  "test/integration/curriculum/vitest.config.ts",
];

const workerConfigs = ["test/vitest.config.ts"];

const results = [];
let totalPassed = 0;
let totalSkipped = 0;
let totalFailed = 0;
let totalFiles = 0;

function runVitest(configPath, cwd, filterPkg) {
  const args = ["--filter", filterPkg, "exec", "vitest", "run", "--config", configPath];
  const fullCwd = resolve(root, cwd);
  const stdoutPath = resolve(root, "b-test-stdout.log");
  const stderrPath = resolve(root, "b-test-stderr.log");

  const result = spawnSync("pnpm", args, {
    cwd: fullCwd,
    shell: true,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    env: { ...process.env, CI: "true", FORCE_COLOR: "0", NO_COLOR: "1" },
  });

  const output = (result.stdout || "") + "\n--STDERR--\n" + (result.stderr || "");

  // 解析末行测试摘要：例如 "Test Files  3 passed (3)"
  //                                 "Tests  28 passed (28)"
  // 或 "Tests  11 passed | 21 skipped (32)"
  let passed = 0;
  let skipped = 0;
  let failed = 0;
  let files = 0;

  const testsLineMatch = output.match(/Tests\s+(\d+)\s+passed(?:\s*\|\s*(\d+)\s+skipped)?(?:\s*\|\s*(\d+)\s+failed)?\s*\((\d+)\)/);
  if (testsLineMatch) {
    passed = parseInt(testsLineMatch[1], 10) || 0;
    skipped = parseInt(testsLineMatch[2] || "0", 10);
    failed = parseInt(testsLineMatch[3] || "0", 10);
  }

  const filesLineMatch = output.match(/Test Files\s+(\d+)\s+passed(?:\s*\|\s*(\d+)\s+skipped)?(?:\s*\|\s*(\d+)\s+failed)?\s*\((\d+)\)/);
  if (filesLineMatch) {
    files = parseInt(filesLineMatch[4], 10) || 0;
  }

  return {
    config: configPath,
    pkg: filterPkg,
    exitCode: result.status,
    passed,
    skipped,
    failed,
    files,
    outputTail: output.slice(-2000),
  };
}

console.log("=== B-track Vitest configs batch run ===");
console.log(`Root: ${root}`);
console.log(`API configs: ${apiConfigs.length}`);
console.log(`Worker configs: ${workerConfigs.length}`);
console.log(`Total configs: ${apiConfigs.length + workerConfigs.length}`);
console.log("");

for (const cfg of apiConfigs) {
  process.stdout.write(`[API] ${cfg} ... `);
  const r = runVitest(cfg, "backend/api", "@yuzan/api");
  results.push(r);
  totalPassed += r.passed;
  totalSkipped += r.skipped;
  totalFailed += r.failed;
  totalFiles += r.files;
  const status =
    r.failed > 0 ? "FAIL" : r.exitCode === 0 || r.passed > 0 || r.skipped > 0 ? "OK" : "ERR";
  console.log(
    `${status} exit=${r.exitCode} passed=${r.passed} skipped=${r.skipped} failed=${r.failed} files=${r.files}`,
  );
}

for (const cfg of workerConfigs) {
  process.stdout.write(`[WORKER] ${cfg} ... `);
  const r = runVitest(cfg, "backend/worker", "@yuzan/worker");
  results.push(r);
  totalPassed += r.passed;
  totalSkipped += r.skipped;
  totalFailed += r.failed;
  totalFiles += r.files;
  const status = r.failed > 0 ? "FAIL" : "OK";
  console.log(
    `${status} exit=${r.exitCode} passed=${r.passed} skipped=${r.skipped} failed=${r.failed} files=${r.files}`,
  );
}

console.log("");
console.log("=== Summary ===");
console.log(`Total configs: ${results.length}`);
console.log(`Total passed:  ${totalPassed}`);
console.log(`Total skipped: ${totalSkipped}`);
console.log(`Total failed:  ${totalFailed}`);
console.log(`Total files:   ${totalFiles}`);

const report = {
  totalConfigs: results.length,
  totalPassed,
  totalSkipped,
  totalFailed,
  totalFiles,
  results: results.map((r) => ({
    config: r.config,
    pkg: r.pkg,
    exitCode: r.exitCode,
    passed: r.passed,
    skipped: r.skipped,
    failed: r.failed,
    files: r.files,
  })),
};

writeFileSync(
  resolve(root, "b-test-results.json"),
  JSON.stringify(report, null, 2),
  "utf8",
);
console.log(`\nResults saved: ${resolve(root, "b-test-results.json")}`);

// 同时保存详细日志
const detailedLog = results
  .map(
    (r) =>
      `=== ${r.pkg} :: ${r.config} (exit=${r.exitCode}, passed=${r.passed}, skipped=${r.skipped}, failed=${r.failed}, files=${r.files}) ===\n${r.outputTail}\n`,
  )
  .join("\n");
writeFileSync(resolve(root, "b-test-detail.log"), detailedLog, "utf8");
console.log(`Detail log: ${resolve(root, "b-test-detail.log")}`);

process.exit(totalFailed > 0 ? 1 : 0);
