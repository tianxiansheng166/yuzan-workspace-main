import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const evidenceDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(evidenceDir, '../..');
const fixture = JSON.parse(await readFile(join(evidenceDir, 'visual-fixture.json'), 'utf8'));
const prefix = process.env.CAPTURE_PREFIX || 'after';
const expectClear = process.env.EXPECT_CLEAR === '1';
const apiEvents = [];
const failures = [];
let fixtureServer;
let frontendServer;
let chromeProcess;
let chromeProfile;
let chromeStderr = '';
let cdp;
let sessionId;

if (fixture.label !== 'VISUAL_FIXTURE_ONLY' || fixture.apiE2e !== false) {
  throw new Error('Visual fixture provenance marker missing.');
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function createFixtureApi() {
  const { school, assignment, course, submission } = fixture;
  const root = `/api/v1/schools/${school.id}`;
  return createServer((req, res) => {
    const path = new URL(req.url || '/', 'http://127.0.0.1').pathname;
    if (req.method === 'GET' && path === `${root}/student/courses/${assignment.id}`) {
      apiEvents.push({ method: req.method, route: 'student-course' });
      return json(res, 200, course);
    }
    if (req.method === 'POST' && path === `${root}/student/courses/${assignment.id}/submissions`) {
      apiEvents.push({ method: req.method, route: 'course-submission' });
      return json(res, 200, { submission });
    }
    if (req.method === 'GET' && path === `${root}/learning/activities/t069-visual-speech-activity/note`) {
      apiEvents.push({ method: req.method, route: 'student-activity-note' });
      return json(res, 200, { content: '', revision: 0 });
    }
    apiEvents.push({ method: req.method, route: path, status: 404 });
    return json(res, 404, { error: { message: 'VISUAL_FIXTURE_ONLY unexpected request' } });
  });
}

function listen(server) {
  return new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolveListen(server.address().port);
    });
  });
}

function closeServer(server) {
  if (!server?.listening) return Promise.resolve();
  server.closeAllConnections?.();
  return new Promise((resolveClose) => server.close(resolveClose));
}

async function freePort() {
  const server = createServer();
  const port = await listen(server);
  await closeServer(server);
  return port;
}

async function waitFor(check, message, timeout = 15000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Timed out waiting for ${message}${lastError ? `: ${lastError.message}` : ''}`);
}

function startFrontend(port, apiPort) {
  return spawn(process.execPath, [join(repoRoot, 'frontend', 'server.mjs')], {
    cwd: join(repoRoot, 'frontend'),
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), API_BASE_URL: `http://127.0.0.1:${apiPort}` },
    stdio: 'ignore',
  });
}

class DevToolsConnection {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
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

