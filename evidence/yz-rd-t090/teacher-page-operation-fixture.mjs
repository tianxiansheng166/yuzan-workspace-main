import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

class FixtureClassList {
  constructor(initial = []) { this.values = new Set(initial); }
  add(name) { this.values.add(name); }
  remove(name) { this.values.delete(name); }
  contains(name) { return this.values.has(name); }
  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.values.has(name) : Boolean(force);
    if (shouldAdd) this.values.add(name);
    else this.values.delete(name);
    return shouldAdd;
  }
}

class FixtureElement {
  constructor(dataset = {}, classes = []) {
    this.dataset = dataset;
    this.classList = new FixtureClassList(classes);
    this.listeners = new Map();
    this.children = [];
    this.style = {};
    this.attributes = {};
    this.hidden = false;
    this.disabled = false;
    this.value = "";
    this.textContent = "";
    this.innerHTML = "";
  }
  addEventListener(type, callback) {
    const callbacks = this.listeners.get(type) || [];
    callbacks.push(callback);
    this.listeners.set(type, callbacks);
  }
  async click() {
    const event = { target: this, stopPropagation() {} };
    for (const callback of this.listeners.get("click") || []) await callback(event);
  }
  querySelector(selector) {
    if (selector === "span" && this.stepSpan) return this.stepSpan;
    if (selector === "i") return this.icon || null;
    if (selector === ".selected-check") return this.selectedCheck || null;
    return null;
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  appendChild(child) { this.children.push(child); return child; }
  prepend(child) { this.children.unshift(child); return child; }
  remove() { this.removed = true; }
  before(child) { this.insertedBefore = child; }
  scrollIntoView() {}
}

const steps = Array.from({ length: 4 }, (_, index) => {
  const step = new FixtureElement({ step: String(index + 1) }, index === 0 ? ["active"] : []);
  step.stepSpan = new FixtureElement();
  return step;
});
const panels = Array.from({ length: 4 }, (_, index) => new FixtureElement(
  { panel: String(index + 1) }, index === 0 ? ["active-panel"] : [],
));
const typeCards = ["朗读测评", "写作测评", "读写综合测评"].map((type, index) =>
  new FixtureElement({ type }, index === 0 ? ["selected"] : []));
const dimensionButtons = ["发音准确", "语调节奏", "流畅度", "情感表达"].map((dimension) => {
  const button = new FixtureElement({ dimension }, ["selected"]);
  button.icon = new FixtureElement();
  return button;
});
const dimensionTrigger = new FixtureElement({ modal: "dimension" }, ["add-dimension"]);
const helpTrigger = new FixtureElement({ modal: "help" });
const actionButtons = ["material", "students", "save", "cancel", "publish-now", "schedule", "preview"]
  .map((action) => new FixtureElement({ action }));
const insertedDimensions = [];
const element = (dataset = {}, classes = []) => new FixtureElement(dataset, classes);
const selectors = new Map([
  ["#nextBtn", element()], ["#previousBtn", element()], ["#publishBtn", element()],
  ["#publishMenuBtn", element()], ["#publishDropdown", element()],
  ["#assessmentName", element()], ["#assessmentGoal", element()],
  ["#nameCount", element()], ["#goalCount", element()],
  ["#modalBackdrop", element()], ["#modalTitle", element()], ["#modalText", element()],
  ["#modalMark", element()], ["#toast", element()], ["#startTime", element()], ["#endTime", element()],
  ["#autosaveHint", element()], [".creator-column", element()],
  ["#normalCount", element()], ["#normalHeaderCount", element()],
  ["#riskCount", element()], ["#riskHeaderCount", element()],
  ["#materialRisk", element()], ["#timeRisk", element()],
  ["#modalClose", element()], ["#modalCancel", element()], ["#modalConfirm", element()],
  ["#dimensionList .add-dimension", dimensionTrigger],
]);
selectors.get("#assessmentName").value = "春天的足迹·朗读测评";
selectors.get("#assessmentGoal").value = "通过朗读材料评估普通话发音、语调和表达。";
selectors.get("#modalBackdrop").hidden = true;
dimensionTrigger.before = (child) => insertedDimensions.push(child);

const document = {
  body: { style: {} },
  querySelector(selector) {
    if (selector === ".type-card.selected") return typeCards.find((card) => card.classList.contains("selected")) || null;
    return selectors.get(selector) || null;
  },
  querySelectorAll(selector) {
    if (selector === ".steps li") return steps;
    if (selector === ".step-panel") return panels;
    if (selector === ".type-card") return typeCards;
    if (selector === "#dimensionList button[data-dimension]") return dimensionButtons;
    if (selector === "[data-modal]") return [dimensionTrigger, helpTrigger];
    if (selector === "[data-action]") return actionButtons;
    return [];
  },
  createElement() { return new FixtureElement(); },
  addEventListener() {},
};
const saved = new Map();
const apiCalls = [];
const context = {
  document,
  YuzanApi: {
    getToken: () => "fixture-token",
    getActiveSchoolId: () => "fixture-school",
    listClasses: async () => ({ items: [{ id: "fixture-class", studentCount: 24 }] }),
    createClassAssessment: async (...args) => { apiCalls.push(args); return { id: "fixture-assessment" }; },
  },
  localStorage: { setItem: (key, value) => saved.set(key, value) },
  location: { href: "" },
  console,
  clearTimeout() {},
  setTimeout() { return 1; },
};

const source = await readFile("frontend/teacher/assessments/create/app.js", "utf8");
vm.runInNewContext(source, context, { filename: "frontend/teacher/assessments/create/app.js" });
await new Promise((resolve) => setImmediate(resolve));

await dimensionTrigger.click();
assert.equal(selectors.get("#modalBackdrop").hidden, false);
assert.equal(selectors.get("#modalTitle").textContent, "自定义能力维度");
assert.match(selectors.get("#modalText").textContent, /"朗读感染力"/);
await selectors.get("#modalConfirm").click();
assert.equal(insertedDimensions.length, 1);
assert.equal(insertedDimensions[0].dataset.dimension, "朗读感染力");
assert.equal(selectors.get("#modalBackdrop").hidden, true);
assert.equal(selectors.get("#toast").textContent, "已添加自定义维度");

await selectors.get("#nextBtn").click();
await selectors.get("#nextBtn").click();
await selectors.get("#nextBtn").click();
assert.equal(panels[3].classList.contains("active-panel"), true);
assert.equal(selectors.get("#nextBtn").textContent, "完成配置");
await selectors.get("#previousBtn").click();
assert.equal(panels[2].classList.contains("active-panel"), true);

await actionButtons.find((button) => button.dataset.action === "material").click();
assert.equal(selectors.get("#modalTitle").textContent, "选择测评材料");
await selectors.get("#modalCancel").click();
await actionButtons.find((button) => button.dataset.action === "save").click();
assert.equal(JSON.parse(saved.get("assessment-draft")).title, "春天的足迹·朗读测评");
await actionButtons.find((button) => button.dataset.action === "students").click();
assert.match(selectors.get("#modalText").textContent, /24 名学生/);
assert.equal(apiCalls.length, 0, "fixture must not call a real assessment API");
process.stdout.write("Teacher page DOM fixture PASS: custom dimension modal/confirm, four-step navigation, material and class dialogs, local draft save; API calls=0.\n");
