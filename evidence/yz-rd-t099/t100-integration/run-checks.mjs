import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
const evidenceDir = import.meta.dirname;
const root = path.resolve(evidenceDir, '../../../');
const env = { ...process.env, PATH: `/home/tian/.nvm/versions/node/v24.20.0/bin:/home/tian/.devspace/worktrees/yuzan-owner-uat-20261021/backend/api/node_modules/.bin:${process.env.PATH}` };
const api = ['--dir', 'backend/api', 'exec', 'vitest', 'run'];
const config = ['--config', '../../evidence/yz-rd-t099/vitest.config.mjs', '--pool=forks', '--poolOptions.forks.singleFork'];
const checks = [
  ['frontend-suite', 'pnpm', ['--dir', 'frontend', 'test']],
  ['frontend-focused', 'node', ['--test', 'frontend/tests/assessment/t099-unanswered-submit.test.mjs']],
  ['api-focused', 'pnpm', [...api, 'test/assessment/assessment.service.spec.ts', 'test/assessment/question-bank-deterministic-scoring.service.spec.ts', ...config]],
  ['api-related', 'pnpm', [...api, 'test/assessment/question-bank-assessment-scoring.spec.ts', 'test/assessment/remediation.service.spec.ts', 'test/assessment/assessment-review.service.spec.ts', ...config]],
  ['api-typecheck', 'pnpm', ['--dir', 'backend/api', 'exec', 'tsc', '-p', '../../evidence/yz-rd-t099/typecheck.json', '--noEmit']],
  ['target-lint', 'pnpm', ['--dir', 'backend/api', 'exec', 'eslint', '--config', '../../evidence/yz-rd-t099/eslint.config.mjs', 'src/modules/assessment/assessment.service.ts', 'src/modules/assessment/question-bank-deterministic-scoring.service.ts', 'test/assessment/assessment.service.spec.ts', 'test/assessment/question-bank-deterministic-scoring.service.spec.ts']],
  ['business-js-gate', 'node', ['frontend/scripts/check-business-js-syntax.mjs']],
  ['runtime-verifier', 'node', ['frontend/scripts/verify-runtime.mjs']],
  ['runner-syntax', 'node', ['--check', 'frontend/assessment/assets/runner.js']],
  ['app-syntax', 'node', ['--check', 'frontend/assessment/assets/app.js']],
  ['test-syntax', 'node', ['--check', 'frontend/tests/assessment/t099-unanswered-submit.test.mjs']],
  ['full-api-suite', 'pnpm', [...api, ...config]],
];
const results = [];
for (const [name, cmd, args] of checks) {
  const result = spawnSync(cmd, args, { cwd: root, env, encoding: 'utf8', maxBuffer: 80 * 1024 * 1024 });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  writeFileSync(path.join(evidenceDir, name + '.txt.raw.gz'), gzipSync(Buffer.from(output)));
  const cleanOutput = output.split(/\r?\n/).map(line => line.replace(/[ \t]+$/g, '')).join('\n').trimEnd();
  writeFileSync(path.join(evidenceDir, name + '.txt'), cleanOutput + (cleanOutput ? '\n' : ''));
  const summary = [...output.matchAll(/(Tests|Test Files|ℹ pass|ℹ fail|ℹ skipped)\s+([^\n]+)/g)].map(m => m[0].trim());
  results.push({ name, command: [cmd, ...args], exit: result.status, signal: result.signal ?? null, error: result.error?.message ?? null, summary });
  console.log(`${name}: ${result.status === 0 ? 'PASS' : 'FAIL'}${summary.length ? ' — ' + summary.slice(-4).join('; ') : ` (exit ${result.status})`}`);
}
writeFileSync(path.join(evidenceDir, 'checks.json'), JSON.stringify(results, null, 2) + '\n');
process.exitCode = results.slice(0, 11).every(r => r.exit === 0) ? 0 : 1;
