const { chromium } = require("../../preflight/node_modules/playwright");

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const outDir = process.env.OUT_DIR || "../round-2";

const cases = [
  { routeId: "login", path: "/login" },
  { routeId: "student-today", path: "/student/today" },
  { routeId: "assessment-entry", path: "/assessment" },
  { routeId: "assessment-reading", path: "/assessment/reading" },
  { routeId: "assessment-written", path: "/assessment/written" },
  { routeId: "assessment-report", path: "/assessment/report/demo-report" },
  { routeId: "assessment-history", path: "/assessment/history" },
  { routeId: "teacher-review", path: "/teacher/review/1?scenario=default" },
  { routeId: "teacher-assignments", path: "/teacher/assignments" },
  { routeId: "studio", path: "/studio" },
];

const sizes = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const fs = require("fs");
  const path = require("path");
  const outputRoot = path.resolve(__dirname, outDir);
  fs.mkdirSync(outputRoot, { recursive: true });

  const results = [];

  for (const { routeId, path: routePath } of cases) {
    for (const { width, height } of sizes) {
      const page = await browser.newPage({ viewport: { width, height } });
      const url = `${baseUrl}${routePath}`;
      let response;
      try {
        response = await page.goto(url, { waitUntil: "networkidle" });
      } catch (error) {
        results.push({ routeId, size: `${width}x${height}`, url, httpStatus: null, error: error.message });
        await page.close();
        continue;
      }
      await page.waitForTimeout(500);

      const fileName = `${routeId}-${width}x${height}.png`;
      const filePath = path.join(outputRoot, fileName);
      await page.screenshot({ path: filePath, type: "png" });

      results.push({
        routeId,
        size: `${width}x${height}`,
        url,
        httpStatus: response?.status(),
        fileName,
        filePath,
      });
      await page.close();
    }
  }

  await browser.close();

  const manifest = {
    baseUrl,
    outDir: outputRoot,
    timestamp: new Date().toISOString(),
    results,
  };
  fs.writeFileSync(path.join(outputRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`Captured ${results.length} screenshots to ${outputRoot}`);
  for (const r of results) {
    if (r.httpStatus >= 400) {
      console.log(`[${r.routeId} ${r.size}] HTTP ${r.httpStatus}`);
    }
  }
})().catch((error) => { console.error(error); process.exit(1); });
