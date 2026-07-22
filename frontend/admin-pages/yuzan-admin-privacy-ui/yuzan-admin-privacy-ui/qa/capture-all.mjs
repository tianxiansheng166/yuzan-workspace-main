import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const specs = [
  ['desktop', 1680, 945],
  ['tablet', 1024, 1366],
  ['mobile', 390, 1200]
];
for (const [name, width, height] of specs) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(root, 'index.html'));
  await page.screenshot({ path: path.join(__dirname, `${name}.png`), fullPage: name !== 'desktop' });
  await page.close();
}
await browser.close();
writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify({ ok: true, views: specs.map(([name]) => name) }, null, 2));
