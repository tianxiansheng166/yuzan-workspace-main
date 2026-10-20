import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.dirname(frontendRoot);

// These paths are intentionally excluded before recursion or file reads.
const protectedPrefixes = [
  "assessment/assets/question-bank",
  "student/courses/course-detail",
];
const excludedDirectoryNames = new Set([
  ".git",
  ".next",
  "__tests__",
  "coverage",
  "dist",
  "local_sources",
  "node_modules",
  "question-bank",
  "test",
  "tests",
]);
const files = [];

function isProtected(relativePath) {
  const normalized = relativePath.split(path.sep).join("/");
  return protectedPrefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))
    || normalized.split("/").some((segment) => segment === "local_sources" || segment === "question-bank");
}

async function collectBusinessScripts(directory, relativeDirectory = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
    if (isProtected(relativePath)) continue;

    if (entry.isDirectory()) {
      if (excludedDirectoryNames.has(entry.name) || (relativeDirectory === "" && entry.name === "scripts")) continue;
      await collectBusinessScripts(path.join(directory, entry.name), relativePath);
      continue;
    }

    if (!entry.isFile() || !/\.(?:js|mjs)$/i.test(entry.name)) continue;
    if (/\.(?:test|spec)\.(?:js|mjs)$/i.test(entry.name) || entry.name.endsWith(".min.js")) continue;
    if (relativePath === "server.mjs") continue;
    files.push(path.join(directory, entry.name));
  }
}

await collectBusinessScripts(frontendRoot);
files.sort();

const failures = [];
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  if (result.status === 0) continue;

  const relativePath = path.relative(repoRoot, file).split(path.sep).join("/");
  failures.push(relativePath);
  process.stderr.write(`FAIL ${relativePath}\n${result.stderr || result.stdout || `node --check exited ${result.status}`}\n`);
}

if (failures.length > 0) {
  process.stderr.write(`Business JS syntax check failed: ${failures.length} of ${files.length} checked files.\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Business JS syntax check passed: ${files.length} JS/MJS files checked.\n`);
}
