import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const apiSource = readFileSync(
  new URL("../../assets/api-client.js", import.meta.url),
  "utf8",
);
const appSource = readFileSync(
  new URL("../../teacher/question-bank/app.js", import.meta.url),
  "utf8",
);
const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

async function createApiClient(
  fetcher = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ data: {} }),
  }),
) {
  const values = new Map([
    ["yuzan-active-school-id", "school-1"],
    ["yuzan-access-token", "teacher-token"],
  ]);
  const calls = [];
  const context = {
    window: {},
    URLSearchParams,
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      return fetcher(url, options);
    },
  };
  vm.runInNewContext(apiSource, context, {
    filename: fileURLToPath(
      new URL("../../assets/api-client.js", import.meta.url),
    ),
  });
  return { api: context.window.YuzanApi, calls };
}

class FakeElement {
  constructor(name = "") {
    this.name = name;
    this.children = [];
    this.listeners = {};
    this.attributes = {};
    this.dataset = {};
    this.value = "";
    this.textContent = "";
    this.hidden = false;
    this.disabled = false;
    this.className = "";
  }
  addEventListener(type, callback) {
    (this.listeners[type] ||= []).push(callback);
  }
  dispatch(type, event = {}) {
    for (const callback of this.listeners[type] || []) callback(event);
  }
  click() {
    this.dispatch("click", { target: this });
  }
  append(...nodes) {
    this.children.push(...nodes);
  }
  replaceChildren(...nodes) {
    this.children = [...nodes];
  }
  setAttribute(name, value) {
    this.attributes[name] = value;
  }
  focus() {}
  querySelector(selector) {
    return selector === ".qb-save" ? this.saveButton : null;
  }
}

function mountQuestionBankPage(api) {
  const ids = [
    "qb-feedback",
    "qb-editor-empty",
    "qb-editor-title",
    "qb-draft-status",
    "qb-review-status",
    "qb-save-status",
    "qb-count",
    "qb-choice-fields",
    "qb-text-fields",
    "qb-search",
    "qb-list",
  ];
  const nodes = new Map(ids.map((id) => [id, new FakeElement(id)]));
  const fields = [
    "title",
    "prompt",
    "itemType",
    "domain",
    "difficulty",
    "gradeBand",
    "level",
    "abilityCategory",
    "maxScore",
    "optionA",
    "optionB",
    "optionC",
    "optionD",
    "correctOption",
    "acceptedAnswers",
  ].map((name) => new FakeElement(name));
  const form = new FakeElement("form");
  form.elements = fields;
  form.elements.namedItem = (name) =>
    fields.find((field) => field.name === name) || null;
  form.saveButton = new FakeElement("save");
  form.reset = () =>
    fields.forEach((field) => {
      field.value = "";
    });
  form.querySelector = (selector) =>
    selector === ".qb-save" ? form.saveButton : null;
  const newButtons = [
    new FakeElement("new-header"),
    new FakeElement("new-empty"),
  ];
  const refreshButton = new FakeElement("refresh");
  const page = new FakeElement("page");
  page.querySelectorAll = (selector) =>
    selector === "[data-new-draft]" ? newButtons : [];
  page.querySelector = (selector) =>
    selector === "[data-refresh]" ? refreshButton : null;
  const document = {
    getElementById: (id) =>
      id === "question-bank-page"
        ? page
        : id === "qb-form"
          ? form
          : nodes.get(id) || null,
    createElement: (tag) => new FakeElement(tag),
  };
  const context = vm.createContext({
    window: { YuzanApi: api },
    document,
    Intl,
    Date,
    setTimeout,
    clearTimeout,
    console,
  });
  vm.runInContext(appSource, context, {
    filename: "frontend/teacher/question-bank/app.js",
  });
  return {
    nodes,
    form,
    fields: form.elements,
    list: nodes.get("qb-list"),
    newButton: newButtons[0],
  };
}

test("teacher Question Bank API client uses the authenticated school's real authoring routes", async () => {
  const { api, calls } = await createApiClient();
  const payload = {
    title: "草稿标题",
    prompt: "题干",
    itemType: "CHOICE",
    domain: "READ",
    difficulty: "EASY",
    maxScore: 5,
    options: [
      { key: "A", text: "甲" },
      { key: "B", text: "乙" },
    ],
    correctOption: "B",
  };
  await api.listTeacherQuestionBankDrafts();
  await api.createTeacherQuestionBankDraft(payload);
  await api.getTeacherQuestionBankDraft("version-1");
  await api.updateTeacherQuestionBankDraft("version-1", {
    ...payload,
    expectedRevision: 1,
  });

  assert.deepEqual(
    calls.map(({ options }) => options.method || "GET"),
    ["GET", "POST", "GET", "PUT"],
  );
  assert.deepEqual(
    calls.map(({ url }) => new URL(url, "http://localhost").pathname),
    [
      "/api/v1/schools/school-1/teacher/question-bank/items",
      "/api/v1/schools/school-1/teacher/question-bank/items",
      "/api/v1/schools/school-1/teacher/question-bank/items/versions/version-1",
      "/api/v1/schools/school-1/teacher/question-bank/items/versions/version-1",
    ],
  );
  assert.deepEqual(JSON.parse(calls[1].options.body), payload);
  assert.equal(JSON.parse(calls[3].options.body).expectedRevision, 1);
  assert.equal(calls[0].options.headers.Authorization, "Bearer teacher-token");
});

