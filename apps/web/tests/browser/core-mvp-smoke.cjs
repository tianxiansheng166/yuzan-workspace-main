const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  const apiRequests = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("request", r => { if (r.url().includes("/api/")) apiRequests.push(r.url()); });
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/teacher", "/student/courses"]) {
      const response = await page.goto(`http://127.0.0.1:3100${route}`, { waitUntil: "networkidle" });
      assert.equal(response.status(), 200);
      assert.equal(await page.locator("#__nuxt").count(), 1);
      assert.equal(await page.locator("text=WAITING_BACKEND").count() > 0, true);
      await page.screenshot({ path: path.join(process.env.TEMP, `yuzan-${route.replaceAll("/", "-")}-${width}.png`), fullPage: true });
    }
  }
  assert.deepEqual(errors.filter(e => /hydration/i.test(e)), []);
  assert.deepEqual(apiRequests, []);
  console.log(JSON.stringify({ viewports: [390, 768, 1440], routes: ["/teacher", "/student/courses"], hydrationErrors: 0, apiRequests: 0 }));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
