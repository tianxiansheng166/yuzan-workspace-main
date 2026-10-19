import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../../student/today/today-showcase.js", import.meta.url), "utf8");
const todaySource = readFileSync(new URL("../../student/today/today.js", import.meta.url), "utf8");
const win = {};
vm.runInNewContext(source, { window: win });
const { suggestion, render } = win.YuzanTodayShowcase;

test("personalized primary task has priority over optional discovery in Today layout", () => {
  assert.match(todaySource, /<section class="today-overview">/);
  assert.match(todaySource, /querySelector\("\.today-overview"\)\?\.insertAdjacentHTML\("afterend", extra\)/);
  assert.doesNotMatch(todaySource, /querySelector\("\.today-header"\)\?\.insertAdjacentHTML/);
  const html = render({ practices: { items: [{ id: "oral-1", title: "跟读", requiresRecording: true }] } });
  assert.match(html, /today-discover/);
  assert.doesNotMatch(html, /today-skill-grid|today-skill-card|听 · 课程学习/);
  assert.equal((html.match(/<a /g) || []).length, 1);
});

test("a real authorized recording practice is an optional activity, not a fake task", () => {
  const entry = suggestion({
    today: { primaryAction: { kind: "BASELINE", target: { practiceDefinitionId: "base-one" } } },
    practices: { items: [
      { id: "base-one", title: "首次测评", requiresRecording: false },
      { id: "oral&two", title: "<朗读与跟读>", requiresRecording: true },
    ] },
    courses: { courses: [{ assignmentId: "real-course", title: "已开放课程" }] },
  });
  assert.equal(entry.type, "speak");
  assert.equal(entry.href, "/student/practices/oral%26two/");
  assert.match(render({ practices: { items: [{ id: "oral&two", title: "<朗读>", requiresRecording: true }] } }), /&lt;朗读&gt;/);
});

test("does not repeat the exact practice or course already selected as the primary step", () => {
  const state = {
    today: { primaryAction: { target: { practiceDefinitionId: "oral-1" } } },
    practices: { items: [{ id: "oral-1", title: "当前口语", requiresRecording: true }] },
    courses: { courses: [{ assignmentId: "assignment-1", title: "独立课程" }] },
  };
  assert.equal(suggestion(state).href, "/student/courses/course-detail/?id=assignment-1");
  const duplicateCourse = {
    today: { primaryAction: { target: { href: "/student/courses/course-detail/?id=assignment-1" } } },
    courses: state.courses,
  };
  assert.equal(suggestion(duplicateCourse), null);
  assert.equal(render(duplicateCourse), "");
});

test("API errors and missing authorized work never produce filler buttons or scores", () => {
  assert.equal(suggestion({ practices: { error: "offline" }, courses: { error: "offline" } }), null);
  assert.equal(render({ today: { summary: { latestFormalAssessment: { score: 0 } } } }), "");
  assert.equal(render({ today: { summary: { latestFormalAssessment: { score: null } } } }), "");
  assert.equal(render({ practices: { items: [{ id: "unknown", title: "阅读", requiresRecording: false }] } }), "");
});
