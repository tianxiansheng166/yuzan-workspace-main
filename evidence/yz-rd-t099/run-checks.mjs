import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
const env = { ...process.env, PATH: `/home/tian/.nvm/versions/node/v24.20.0/bin:/home/tian/.devspace/worktrees/yuzan-owner-uat-20261021/backend/api/node_modules/.bin:${process.env.PATH}` };
const focused = ['--dir', 'backend/api', 'exec', 'vitest', 'run'];
const tail = ['--config', '../../evidence/yz-rd-t099/vitest.config.mjs', '--pool=forks', '--poolOptions.forks.singleFork'];
const checks = [
  ['frontend-suite', 'pnpm', ['--dir', 'frontend', 'test']],
  ['frontend-focused', 'node', ['--test', 'frontend/tests/assessment/t099-unanswered-submit.test.mjs']],
  ['api-focused', 'pnpm', [...focused, 'test/assessment/assessment.service.spec.ts', 'test/assessment/question-bank-deterministic-scoring.service.spec.ts', ...tail]],
  ['api-related', 'pnpm', [...focused, 'test/assessment/question-bank-assessment-scoring.spec.ts', 'test/assessment/remediation.service.spec.ts', 'test/assessment/assessment-review.service.spec.ts', ...tail]],
  ['api-typecheck', 'pnpm', ['--dir', 'backend/api', 'exec', 'tsc', '-p', '../../evidence/yz-rd-t099/typecheck.json', '--noEmit']],
  ['target-lint', 'pnpm', ['--dir', 'backend/api', 'exec', 'eslint', '--config', '../../evidence/yz-rd-t099/eslint.config.mjs', 'src/modules/assessment/assessment.service.ts', 'src/modules/assessment/question-bank-deterministic-scoring.service.ts', 'test/assessment/assessment.service.spec.ts', 'test/assessment/question-bank-deterministic-scoring.service.spec.ts']],
  ['runner-syntax', 'node', ['--check', 'frontend/assessment/assets/runner.js']],
  ['app-syntax', 'node', ['--check', 'frontend/assessment/assets/app.js']],
  ['test-syntax', 'node', ['--check', 'frontend/tests/assessment/t099-unanswered-submit.test.mjs']],
  ['diff-check', 'git', ['diff', '--check']],
];
const results = [];
for (const [name, cmd, args] of checks) {
  const result = spawnSync(cmd, args, { cwd: root, env, encoding: 'utf8' });
  writeFileSync(path.join(import.meta.dirname, name + '.txt'), (`${result.stdout || ''}${result.stderr || ''}`).trimEnd() + (result.stdout || result.stderr ? '\n' : ''));
  results.push({ name, command: [cmd, ...args], exit: result.status, error: result.error?.message ?? null });
  console.log(`${name}: ${result.status === 0 ? 'PASS' : 'FAIL'} (exit ${result.status})`);
}
writeFileSync(path.join(import.meta.dirname, 'checks.json'), JSON.stringify(results, null, 2) + '\n');
process.exitCode = results.every(r => r.exit === 0) ? 0 : 1;
