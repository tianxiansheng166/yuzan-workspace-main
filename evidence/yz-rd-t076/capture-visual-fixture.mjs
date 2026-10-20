import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const evidenceDir = dirname(fileURLToPath(import.meta.url));
const screenshotDir = resolve(evidenceDir, "screenshots");
const profileDir = await mkdtemp(resolve(tmpdir(), "yz-rd-t076-chrome-"));
const chrome = spawn("/usr/bin/google-chrome", [
  "--headless=new",
  "--disable-gpu",
  "--no-proxy-server",
  "--remote-debugging-port=0",
  `--user-data-dir=${profileDir}`,
  "--no-first-run",
  "--no-default-browser-check",
  "about:blank",
], { stdio: "ignore" });

let socket;
try {
  let port;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const activePort = await readFile(resolve(profileDir, "DevToolsActivePort"), "utf8");
      port = Number(activePort.split("\n")[0]);
      if (port) break;
    } catch {}
    await delay(100);
  }
  if (!port) throw new Error("Chrome did not publish a DevTools port.");

  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((target) => target.type === "page");
  if (!page?.webSocketDebuggerUrl) throw new Error("Chrome did not expose a page target.");
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", rejectOpen, { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve: resolveReply, reject: rejectReply } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) rejectReply(new Error(message.error.message));
    else resolveReply(message.result);
  });
  const send = (method, params = {}) => new Promise((resolveReply, rejectReply) => {
    const id = ++nextId;
    pending.set(id, { resolve: resolveReply, reject: rejectReply });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return result.result?.value;
  };
  const waitFor = async (expression, label) => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await evaluate(expression)) return;
      await delay(100);
    }
    throw new Error(`Timed out waiting for ${label}.`);
  };
  const capture = async ({ width, height, name, path, readyExpression }) => {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: path });
    await waitFor(readyExpression, name);
    await delay(800);
    const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, fromSurface: true });
    await writeFile(resolve(screenshotDir, name), Buffer.from(screenshot.data, "base64"));
    process.stdout.write(`${name} ${width}x${height} TEST_FIXTURE_ONLY visual-only\n`);
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await capture({
    width: 1280, height: 900, name: "catalog-1280-fixture.png",
    path: "http://127.0.0.1:4176/student/practices/",
    readyExpression: "Boolean(document.querySelector('.practice-grid') && document.querySelector('.t076-fixture-banner'))",
  });
  await capture({
    width: 1440, height: 1000, name: "catalog-1440-fixture.png",
    path: "http://127.0.0.1:4176/student/practices/",
    readyExpression: "Boolean(document.querySelector('.practice-grid') && document.querySelector('.t076-fixture-banner'))",
  });
  await capture({
    width: 1280, height: 900, name: "runner-1280-fixture.png",
    path: "http://127.0.0.1:4176/student/practices/attempts/attempt-t076-fixture/runner/",
    readyExpression: "Boolean(document.querySelector('.runner-page') && document.querySelector('.t076-fixture-banner'))",
  });
  await capture({
    width: 1440, height: 1000, name: "runner-1440-fixture.png",
    path: "http://127.0.0.1:4176/student/practices/attempts/attempt-t076-fixture/runner/",
    readyExpression: "Boolean(document.querySelector('.runner-page') && document.querySelector('.t076-fixture-banner'))",
  });
} finally {
  socket?.close();
  chrome.kill("SIGTERM");
  await delay(250);
  await rm(profileDir, { recursive: true, force: true });
}
