const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const outDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const pages = [
  { name: 'student-today', url: 'http://localhost:4175/student/today' },
  { name: 'student-courses', url: 'http://localhost:4175/student/courses' },
  { name: 'teacher', url: 'http://localhost:4175/teacher' },
  { name: 'admin', url: 'http://localhost:4175/admin' },
  { name: 'volunteer', url: 'http://localhost:4175/volunteer' },
  { name: 'research', url: 'http://localhost:4175/research' },
  { name: 'teacher-tools', url: 'http://localhost:4175/teacher-tools' },
  { name: 'plans', url: 'http://localhost:4175/plans' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  for (const p of pages) {
    const page = await context.newPage();
    await page.goto(p.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(outDir, `${p.name}.png`), fullPage: false });
    console.log('saved', p.name);
    await page.close();
  }
  await browser.close();
})();
