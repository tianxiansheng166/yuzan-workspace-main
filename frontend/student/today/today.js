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

  let loadVersion = 0;

  function failureMessage(error) {
    if (error?.status === 401) return "登录已过期，请重新登录后继续学习。";
    if (error?.status === 403)
      return "当前账号没有访问权限，请确认学校或联系老师后重试。";
    if (error?.status === 404)
      return "学习安排暂时不可用，请刷新或联系老师确认。";
    if (error?.name === "TypeError") return "网络连接失败，请检查网络后重试。";
    return error?.message || "网络连接失败，请检查网络后重试。";
  }

  function renderError(message, status) {
    app.dataset.state = "error";
    app.innerHTML = `<section class="today-error"><h1>今天的学习暂时打不开</h1><p>${safe(message || "请检查网络后重试。不会显示本地示例任务。")}</p><button class="today-retry" type="button" data-today-retry>重新加载</button>${status === 401 ? '<a href="/login/">重新登录</a>' : ""}</section>`;
    app.querySelector("[data-today-retry]")?.addEventListener("click", init);
  }

  function renderEmptyList(text) {
    return `<p class="today-empty">${safe(text)}</p>`;
  }

  function renderCourseCard(course) {
    const assignmentId = course?.assignmentId || '';
    const title = course?.title || course?.course?.title || '未命名课程';
    const description = course?.description || '打开真实课程内容，继续完成老师安排的学习路径。';
    const progress = Number(course?.progressPercent);
    const hasProgress = Number.isFinite(progress) && progress >= 0;
    const minutes = Number(course?.estimatedMinutes);
    const nextActivity = course?.nextActivity?.title;
    const meta = [
      Number.isFinite(minutes) && minutes > 0 ? `预计 ${minutes} 分钟` : '',
      nextActivity ? `下一步：${nextActivity}` : '',
    ].filter(Boolean);
    return `<article class="today-course-item">
      <div class="today-course-cover"><img src="${safe(course?.coverAsset || '/assets/cover-spring.png')}" alt="${safe(title)}" onerror="this.onerror=null;this.src='/assets/cover-spring.png'"></div>
      <div class="today-course-body">
        <span class="today-course-label">真实课程</span>
        <h3>${safe(title)}</h3>
        <p>${safe(description)}</p>
        ${meta.length ? `<div class="today-course-meta">${meta.map((item) => `<span>${safe(item)}</span>`).join('')}</div>` : ''}
        ${hasProgress ? `<div class="today-course-progress"><div><i style="width:${Math.min(100, progress)}%"></i></div><span>${Math.round(progress)}%</span></div>` : ''}
        <a class="today-course-link" href="/student/courses/course-detail/?id=${encodeURIComponent(assignmentId)}">${progress > 0 ? '继续课程' : '进入课程'}　→</a>
      </div>
    </article>`;
  }

  function renderCourseSection(courses, state = "ready", error = null) {
    const visibleCourses = (Array.isArray(courses) ? courses : []).slice(0, 2);
    const body =
      state === "loading"
        ? `<p class="today-empty" aria-busy="true">正在加载课程…</p>`
        : state === "error"
          ? `<div role="alert"><p>课程列表加载失败，暂时无法确认可学课程。</p><p>${safe(failureMessage(error))}</p><button class="today-retry" type="button" data-courses-retry>重试课程列表</button>${error?.status === 401 ? '<a href="/login/">重新登录</a>' : ""}</div>`
          : visibleCourses.length
            ? `<div class="today-course-grid">${visibleCourses.map(renderCourseCard).join("")}</div>`
            : `<div class="today-course-empty"><div><strong>当前没有可学课程</strong><p>学校开放的真实课程会出现在课程中心，点击进入查看视频、课件与练习。</p></div><a class="today-course-link" href="/student/courses">打开课程中心　→</a></div>`;
    return `<section class="today-card today-courses" data-course-state="${state === "ready" && !visibleCourses.length ? "empty" : state}"><div class="today-course-head"><div><p class="today-eyebrow">课程路径</p><h2>继续你的课程学习</h2></div><a href="/student/courses">查看全部课程　→</a></div>${body}</section>`;
  }

  function render(data) {
    const primary = data?.primaryAction || null;
    app.dataset.state = primary
      ? "ready"
      : data?.waiting?.length
        ? "processing"
        : "empty";
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

    app.innerHTML = `<header class="today-header"><div class="today-header-copy"><p class="today-kicker">学生学习入口</p><h1>今天的学习</h1><p>先完成一个最值得做的动作，再回到课程路径继续学习。</p><nav class="today-breadcrumb" aria-label="面包屑"><a href="/student/courses">课程中心</a><span>/</span><span>今日学习</span></nav></div><time class="today-date">${dateText()}</time></header><section class="today-grid"><article class="today-card today-primary" data-action-kind="${safe(primary?.kind || "WAITING")}">${primaryMarkup}</article><aside class="today-side"><article class="today-card today-summary"><p class="today-eyebrow">学习小结</p><h2>最近一次正式测评</h2>${formal ? `<div class="today-score"><small>${safe(formal.level || "已完成测评")}</small><strong>${scoreText(formal.score)}</strong><p>完成于 ${safe(String(formal.completedAt).slice(0, 10))}</p></div>` : renderEmptyList("还没有可展示的正式测评记录。")}</article><a class="today-card today-summary today-link-card" href="/student/practices/"><p class="today-eyebrow">需要自己选择时</p><h2>进入练习中心　→</h2><p>查看学校开放的真实练习和历史记录。</p></a></aside></section><div class="today-course-wrap">${renderCourseSection([], "loading")}</div><section class="today-lists">${waitingMarkup}${secondaryMarkup}${legacyMarkup}</section>`;

    app
      .querySelector("[data-primary-action]")
      ?.addEventListener("click", () => runPrimary(primary));
  }

  async function runPrimary(action) {
    const button = app.querySelector("[data-primary-action]");
    if (!action || !button) return;
    app.querySelector("[data-primary-error]")?.remove();
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
      if (!action.target?.href)
        throw new Error("学习任务缺少入口，请重新加载。");
      location.href = action.target.href;
    } catch (error) {
      button.disabled = false;
      button.textContent = `${action.cta}　→`;
      let feedback = app.querySelector("[data-primary-error]");
      if (!feedback) {
        feedback = document.createElement("p");
        feedback.dataset.primaryError = "";
        feedback.setAttribute("role", "alert");
        button.after(feedback);
      }
      feedback.textContent = `${failureMessage(error)} 可以重试上方学习按钮。`;
      if (error?.status === 401) {
        const login = document.createElement("a");
        login.href = "/login/";
        login.textContent = "重新登录";
        feedback.append(login);
      }
    }
  }

  function courseResult() {
    return YuzanApi.listStudentCourses({ limit: 4 })
      .then((data) => {
        if (!Array.isArray(data?.courses))
          throw new Error("课程列表响应不可用，请重试。");
        return { courses: data.courses };
      })
      .catch((error) => ({ error }));
  }

  function updateCourses(result, version) {
    if (version !== loadVersion) return;
    const wrap = app.querySelector(".today-course-wrap");
    if (!wrap) return;
    wrap.innerHTML = renderCourseSection(
      result.courses,
      result.error ? "error" : "ready",
      result.error,
    );
    wrap
      .querySelector("[data-courses-retry]")
      ?.addEventListener("click", async () => {
        wrap.innerHTML = renderCourseSection([], "loading");
        updateCourses(await courseResult(), version);
      });
  }

  async function init() {
    const version = ++loadVersion;
    delete window.__studentTodayData;
    if (!YuzanApi.getToken()) {
      location.href = "/login";
      return;
    }
    app.dataset.state = "loading";
    app.innerHTML = `<section class="today-state" aria-busy="true"><div class="today-spinner" aria-hidden="true"></div><p>正在整理你的下一步学习…</p></section>`;
    try {
      const schoolId = YuzanApi.getActiveSchoolId();
      if (!schoolId) {
        location.href = "/select-school";
        return;
      }
      const courses = courseResult();
      const data = await YuzanApi.getStudentToday();
      if (version !== loadVersion) return;
      if (!data || data.version !== "student-today-v1")
        throw new Error("今日学习数据版本不可用");
      window.__studentTodayData = data;
      render(data);
      updateCourses(await courses, version);
    } catch (error) {
      if (version === loadVersion) renderError(failureMessage(error), error?.status);
    }
  }

  init();
})();
