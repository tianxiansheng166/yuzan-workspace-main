const { chromium } = require("../../../../design-lab/frontend-pixel-v4-adoption/preflight/node_modules/playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const cases = [
    ["/login", 390, 844],
    ["/assessment/report/missing", 768, 1024],
    ["/teacher/review/1?scenario=default", 1440, 900],
  ];
  const failures = [];
  for (const [path, width, height] of cases) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on("console", (message) => {
      if (message.type() === "error") failures.push(`${path}: ${message.text()}`);
    });
    const response = await page.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle" });
    if (!response || response.status() >= 400) failures.push(`${path}: HTTP ${response?.status()}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (overflow) failures.push(`${path}: horizontal overflow at ${width}x${height}`);
    await page.close();
  }
  await browser.close();
  if (failures.length) throw new Error(failures.join("\n"));
  console.log("v4 core browser smoke: 3 routes passed, no console errors or horizontal overflow");
})().catch((error) => { console.error(error); process.exit(1); });
