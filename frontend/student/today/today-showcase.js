(() => {
  "use strict";

  // Present real, authorized learning routes. This is navigation, not a separate
  // exam engine or a claim that a scoring/recording service is available.
  const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

  function cards({ today = {}, practices = {}, courses = {} } = {}) {
    const openPractices = Array.isArray(practices.items) ? practices.items : [];
    const openCourses = Array.isArray(courses.courses) ? courses.courses : [];
    const course = openCourses.find((item) => item?.assignmentId && (item.title || item.course?.title));
    const speaking = openPractices.find((item) => item?.id && item?.title && item.requiresRecording === true);
    const baselineId = today.primaryAction?.kind === "BASELINE"
      ? today.primaryAction?.target?.practiceDefinitionId : null;
    const baseline = baselineId && openPractices.find((item) => item?.id === baselineId);
    const formal = today.summary?.latestFormalAssessment;
    const hasFormalScore = Number.isFinite(formal?.score);

    return [
      {
        key: "listen", number: "01", title: "听 · 课程学习", kicker: "LISTEN",
        detail: course ? safe(course.title || course.course.title) : "进入课程中心，查看当前学籍已开放的内容。",
        status: course ? "已有可学课程" : courses.error ? "课程尚未确认" : "暂无开放课程",
        href: course ? `/student/courses/course-detail/?id=${encodeURIComponent(course.assignmentId)}` : "/student/courses/",
        cta: course ? "打开这门课程" : "查看课程中心",
      },
      {
        key: "speak", number: "02", title: "说 · 录音练习", kicker: "SPEAK",
        detail: speaking ? safe(speaking.title) : "有录音要求的练习开放后，可以在这里开始。",
        status: speaking ? "录音练习已开放" : practices.error ? "练习尚未确认" : "暂无已开放录音练习",
        href: speaking ? `/student/practices/${encodeURIComponent(speaking.id)}/` : "/student/practices/",
        cta: speaking ? "进入录音练习" : "查看练习清单",
      },
      {
        key: "exam", number: "03", title: "测 · 规范作答", kicker: "ASSESS",
        detail: baseline ? safe(baseline.title) : "查看真实测评与练习要求，按题作答并提交。",
        status: baseline ? "首次测评已开放" : "具体题型以授权清单为准",
        href: baseline ? `/student/practices/${encodeURIComponent(baseline.id)}/` : "/student/practices/",
        cta: baseline ? "查看本次测评" : "进入测评与练习",
      },
      {
        key: "report", number: "04", title: "评 · 报告复练", kicker: "REVIEW",
        detail: hasFormalScore ? `最近正式成绩 ${safe(formal.score)} 分，可查看反馈与巩固入口。` : "等待正式结果时，可随时回看本人学习记录。",
        status: hasFormalScore ? "正式成绩已生成" : "不展示待审或缺失成绩",
        href: hasFormalScore ? "/student/growth/" : "/student/practices/history/",
        cta: hasFormalScore ? "看报告与专项复练" : "查看学习记录",
      },
    ];
  }

  function render(state) {
    const steps = cards(state);
    return `<section class="today-skill-path" aria-labelledby="today-skill-title">
      <div class="today-skill-heading">
        <div><p class="today-eyebrow">听 · 说 · 练 · 测</p><h2 id="today-skill-title">从开口练习，到看见成长</h2></div>
        <p>真实课程、录音作答、测评和报告，都在这里找到下一步。</p>
      </div>
      <div class="today-skill-grid">${steps.map((step) => `<article class="today-skill-card today-skill-${step.key}">
        <div class="today-skill-top"><span class="today-skill-number">${step.number}</span><span class="today-skill-kicker">${step.kicker}</span></div>
        <div class="today-skill-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <h3>${step.title}</h3><p class="today-skill-detail">${step.detail}</p>
        <span class="today-skill-status">${safe(step.status)}</span>
        <a class="today-skill-link" href="${safe(step.href)}">${safe(step.cta)} <span aria-hidden="true">↗</span></a>
      </article>`).join("")}</div>
    </section>`;
  }

  window.YuzanTodayShowcase = Object.freeze({ cards, render });
})();
