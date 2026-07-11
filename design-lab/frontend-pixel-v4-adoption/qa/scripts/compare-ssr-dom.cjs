const { chromium } = require("../../preflight/node_modules/playwright");

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const cases = [
  { path: "/login", selector: ".app-shell__navigation--desktop" },
  { path: "/assessment/report/missing", selector: ".app-shell__navigation--desktop" },
  { path: "/teacher/review/1?scenario=default", selector: ".app-shell__navigation--desktop" },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const { path, selector } of cases) {
    const serverPage = await browser.newPage({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
    const serverResponse = await serverPage.goto(`${baseUrl}${path}`, { waitUntil: "load" });
    const serverHtml = await serverPage.content();
    const serverSnippet = await serverPage.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.outerHTML : null;
    }, selector);
    await serverPage.close();

    const clientPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const messages = [];
    clientPage.on("console", (m) => messages.push({ type: m.type(), text: m.text() }));
    clientPage.on("pageerror", (e) => messages.push({ type: "pageerror", text: e.message }));
    await clientPage.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
    await clientPage.waitForTimeout(500);
    const clientSnippet = await clientPage.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.outerHTML : null;
    }, selector);
    await clientPage.close();

    results.push({
      path,
      selector,
      httpStatus: serverResponse?.status(),
      serverSnippet,
      clientSnippet,
      match: serverSnippet === clientSnippet,
      messages: messages.filter((m) => /hydration|mismatch/i.test(m.text)),
    });
  }

  await browser.close();

  const fs = require("fs");
  const path = require("path");
  const outDir = path.join(__dirname, "..", "logs");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `ssr-dom-compare-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`Comparison written to ${outFile}`);

  for (const r of results) {
    console.log(`\n[${r.path}] match=${r.match}`);
    if (!r.match) {
      console.log("SERVER:", r.serverSnippet?.substring(0, 400));
      console.log("CLIENT:", r.clientSnippet?.substring(0, 400));
    }
  }
})().catch((error) => { console.error(error); process.exit(1); });
