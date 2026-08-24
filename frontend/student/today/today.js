(() => {
  "use strict";

  const app = document.querySelector("#todayApp");
  const weekdays = "日一二三四五六";
  const safe = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  const statusText = (status) =>
    ({
      CREATED: "未开始",
      IN_PROGRESS: "进行中",
      SUBMITTED: "已提交",
      PROCESSING: "处理中",
      COMPLETED: "已完成",
      OPEN: "开放中",
    })[status] || "有任务";
  const scoreText = (value) =>
    typeof value === "number" && Number.isFinite(value)
      ? `${value} 分`
      : "暂未形成可用成绩";

  function dateText() {
    const now = new Date();
    return `${now.getMonth() + 1}月${now.getDate()}日　星期${weekdays[now.getDay()]}`;
  }

  function renderError(message) {
    app.innerHTML = `<section class="today-error"><h1>今天的学习暂时打不开</h1><p>${safe(message || "请检查网络后重试。不会显示本地示例任务。")}</p><button class="today-retry" type="button" data-today-retry>重新加载</button></section>`;
    app.querySelector("[data-today-retry]")?.addEventListener("click", init);
  }

  function renderEmptyList(text) {
    return `<p class="today-empty">${safe(text)}</p>`;
  }

  function render(data) {
    const primary = data?.primaryAction || null;
    const waiting = Array.isArray(data?.waiting) ? data.waiting : [];
    const secondary = Array.isArray(data?.secondaryActions)
      ? data.secondaryActions
      : [];
    const legacy = Array.isArray(data?.legacyTasks) ? data.legacyTasks : [];
    const formal = data?.summary?.latestFormalAssessment || null;
    const primaryMarkup = primary
      ? `<p class="today-eyebrow">建议先做</p><h2>${safe(primary.title)}</h2><p class="today-reason">${safe(primary.reason)}</p><button class="today-cta" type="button" data-primary-action>${safe(primary.cta)}　→</button>`
      : `<p class="today-eyebrow">现在没有需要立刻完成的练习</p><h2>先看看老师的反馈</h2><p class="today-neutral">${waiting.length ? "你的练习正在等待老师复核，完成复核后会在这里继续安排下一步。" : "新的学习安排会在有真实任务后出现在这里。"}</p>`;
    const waitingMarkup = waiting.length
      ? `<section class="today-card today-list"><div class="today-list-head"><h2>等待老师复核</h2><span>${waiting.length} 项</span></div><div class="today-list-items">${waiting.map((item) => `<article class="today-list-item"><div><strong>${safe(item.title)}</strong><p>${safe(item.reason)}${item.itemCount > 0 ? ` 共 ${item.itemCount} 道题。` : ""}</p></div><span class="today-status">等待中</span></article>`).join("")}</div></section>`
      : "";
    const secondaryMarkup = secondary.length
      ? `<section class="today-card today-list"><div class="today-list-head"><h2>其他可选任务</h2><span>按需完成</span></div><div class="today-list-items">${secondary.map((action) => `<article class="today-list-item"><div><strong>${safe(action.title)}</strong><p>${safe(action.reason)}</p></div><a href="${safe(action.target?.href || "/student/today")}">${safe(action.cta)}　→</a></article>`).join("")}</div></section>`
      : "";
    const legacyMarkup = legacy.length
      ? `<section class="today-card today-list"><div class="today-list-head"><h2>课程任务</h2><span>来自老师的课程安排</span></div><div class="today-list-items">${legacy.map((task) => `<article class="today-list-item"><div><strong>${safe(task.title)}</strong><p>${safe(task.courseTitle || "课程任务")} · ${safe(statusText(task.status))} · 已完成 ${Number(task.progressPercent) || 0}%</p></div><a href="/student/learn/spring-2?assignmentId=${encodeURIComponent(task.assignmentId)}">进入课程　→</a></article>`).join("")}</div></section>`
      : "";

    app.innerHTML = `<header class="today-header"><div><p class="today-kicker">学生学习入口</p><h1>今天的学习</h1><p>先完成一个最值得做的动作，其他安排稍后再看。</p></div><time class="today-date">${dateText()}</time></header><section class="today-grid"><article class="today-card today-primary" data-action-kind="${safe(primary?.kind || "WAITING")}">${primaryMarkup}</article><aside class="today-side"><article class="today-card today-summary"><p class="today-eyebrow">学习小结</p><h2>最近一次正式测评</h2>${formal ? `<div class="today-score"><small>${safe(formal.level || "已完成测评")}</small><strong>${scoreText(formal.score)}</strong><p>完成于 ${safe(String(formal.completedAt).slice(0, 10))}</p></div>` : renderEmptyList("还没有可展示的正式测评记录。")}</article><a class="today-card today-summary today-link-card" href="/student/practices/"><p class="today-eyebrow">需要自己选择时</p><h2>进入练习中心　→</h2><p>查看学校开放的真实练习和历史记录。</p></a></aside></section><section class="today-lists">${waitingMarkup}${secondaryMarkup}${legacyMarkup}</section>`;

    app
      .querySelector("[data-primary-action]")
      ?.addEventListener("click", () => runPrimary(primary));
  }

  async function runPrimary(action) {
    const button = app.querySelector("[data-primary-action]");
    if (!action || !button) return;
    button.disabled = true;
    button.textContent = "正在准备…";
    try {
      if (action.kind === "START_REMEDIATION") {
        if (!action.target?.sourceSessionId)
          throw new Error("缺少正式测评来源，无法准备专项巩固");
        const result = await YuzanApi.createAssessmentRemediation(
          action.target.sourceSessionId,
        );
        if (!result?.attemptId) throw new Error("专项巩固练习未能准备完成");
        location.href = `/student/practices/attempts/${encodeURIComponent(result.attemptId)}/runner/`;
        return;
      }
      if (action.kind === "BASELINE") {
        if (!action.target?.practiceDefinitionId)
          throw new Error("缺少练习定义，无法准备第一次测评");
        const result = await YuzanApi.createOrResumePractice(
          action.target.practiceDefinitionId,
        );
        if (!result?.attemptId) throw new Error("第一次测评未能准备完成");
        location.href = `/student/practices/attempts/${encodeURIComponent(result.attemptId)}/runner/`;
        return;
      }
      location.href = action.target.href;
    } catch (error) {
      button.disabled = false;
      button.textContent = `${action.cta}　→`;
      renderError(error?.message || "进入学习任务失败");
    }
  }

  async function init() {
    if (!YuzanApi.getToken()) {
      location.href = "/login";
      return;
    }
    try {
      const schoolId = YuzanApi.getActiveSchoolId();
      if (!schoolId) {
        location.href = "/select-school";
        return;
      }
      const data = await YuzanApi.getStudentToday();
      if (!data || data.version !== "student-today-v1")
        throw new Error("今日学习数据版本不可用");
      window.__studentTodayData = data;
      render(data);
    } catch (error) {
      renderError(error?.message || "今日学习数据加载失败");
    }
  }

  init();
})();
