import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const evidenceDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(evidenceDir, '../..');
const frontendRoot = join(repoRoot, 'frontend');
const fixture = JSON.parse(await readFile(join(evidenceDir, 'visual-fixture.json'), 'utf8'));
const schoolId = fixture.school.id;
const courseVersionId = fixture.courseVersion.id;
const prefix = process.env.CAPTURE_PREFIX || 'studio';
const assertionFailures = [];
const runtimeExceptions = [];
const apiEvents = [];
let courseVersion = structuredClone(fixture.courseVersion);
let failNextPatch = false;
let fixtureServer;
let frontendServer;
let chromeProcess;
let chromeProfile;
let chromeStderr = '';
let cdp;
let targetSessionId;

function recordCheck(name, condition, detail = undefined) {
  if (!condition) assertionFailures.push({ name, detail });
}

function json(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function createVisualFixtureApi() {
  return createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = url.pathname;
    const detailPath = `/api/v1/schools/${schoolId}/course-versions/${courseVersionId}`;

    try {
      if (req.method === 'GET' && pathname === detailPath) {
        apiEvents.push({ method: 'GET', path: 'course-version' });
        return json(res, 200, courseVersion);
      }
      if (req.method === 'GET' && pathname === `${detailPath}/practice-options`) {
        apiEvents.push({ method: 'GET', path: 'practice-options' });
        return json(res, 200, []);
      }
      if (req.method === 'PATCH' && pathname === detailPath) {
        const body = await readRequestBody(req);
        apiEvents.push({ method: 'PATCH', path: 'course-version', title: body.title });
        if (failNextPatch) {
          failNextPatch = false;
          return json(res, 503, { error: { message: 'VISUAL_FIXTURE_ONLY 模拟保存失败' } });
        }
        courseVersion = {
          ...courseVersion,
          title: body.title || courseVersion.title,
          units: body.units || courseVersion.units,
          updatedAt: new Date('2026-10-20T05:10:00.000Z').toISOString(),
        };
        return json(res, 200, courseVersion);
      }
      if (req.method === 'POST' && pathname === `${detailPath}/submit-review`) {
        apiEvents.push({ method: 'POST', path: 'submit-review' });
        courseVersion = {
          ...courseVersion,
          status: 'IN_REVIEW',
          updatedAt: new Date('2026-10-20T05:20:00.000Z').toISOString(),
        };
        return json(res, 200, { id: courseVersionId, status: 'IN_REVIEW', updatedAt: courseVersion.updatedAt });
      }
      apiEvents.push({ method: req.method, path: pathname, status: 404 });
      return json(res, 404, { error: { message: 'VISUAL_FIXTURE_ONLY unexpected API route' } });
    } catch (error) {
      return json(res, 500, { error: { message: `VISUAL_FIXTURE_ONLY ${error.message}` } });
    }
  });
}

function listen(server, port = 0) {
  return new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolveListen(server.address().port);
    });
  });
}

function closeServer(server) {
  if (!server?.listening) return Promise.resolve();
  return new Promise((resolveClose) => server.close(() => resolveClose()));
}

async function freePort() {
  const reservation = createServer();
  const port = await listen(reservation);
  await closeServer(reservation);
  return port;
}

async function waitFor(check, description, timeout = 12000) {
  const end = Date.now() + timeout;
  let lastError;
  while (Date.now() < end) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Timed out waiting for ${description}${lastError ? `: ${lastError.message}` : ''}`);
}

function startFrontend(port, apiPort) {
  return spawn(process.execPath, [join(frontendRoot, 'server.mjs')], {
    cwd: frontendRoot,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      API_BASE_URL: `http://127.0.0.1:${apiPort}`,
    },
    stdio: 'ignore',
  });
}

