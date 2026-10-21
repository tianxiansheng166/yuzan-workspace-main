import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";

const appSource = await readFile(new URL("./app.js", import.meta.url), "utf8");
const legacySource = await readFile(
  new URL("./login.js", import.meta.url),
  "utf8",
);
const pageSource = await readFile(
  new URL("./index.html", import.meta.url),
  "utf8",
);

function makeClassList() {
  const values = new Set();
  return {
    add(...names) {
      names.forEach((name) => values.add(name));
    },
    remove(...names) {
      names.forEach((name) => values.delete(name));
    },
    contains(name) {
      return values.has(name);
    },
    toggle(name, force) {
      const next = force === undefined ? !values.has(name) : Boolean(force);
      if (next) values.add(name);
      else values.delete(name);
      return next;
    },
  };
}

function makeElement(name = "") {
  const listeners = new Map();
  const element = {
    name,
    hidden: false,
    disabled: false,
    textContent: "",
    innerHTML: "",
    value: "",
    type: "text",
    dataset: {},
    style: { setProperty() {} },
    classList: makeClassList(),
    attributes: new Map(),
    listeners,
    addEventListener(type, handler) {
      const handlers = listeners.get(type) ?? [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
    async dispatch(type, event = {}) {
      for (const handler of listeners.get(type) ?? []) await handler(event);
    },
    setAttribute(key, value) {
      this.attributes.set(key, String(value));
    },
    getAttribute(key) {
      return this.attributes.get(key) ?? null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    checkValidity() {
      return true;
    },
    closest() {
      return { classList: makeClassList() };
    },
    focus() {
      this.focused = true;
    },
    animate() {},
  };
  return element;
}

function makeLocalStorage() {
  const values = new Map();
  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function makeAppHarness({
  api,
  online = true,
  login = {},
  register = {},
} = {}) {
  const body = makeElement("body");
  const ids = new Map();
  const element = (id) => {
    if (!ids.has(id)) ids.set(id, makeElement(id));
    return ids.get(id);
  };
  const loginPanel = element("loginPanel");
  const registerPanel = element("registerPanel");
  loginPanel.values = login;
  registerPanel.values = register;
  loginPanel.requiredInputs = [
    makeElement("loginAccount"),
    makeElement("loginPassword"),
  ];
  registerPanel.requiredInputs = [
    makeElement("registerPhone"),
    makeElement("registerPassword"),
  ];
  loginPanel.querySelectorAll = (selector) =>
    selector === "input[required]" ? loginPanel.requiredInputs : [];
  registerPanel.querySelectorAll = (selector) =>
    selector === "input[required]" ? registerPanel.requiredInputs : [];
  loginPanel.querySelector = (selector) =>
    selector === '[data-action="login"]' ? element("loginButton") : null;
  registerPanel.querySelector = (selector) =>
    selector === '[data-action="register"]' ? element("registerButton") : null;

  const soundLabel = makeElement("soundLabel");
  element("soundSwitch").querySelector = (selector) =>
    selector === "span:last-child" ? soundLabel : null;
  const document = {
    body,
    documentElement: { style: { setProperty() {} } },
    getElementById: element,
    querySelector(selector) {
      if (selector === ".tabs") return element("tabs");
      if (selector === ".story__copy") return makeElement("storyCopy");
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
  };
  const localStorage = makeLocalStorage();
  const location = { href: "" };
  const window = {
    location,
    YuzanApi: api,
    setTimeout(callback) {
      callback();
      return 1;
    },
    setInterval() {
      return 1;
    },
    clearInterval() {},
    matchMedia() {
      return { matches: false };
    },
    alert() {
      throw new Error("unexpected alert");
    },
  };
  runInNewContext(appSource, {
    document,
    window,
    navigator: { onLine: online },
    localStorage,
    FormData: class {
      constructor(form) {
        this.form = form;
      }
      entries() {
        return Object.entries(this.form.values)[Symbol.iterator]();
      }
    },
  });
  return { ids, location, localStorage, window };
}

function makeLegacyHarness({
  api,
  online = true,
  login = {},
  register = {},
  roles = [],
} = {}) {
  const ids = new Map();
  const element = (id) => {
    if (!ids.has(id)) ids.set(id, makeElement(id));
    return ids.get(id);
  };
  const loginForm = element("loginForm");
  const registerForm = element("registerForm");
  loginForm.querySelector = (selector) =>
    selector === ".submit" ? element("loginSubmit") : null;
  registerForm.querySelector = (selector) =>
    selector === ".submit" ? element("registerSubmit") : null;
  Object.assign(element("account"), { value: login.account ?? "" });
  Object.assign(element("password"), { value: login.password ?? "" });
  Object.assign(element("regPhone"), { value: register.phone ?? "" });
  Object.assign(element("regPassword"), { value: register.password ?? "" });

  const tabs = [makeElement("loginTab"), makeElement("registerTab")];
  tabs[0].dataset.tab = "login";
  tabs[1].dataset.tab = "register";
  const loginError = element("loginError");
  const registerError = element("registerError");
  const localStorage = makeLocalStorage();
  const location = { href: "" };
  const toasts = [];
  const document = {
    querySelector(selector) {
      const map = {
        "#loginSection": "loginSection",
        "#registerSection": "registerSection",
        "#loginForm": "loginForm",
        "#account": "account",
        "#password": "password",
        "#toggle": "toggle",
        "#loginError": "loginError",
        "#registerForm": "registerForm",
        "#regPhone": "regPhone",
        "#regPassword": "regPassword",
        "#regToggle": "regToggle",
        "#registerError": "registerError",
        "#forgotPassword": "forgotPassword",
      };
      return map[selector] ? element(map[selector]) : null;
    },
    querySelectorAll(selector) {
      if (selector === ".auth-tab") return tabs;
      if (selector === ".role-btn") return roles;
      if (selector === "#loginError, #registerError")
        return [loginError, registerError];
      return [];
    },
  };
  const window = { location, YuzanApi: api };
  runInNewContext(legacySource, {
    document,
    window,
    navigator: { onLine: online },
    localStorage,
    location,
    YuzanApi: api,
    YuzanDemo: {
      toast(message, type) {
        toasts.push({ message, type });
      },
    },
    setTimeout(callback) {
      callback();
      return 1;
    },
  });
  return { ids, location, localStorage, toasts };
}

function submitEvent() {
  return { preventDefault() {} };
}

async function settleAsyncHandler() {
  await new Promise((resolve) => setImmediate(resolve));
}

function noAuthStorage(localStorage) {
  assert.equal(
    [...localStorage.values.keys()].some(
      (key) =>
        key.includes("token") ||
        key.includes("session") ||
        key.includes("school"),
    ),
    false,
  );
}

test("401 stays on the login page and shows a retryable failure without creating auth state", async () => {
  const api = {
    async login() {
      const error = new Error("sensitive response content");
      error.status = 401;
      throw error;
    },
    getHomeUrlByRole() {
      return "/teacher";
    },
  };
  const harness = makeAppHarness({
    api,
    login: { account: "real.user", password: "secret-password" },
  });
  await harness.ids.get("loginPanel").dispatch("submit", submitEvent());
  await settleAsyncHandler();

  const message = harness.ids.get("loginMessage");
  assert.equal(harness.location.href, "");
  assert.equal(message.hidden, false);
  assert.match(message.textContent, /验证未通过/);
  assert.doesNotMatch(
    message.textContent,
    /sensitive response content|secret-password/,
  );
  noAuthStorage(harness.localStorage);
});

test("offline login sends no request, creates no session, and does not navigate", async () => {
  let calls = 0;
  const harness = makeAppHarness({
    online: false,
    login: { account: "real.user", password: "secret-password" },
    api: {
      async login() {
        calls += 1;
      },
      getHomeUrlByRole() {
        return "/student/today";
      },
    },
  });
  await harness.ids.get("loginPanel").dispatch("submit", submitEvent());

  assert.equal(calls, 0);
  assert.equal(harness.location.href, "");
  assert.match(harness.ids.get("loginMessage").textContent, /恢复连接后重试/);
  noAuthStorage(harness.localStorage);
});

test("429 and API transport failures show distinct retry guidance without navigation", async () => {
  for (const [error, expected] of [
    [{ status: 429 }, /请求过于频繁，请稍后再试/],
    [new TypeError("transport failure"), /无法连接认证服务，请检查网络后重试/],
  ]) {
    const api = {
      async login() {
        throw error;
      },
      getHomeUrlByRole() {
        return "/teacher";
      },
    };
    const harness = makeAppHarness({
      api,
      login: { account: "real.user", password: "secret-password" },
    });
    await harness.ids.get("loginPanel").dispatch("submit", submitEvent());
    await settleAsyncHandler();

    assert.equal(harness.location.href, "");
    assert.match(harness.ids.get("loginMessage").textContent, expected);
    noAuthStorage(harness.localStorage);
  }
});

test("missing API Client fails closed even for demo-shaped credentials", async () => {
  const harness = makeAppHarness({
    login: { account: "student.test", password: "YuzanTest!2026" },
  });
  await harness.ids.get("loginPanel").dispatch("submit", submitEvent());
  await settleAsyncHandler();

  assert.equal(harness.location.href, "");
  assert.match(harness.ids.get("loginMessage").textContent, /认证服务暂不可用/);
  noAuthStorage(harness.localStorage);
});

test("demo-shaped credentials are sent to the real API and cannot bypass a 401", async () => {
  const calls = [];
  const api = {
    async login(identifier, password) {
      calls.push([identifier, password]);
      const error = new Error();
      error.status = 401;
      throw error;
    },
    getHomeUrlByRole() {
      return "/student/today";
    },
  };
  const harness = makeAppHarness({
    api,
    login: { account: "student.test", password: "YuzanTest!2026" },
  });
  await harness.ids.get("loginPanel").dispatch("submit", submitEvent());
  await settleAsyncHandler();

  assert.deepEqual(calls, [["student.test", "YuzanTest!2026"]]);
  assert.equal(harness.location.href, "");
  assert.match(harness.ids.get("loginMessage").textContent, /验证未通过/);
  noAuthStorage(harness.localStorage);
});

test("successful login routes using the exact user returned by the server", async () => {
  const serverUser = {
    id: "server-user",
    memberships: [{ role: "TEACHER", schoolId: "server-school" }],
  };
  const api = {
    async login(identifier, password) {
      assert.equal(identifier, "person@example.test");
      assert.equal(password, "server-password");
      return {
        user: serverUser,
        activeSchoolId: "server-school",
        expiresIn: 600,
      };
    },
    getHomeUrlByRole(user) {
      assert.strictEqual(user, serverUser);
      return user.memberships[0].role === "TEACHER"
        ? "/teacher"
        : "/student/today";
    },
  };
  const harness = makeAppHarness({
    api,
    login: { account: "person@example.test", password: "server-password" },
  });
  await harness.ids.get("loginPanel").dispatch("submit", submitEvent());
  await settleAsyncHandler();

  assert.equal(harness.location.href, "/teacher");
  noAuthStorage(harness.localStorage);
});

test("registration failure stays on the page and never reports success", async () => {
  const api = {
    async register(identifier, password, role) {
      assert.equal(identifier, "13800138000");
      assert.equal(password, "register-password");
      assert.equal(role, "STUDENT");
      const error = new Error("sensitive response content");
      error.status = 503;
      throw error;
    },
    getHomeUrlByRole() {
      return "/student/today";
    },
  };
  const harness = makeAppHarness({
    api,
    register: {
      phone: "13800138000",
      password: "register-password",
      role: "student",
    },
  });
  await harness.ids.get("registerPanel").dispatch("submit", submitEvent());
  await settleAsyncHandler();

  const message = harness.ids.get("registerMessage");
  assert.equal(harness.location.href, "");
  assert.match(message.textContent, /认证服务暂时不可用/);
  assert.doesNotMatch(
    message.textContent,
    /注册成功|sensitive response content/,
  );
  noAuthStorage(harness.localStorage);
});

test("failure messages are visible and announced accessibly in the current login page", async () => {
  const api = {
    async login() {
      const error = new Error();
      error.status = 403;
      throw error;
    },
    getHomeUrlByRole() {
      return "/teacher";
    },
  };
  const harness = makeAppHarness({
    api,
    login: { account: "real.user", password: "secret-password" },
  });
  await harness.ids.get("loginPanel").dispatch("submit", submitEvent());
  await settleAsyncHandler();

  const message = harness.ids.get("loginMessage");
  assert.equal(message.hidden, false);
  assert.equal(message.style.display, "flex");
  assert.match(message.textContent, /服务端拒绝/);
});

test("legacy login.js also fails closed for offline and rejected authentication", async () => {
  let calls = 0;
  const offline = makeLegacyHarness({
    online: false,
    login: { account: "student.test", password: "YuzanTest!2026" },
    api: {
      async login() {
        calls += 1;
      },
      getHomeUrlByRole() {
        return "/student/today";
      },
    },
  });
  await offline.ids.get("loginForm").dispatch("submit", submitEvent());
  assert.equal(calls, 0);
  assert.equal(offline.location.href, "");
  assert.match(offline.ids.get("loginError").textContent, /恢复连接后重试/);
  noAuthStorage(offline.localStorage);

  const denied = makeLegacyHarness({
    login: { account: "student.test", password: "YuzanTest!2026" },
    api: {
      async login() {
        calls += 1;
        const error = new Error();
        error.status = 401;
        throw error;
      },
      getHomeUrlByRole() {
        return "/student/today";
      },
    },
  });
  await denied.ids.get("loginForm").dispatch("submit", submitEvent());
  assert.equal(calls, 1);
  assert.equal(denied.location.href, "");
  assert.match(denied.ids.get("loginError").textContent, /验证未通过/);
  assert.equal(
    denied.toasts.some((toast) => /成功/.test(toast.message)),
    false,
  );
  noAuthStorage(denied.localStorage);
});

test("legacy login.js uses the returned server identity for a successful redirect", async () => {
  const serverUser = {
    id: "server-user",
    memberships: [{ role: "STUDENT", schoolId: "server-school" }],
  };
  const api = {
    async login() {
      return { user: serverUser, activeSchoolId: "server-school" };
    },
    getHomeUrlByRole(user) {
      assert.strictEqual(user, serverUser);
      return user.memberships[0].role === "STUDENT"
        ? "/student/today"
        : "/teacher";
    },
  };
  const harness = makeLegacyHarness({
    api,
    login: { account: "person@example.test", password: "server-password" },
  });
  await harness.ids.get("loginForm").dispatch("submit", submitEvent());

  assert.equal(harness.location.href, "/student/today");
  assert.equal(
    harness.toasts.some((toast) => toast.message === "登录成功"),
    true,
  );
  noAuthStorage(harness.localStorage);
});

test("legacy registration rejection does not show success or navigate", async () => {
  const role = makeElement("studentRole");
  role.dataset.role = "STUDENT";
  const api = {
    async register() {
      const error = new Error();
      error.status = 503;
      throw error;
    },
    getHomeUrlByRole() {
      return "/student/today";
    },
  };
  const harness = makeLegacyHarness({
    api,
    register: { phone: "13800138000", password: "register-password" },
    roles: [role],
  });
  await role.dispatch("click");
  await harness.ids.get("registerForm").dispatch("submit", submitEvent());

  assert.equal(harness.location.href, "");
  assert.match(
    harness.ids.get("registerError").textContent,
    /认证服务暂时不可用/,
  );
  assert.equal(
    harness.toasts.some((toast) => /成功/.test(toast.message)),
    false,
  );
  noAuthStorage(harness.localStorage);
});

test("the page contains live failure regions and no demo-success dialog copy", () => {
  assert.match(
    pageSource,
    /id="loginMessage"[^>]*role="alert"[^>]*aria-live="assertive"/,
  );
  assert.match(
    pageSource,
    /id="registerMessage"[^>]*role="alert"[^>]*aria-live="assertive"/,
  );
  assert.doesNotMatch(pageSource, /演示转场已完成|AUTH_ENDPOINTS/);
});
