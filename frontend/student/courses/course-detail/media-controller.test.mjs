import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("./media-controller.js", import.meta.url), "utf8");
const pageSource = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");

class FakeElement {
  constructor(id) {
    this.id = id;
    this.listeners = new Map();
    this.attributes = new Map();
    this.children = [];
    this.textContent = "";
    this.innerHTML = "";
    this.hidden = ["cpVideoError", "cpProgressError", "cpProgressRetryBtn"].includes(id);
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
    if (name === "src") {
      this.src = "";
      this.currentTime = 0;
    }
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

  load() {
    this.currentTime = 0;
  }

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
    activityProgressMap: {},
    getState() {
      return {
        currentActivityId: this.currentActivityId,
        submissionId: this.submissionId,
        submissionStatus: this.submissionStatus,
        currentActivity: this.currentActivity,
        activityProgressMap: this.activityProgressMap,
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
    progressError: getElement("cpProgressError"),
    progressErrorMessage: getElement("cpProgressErrorMessage"),
    progressRetryBtn: getElement("cpProgressRetryBtn"),
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

test("course detail includes a persistent accessible progress-save error and retry control", () => {
  assert.match(pageSource, /id="cpProgressError"[^>]*role="alert"[^>]*aria-live="assertive"/);
  assert.match(pageSource, /id="cpProgressErrorMessage"/);
  assert.match(pageSource, /id="cpProgressRetryBtn"[^>]*>核对后重试保存<\/button>/);
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

test("restores the server-saved fractional position after media metadata loads", () => {
  const f = mount({
    activityProgressMap: {
      "activity-dynamic": { revision: 3, position: 0.4, completed: false },
    },
  });

  f.controller.setActivityContext("activity-dynamic", "VIDEO");
  f.controller.loadSource("https://media.example.invalid/course-video.mp4");
  f.video.duration = 100;
  f.video.dispatch("loadedmetadata");

  assert.equal(f.video.currentTime, 40);
});

test("clamps restored position to media duration and allows a zero-position restart", () => {
  const f = mount({
    activityProgressMap: {
      "activity-dynamic": { revision: 1, position: 1, completed: false },
      "activity-second": { revision: 2, position: 0, completed: false },
    },
  });

  f.controller.setActivityContext("activity-dynamic", "VIDEO");
  f.controller.loadSource("https://media.example.invalid/first.mp4");
  f.video.duration = 12;
  f.video.dispatch("loadedmetadata");
  assert.equal(f.video.currentTime, 12);

  f.state.currentActivityId = "activity-second";
  f.state.currentActivity = { activityType: "VIDEO" };
  f.controller.setActivityContext("activity-second", "VIDEO");
  f.controller.loadSource("https://media.example.invalid/second.mp4");
  f.video.duration = 60;
  f.video.dispatch("loadedmetadata");
  assert.equal(f.video.currentTime, 0);
});

test("ignores metadata from a media activity that is no longer selected", () => {
  const f = mount({
    activityProgressMap: {
      "activity-first": { revision: 2, position: 0.7, completed: false },
    },
  });
  f.state.currentActivityId = "activity-second";
  f.state.currentActivity = { activityType: "VIDEO" };

  f.controller.setActivityContext("activity-first", "VIDEO");
  f.controller.loadSource("https://media.example.invalid/first.mp4");
  f.video.duration = 100;
  f.video.dispatch("loadedmetadata");

  assert.equal(f.video.currentTime, 0);
});

test("duplicate ended events create only one completion write", async () => {
  const f = mount();

  f.controller.setActivityContext("activity-dynamic", "VIDEO");
  f.controller.loadSource("https://media.example.invalid/course-video.mp4");
  f.video.duration = 40;
  f.video.currentTime = 40;
  f.video.dispatch("loadedmetadata");
  f.video.dispatch("ended");
  f.video.dispatch("ended");
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][3], true);
});

test("progress save failure stays visible and retries only after server status is checked", async () => {
  let saveCount = 0;
  let refreshCount = 0;
  const saveFailure = Object.assign(new Error("service unavailable"), {
    status: 503,
  });
  const f = mount({
    saveActivityAttempt: async (...args) => {
      f.calls.push(args);
      saveCount += 1;
      if (saveCount === 1) throw saveFailure;
      return {
        progress: { revision: 1, position: 0.2, completed: false },
      };
    },
    refreshActivityProgress: async () => {
      refreshCount += 1;
      return { revision: 0, position: 0, completed: false };
    },
  });

  f.controller.setActivityContext("activity-dynamic", "VIDEO");
  f.controller.loadSource("https://media.example.invalid/course-video.mp4");
  f.video.duration = 100;
  f.video.dispatch("loadedmetadata");
  f.video.currentTime = 20;
  f.video.dispatch("timeupdate");
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(f.progressError.hidden, false);
  assert.match(f.progressErrorMessage.textContent, /未确认保存|尚未保存/);
  assert.equal(f.progressRetryBtn.hidden, false);
  assert.equal(saveCount, 1, "a failure must not trigger an automatic retry loop");

  f.progressRetryBtn.dispatch("click");
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(refreshCount, 1);
  assert.equal(saveCount, 2);
  assert.equal(f.calls[1][0], "activity-dynamic");
  assert.equal(f.calls[1][2].videoPosition, 0.2);
  assert.equal(f.progressError.hidden, true);
});

test("permission failure remains visible and retry never writes until server access is rechecked", async () => {
  let saveCount = 0;
  let refreshCount = 0;
  const denied = Object.assign(new Error("forbidden"), { status: 403 });
  const f = mount({
    saveActivityAttempt: async () => {
      saveCount += 1;
      throw denied;
    },
    refreshActivityProgress: async () => {
      refreshCount += 1;
      throw denied;
    },
  });

  f.controller.setActivityContext("activity-dynamic", "VIDEO");
  f.controller.loadSource("https://media.example.invalid/course-video.mp4");
  f.video.duration = 100;
  f.video.dispatch("loadedmetadata");
  f.video.currentTime = 20;
  f.controller.pause();
  f.video.play();
  f.controller.pause();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(saveCount, 1);
  assert.equal(f.progressError.hidden, false);
  assert.match(f.progressErrorMessage.textContent, /无权保存/);

  f.progressRetryBtn.dispatch("click");
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(refreshCount, 1);
  assert.equal(saveCount, 1);
  assert.equal(f.progressError.hidden, false);
  assert.equal(f.progressRetryBtn.hidden, false);
});

test("successful server acknowledgements from HTTP 200 and 201 paths clear progress state", async () => {
  for (const status of [200, 201]) {
    let saveCount = 0;
    const f = mount({
      saveActivityAttempt: async (...args) => {
        f.calls.push(args);
        saveCount += 1;
        return {
          status,
          progress: { revision: 1, position: 0.2, completed: false },
        };
      },
    });

    f.controller.setActivityContext("activity-dynamic", "VIDEO");
    f.controller.loadSource("https://media.example.invalid/course-video.mp4");
    f.video.duration = 100;
    f.video.dispatch("loadedmetadata");
    f.video.currentTime = 20;
    f.video.play();
    f.controller.pause();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(saveCount, 1);
    assert.equal(f.progressError.hidden, true);
    f.controller.destroy();
  }
});

test("a lost save response is reconciled against server progress without duplicate completion", async () => {
  let saveCount = 0;
  let refreshCount = 0;
  const f = mount({
    saveActivityAttempt: async (...args) => {
      f.calls.push(args);
      saveCount += 1;
      const error = new Error("response lost");
      error.code = "NETWORK_ERROR";
      throw error;
    },
    refreshActivityProgress: async () => {
      refreshCount += 1;
      return { revision: 1, position: 1, completed: true };
    },
  });

  f.controller.setActivityContext("activity-dynamic", "VIDEO");
  f.controller.loadSource("https://media.example.invalid/course-video.mp4");
  f.video.duration = 10;
  f.video.currentTime = 10;
  f.video.dispatch("loadedmetadata");
  f.video.dispatch("ended");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(f.progressError.hidden, false);

  f.progressRetryBtn.dispatch("click");
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(refreshCount, 1);
  assert.equal(saveCount, 1);
  assert.equal(f.progressError.hidden, true);
});

test("retry preserves a later server position instead of overwriting it with stale local progress", async () => {
  let saveCount = 0;
  const f = mount({
    saveActivityAttempt: async (...args) => {
      f.calls.push(args);
      saveCount += 1;
      if (saveCount === 1) throw new Error("network interrupted");
      return { progress: { revision: 2, position: 0.8, completed: false } };
    },
    refreshActivityProgress: async () => ({
      revision: 2,
      position: 0.9,
      completed: false,
    }),
  });

  f.controller.setActivityContext("activity-dynamic", "VIDEO");
  f.controller.loadSource("https://media.example.invalid/course-video.mp4");
  f.video.duration = 100;
  f.video.dispatch("loadedmetadata");
  f.video.currentTime = 80;
  f.video.dispatch("timeupdate");
  await new Promise((resolve) => setTimeout(resolve, 0));

  f.progressRetryBtn.dispatch("click");
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(saveCount, 1);
  assert.equal(f.progressError.hidden, true);
});

test("delayed progress writes stay bound to the activity selected when each save began", async () => {
  const pending = [];
  const f = mount({
    saveActivityAttempt(...args) {
      f.calls.push(args);
      return new Promise((resolve) => pending.push(resolve));
    },
  });

  f.controller.setActivityContext("activity-first", "VIDEO");
  f.controller.loadSource("https://media.example.invalid/first.mp4");
  f.video.duration = 100;
  f.video.dispatch("loadedmetadata");
  f.video.currentTime = 25;
  f.video.play();
  f.controller.pause();

  f.state.currentActivityId = "activity-second";
  f.state.currentActivity = { activityType: "VIDEO" };
  f.state.activityProgressMap = {
    "activity-first": { revision: 0, position: 0, completed: false },
    "activity-second": { revision: 0, position: 0, completed: false },
  };
  f.controller.setActivityContext("activity-second", "VIDEO");
  f.controller.loadSource("https://media.example.invalid/second.mp4");
  f.video.duration = 100;
  f.video.dispatch("loadedmetadata");
  f.video.currentTime = 35;
  f.video.play();
  f.controller.pause();

  assert.equal(f.calls[0][0], "activity-first");
  assert.equal(f.calls[0][2].videoPosition, 0.25);
  assert.equal(f.calls.length, 1, "writes are serialized while the first result is unresolved");

  pending[0]({ progress: { revision: 1, position: 0.25, completed: false } });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1][0], "activity-second");
  assert.equal(f.calls[1][2].videoPosition, 0.35);
  pending[1]({ progress: { revision: 1, position: 0.35, completed: false } });
  await new Promise((resolve) => setTimeout(resolve, 0));
});
