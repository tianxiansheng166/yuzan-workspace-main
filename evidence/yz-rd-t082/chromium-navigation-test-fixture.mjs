// TEST_FIXTURE_ONLY: static frontend route and navigation smoke; API proxy is deliberately unreachable.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const evidenceDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(evidenceDir, "../..");
const frontendServer = join(repoRoot, "frontend/server.mjs");
const routes = [
  { key: "today", path: "/student/today/", label: "今日学习", selector: "#todayApp" },
  { key: "courses", path: "/student/courses/", label: "课程中心", selector: "#coursePage" },
  { key: "practice", path: "/student/practices/", label: "练习中心", selector: "#app" },
  { key: "growth", path: "/student/growth/", label: "我的成长", selector: "#growthApp" },
];

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function reservePort() {
  const server = createServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const port = server.address().port;
  await new Promise((resolveClose) => server.close(resolveClose));
  return port;
}

async function waitForFrontend(baseUrl, child) {
  const deadline = Date.now() + 10000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Frontend server exited early: ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/student/today/`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Frontend server did not become ready: ${lastError || "timeout"}`);
}

function waitForChrome(child) {
  return new Promise((resolveChrome, rejectChrome) => {
    let output = "";
    const timer = setTimeout(() => rejectChrome(new Error(`Chrome remote debugging did not start: ${output}`)), 12000);
    const onData = (chunk) => {
      output += chunk.toString();
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timer);
        resolveChrome(match[1]);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("error", (error) => {
      clearTimeout(timer);
      rejectChrome(error);
    });
    child.once("exit", (code) => {
      if (code !== null) {
        clearTimeout(timer);
        rejectChrome(new Error(`Chrome exited before remote debugging started (${code}): ${output}`));
      }
    });
  });
}

