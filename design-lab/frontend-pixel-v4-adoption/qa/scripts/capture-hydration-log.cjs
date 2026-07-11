const { chromium } = require("../../preflight/node_modules/playwright");

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const cases = [
  { path: "/login", width: 390, height: 844 },
  { path: "/login", width: 1440, height: 900 },
  { path: "/assessment/report/missing", width: 768, height: 1024 },
  { path: "/assessment/report/missing", width: 1440, height: 900 },
  { path: "/teacher/review/1?scenario=default", width: 768, height: 1024 },
  { path: "/teacher/review/1?scenario=default", width: 1440, height: 900 },
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

  for (const { path, width, height } of cases) {
    const page = await browser.newPage({ viewport: { width, height } });
    const messages = [];

    page.on("console", (message) => {
      const text = message.text();
      messages.push({
        type: message.type(),
        text,
        location: message.location(),
        isHydration: isHydrationMessage(text),
      });
    });

    page.on("pageerror", (error) => {
      messages.push({ type: "pageerror", text: error.message, isHydration: isHydrationMessage(error.message) });
    });

    const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    const hydrationMessages = messages.filter((m) => m.isHydration);
    const overflow = await page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    results.push({
      path,
      viewport: `${width}x${height}`,
      httpStatus: response?.status(),
      messages,
      hydrationMessages,
      overflow,
    });

    await page.close();
  }

  await browser.close();

  const summary = {
    baseUrl,
    timestamp: new Date().toISOString(),
    totalCases: cases.length,
    hydrationCases: results.filter((r) => r.hydrationMessages.length > 0).length,
    results,
  };

  const fs = require("fs");
  const path = require("path");
  const outDir = path.join(__dirname, "..", "logs");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `hydration-log-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));
  console.log(`Hydration log written to ${outFile}`);
  console.log(`Cases with hydration issues: ${summary.hydrationCases}/${summary.totalCases}`);

  for (const r of results) {
    if (r.hydrationMessages.length > 0) {
      console.log(`\n[${r.path} @ ${r.viewport}]`);
      for (const m of r.hydrationMessages) {
        console.log(`  [${m.type}] ${m.text}`);
      }
    }
  }
})().catch((error) => { console.error(error); process.exit(1); });
