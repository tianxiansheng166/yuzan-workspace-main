import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../../student/today/today-showcase.js", import.meta.url), "utf8");
const win = {};
vm.runInNewContext(source, { window: win });
const { cards, render } = win.YuzanTodayShowcase;

test("the first screen distinguishes learning, speaking, assessment and feedback", () => {
  const model = cards({
    today: { summary: { latestFormalAssessment: null } },
    practices: { items: [] }, courses: { courses: [] },
  });
  assert.deepEqual(Array.from(model, ({ key }) => key), ["listen", "speak", "exam", "report"]);
  assert.equal(model[1].href, "/student/practices/");
  assert.match(model[1].status, /暂无已开放录音练习/);
  assert.doesNotMatch(render({ practices: { items: [] }, courses: { courses: [] } }), /正式成绩 \d+ 分/);
  assert.match(render({}), /aria-labelledby="today-skill-title"/);
});

test("only an authorized practice with requiresRecording opens the speaking route", () => {
  const model = cards({
    practices: { items: [
      { id: "id-no-audio", title: "书面作答", requiresRecording: false },
      { id: "id-oral&one", title: "<真实朗读>", requiresRecording: true },
    ] },
  });
  assert.equal(model[1].href, "/student/practices/id-oral%26one/");
  assert.match(model[1].detail, /&lt;真实朗读&gt;/);
  assert.doesNotMatch(render({ practices: { items: [{ id: "x", title: "写作" }] } }), /录音练习已开放/);
});

test("course and first assessment destination use dynamic server identifiers", () => {
  const model = cards({
    courses: { courses: [{ assignmentId: "course-live", title: "听读课程" }] },
    today: { primaryAction: { kind: "BASELINE", target: { practiceDefinitionId: "baseline-live" } } },
    practices: { items: [{ id: "baseline-live", title: "第一次测评", requiresRecording: false }] },
  });
  assert.equal(model[0].href, "/student/courses/course-detail/?id=course-live");
  assert.equal(model[2].href, "/student/practices/baseline-live/");
  assert.match(model[2].status, /首次测评已开放/);
});

test("only server-provided numeric formal score is shown, preserving a real zero", () => {
  const formal = (score) => cards({ today: { summary: { latestFormalAssessment: { score } } } })[3];
  assert.match(formal(0).detail, /正式成绩 0 分/);
  assert.equal(formal(0).href, "/student/growth/");
  assert.doesNotMatch(formal(null).detail, /正式成绩 0 分/);
  assert.equal(formal(null).href, "/student/practices/history/");
});
