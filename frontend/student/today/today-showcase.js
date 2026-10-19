(() => {
  "use strict";

  // Today already decides the student's primary next step. This small module
  // only surfaces ONE different, server-authorized optional activity afterwards.
  const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

  function suggestion({ today = {}, practices = {}, courses = {}, attempts = {} } = {}) {
    const primary = today.primaryAction || {};
    const target = primary.target || {};
    const practicesList = Array.isArray(practices.items) ? practices.items : [];
    const coursesList = Array.isArray(courses.courses) ? courses.courses : [];
    const attemptsList = Array.isArray(attempts.items) ? attempts.items : [];
    const resumeMatch = typeof target.href === "string"
      ? target.href.match(/^\/(?:assessment\/sessions\/([^/]+)|student\/practices\/attempts\/([^/]+)\/runner)\/$/)
      : null;
    const resumedAttemptId = resumeMatch?.[1] || resumeMatch?.[2] || null;
    const resumedAttempt = resumedAttemptId
      ? attemptsList.find((item) => item?.id === resumedAttemptId)
      : null;
    const primaryPracticeId = target.practiceDefinitionId
      || resumedAttempt?.practiceAttempt?.practiceDefinitionId
      || resumedAttempt?.practiceDefinitionId
      || null;

    // A continuation route has no trustworthy practice ID until its own
    // authorized Attempt is loaded. Fail closed instead of guessing.
    if (resumedAttemptId && !primaryPracticeId) return null;
    const isDuplicate = (id, href) =>
      (primaryPracticeId && primaryPracticeId === id) ||
      (typeof target.href === "string" && target.href === href);

    // Show a recording shortcut only when the real authorized catalog says
    // this definition requires recording. Do not mistake any reading practice
    // for a speaking activity or invent a supposedly personalized AI choice.
    const oral = practicesList.find((item) => item?.id && item?.title
      && item.requiresRecording === true
      && !isDuplicate(item.id, `/student/practices/${encodeURIComponent(item.id)}/`));
    if (oral) {
      return {
        type: "speak",
        eyebrow: "已开放 · 录音练习",
        title: oral.title,
        detail: "完成今天的主要任务后，也可以试试这项需要录音的练习。",
        href: `/student/practices/${encodeURIComponent(oral.id)}/`,
        label: "查看练习",
      };
    }

    const course = coursesList.find((item) =>
      item?.assignmentId && (item.title || item.course?.title) &&
      !isDuplicate(null, `/student/courses/course-detail/?id=${encodeURIComponent(item.assignmentId)}`));
    if (course) {
      return {
        type: "course",
        eyebrow: "已开放 · 课程内容",
        title: course.title || course.course.title,
        detail: "学完当前任务后，可以继续自己的课程学习。",
        href: `/student/courses/course-detail/?id=${encodeURIComponent(course.assignmentId)}`,
        label: "进入课程",
      };
    }

    // No additional verified work: don't create a fourth action just to fill
    // space, and never treat an API failure as an empty authorized catalog.
    return null;
  }

  function render(state) {
    const item = suggestion(state);
    if (!item) return "";
    return `<section class="today-discover" aria-label="其他已开放的学习内容">
      <span class="today-discover-symbol" aria-hidden="true">↗</span>
      <div class="today-discover-copy">
        <p class="today-eyebrow">${safe(item.eyebrow)}</p>
        <h2>${safe(item.title)}</h2>
        <p>${safe(item.detail)}</p>
      </div>
      <a class="today-discover-link" href="${safe(item.href)}">${safe(item.label)} <span aria-hidden="true">→</span></a>
    </section>`;
  }

  // Keep the pre-existing loader's global name to avoid changing its other
  // dependency wiring or the original Today error / retry lifecycle.
  window.YuzanTodayShowcase = Object.freeze({ suggestion, render });
})();