class DevToolsConnection {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timeout);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      const handlers = this.listeners.get(message.method) || [];
      handlers.forEach((handler) => handler(message));
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolveOpen, rejectOpen) => {
      socket.addEventListener('open', resolveOpen, { once: true });
      socket.addEventListener('error', rejectOpen, { once: true });
    });
    return new DevToolsConnection(socket);
  }

  on(method, handler) {
    const handlers = this.listeners.get(method) || [];
    handlers.push(handler);
    this.listeners.set(method, handlers);
  }

  send(method, params = {}, sessionId = undefined, timeoutMs = 12000) {
    const id = ++this.nextId;
    return new Promise((resolveMessage, rejectMessage) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        rejectMessage(new Error(`CDP timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolveMessage, reject: rejectMessage, timeout });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  }, targetSessionId);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}

async function setViewport(width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 768,
    screenWidth: width,
    screenHeight: height,
  }, targetSessionId);
  await new Promise((resolveResize) => setTimeout(resolveResize, 250));
}

async function pageMetrics(width, height) {
  return evaluate(`(() => {
    const box = (el) => {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: Math.round(rect.x * 10) / 10, y: Math.round(rect.y * 10) / 10,
        width: Math.round(rect.width * 10) / 10, height: Math.round(rect.height * 10) / 10 };
    };
    const font = (selector) => {
      const el = document.querySelector(selector);
      return el ? Number.parseFloat(getComputedStyle(el).fontSize) : null;
    };
    const panels = document.querySelector('.panels');
    const panelBoxes = [...document.querySelectorAll('.panels > .panel')].slice(0, 3).map(box);
    const actions = [...document.querySelectorAll('.title-actions button')].map((el) => ({
      label: (el.textContent || '').trim(), height: Math.round(el.getBoundingClientRect().height * 10) / 10,
      disabled: el.disabled,
    }));
    const controlSelectors = [
      ['rename', '.title-copy .edit'],
      ['add-unit', '.structure [data-action="add-unit"]'],
      ['add-activity', '.structure [data-action="add-activity"]'],
    ];
    const actionControls = controlSelectors.map(([name, selector]) => ({ name, ...box(document.querySelector(selector)) }));
    const pageButtons = [...document.querySelectorAll('main.responsive-studio button')].map((el) => ({
      label: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 50),
      height: Math.round(el.getBoundingClientRect().height * 10) / 10,
      visible: Boolean(el.getClientRects().length && el.getBoundingClientRect().width && el.getBoundingClientRect().height),
    })).filter((button) => button.visible);
    return {
      viewport: { width: innerWidth, height: innerHeight, requestedWidth: ${width}, requestedHeight: ${height} },
      documentWidth: { html: document.documentElement.scrollWidth, body: document.body.scrollWidth },
      text: {
        titlePx: font('[data-bind="course-title"]'),
        structurePx: font('.tree p.activity'),
        editorHeadingPx: font('.editor-body h3'),
        workflowPx: font('.workflow-hint'),
        activityText: document.querySelector('.tree p.activity')?.textContent?.trim() || null,
      },
      canvas: {
        host: box(document.querySelector('.ts-design-host')),
        root: box(document.querySelector('main.design.responsive-studio')),
        transform: getComputedStyle(document.querySelector('main.design.responsive-studio')).transform,
      },
      panels: {
        columns: getComputedStyle(panels).gridTemplateColumns,
        boxes: panelBoxes,
      },
      buttons: { main: actions, otherActions: actionControls, allPageButtons: pageButtons },
      saveStatus: {
        text: document.querySelector('[data-bind="status-label"]')?.textContent?.trim() || null,
        live: document.querySelector('[data-bind="status-label"]')?.getAttribute('aria-live') || null,
      },
    };
  })()`);
}

async function captureViewport(baseUrl, width, height) {
  await setViewport(width, height);
  const metrics = await pageMetrics(width, height);
  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width, height, scale: 1 },
  }, targetSessionId, 60000);
  const path = join(evidenceDir, `${prefix}-${width}x${height}-chromium.png`);
  await writeFile(path, Buffer.from(screenshot.data, 'base64'));
  return { ...metrics, screenshot: path.split('/').at(-1) };
}

async function tapTab() {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 }, targetSessionId);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 }, targetSessionId);
}

async function runInteractionChecks() {
  apiEvents.length = 0;
  await evaluate(`document.querySelector('.edit').click()`);
  await waitFor(async () => (await evaluate(`document.querySelector('[data-action="save-course"]')?.disabled === false`)), 'dirty state and enabled save action');
  const dirtyStatus = await evaluate(`({text: document.querySelector('[data-bind="status-label"]')?.textContent.trim(), live: document.querySelector('[data-bind="status-label"]')?.getAttribute('aria-live')})`);
  recordCheck('dirty save status is announced', dirtyStatus.text === '未保存' && dirtyStatus.live === 'polite', dirtyStatus);

  await evaluate(`document.querySelector('.edit').focus()`);
  await tapTab();
  await tapTab();
  await tapTab();
  const focus = await evaluate(`(() => {
    const el = document.activeElement;
    const style = el ? getComputedStyle(el) : null;
    return {
      label: (el?.textContent || '').trim(),
      selector: el?.className || el?.tagName || null,
      focusVisible: Boolean(el?.matches(':focus-visible')),
      outlineStyle: style?.outlineStyle || null,
      outlineWidth: style?.outlineWidth || null,
      boxShadow: style?.boxShadow || null,
      height: el ? Math.round(el.getBoundingClientRect().height * 10) / 10 : null,
    };
  })()`);
  recordCheck('keyboard reaches visible Save Draft with focus indicator',
    focus.selector?.includes('save-course') && focus.focusVisible && (focus.outlineStyle !== 'none' || focus.boxShadow !== 'none'), focus);
  const focusShot = await cdp.send('Page.captureScreenshot', {
    format: 'png', fromSurface: true, captureBeyondViewport: false,
    clip: { x: 0, y: 0, width: 390, height: 844, scale: 1 },
  }, targetSessionId, 60000);
  await writeFile(join(evidenceDir, 'studio-keyboard-focus-390x844-chromium.png'), Buffer.from(focusShot.data, 'base64'));

  await evaluate(`document.querySelector('[data-action="save-course"]').click()`);
  await waitFor(async () => apiEvents.some((event) => event.method === 'PATCH') && await evaluate(`document.querySelector('[data-action="save-course"]')?.disabled === true`), 'explicit draft save');
  const saved = await evaluate(`({title: document.querySelector('[data-bind="course-title"]')?.textContent.trim(), status: document.querySelector('[data-bind="status-label"]')?.textContent.trim(), disabled: document.querySelector('[data-action="save-course"]')?.disabled})`);
  recordCheck('explicit Save Draft persists the edit and clears dirty state', saved.status === '课程草稿' && saved.disabled, saved);

  await evaluate(`document.querySelector('.edit').click()`);
  await waitFor(async () => (await evaluate(`document.querySelector('[data-action="save-course"]')?.disabled === false`)), 'second dirty state');
  failNextPatch = true;
  await evaluate(`document.querySelector('.submit').click()`);
  await waitFor(async () => apiEvents.filter((event) => event.method === 'PATCH').length >= 2
    && await evaluate(`document.querySelector('.submit')?.disabled === false`), 'failed save response before review');
  const afterFailure = {
    patchCount: apiEvents.filter((event) => event.method === 'PATCH').length,
    reviewCount: apiEvents.filter((event) => event.path === 'submit-review').length,
    status: await evaluate(`document.querySelector('[data-bind="status-label"]')?.textContent.trim()`),
    saveDisabled: await evaluate(`document.querySelector('[data-action="save-course"]')?.disabled`),
  };
  recordCheck('failed save leaves review unsubmitted and edits dirty',
    afterFailure.patchCount === 2 && afterFailure.reviewCount === 0 && afterFailure.status === '未保存' && afterFailure.saveDisabled === false,
    afterFailure);

  await evaluate(`document.querySelector('.submit').click()`);
  await waitFor(async () => apiEvents.some((event) => event.path === 'submit-review')
    && await evaluate(`document.querySelector('[data-bind="status-label"]')?.textContent.trim() === '审核中'`), 'successful save then review submission');
  const orderedEvents = apiEvents.filter((event) => event.method === 'PATCH' || event.path === 'submit-review');
  const reviewIndex = orderedEvents.findIndex((event) => event.path === 'submit-review');
  recordCheck('review submits only after successful draft save',
    orderedEvents.slice(0, reviewIndex).some((event) => event.method === 'PATCH') && orderedEvents.at(-1)?.path === 'submit-review',
    orderedEvents);

  return { dirtyStatus, keyboardFocus: focus, afterExplicitSave: saved, afterFailedSave: afterFailure, orderedEvents };
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (child.detached && process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM');
    else child.kill('SIGTERM');
  } catch {}
  await Promise.race([
    new Promise((resolveExit) => child.once('exit', resolveExit)),
    new Promise((resolveTimeout) => setTimeout(resolveTimeout, 3000)),
  ]);
  if (child.exitCode === null) {
    try {
      if (child.detached && process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL');
      else child.kill('SIGKILL');
    } catch {}
  }
}

try {
  if (fixture.label !== 'VISUAL_FIXTURE_ONLY' || fixture.apiE2e !== false) throw new Error('Fixture provenance marker missing.');
  fixtureServer = createVisualFixtureApi();
  const apiPort = await listen(fixtureServer);
  const frontendPort = await freePort();
  frontendServer = startFrontend(frontendPort, apiPort);
  const baseUrl = `http://127.0.0.1:${frontendPort}`;
  await waitFor(async () => {
    const response = await fetch(`${baseUrl}/teacher/courses/spring/studio/?courseVersionId=${courseVersionId}`);
    return response.ok;
  }, 'isolated frontend static server');

  chromeProfile = await mkdtemp(join(tmpdir(), 'yz-rd-t067-chrome-'));
  const chromeBinary = process.env.CHROME_BIN || '/opt/google/chrome/chrome';
  await access(chromeBinary);
  chromeProcess = spawn(chromeBinary, [
    '--headless=new',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${chromeProfile}`,
    'about:blank',
  ], { detached: true, stdio: ['ignore', 'ignore', 'pipe'] });
  chromeProcess.stderr.setEncoding('utf8');
  chromeProcess.stderr.on('data', (chunk) => { chromeStderr = `${chromeStderr}${chunk}`.slice(-4000); });

  const activePortPath = join(chromeProfile, 'DevToolsActivePort');
  const activePort = await waitFor(async () => {
    if (chromeProcess.exitCode !== null) throw new Error(`Chromium exited (${chromeProcess.exitCode}): ${chromeStderr}`);
    try { return Number((await readFile(activePortPath, 'utf8')).split('\n')[0]); }
    catch { return null; }
  }, 'owned Chromium DevTools endpoint', 30000);
  const version = await (await fetch(`http://127.0.0.1:${activePort}/json/version`)).json();
  cdp = await DevToolsConnection.connect(version.webSocketDebuggerUrl);
  const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const attached = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  targetSessionId = attached.sessionId;
  cdp.on('Runtime.exceptionThrown', (event) => runtimeExceptions.push(event.params.exceptionDetails.text));
  await cdp.send('Page.enable', {}, targetSessionId);
  await cdp.send('Runtime.enable', {}, targetSessionId);
  const bootstrap = `(() => {
    localStorage.setItem('yuzan-access-token', 'VISUAL_FIXTURE_ONLY');
    localStorage.setItem('yuzan-active-school-id', ${JSON.stringify(schoolId)});
    localStorage.setItem('yuzan-current-user', ${JSON.stringify(JSON.stringify({
      id: fixture.teacher.id,
      displayName: fixture.teacher.displayName,
      memberships: [{ schoolId, role: 'TEACHER', schoolName: fixture.school.name }],
    }))});
    window.prompt = () => '未保存课程标题';
    window.confirm = () => true;
  })();`;
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: bootstrap }, targetSessionId);

  const initialUrl = `${baseUrl}/teacher/courses/spring/studio/?courseVersionId=${courseVersionId}`;
  await cdp.send('Page.navigate', { url: initialUrl }, targetSessionId);
  try {
    await waitFor(async () => evaluate(`document.readyState === 'complete'
      && document.querySelector('.tree p.activity')
      && document.querySelector('[data-bind="course-title"]')?.textContent.includes('高原春声')`), 'studio page and fixture course rendering');
  } catch (error) {
    const pageState = await evaluate(`({
      href: location.href,
      readyState: document.readyState,
      title: document.querySelector('[data-bind="course-title"]')?.textContent,
      status: document.querySelector('[data-bind="status-label"]')?.textContent,
      body: document.body.innerText.slice(0, 1000),
      tokenSet: Boolean(localStorage.getItem('yuzan-access-token')),
      schoolSet: Boolean(localStorage.getItem('yuzan-active-school-id')),
    })`).catch((diagnosticError) => ({ diagnosticError: diagnosticError.message }));
    console.error(JSON.stringify({ pageState, apiEvents, runtimeExceptions }));
    throw error;
  }

  const viewports = [[390, 844], [768, 1024], [1280, 900], [1440, 1000]];
  const viewportEvidence = [];
  for (const [width, height] of viewports) viewportEvidence.push(await captureViewport(baseUrl, width, height));

  const mobile = viewportEvidence.find((item) => item.viewport.requestedWidth === 390);
  const tablet = viewportEvidence.find((item) => item.viewport.requestedWidth === 768);
  const desktop = viewportEvidence.filter((item) => item.viewport.requestedWidth >= 1280);
  recordCheck('390px course text remains at readable size',
    mobile.text.titlePx >= 23 && mobile.text.structurePx >= 13 && mobile.text.editorHeadingPx >= 14, mobile.text);
  recordCheck('390px and 768px do not scale the 1536px design canvas',
    [mobile, tablet].every((item) => item.canvas.transform === 'none' && item.canvas.root.width <= item.viewport.width),
    [mobile.canvas, tablet.canvas]);
  recordCheck('mobile and tablet panels stack vertically',
    [mobile, tablet].every((item) => item.panels.boxes.length === 3
      && item.panels.boxes[1].y > item.panels.boxes[0].y
      && item.panels.boxes[2].y > item.panels.boxes[1].y
      && item.panels.boxes.every((box) => Math.abs(box.x - item.panels.boxes[0].x) < 2)),
    [mobile.panels, tablet.panels]);
  recordCheck('mobile and tablet document have no horizontal overflow',
    [mobile, tablet].every((item) => item.documentWidth.html <= item.viewport.width && item.documentWidth.body <= item.viewport.width),
    [mobile.documentWidth, tablet.documentWidth]);
  recordCheck('desktop keeps the three-panel course structure',
    desktop.every((item) => item.panels.boxes.length === 3 && item.panels.boxes.every((box) => box.width > 0)
      && Math.max(...item.panels.boxes.map((box) => box.y)) - Math.min(...item.panels.boxes.map((box) => box.y)) < 2),
    desktop.map((item) => ({ width: item.viewport.width, panels: item.panels })));
  recordCheck('primary operation buttons meet 44px touch height at 390px',
    mobile.buttons.main.every((button) => button.height >= 44)
      && mobile.buttons.otherActions.filter((button) => button.height !== null).every((button) => button.height >= 44),
    { main: mobile.buttons.main, otherActions: mobile.buttons.otherActions });
  recordCheck('operation buttons meet 44px touch height at all requested viewports',
    viewportEvidence.every((item) => item.buttons.main.every((button) => button.height >= 44)
      && item.buttons.otherActions.filter((button) => button.height !== null).every((button) => button.height >= 44)
      && item.buttons.allPageButtons.every((button) => button.height >= 44)),
    viewportEvidence.map((item) => ({ width: item.viewport.width, main: item.buttons.main, otherActions: item.buttons.otherActions, allPageButtons: item.buttons.allPageButtons })));
  recordCheck('draft status uses a polite live region', mobile.saveStatus.live === 'polite', mobile.saveStatus);

  await setViewport(390, 844);
  const interactionProof = await runInteractionChecks();
  const proof = {
    taskId: 'YZ-RD-T067',
    fixture: fixture.label,
    realApiConnected: false,
    browser: 'Google Chrome/Chromium, isolated headless process, ephemeral DevTools port',
    sharedBrowserService9222Touched: false,
    viewports: viewportEvidence,
    interactions: interactionProof,
    runtimeExceptions,
    assertionFailures,
  };
  await writeFile(join(evidenceDir, 'browser-proof.json'), `${JSON.stringify(proof, null, 2)}\n`);
  console.log(JSON.stringify(proof, null, 2));
  if (assertionFailures.length || runtimeExceptions.length) process.exitCode = 1;
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
} finally {
  cdp?.close();
  await stopChild(chromeProcess);
  await stopChild(frontendServer);
  await closeServer(fixtureServer);
  if (chromeProfile) await rm(chromeProfile, { recursive: true, force: true });
}