test("teacher UI creates, saves, reopens, edits, and saves a DRAFT with the server revision", async () => {
  let saved = null;
  let nextRevision = 1;
  const calls = [];
  const api = {
    listTeacherQuestionBankDrafts: async () => ({
      items: saved ? [{ ...saved }] : [],
    }),
    createTeacherQuestionBankDraft: async (payload) => {
      calls.push({ action: "create", payload });
      saved = {
        ...payload,
        questionVersionId: "version-1",
        itemId: "item-1",
        version: 1,
        revision: nextRevision,
        status: "DRAFT",
        reviewStatus: "NOT_SUBMITTED",
        publishedAt: null,
        options: payload.options || [],
        correctOption: payload.correctOption || null,
        acceptedAnswers: payload.acceptedAnswers || [],
        createdAt: "2026-10-20T10:00:00.000Z",
        updatedAt: "2026-10-20T10:00:00.000Z",
      };
      return { ...saved };
    },
    getTeacherQuestionBankDraft: async (versionId) => {
      calls.push({ action: "read", versionId });
      return { ...saved };
    },
    updateTeacherQuestionBankDraft: async (versionId, payload) => {
      calls.push({
        action: "update",
        versionId,
        expectedRevision: payload.expectedRevision,
      });
      assert.equal(payload.expectedRevision, nextRevision);
      nextRevision += 1;
      saved = {
        ...saved,
        ...payload,
        revision: nextRevision,
        updatedAt: "2026-10-20T10:05:00.000Z",
      };
      return { ...saved };
    },
  };
  const page = mountQuestionBankPage(api);
  await flush();
  page.newButton.click();
  const field = (name) => page.fields.namedItem(name);
  field("title").value = "题库草稿一";
  field("prompt").value = "选出关键词";
  field("optionA").value = "晨光";
  field("optionB").value = "山谷";
  field("correctOption").value = "B";
  page.form.dispatch("submit", { preventDefault() {} });
  await flush();

  assert.equal(calls[0].action, "create");
  assert.equal(calls[0].payload.itemType, "CHOICE");
  assert.equal(calls[0].payload.options.length, 2);
  assert.match(page.nodes.get("qb-save-status").textContent, /revision 1/);
  assert.equal(page.list.children.length, 1);

  page.list.children[0].click();
  await flush();
  assert.deepEqual(calls[1], { action: "read", versionId: "version-1" });
  assert.equal(field("title").value, "题库草稿一");
  field("title").value = "题库草稿一修订";
  page.form.dispatch("input");
  page.form.dispatch("submit", { preventDefault() {} });
  await flush();

  assert.deepEqual(calls[2], {
    action: "update",
    versionId: "version-1",
    expectedRevision: 1,
  });
  assert.equal(saved.revision, 2);
  assert.equal(saved.title, "题库草稿一修订");
  assert.match(page.nodes.get("qb-save-status").textContent, /revision 2/);
  assert.equal(page.nodes.get("qb-draft-status").textContent, "DRAFT");
  assert.equal(page.nodes.get("qb-review-status").textContent, "审核：未提交");
});

test("teacher API client preserves authorization, missing-resource, and conflict status codes", async () => {
  const codes = [401, 403, 404, 409];
  for (const status of codes) {
    const { api } = await createApiClient(async () => ({
      ok: false,
      status,
      json: async () => ({
        error: { code: `HTTP_${status}`, message: "request denied" },
      }),
    }));
    await assert.rejects(
      api.getTeacherQuestionBankDraft("version-1"),
      (error) => error.status === status,
    );
  }
});

test("teacher UI displays 401, 403, 404, and 409 save errors without claiming success", async () => {
  for (const status of [401, 403, 404, 409]) {
    const error = Object.assign(new Error("request denied"), { status });
    const api = {
      listTeacherQuestionBankDrafts: async () => ({ items: [] }),
      createTeacherQuestionBankDraft: async () => {
        throw error;
      },
    };
    const page = mountQuestionBankPage(api);
    await flush();
    page.newButton.click();
    const field = (name) => page.fields.namedItem(name);
    field("title").value = "新草稿";
    field("prompt").value = "题干内容";
    field("optionA").value = "选项甲";
    field("optionB").value = "选项乙";
    page.form.dispatch("submit", { preventDefault() {} });
    await flush();

    assert.match(
      page.nodes.get("qb-feedback").textContent,
      new RegExp(`${status}｜`),
    );
    assert.equal(page.nodes.get("qb-feedback").hidden, false);
    assert.doesNotMatch(page.nodes.get("qb-save-status").textContent, /已保存/);
  }
});
