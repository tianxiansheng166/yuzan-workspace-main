import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass, detail });

const routes = {
  "/": "apps/web/app/pages/index.vue",
  "/login": "apps/web/app/pages/login.vue",
  "/student/today": "apps/web/app/pages/student/today.vue",
  "/assessment": "apps/web/app/pages/assessment/index.vue",
  "/studio": "apps/web/app/pages/studio/index.vue",
  "/teacher/assignments": "apps/web/app/pages/teacher/assignments/index.vue",
  "/teacher/review": "apps/web/app/pages/teacher/review/index.vue",
  "/reports": "apps/web/app/pages/reports/index.vue",
  "/design/icons": "apps/web/app/pages/design/icons.vue",
};
const composedHeadingSources = {
  "/login": "apps/web/app/features/auth/components/LoginPanel.vue",
  "/assessment": "apps/web/app/features/assessment/AssessmentPageShell.vue",
  "/design/icons":
    "apps/web/app/features/icon-gallery/components/IconGallery.vue",
};

for (const [route, file] of Object.entries(routes)) {
  check(
    `route source exists: ${route}`,
    statSync(resolve(root, file)).isFile(),
    file,
  );
  const headingFile = composedHeadingSources[route] ?? file;
  check(
    `primary heading: ${route}`,
    /<h1[\s>]/.test(read(headingFile)),
    headingFile,
  );
}

const app = read("apps/web/app/app.vue");
const config = read("apps/web/nuxt.config.ts");
const shell = read("apps/web/app/components/app-shell/AppShell.vue");
const today = read(routes["/student/today"]);
const login = read(routes["/login"]);
const player = read("apps/web/app/pages/student/learning/[activityId].vue");
const icons = read(routes["/design/icons"]);

check(
  "document language is zh-CN",
  config.includes('lang: "zh-CN"'),
  "nuxt.config.ts",
);
check(
  "skip link targets main",
  app.includes('href="#main"') && shell.includes('<main id="main"'),
  "app shell",
);
check(
  "student page exposes demo state",
  /DEMO|demo/.test(today),
  routes["/student/today"],
);
check(
  "login exposes unavailable state",
  /unavailable|暂不可用/.test(login),
  routes["/login"],
);
check(
  "player guards browser-only exit confirmation",
  player.includes("import.meta.client"),
  "learning player",
);
check(
  "player supports reduced motion",
  player.includes("prefers-reduced-motion"),
  "learning player",
);
check(
  "icon page has an explicit title",
  /useSeoMeta/.test(icons),
  routes["/design/icons"],
);
check(
  "no autoplay audio on core sources",
  !Object.values(routes).some((file) =>
    /<audio[^>]+autoplay/i.test(read(file)),
  ),
  "core routes",
);

for (const item of checks) {
  console.log(`${item.pass ? "PASS" : "FAIL"}\t${item.name}\t${item.detail}`);
}
console.log(
  `SUMMARY\t${checks.filter((item) => item.pass).length}/${checks.length} passed`,
);
process.exitCode = checks.every((item) => item.pass) ? 0 : 1;
