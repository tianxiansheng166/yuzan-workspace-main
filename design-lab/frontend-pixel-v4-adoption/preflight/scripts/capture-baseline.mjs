import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..', '..', '..');

const sizes = [
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1440x900', width: 1440, height: 900 },
];

const sourceRoutes = [
  { id: 'home', path: '/' },
  { id: 'login', path: '/login' },
  { id: 'select-school', path: '/select-school' },
  { id: 'teacher-studio', path: '/teacher/courses/spring/studio' },
  { id: 'teacher-assignments', path: '/teacher/assignments' },
  { id: 'teacher-review', path: '/teacher/reviews/submission-1' },
  { id: 'student-today', path: '/student/today' },
  { id: 'student-learn', path: '/student/learn/spring-2' },
  { id: 'student-growth', path: '/student/growth' },
  { id: 'assessment', path: '/assessment' },
  { id: 'assessment-reading', path: '/assessment/reading/2' },
  { id: 'assessment-written', path: '/assessment/written' },
  { id: 'assessment-report', path: '/assessment/report/demo' },
  { id: 'assessment-history', path: '/assessment/history' },
];

const officialRoutes = [
  { id: 'home', path: '/' },
  { id: 'login', path: '/login' },
  { id: 'student-today', path: '/student/today' },
  { id: 'assessment', path: '/assessment' },
  { id: 'assessment-reading', path: '/assessment/reading' },
  { id: 'assessment-written', path: '/assessment/written' },
  { id: 'assessment-report', path: '/assessment/report/demo-report' },
  { id: 'assessment-history', path: '/assessment/history' },
  { id: 'teacher-assignments', path: '/teacher/assignments' },
  { id: 'teacher-review', path: '/teacher/review/1' },
  { id: 'studio', path: '/studio' },
];

function startServer(cwd, port, env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ['server.mjs'], {
      cwd,
      env: { ...process.env, PORT: String(port), ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });
    const timeout = setTimeout(() => { reject(new Error(`server start timeout on port ${port}\n${stderr}`)); }, 15000);
    const probe = setInterval(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/`);
        if (res.ok) {
          clearInterval(probe);
          clearTimeout(timeout);
          resolve(proc);
        }
      } catch {}
    }, 300);
  });
}

function startOfficialServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn('pnpm', ['--filter', '@yuzan/web', 'dev'], {
      cwd: root,
      env: { ...process.env },
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });
    const timeout = setTimeout(() => { reject(new Error(`official dev server start timeout\n${stderr}`)); }, 300000);
    const probe = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:3000/');
        if (res.ok || res.status === 404) {
          clearInterval(probe);
          clearTimeout(timeout);
          resolve(proc);
        }
      } catch {}
    }, 500);
  });
}

async function waitForPageLoad(page, url) {
  try {
    const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    return res;
  } catch {
    const res = await page.goto(url, { waitUntil: 'load', timeout: 15000 });
    return res;
  }
}

async function captureSet(browser, baseUrl, routes, outDir, label) {
  const results = [];
  for (const route of routes) {
    const url = `${baseUrl}${route.path}`;
    for (const size of sizes) {
      const context = await browser.newContext({ viewport: { width: size.width, height: size.height } });
      const page = await context.newPage();
      let res;
      let error;
      try {
        res = await waitForPageLoad(page, url);
        await page.waitForTimeout(800);
      } catch (e) { error = e.message; }
      const fileName = `${route.id}-${size.name}.png`;
      const filePath = join(outDir, fileName);
      let blank = false;
      if (!error) {
        try {
          const bodyBox = await page.locator('body').boundingBox();
          blank = !bodyBox || bodyBox.height < 20;
          await page.screenshot({ path: filePath, fullPage: false });
        } catch (e) {
          error = e.message;
        }
      }
      results.push({ routeId: route.id, size: size.name, url, httpStatus: res?.status() ?? null, blank, error, fileName });
      await context.close();
    }
  }
  return results;
}

async function main() {
  const v3Root = join(root, '..', '..', 'yuzan-next', 'source-materials', 'yuzan-pixel-v3-runtime');
  const v4Root = join(root, '..', '..', 'yuzan-next', 'source-materials', 'yuzan-pixel-v4-runtime');
  const outRoot = join(root, 'design-lab', 'frontend-pixel-v4-adoption', 'preflight');

  console.log('Starting servers...');
  const v3Server = await startServer(v3Root, 4173);
  const v4Server = await startServer(v4Root, 4174);
  const officialServer = await startOfficialServer();

  const browser = await chromium.launch({ headless: true });
  try {
    const v3Out = join(outRoot, 'v3');
    const v4Out = join(outRoot, 'v4');
    const officialOut = join(outRoot, 'official-before');
    await mkdir(v3Out, { recursive: true });
    await mkdir(v4Out, { recursive: true });
    await mkdir(officialOut, { recursive: true });

    console.log('Capturing V3 source baselines...');
    const v3Results = await captureSet(browser, 'http://127.0.0.1:4173', sourceRoutes, v3Out, 'v3');
    console.log('Capturing V4 source baselines...');
    const v4Results = await captureSet(browser, 'http://127.0.0.1:4174', sourceRoutes, v4Out, 'v4');
    console.log('Capturing official-before baselines...');
    const officialResults = await captureSet(browser, 'http://localhost:3000', officialRoutes, officialOut, 'official-before');

    const report = { generatedAt: new Date().toISOString(), sizes: sizes.map(s => s.name), v3: v3Results, v4: v4Results, official: officialResults };
    await writeFile(join(outRoot, 'baseline-report.json'), JSON.stringify(report, null, 2));
    console.log('Baseline report written to', join(outRoot, 'baseline-report.json'));

    const failures = [...v3Results, ...v4Results, ...officialResults].filter(r => r.error || r.httpStatus >= 400 || r.blank);
    if (failures.length) {
      console.error('Failures:', failures);
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
    v3Server.kill('SIGTERM');
    v4Server.kill('SIGTERM');
    officialServer.kill('SIGTERM');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