function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  const events = [];
  let nextId = 0;

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolveCommand, rejectCommand } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) rejectCommand(new Error(`${message.error.code}: ${message.error.message}`));
      else resolveCommand(message.result || {});
      return;
    }
    events.push(message);
  });

  const ready = new Promise((resolveReady, rejectReady) => {
    socket.addEventListener("open", resolveReady, { once: true });
    socket.addEventListener("error", () => rejectReady(new Error("Chrome DevTools WebSocket failed")), { once: true });
  });

  function command(method, params = {}, sessionId) {
    const id = ++nextId;
    return new Promise((resolveCommand, rejectCommand) => {
      pending.set(id, { resolveCommand, rejectCommand });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  return { socket, ready, command, events };
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  const closed = new Promise((resolveClose) => child.once("exit", resolveClose));
  child.kill("SIGTERM");
  const timer = delay(2500).then(() => {
    if (child.exitCode === null) child.kill("SIGKILL");
  });
  await Promise.race([closed, timer]);
}

const frontendPort = await reservePort();
const frontendChild = spawn(process.execPath, [frontendServer], {
  cwd: repoRoot,
  env: { ...process.env, PORT: String(frontendPort), API_BASE_URL: "http://127.0.0.1:1" },
  stdio: ["ignore", "pipe", "pipe"],
});
const profileDir = await mkdtemp(join(tmpdir(), "yz-rd-t082-chromium-"));
let chromeChild;
let cdp;
const proof = {
  label: "TEST_FIXTURE_ONLY",
  browser: "Chromium through Google Chrome headless",
  api: "not connected; static frontend proxy targets unreachable 127.0.0.1:1",
  data: "no production or student data; browser local storage uses TEST_FIXTURE_ONLY identity",
  widths: [],
  pages: [],
};

try {
  const baseUrl = `http://127.0.0.1:${frontendPort}`;
  await waitForFrontend(baseUrl, frontendChild);
  chromeChild = spawn(process.env.CHROME_BIN || "google-chrome", [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--disable-extensions",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--remote-allow-origins=*",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  const browserWebSocketUrl = await waitForChrome(chromeChild);
  cdp = connectCdp(browserWebSocketUrl);
  await cdp.ready;
  const { targetId } = await cdp.command("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.command("Target.attachToTarget", { targetId, flatten: true });
  await cdp.command("Page.enable", {}, sessionId);
  await cdp.command("Runtime.enable", {}, sessionId);

  const evaluate = async (expression) => {
    const response = await cdp.command("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    }, sessionId);
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || "Browser evaluation failed");
    return response.result?.value;
  };

  const waitForPage = async (route) => {
    const deadline = Date.now() + 10000;
    let latest;
    while (Date.now() < deadline) {
      latest = await evaluate(`(() => ({
        path: location.pathname,
        title: document.title,
        marker: Boolean(document.querySelector(${JSON.stringify(route.selector)})),
        navCount: document.querySelectorAll('a[data-student-nav]').length,
        active: document.querySelector('a[data-student-nav][aria-current="page"] span')?.textContent?.trim() || '',
        viewport: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth
      }))()`);
      if (latest.path === route.path && latest.marker && latest.navCount === 6) return latest;
      await delay(100);
    }
    throw new Error(`Page did not settle at ${route.path}: ${JSON.stringify(latest)}`);
  };

  await cdp.command("Page.navigate", { url: `${baseUrl}/login/` }, sessionId);
  const loginDeadline = Date.now() + 10000;
  while (Date.now() < loginDeadline) {
    const loginState = await evaluate("({ path: location.pathname, ready: document.readyState })");
    if (loginState.path.startsWith("/login") && loginState.ready === "complete") break;
    await delay(100);
  }
  await evaluate(`(() => {
    localStorage.setItem('yuzan-access-token', 'TEST_FIXTURE_ONLY');
    localStorage.setItem('yuzan-active-school-id', 'TEST_FIXTURE_ONLY-school');
    localStorage.setItem('yuzan-current-user', JSON.stringify({
      id: 'TEST_FIXTURE_ONLY-student', role: 'STUDENT', displayName: 'TEST_FIXTURE_ONLY 学生',
      memberships: [{ schoolId: 'TEST_FIXTURE_ONLY-school', role: 'STUDENT' }],
      schoolMemberships: [{ schoolId: 'TEST_FIXTURE_ONLY-school', role: 'STUDENT' }]
    }));
  })()`);

  for (const width of [1280, 1440]) {
    const height = width === 1280 ? 900 : 1000;
    proof.widths.push({ width, height });
    await cdp.command("Emulation.setDeviceMetricsOverride", {
      width, height, deviceScaleFactor: 1, mobile: false,
    }, sessionId);
    await cdp.command("Page.navigate", { url: `${baseUrl}${routes[0].path}` }, sessionId);
    await waitForPage(routes[0]);

    for (const route of routes) {
      if (route !== routes[0]) {
        await evaluate(`(() => {
          const link = document.querySelector('a[data-student-nav][href=${JSON.stringify(route.path)}]');
          if (!link) throw new Error('Missing student navigation link: ${route.path}');
          link.click();
        })()`);
      }
      await delay(450);
      const page = await waitForPage(route);
      if (page.active !== route.label) throw new Error(`Wrong active navigation on ${route.path}: ${page.active}`);
      if (page.scrollWidth > width + 2) throw new Error(`Horizontal overflow at ${width}px on ${route.path}: ${page.scrollWidth}px`);
      await evaluate(`(() => {
        const mark = document.createElement('div');
        mark.textContent = 'TEST_FIXTURE_ONLY · API 未连接';
        mark.setAttribute('aria-hidden', 'true');
        mark.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:2147483647;padding:6px 10px;border:1px solid #8a5a23;border-radius:6px;background:#fff7df;color:#603900;font:600 12px/1.2 sans-serif;pointer-events:none;';
        document.body.appendChild(mark);
      })()`);

      const screenshot = await cdp.command("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
        fromSurface: true,
      }, sessionId);
      const screenshotName = `chromium-${width}-${route.key}.png`;
      await writeFile(join(evidenceDir, screenshotName), Buffer.from(screenshot.data, "base64"));
      proof.pages.push({ ...page, label: route.label, screenshot: screenshotName, fixtureWatermark: true });
    }
  }

  await mkdir(evidenceDir, { recursive: true });
  await writeFile(join(evidenceDir, "chromium-navigation-proof.json"), `${JSON.stringify(proof, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(proof, null, 2)}\n`);
} finally {
  if (cdp?.socket.readyState === WebSocket.OPEN) {
    try { await cdp.command("Browser.close"); } catch { /* Chrome may already be closing. */ }
    cdp.socket.close();
  }
  await stopChild(chromeChild);
  await stopChild(frontendChild);
  await rm(profileDir, { recursive: true, force: true });
}
