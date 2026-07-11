const { chromium } = require("../../preflight/node_modules/playwright");

const baseUrl = process.env.BASE_URL || "http://localhost:3000";

// Routes to smoke for hydration mismatches. Some may legitimately 404 if not implemented.
const routes = [
  "/",
  "/login",
  "/select-school",
  "/student/today",
  "/student/learning/spring-2",
  "/assessment",
  "/assessment/reading",
  "/assessment/written",
  "/assessment/report/missing",
  "/assessment/report/demo-report",
  "/assessment/history",
  "/teacher/assignments",
  "/teacher/review/1?scenario=default",
  "/teacher/review/1/feedback",
  "/studio",
];

function isHydrationMessage(text) {
  const lower = String(text).toLowerCase();
  return (
    lower.includes("hydration") ||
    lower.includes("mismatch") ||
    lower.includes("server-rendered") ||
    lower.includes("client-side") ||
    lower.includes("did not match")
  );
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const route of routes) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const messages = [];
    page.on("console", (message) => {
      const text = message.text();
      messages.push({ type: message.type(), text, isHydration: isHydrationMessage(text) });
    });
    page.on("pageerror", (error) => {
      messages.push({ type: "pageerror", text: error.message, isHydration: isHydrationMessage(error.message) });
    });

    let response;
    try {
      response = await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
    } catch (error) {
      results.push({ route, httpStatus: null, error: error.message, hydrationMessages: [] });
      await page.close();
      continue;
    }

    await page.waitForTimeout(500);
    const hydrationMessages = messages.filter((m) => m.isHydration);
    const overflow = await page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    results.push({
      route,
      httpStatus: response?.status(),
      hydrationMessages,
      overflow,
      fatalErrors: messages.filter((m) => m.type === "error" || m.type === "pageerror"),
    });
    await page.close();
  }

  await browser.close();

  const summary = {
    baseUrl,
    timestamp: new Date().toISOString(),
    total: routes.length,
    hydrationRoutes: results.filter((r) => r.hydrationMessages && r.hydrationMessages.length > 0).length,
    errorRoutes: results.filter((r) => r.httpStatus >= 400 || (r.fatalErrors && r.fatalErrors.length > 0)).length,
    overflowRoutes: results.filter((r) => r.overflow && r.overflow.horizontal).length,
    results,
  };

  const fs = require("fs");
  const path = require("path");
  const outDir = path.join(__dirname, "..", "logs");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `routes-hydration-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));
  console.log(`Routes hydration log written to ${outFile}`);
  console.log(`Hydration issues: ${summary.hydrationRoutes}/${summary.total}`);
  console.log(`HTTP/errors: ${summary.errorRoutes}/${summary.total}`);
  console.log(`Horizontal overflow: ${summary.overflowRoutes}/${summary.total}`);

  for (const r of results) {
    if (r.hydrationMessages && r.hydrationMessages.length > 0) {
      console.log(`\n[${r.route}] hydration mismatches:`);
      for (const m of r.hydrationMessages.slice(0, 3)) {
        console.log(`  [${m.type}] ${m.text.split("\n")[0]}`);
      }
    }
    if (r.httpStatus >= 400) {
      console.log(`\n[${r.route}] HTTP ${r.httpStatus}`);
    }
  }
})().catch((error) => { console.error(error); process.exit(1); });
