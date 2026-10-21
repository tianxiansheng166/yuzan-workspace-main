import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("./media-controller.js", import.meta.url), "utf8");

class FakeElement {
  constructor(id) {
    this.id = id;
    this.listeners = new Map();
    this.attributes = new Map();
    this.children = [];
    this.textContent = "";
    this.innerHTML = "";
    this.hidden = id === "cpVideoError";
    this.paused = true;
    this.muted = false;
    this.currentTime = 0;
    this.duration = 0;
    this.classList = {
      add() {},
      remove() {},
      toggle() {},
    };
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.set(
      type,
      (this.listeners.get(type) || []).filter((entry) => entry !== listener),
    );
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) listener(event);
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
    if (name === "hidden") this.hidden = true;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === "hidden") this.hidden = false;
    if (name === "src") this.src = "";
  }

  querySelectorAll() {
    return this.children;
  }

  appendChild(child) {
    this.children.push(child);
  }

  removeChild(child) {
    this.children = this.children.filter((entry) => entry !== child);
  }

  contains() {
    return false;
  }

  load() {}

  play() {
    this.paused = false;
    this.dispatch("play");
    return Promise.resolve();
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    this.dispatch("pause");
  }
}

function mount(courseState = {}) {
  const elements = new Map();
  const calls = [];
  const state = {
    currentActivityId: "activity-dynamic",
    submissionId: "submission-dynamic",
    submissionStatus: "IN_PROGRESS",
    currentActivity: { activityType: "VIDEO" },
    getState() {
      return {
        currentActivityId: this.currentActivityId,
        submissionId: this.submissionId,
        submissionStatus: this.submissionStatus,
        currentActivity: this.currentActivity,
      };
    },
    saveActivityAttempt(...args) {
      calls.push(args);
      return Promise.resolve();
    },
    updateVideoProgress() {},
    ...courseState,
  };
  const getElement = (id) => {
    if (!elements.has(id)) elements.set(id, new FakeElement(id));
    return elements.get(id);
  };
  const video = getElement("cpVideo");
  video.parentElement = getElement("cpVideoContainer");

  const document = {
    getElementById: getElement,
    createElement: (tagName) => new FakeElement(tagName),
    addEventListener() {},
    removeEventListener() {},
  };
  const window = {};

  vm.runInNewContext(source, {
    window,
    document,
    CoursePlayerState: state,
    setTimeout,
    clearTimeout,
    isFinite,
  });

  window.MediaController.init("cpVideo");
  return {
    controller: window.MediaController,
    video,
    error: getElement("cpVideoError"),
    calls,
    state,
  };
}

test("shows a persistent player error when a signed playback URL fails in the browser", () => {
  const f = mount();

  f.controller.loadSource("https://media.example.invalid/signed-playback-url");
  f.video.dispatch("error");

  assert.equal(f.error.hidden, false);
  assert.match(f.error.textContent, /视频.*加载失败/);
});

test("saves the final fractional position as completed when the video ends", () => {
  const f = mount();

  f.controller.setActivityContext?.("activity-dynamic", "VIDEO");
  f.controller.loadSource("https://media.example.invalid/signed-playback-url");
  f.video.duration = 40;
  f.video.currentTime = 40;
  f.video.dispatch("loadedmetadata");
  f.video.dispatch("ended");

  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][0], "activity-dynamic");
  assert.equal(f.calls[0][1], "VIDEO");
  assert.equal(f.calls[0][2].videoPosition, 1);
  assert.equal(f.calls[0][3], true);
});

test("keeps a paused video's progress write bound to its original activity", () => {
  const f = mount();

  f.controller.setActivityContext("activity-first", "VIDEO");
  f.controller.loadSource("https://media.example.invalid/first.mp4");
  f.video.duration = 100;
  f.video.currentTime = 25;
  f.video.dispatch("loadedmetadata");
  f.video.play();

  // The course state changes before the player subscriber switches media.
  f.state.currentActivityId = "activity-second";
  f.state.currentActivity = { activityType: "VIDEO" };
  f.controller.setActivityContext("activity-second", "VIDEO");

  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][0], "activity-first");
  assert.equal(f.calls[0][2].videoPosition, 0.25);
});
