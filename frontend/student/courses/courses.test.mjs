import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL("./courses.js", import.meta.url),
  "utf8",
);
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function mount(course) {
  const elements = new Map();
  const documentListeners = new Map();
  const cardListeners = new Map();
  const card = {
    dataset: { assignmentId: course.assignmentId || "" },
    addEventListener(name, callback) {
      cardListeners.set(name, callback);
    },
  };
  const document = {
    addEventListener(name, callback) {
      if (!documentListeners.has(name)) documentListeners.set(name, []);
      documentListeners.get(name).push(callback);
    },
    querySelector(selector) {
      if (!elements.has(selector)) {
        elements.set(selector, {
          innerHTML: "",
          textContent: "",
          hidden: false,
          value: "",
          className: "",
          addEventListener() {},
          setAttribute() {},
          querySelector() {
            return null;
          },
        });
      }
      return elements.get(selector);
    },
    querySelectorAll(selector) {
      if (selector === ".cc-card") return [card];
      return [];
    },
  };
  const location = { pathname: "/student/courses/", href: "" };
  const api = { listStudentCourses: async () => ({ courses: [course] }) };
  vm.runInNewContext(source, {
    document,
    window: {},
    YuzanApi: api,
    navigator: { onLine: true },
    location,
    Date,
    String,
    Number,
    Math,
    Array,
    Object,
    Promise,
    setTimeout,
    clearTimeout,
    encodeURIComponent,
  });
  documentListeners.get("DOMContentLoaded")[0]();
  return { cardListeners, location, elements };
}

test("Courses card opens the matching dynamic course detail assignment", async () => {
  const f = mount({
    assignmentId: "assignment/dynamic",
    title: "TEST_FIXTURE_ONLY",
  });
  await tick();

  const click = f.cardListeners.get("click");
  assert.equal(typeof click, "function");
  click({ target: { closest: () => null } });

  assert.equal(
    f.location.href,
    "/student/courses/course-detail/?id=assignment%2Fdynamic",
  );
});

test("Courses card with no assignment ID does not navigate to a broken detail route", async () => {
  const f = mount({ assignmentId: "", title: "TEST_FIXTURE_ONLY" });
  await tick();

  f.cardListeners.get("click")({ target: { closest: () => null } });

  assert.equal(f.location.href, "");
});
