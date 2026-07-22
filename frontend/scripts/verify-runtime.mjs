import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const requiredEntries = [
  "server.mjs",
  "index.html",
  "login/index.html",
  "select-school/index.html",
  "teacher-home/index.html",
  "student/today/index.html",
  "assessment/practice-shell.html",
];

const missing = requiredEntries.filter(
  (relativePath) => !existsSync(new URL(relativePath, new URL("../", import.meta.url))),
);
if (missing.length > 0) {
  throw new Error(`Missing frontend runtime entries: ${missing.join(", ")}`);
}

const serverSource = readFileSync(new URL("../server.mjs", import.meta.url), "utf8");
for (const requiredBehavior of ["proxyToApi", "routeToSpa", "pathname.startsWith('/api/')"]) {
  if (!serverSource.includes(requiredBehavior)) {
    throw new Error(`Frontend server is missing required behavior: ${requiredBehavior}`);
  }
}

if (serverSource.includes("apps/apps-web") || serverSource.includes("web-runtime")) {
  throw new Error("Frontend server still references an archived frontend path");
}

console.log(`Frontend runtime verified at ${root}`);
