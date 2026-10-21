import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const mediaSource = fs.readFileSync(
  new URL("./media-controller.js", import.meta.url),
  "utf8",
);

function element() {
  const listeners = new Map();
  const attributes = new Set();
  return {
    listeners,
    attributes,
    classList: { add() {}, remove() {} },
    children: [],
    hidden: false,
    paused: true,
    muted: false,
    currentTime: 0,
    duration: 0,
    style: {},
    textContent: "",
    innerHTML: "",
    value: "",
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
    setAttribute(name) { attributes.add(name); },
    removeAttribute(name) { attributes.delete(name); },
    appendChild(child) { this.children.push(child); },
    removeChild(child) { this.children = this.children.filter((item) => item !== child); },
    querySelectorAll() { return []; },
    contains() { return false; },
    play() { this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; },
    load() {},
    dispatch(name) { const callback = listeners.get(name); if (callback) callback(); },
  };
}

function loadMediaController() {
  const ids = [
    "cpVideo", "cpPlayBig", "cpVideoOverlay", "cpVideoControls", "cpPlayBtn",
    "cpProgressInput", "cpTimeCurrent", "cpTimeDuration", "cpSpeedBtn",
    "cpSpeedMenu", "cpSubZhBtn", "cpSubBoBtn", "cpFullscreenBtn", "cpVolumeBtn",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, element()]));
  elements.cpVideo.parentElement = element();
  const documentListeners = new Map();
  const document = {
    fullscreenElement: null,
    getElementById: (id) => elements[id] || null,
    createElement: () => element(),
    addEventListener: (name, callback) => documentListeners.set(name, callback),
    removeEventListener: (name) => documentListeners.delete(name),
  };
  const state = {
    currentActivityId: "activity-video",
    submissionId: "submission-1",
    submissionStatus: "IN_PROGRESS",
    currentActivity: { activityType: "VIDEO" },
    activityProgressMap: { "activity-video": { position: 0.4, revision: 2 } },
  };
  const saves = [];
  const progressUpdates = [];
  const coursePlayerState = {
    getState: () => state,
    updateVideoProgress: (...args) => { progressUpdates.push(args); },
    saveActivityAttempt: (...args) => { saves.push(args); return Promise.resolve({}); },
  };
  const window = {};
  vm.runInNewContext(mediaSource, {
    window,
    document,
    CoursePlayerState: coursePlayerState,
    Promise,
    Number,
    Math,
    isFinite,
    setTimeout,
    clearTimeout,
  });
  window.MediaController.init("cpVideo");
  window.MediaController.loadSource("https://media.invalid/course.mp4", "", "", "");
  return { media: window.MediaController, video: elements.cpVideo, saves, state, elements, progressUpdates };
}

test("tracks native duration and reports full playback progress to course state", async () => {
  const { video, saves, elements, progressUpdates } = loadMediaController();

  video.duration = 100;
  video.dispatch("loadedmetadata");
  assert.equal(elements.cpProgressInput.max, 100);
  assert.equal(video.currentTime, 0);

  video.currentTime = 100;
  video.dispatch("timeupdate");
  await Promise.resolve();

  assert.equal(saves.length, 1);
  assert.equal(saves[0][0], "activity-video");
  assert.equal(saves[0][1], "VIDEO");
  assert.equal(saves[0][2].videoPosition, 1);
  assert.equal(saves[0][3], false);
  assert.deepEqual(progressUpdates[0], [100, 100, 100]);
});

test("persists partial video position without marking the activity complete", async () => {
  const { video, saves } = loadMediaController();
  video.duration = 100;
  video.dispatch("loadedmetadata");
  video.currentTime = 55;
  video.dispatch("timeupdate");
  await Promise.resolve();

  assert.equal(saves.length, 1);
  assert.equal(saves[0][2].videoPosition, 0.55);
  assert.equal(saves[0][3], false);
});

test("replacing a course activity source does not keep stale video media", () => {
  const { media, video } = loadMediaController();
  media.loadSource("https://media.invalid/first.mp4", "first-poster.jpg", "", "");
  assert.equal(video.src, "https://media.invalid/first.mp4");
  assert.equal(video.poster, "first-poster.jpg");

  media.loadSource("https://media.invalid/next.mp4", "next-poster.jpg", "", "");
  assert.equal(video.src, "https://media.invalid/next.mp4");
  assert.equal(video.poster, "next-poster.jpg");
});