  send(method, params = {}, targetSessionId = undefined, timeoutMs = 12000) {
    const id = ++this.nextId;
    return new Promise((resolveMessage, rejectMessage) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        rejectMessage(new Error(`CDP timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolveMessage, reject: rejectMessage, timer });
      this.socket.send(JSON.stringify({ id, method, params, ...(targetSessionId ? { sessionId: targetSessionId } : {}) }));
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
  }, sessionId);
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
  }, sessionId);
  await new Promise((resolveResize) => setTimeout(resolveResize, 180));
}

async function pageMetrics(width, height) {
  return evaluate(`(() => {
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), width: +r.width.toFixed(1), height: +r.height.toFixed(1) };
    };
    const intersects = (a, b) => Boolean(a && b && a.x < b.x + b.width && a.x + a.width > b.x
      && a.y < b.y + b.height && a.y + a.height > b.y);
    const nav = document.querySelector('#yuzan-global-nav .nav-toggle');
    const recorder = document.querySelector('#courseRecorder');
    const selectors = {
      pipeline: '.vr-pipeline', recordingState: '.vr-state', timer: '.vr-time', errorCopy: '.vr-substate', errorToast: '.vr-toast',
      micButton: '.vr-mic', recordAction: '.vr-action', finish: '#finishCourseRecording',
      preview: '#previewCourseRecording', upload: '#completeActivity', courseBack: '#backToCourse',
      coursePath: '#chapterPath a.active', syncStatus: '#syncState'
    };
    const targets = Object.fromEntries(Object.entries(selectors).map(([name, selector]) => {
      const el = document.querySelector(selector);
      const r = el?.getBoundingClientRect();
      const inViewport = Boolean(r && r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= 0
        && r.right <= innerWidth && r.bottom <= innerHeight);
      return [name, { box: box(el), inViewport, label: (el?.innerText || el?.getAttribute('aria-label') || '').trim(),
        hidden: !el || !el.getClientRects().length, disabled: Boolean(el?.disabled) }];
    }));
    const navBox = box(nav);
    const protectedNames = ['pipeline', 'recordingState', 'timer', 'errorCopy', 'errorToast', 'micButton', 'recordAction', 'finish', 'preview', 'upload'];
    const navOverlaps = protectedNames.filter((name) => !targets[name].hidden && intersects(navBox, targets[name].box));
    const recordActionBox = targets.recordAction.box;
    const recorderBox = box(recorder);
    const recordActionInsideRecorder = Boolean(recordActionBox && recorderBox
      && recordActionBox.x >= recorderBox.x && recordActionBox.x + recordActionBox.width <= recorderBox.x + recorderBox.width
      && recordActionBox.y >= recorderBox.y && recordActionBox.y + recordActionBox.height <= recorderBox.y + recorderBox.height);
    const pipelineBox = targets.pipeline.box;
    const pipelineInsideRecorder = targets.pipeline.hidden || Boolean(pipelineBox && recorderBox
      && pipelineBox.x >= recorderBox.x && pipelineBox.x + pipelineBox.width <= recorderBox.x + recorderBox.width);
    const interactive = [...document.querySelectorAll('#learningShell a, #learningShell button, #yuzan-global-nav a, #yuzan-global-nav button')]
      .filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
      .map((el) => ({ label: (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 44),
        height: +el.getBoundingClientRect().height.toFixed(1), disabled: Boolean(el.disabled) }));
    return {
      viewport: { width: innerWidth, height: innerHeight, requestedWidth: ${width}, requestedHeight: ${height}, scrollY },
      document: { htmlWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight },
      nav: { box: navBox, position: getComputedStyle(document.querySelector('#yuzan-global-nav')).position,
        classScope: document.body.classList.contains('student-speech-activity') },
      recorder: { box: recorderBox, state: recorder?.dataset.state, targets, navOverlaps, recordActionInsideRecorder, pipelineInsideRecorder,
        touchTargetsUnder44: interactive.filter((item) => item.height < 44) },
      courseNav: { back: targets.courseBack, activeActivity: targets.coursePath,
        menuLinks: [...document.querySelectorAll('#yuzan-global-nav .nav-panel a')].map((a) => a.innerText.trim()) },
      scroll: { canScroll: document.documentElement.scrollHeight > innerHeight }
    };
  })()`);
}

async function capture(width, height, name) {
  await setViewport(width, height);
  const metrics = await pageMetrics(width, height);
  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width, height, scale: 1 },
  }, sessionId, 60000);
  await writeFile(join(evidenceDir, `${name}-${width}x${height}-chromium.png`), Buffer.from(screenshot.data, 'base64'));
  return metrics;
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
  fixtureServer = createFixtureApi();
  const apiPort = await listen(fixtureServer);
  const frontendPort = await freePort();
  frontendServer = startFrontend(frontendPort, apiPort);
  const origin = `http://127.0.0.1:${frontendPort}`;
  await waitFor(async () => (await fetch(`${origin}/student/courses/`)).ok, 'isolated frontend server');

  chromeProfile = await mkdtemp(join(tmpdir(), 'yz-rd-t069-chrome-'));
  const chromeBinary = process.env.CHROME_BIN || '/usr/bin/google-chrome';
  await access(chromeBinary);
  chromeProcess = spawn(chromeBinary, [
    '--headless=new', '--disable-gpu', '--disable-dev-shm-usage', '--disable-background-networking',
    '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
    `--user-data-dir=${chromeProfile}`, 'about:blank',
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
  sessionId = (await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true })).sessionId;
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  const bootstrap = `(() => {
    localStorage.setItem('yuzan-access-token', 'VISUAL_FIXTURE_ONLY');
    localStorage.setItem('yuzan-active-school-id', ${JSON.stringify(fixture.school.id)});
    localStorage.setItem('yuzan-current-user', ${JSON.stringify(JSON.stringify({
      id: fixture.student.id,
      displayName: fixture.student.displayName,
      memberships: [{ schoolId: fixture.school.id, role: 'STUDENT', schoolName: fixture.school.name }],
    }))});
  })();`;
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: bootstrap }, sessionId);
  const assignment = fixture.assignment;
  const route = `/student/courses/${assignment.id}/submissions/${assignment.submissionId}/activities/t069-visual-speech-activity`;
  await cdp.send('Page.navigate', { url: `${origin}${route}` }, sessionId);
  await waitFor(async () => evaluate(`document.readyState === 'complete' && document.querySelector('#courseRecorder .vr-state')
    && document.querySelector('#yuzan-global-nav .nav-toggle') && !document.querySelector('#learningShell').hidden`), 'speech activity rendered from visual fixture');

  const dimensions = [[390, 844], [768, 1024], [1280, 900], [1440, 1000]];
  const screenshots = [];
  for (const [width, height] of dimensions) screenshots.push(await capture(width, height, `${prefix}`));
  const mobile = screenshots.find((item) => item.viewport.requestedWidth === 390);
  const tablet = screenshots.find((item) => item.viewport.requestedWidth === 768);
  const desktop = screenshots.filter((item) => item.viewport.requestedWidth >= 1280);
  const checks = {
    currentSpeechRouteMarked: screenshots.every((item) => item.nav.classScope),
    pageScopedNavLeavesReservedTopArea: screenshots.every((item) => item.nav.position === 'absolute'
      && item.nav.box.y >= 0 && item.nav.box.y + item.nav.box.height < item.recorder.targets.courseBack.box.y),
    noHorizontalOverflow: screenshots.every((item) => item.document.htmlWidth <= item.viewport.width && item.document.bodyWidth <= item.viewport.width),
    navDoesNotOverlapRecorderStateOrControls: screenshots.map((item) => ({ width: item.viewport.width, overlaps: item.recorder.navOverlaps })),
    recordActionInsideRecorder: screenshots.map((item) => ({ width: item.viewport.width, inside: item.recorder.recordActionInsideRecorder })),
    pipelineInsideRecorder: screenshots.map((item) => ({ width: item.viewport.width, inside: item.recorder.pipelineInsideRecorder,
      hidden: item.recorder.targets.pipeline.hidden })),
    controlTargetsAtLeast44: screenshots.every((item) => item.recorder.touchTargetsUnder44.length === 0),
    courseNavigationRetained: screenshots.every((item) => item.courseNav.menuLinks.length > 0 && !item.courseNav.back.hidden && !item.courseNav.activeActivity.hidden),
    pageCanScroll: screenshots.every((item) => item.scroll.canScroll),
  };
  if (expectClear) {
    assert(checks.currentSpeechRouteMarked, 'Speech activity body scope is missing.');
    assert(checks.pageScopedNavLeavesReservedTopArea, 'The speech navigation is outside its reserved top area.');
    assert(checks.noHorizontalOverflow, 'A requested viewport has horizontal overflow.');
    assert(checks.navDoesNotOverlapRecorderStateOrControls.every((item) => item.overlaps.length === 0), 'Floating navigation overlaps a speech state or control.');
    assert(checks.recordActionInsideRecorder.every((item) => item.inside), 'The record action overflows its recorder panel.');
    assert(checks.pipelineInsideRecorder.every((item) => item.inside), 'A visible recorder status pipeline overflows its panel.');
    assert(checks.controlTargetsAtLeast44, 'A visible course or global navigation target is shorter than 44px.');
    assert(checks.courseNavigationRetained, 'Course or global navigation is missing.');
    assert(checks.pageCanScroll, 'The course activity page does not scroll.');
    assert(mobile.recorder.targets.recordingState.box && mobile.recorder.targets.timer.box, 'Mobile recording state or timer is missing.');
  }

  await setViewport(390, 844);
  await evaluate(`(() => {
    const recorder = document.querySelector('#courseRecorder');
    window.scrollTo(0, recorder.getBoundingClientRect().top + scrollY - 18);
  })()`);
  const scrollState = await pageMetrics(390, 844);
  await setViewport(768, 1024);
  await evaluate(`(() => {
    const recorder = document.querySelector('#courseRecorder');
    window.scrollTo(0, recorder.getBoundingClientRect().top + scrollY - 18);
  })()`);
  const tabletScrollState = await pageMetrics(768, 1024);
  await setViewport(390, 844);
  await evaluate(`(() => {
    const recorder = document.querySelector('#courseRecorder');
    window.scrollTo(0, recorder.getBoundingClientRect().top + scrollY - 18);
  })()`);
  const mobileRecorderTargets = scrollState.recorder.targets;
  const tabletRecorderTargets = tabletScrollState.recorder.targets;
  const responsiveScrollVisibility = [
    { width: 390, navOverlaps: scrollState.recorder.navOverlaps, pipelineHidden: mobileRecorderTargets.pipeline.hidden,
      state: mobileRecorderTargets.recordingState.inViewport, timer: mobileRecorderTargets.timer.inViewport,
      errorCopy: mobileRecorderTargets.errorCopy.inViewport, micButton: mobileRecorderTargets.micButton.inViewport,
      recordAction: mobileRecorderTargets.recordAction.inViewport, recorder: scrollState.recorder.box },
    { width: 768, navOverlaps: tabletScrollState.recorder.navOverlaps, pipelineHidden: tabletRecorderTargets.pipeline.hidden,
      state: tabletRecorderTargets.recordingState.inViewport, timer: tabletRecorderTargets.timer.inViewport,
      errorCopy: tabletRecorderTargets.errorCopy.inViewport, micButton: tabletRecorderTargets.micButton.inViewport,
      recordAction: tabletRecorderTargets.recordAction.inViewport, recorder: tabletScrollState.recorder.box },
  ];
  if (expectClear) {
    for (const view of responsiveScrollVisibility) {
      assert(view.navOverlaps.length === 0, `${view.width}px navigation overlaps the recorder after scrolling.`);
      assert(view.state && view.timer && view.errorCopy && view.micButton && view.recordAction,
        `${view.width}px recording state or controls are outside the viewport after scrolling.`);
    }
    assert(tabletRecorderTargets.pipeline.inViewport, '768px recorder status pipeline is not visible after scrolling.');
  }
  const component = await evaluate(`(() => {
    const root = document.querySelector('#courseRecorder');
    return { root: Boolean(root), voice: Boolean(root?.__voiceRecorder), currentState: root?.dataset.state };
  })()`);
  assert(component.root && component.voice, 'The shared voice recorder component did not initialize.');

  await evaluate(`(() => {
    const voice = document.querySelector('#courseRecorder').__voiceRecorder;
    voice.setState('recording');
    voice.timeEl.textContent = '00:08';
  })()`);
  const recordingStateProof = await pageMetrics(390, 844);

  await evaluate(`(() => {
    const voice = document.querySelector('#courseRecorder').__voiceRecorder;
    voice.setState('error');
    voice.notify('麦克风权限被拒绝，请允许后重试；尚未录音');
  })()`);
  const errorStateProof = await pageMetrics(390, 844);

  await evaluate(`(() => {
    const root = document.querySelector('#courseRecorder');
    const voice = root.__voiceRecorder;
    voice.blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/webm' });
    voice.elapsedMs = 8000;
    voice.setState('recorded');
    root.dispatchEvent(new CustomEvent('recorder:blob-ready', { detail: { size: voice.blob.size, mimeType: voice.blob.type } }));
  })()`);
  const recordedStateProof = await pageMetrics(390, 844);

  await evaluate(`window.scrollTo(0, 0); document.querySelector('#yuzan-global-nav .nav-toggle').focus()`);
  const keyboardFocus = await evaluate(`(() => {
    const el = document.querySelector('#yuzan-global-nav .nav-toggle');
    const style = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { focusVisible: el.matches(':focus-visible'), outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth, box: { x: r.x, y: r.y, width: r.width, height: r.height } };
  })()`);
  await evaluate(`document.querySelector('#yuzan-global-nav .nav-toggle').click()`);
  await new Promise((resolveOpen) => setTimeout(resolveOpen, 250));
  const openNavigation = await evaluate(`(() => {
    const panel = document.querySelector('#yuzan-global-nav .nav-panel');
    const r = panel.getBoundingClientRect();
    const links = [...panel.querySelectorAll('a')].map((el) => ({ label: el.innerText.trim(), height: el.getBoundingClientRect().height,
      visible: getComputedStyle(el).visibility === 'visible' && getComputedStyle(el).display !== 'none' }));
    return { box: { x: r.x, y: r.y, width: r.width, height: r.height },
      visible: getComputedStyle(panel).visibility === 'visible', links };
  })()`);

  const stateVisibility = {
    responsiveScroll: responsiveScrollVisibility,
    recorderInView: { navOverlaps: scrollState.recorder.navOverlaps, recorder: scrollState.recorder.box, nav: scrollState.nav.box },
    recording: { navOverlaps: recordingStateProof.recorder.navOverlaps,
      state: recordingStateProof.recorder.targets.recordingState, timer: recordingStateProof.recorder.targets.timer,
      finish: recordingStateProof.recorder.targets.finish, action: recordingStateProof.recorder.targets.recordAction },
    error: { navOverlaps: errorStateProof.recorder.navOverlaps,
      state: errorStateProof.recorder.targets.recordingState, errorCopy: errorStateProof.recorder.targets.errorCopy,
      errorToast: errorStateProof.recorder.targets.errorToast, timer: errorStateProof.recorder.targets.timer },
    recorded: { navOverlaps: recordedStateProof.recorder.navOverlaps,
      state: recordedStateProof.recorder.targets.recordingState, timer: recordedStateProof.recorder.targets.timer,
      preview: recordedStateProof.recorder.targets.preview, upload: recordedStateProof.recorder.targets.upload },
  };
  if (expectClear) {
    for (const [name, proof] of Object.entries(stateVisibility).filter(([name]) => name !== 'responsiveScroll')) {
      assert(proof.navOverlaps.length === 0, `Navigation overlaps recorder UI in ${name} state.`);
    }
    assert(recordingStateProof.recorder.targets.finish.hidden === false, 'Finish recording is not visible while recording.');
    assert(recordedStateProof.recorder.targets.preview.hidden === false && recordedStateProof.recorder.targets.upload.disabled === false,
      'Preview or upload did not become available after the visual recording state.');
    assert(keyboardFocus.focusVisible && keyboardFocus.outlineStyle !== 'none' && Number.parseFloat(keyboardFocus.outlineWidth) >= 2,
      'Global navigation keyboard focus is not visible.');
    assert(openNavigation.visible && openNavigation.links.length > 0 && openNavigation.links.every((link) => link.visible && link.height >= 44),
      'The global navigation links are missing or shorter than 44px.');
  }

  const currentOrigin = new URL(await evaluate('location.href')).origin;
  await cdp.send('Page.navigate', { url: `${currentOrigin}/student/courses/` }, sessionId);
  await waitFor(async () => evaluate(`document.readyState === 'complete' && document.querySelector('.student-topbar')`), 'unmodified student course navigation');
  const otherStudentPage = await evaluate(`({ path: location.pathname, hasSpeechScope: document.body.classList.contains('student-speech-activity'),
    hasStudentNav: Boolean(document.querySelector('.student-topbar .sn-menu-toggle')), navLinks: document.querySelectorAll('.student-topbar .sn-link').length })`);
  await cdp.send('Page.navigate', { url: `${currentOrigin}/plans/` }, sessionId);
  await waitFor(async () => evaluate(`document.readyState === 'complete' && document.querySelector('#yuzan-global-nav .nav-toggle')`), 'generic global navigation');
  const genericGlobalNavigation = await evaluate(`(() => {
    const nav = document.querySelector('#yuzan-global-nav');
    const style = getComputedStyle(nav);
    return { path: location.pathname, hasSpeechScope: document.body.classList.contains('student-speech-activity'),
      position: style.position, right: style.right, bottom: style.bottom };
  })()`);
  if (expectClear) {
    assert(!otherStudentPage.hasSpeechScope && otherStudentPage.hasStudentNav && otherStudentPage.navLinks === 6,
      'The student course page navigation changed.');
    assert(!genericGlobalNavigation.hasSpeechScope && genericGlobalNavigation.position === 'fixed',
      'Generic global navigation changed outside the speech activity.');
  }

  const proof = {
    taskId: 'YZ-RD-T069',
    fixture: fixture.label,
    realApiConnected: false,
    browser: 'Google Chrome/Chromium, isolated headless process, ephemeral DevTools port',
    sharedBrowserService9222Touched: false,
    prefix,
    checks,
    viewports: screenshots,
    stateVisibility,
    keyboardFocus,
    openNavigation,
    otherStudentPage,
    genericGlobalNavigation,
    apiEvents,
  };
  await writeFile(join(evidenceDir, `browser-proof-${prefix}.json`), `${JSON.stringify(proof, null, 2)}\n`);
  console.log(JSON.stringify(proof, null, 2));
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
