(() => {
  "use strict";

  const app = document.querySelector("#todayApp");
  const weekdays = "日一二三四五六";
  const icons = {
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 5.5v13A2.5 2.5 0 0 1 6.5 16H20M8 7h8M8 10h6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    flag: '<path d="M5 21V4m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
    leaf: '<path d="M20 4c-8 0-14 3-14 10a6 6 0 0 0 6 6c7 0 8-8 8-16Z"/><path d="M4 21c2-5 6-8 12-11"/>',
    spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>',
    report: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h7"/>',
    school: '<path d="m3 10 9-6 9 6M5 11v8m4-8v8m6-8v8m4-8v8M3 21h18"/>',
  };

  const safe = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);

  const icon = (name, className = "") =>
    `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.book}</svg>`;

  const unwrap = (value) =>
    value && typeof value === "object" && Object.hasOwn(value, "data")
      ? value.data
      : value;

  const statusText = (status) =>
    ({
      CREATED: "未开始",
      IN_PROGRESS: "进行中",
      SUBMITTED: "已提交",
      PROCESSING: "处理中",
      COMPLETED: "已完成",
      OPEN: "开放中",
    })[status] || "状态待确认";

  const actionLabel = (kind) =>
    ({
      TEACHER_REMEDIATION: "老师布置",
      RESUME_REMEDIATION: "专项巩固",
      RESUME_ASSESSMENT: "上次未完成",
      START_REMEDIATION: "待巩固能力",
      BASELINE: "首次测评",
      CONTINUE_PRACTICE: "继续练习",
      LEGACY_ASSIGNMENT: "老师布置",
    })[kind] || "今日行动";

  function dateText(value, options = {}) {
    const date = value ? new Date(value) : new Date();
    if (!Number.isFinite(date.getTime())) return "";
    return new Intl.DateTimeFormat("zh-CN", options).format(date);
  }

  function failureMessage(error) {
    if (error?.status === 401) return "登录已过期，请重新登录后继续学习。";
    if (error?.status === 403)
      return "当前账号没有访问权限，请确认所选学校和学生学籍后重试。";
    if (error?.status === 404)
      return "这条学习记录已不可用，请刷新后重新读取当前账号的数据。";
    if (error?.name === "TypeError" || error?.status === 0)
      return "网络连接失败，请检查网络后重试。";
    return error?.message || "暂时无法读取学习数据，请稍后重试。";
  }

  let loadVersion = 0;
  let loadedIdentity = null;

  function readIdentity() {
    const api = window.YuzanApi || YuzanApi;
    const user = api.getStoredUser?.() || {};
    return {
      hasToken: Boolean(api.getToken?.()),
      schoolId: api.getActiveSchoolId?.() || "",
      userId: user.id || user.userId || "",
    };
  }

  function identityKey(identity) {
    return `${identity.userId}|${identity.schoolId}`;
  }

  function sameIdentity(left, right) {
    return identityKey(left) === identityKey(right) && left.hasToken === right.hasToken;
  }

  function retryButton(label = "重新加载", marker = "today-retry") {
    return `<button class="today-button today-button-secondary" type="button" data-${marker}>${safe(label)}</button>`;
  }

  function renderError(error) {
    const status = error?.status;
    const heading =
      status === 401
        ? "请重新登录"
        : status === 403
          ? "暂时无法查看这所学校的学习内容"
          : status === 404
            ? "这条学习记录暂时不可用"
            : "今天的学习暂时打不开";
    app.dataset.state = "error";
    app.innerHTML = `<section class="today-error" role="alert"><span class="today-error-mark">!</span><p class="today-eyebrow">学习数据未加载</p><h1>${heading}</h1><p>${safe(failureMessage(error))}</p><div class="today-error-actions">${retryButton()}${status === 401 ? '<a class="today-button today-button-primary" href="/login/">重新登录</a>' : ""}</div></section>`;
    app.querySelector("[data-today-retry]")?.addEventListener("click", init);
  }

  function renderSupplementError(title, error, marker) {
    return `<article class="today-card today-data-error" role="alert"><div>${icon("clock", "today-icon")}</div><div><h3>${safe(title)}暂时无法确认</h3><p>${safe(failureMessage(error))}</p>${retryButton("重试", marker)}${error?.status === 401 ? '<a class="today-inline-link" href="/login/">重新登录</a>' : ""}</div></article>`;
  }

  function localHref(value) {
    return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
      ? value
      : "";
  }

  function failureFooter(action) {
    return `<p class="today-inline-error" data-primary-error role="alert">${safe(failureMessage(action))}</p>`;
  }

  function primaryControl(action) {
    if (action.kind === "START_REMEDIATION" || action.kind === "BASELINE") {
      return `<button class="today-button today-button-primary" type="button" data-primary-action>${safe(action.cta)} ${icon("arrow")}</button>`;
    }
    const href = localHref(action.target?.href);
    return href
      ? `<a class="today-button today-button-primary" data-primary-action href="${safe(href)}">${safe(action.cta)} ${icon("arrow")}</a>`
      : `<p class="today-inline-error" role="alert">这项学习任务没有有效入口，请重新加载后再试。</p>`;
  }

  function renderPrimary(action, waiting, profile, unresolved) {
    if (!action) {
      const hasWaiting = waiting.length > 0;
      if (!hasWaiting && unresolved) {
        return `<section class="today-card today-primary today-primary-empty" data-action-kind="UNCONFIRMED" role="status"><div class="today-primary-copy"><span class="today-label-icon">${icon("clock")}</span><p class="today-eyebrow">学习安排尚未完全确认</p><h2>正在确认可继续的练习</h2><p class="today-reason">部分学习记录暂时没有加载成功。重新读取后，才能确认今天是否有可做的任务。</p>${retryButton("重新读取学习安排")}</div><div class="today-primary-side"><span class="today-orbit today-orbit-one"></span><span class="today-orbit today-orbit-two"></span><span class="today-orbit-core">${icon("spark")}</span><p>${safe(profile.schoolName || "当前学校")}</p></div></section>`;
      }
      return `<section class="today-card today-primary today-primary-empty" data-action-kind="WAITING"><div class="today-primary-copy"><span class="today-label-icon">${icon(hasWaiting ? "clock" : "leaf")}</span><p class="today-eyebrow">${hasWaiting ? "当前有记录正在处理中" : "今天暂时没有待开始的练习"}</p><h2>${hasWaiting ? "等待中的记录" : "给自己留一点探索时间"}</h2><p class="today-reason">${hasWaiting ? "老师完成复核或处理结束后，最新状态会显示在学习记录中。" : "如果老师开放了任务，或有一项练习还没完成，这里会出现对应入口。"}</p><a class="today-button today-button-outline" href="${hasWaiting ? "/assessment/history/" : "/student/practices/"}">${hasWaiting ? "查看学习记录" : "看看已开放练习"} ${icon("arrow")}</a></div><div class="today-primary-side"><span class="today-orbit today-orbit-one"></span><span class="today-orbit today-orbit-two"></span><span class="today-orbit-core">${icon("spark")}</span><p>${safe(profile.schoolName || "当前学校")}</p></div></section>`;
    }

    return `<section class="today-card today-primary" data-action-kind="${safe(action.kind)}"><div class="today-primary-copy"><div class="today-label-row"><span class="today-label-icon">${icon(action.kind === "TEACHER_REMEDIATION" || action.kind === "LEGACY_ASSIGNMENT" ? "school" : action.kind === "RESUME_REMEDIATION" ? "flag" : "book")}</span><p class="today-eyebrow">${safe(actionLabel(action.kind))}</p></div><h2>${safe(action.title)}</h2><p class="today-reason">${safe(action.reason)}</p><div class="today-primary-controls">${primaryControl(action)}<a class="today-button today-button-quiet" href="/student/growth/">看看最近的成长 ${icon("arrow")}</a></div></div><div class="today-primary-side" aria-hidden="true"><span class="today-orbit today-orbit-one"></span><span class="today-orbit today-orbit-two"></span><span class="today-orbit-core">${icon(action.kind === "TEACHER_REMEDIATION" ? "school" : action.kind === "START_REMEDIATION" ? "flag" : "book")}</span><p>下一步 · ${safe(action.cta)}</p></div><div data-primary-feedback></div></section>`;
  }

  function actionProgress(data, attempts) {
    const milestones = [];
    const primary = data.today.primaryAction;
    const hasOpenedWork = data.practices.items.length > 0 || data.today.legacyTasks.length > 0;
    const inProgress = attempts.filter((entry) => ["CREATED", "IN_PROGRESS"].includes(entry.status));
    const processing = attempts.filter((entry) => ["SUBMITTED", "PROCESSING"].includes(entry.status));
    const formal = data.today.summary?.latestFormalAssessment;
    if (hasOpenedWork) milestones.push({ label: "已有开放练习", state: "complete", icon: "book" });
    if (inProgress.length || ["RESUME_ASSESSMENT", "RESUME_REMEDIATION"].includes(primary?.kind)) milestones.push({ label: "继续上次进度", state: "current", icon: "clock" });
    if (processing.length || data.today.waiting.length) milestones.push({ label: "等待处理或复核", state: "waiting", icon: "clock" });
    if (formal && typeof formal.score === "number") milestones.push({ label: "已有正式结果", state: "complete", icon: "check" });
    if (!milestones.length) return `<p class="today-track-empty">有新的学习记录后，这条进度轨会按真实状态更新。</p>`;
    return `<ol class="today-track">${milestones.map((item, index) => `<li class="today-track-step ${item.state}"><span class="today-track-node">${icon(item.icon)}</span><span class="today-track-copy"><small>记录 ${String(index + 1).padStart(2, "0")}</small><strong>${safe(item.label)}</strong></span></li>`).join("")}</ol>`;
  }

  function renderLatestFormal(formal) {
    if (!formal) return `<div class="today-formal-empty"><span class="today-formal-icon">${icon("report")}</span><div><strong>还没有正式测评结果</strong><p>只有服务端已生成的正式结果会显示在这里。</p></div></div>`;
    const score = typeof formal.score === "number" && Number.isFinite(formal.score) ? `${formal.score} 分` : "正式报告暂无总分";
    return `<div class="today-formal-result"><span class="today-formal-icon">${icon("report")}</span><div><strong>${safe(formal.level || "正式测评")}</strong><p>${safe(score)} · 完成于 ${safe(dateText(formal.completedAt, { year: "numeric", month: "long", day: "numeric" }))}</p><a href="/student/growth/">查看成长与报告 ${icon("arrow")}</a></div></div>`;
  }

  function attemptLink(attempt) {
    const practiceAttempt = attempt.practiceAttempt;
    const path = attempt.status === "PROCESSING" || attempt.status === "SUBMITTED"
      ? attempt.purpose === "REMEDIATION"
        ? `/student/practices/attempts/${encodeURIComponent(attempt.id)}/processing/`
        : `/assessment/sessions/${encodeURIComponent(attempt.id)}/processing/`
      : attempt.purpose === "REMEDIATION" || practiceAttempt?.practiceDefinitionId
        ? `/student/practices/attempts/${encodeURIComponent(attempt.id)}/runner/`
        : `/assessment/sessions/${encodeURIComponent(attempt.id)}/`;
    return path;
  }

  function renderAttempt(attempt) {
    const processing = ["SUBMITTED", "PROCESSING"].includes(attempt.status);
    const title = attempt.practiceTitle || (attempt.purpose === "REMEDIATION" ? "专项巩固" : "上次未完成的测评");
    const updated = attempt.updatedAt ? dateText(attempt.updatedAt, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
    const progress = attempt.itemProgress;
    const progressText = progress ? `已完成 ${progress.answered} / ${progress.total} 道` : "按上次保存的位置继续";
    const href = attemptLink(attempt);
    return `<article class="today-record-row ${processing ? "is-processing" : ""}"><span class="today-record-icon">${icon(processing ? "clock" : attempt.purpose === "REMEDIATION" ? "flag" : "book")}</span><div class="today-record-copy"><div class="today-record-title"><strong>${safe(title)}</strong><span class="today-status ${processing ? "processing" : "active"}">${safe(statusText(attempt.status))}</span></div><p>${safe(progressText)}${updated ? ` · 最近更新 ${safe(updated)}` : ""}</p></div><a class="today-record-link" href="${safe(href)}">${processing ? "查看处理状态" : "继续练习"} ${icon("arrow")}</a></article>`;
  }

  function renderPractice(practice, attemptByDefinition) {
    if (!practice?.id || !practice.title) return "";
    const attempt = attemptByDefinition.get(practice.id);
    const state = practice.studentState || {};
    const isTeacher = practice.mode === "ASSIGNMENT";
    const isSpecialized = practice.catalogType === "SPECIALIZED";
    const label = isTeacher ? "老师开放" : isSpecialized ? "专项巩固" : "自主练习";
    const completion = attempt?.status || state.completionStatus || "NOT_STARTED";
    const stateLabel = attempt ? statusText(attempt.status) : ({ NOT_STARTED: "待开始", IN_PROGRESS: "进行中", COMPLETED: "已完成" })[completion] || "开放中";
    const href = attempt && ["CREATED", "IN_PROGRESS"].includes(attempt.status)
      ? attemptLink(attempt)
      : `/student/practices/${encodeURIComponent(practice.id)}/`;
    const cta = attempt && ["CREATED", "IN_PROGRESS"].includes(attempt.status)
      ? "继续这项练习"
      : completion === "COMPLETED"
        ? "再次练习"
        : "查看练习";
    const categories = Array.isArray(practice.abilityCategories) ? practice.abilityCategories.slice(0, 2) : [];
    const minutes = Number(practice.estimatedMinutes);
    const facts = [
      ...categories,
      Number.isFinite(minutes) && minutes > 0 ? `约 ${minutes} 分钟` : "",
    ].filter(Boolean);
    return `<article class="today-practice-card"><div class="today-practice-mark ${isTeacher ? "teacher" : isSpecialized ? "focus" : "self"}">${icon(isTeacher ? "school" : isSpecialized ? "flag" : "leaf")}</div><div class="today-practice-content"><div class="today-practice-tags"><span>${safe(label)}</span><span class="today-status ${completion === "COMPLETED" ? "complete" : "active"}">${safe(stateLabel)}</span></div><h3>${safe(practice.title)}</h3>${practice.summary ? `<p>${safe(practice.summary)}</p>` : ""}${facts.length ? `<ul class="today-facts">${facts.map((fact) => `<li>${safe(fact)}</li>`).join("")}</ul>` : ""}<a href="${safe(href)}" class="today-text-link">${cta} ${icon("arrow")}</a></div></article>`;
  }

  function renderPracticeSection(result, attempts) {
    if (result.error) return renderSupplementError("开放练习", result.error, "practices-retry");
    const items = Array.isArray(result.items) ? result.items : [];
    const attemptByDefinition = new Map();
    attempts.forEach((attempt) => {
      if (attempt.practiceAttempt?.practiceDefinitionId && !attemptByDefinition.has(attempt.practiceAttempt.practiceDefinitionId)) {
        attemptByDefinition.set(attempt.practiceAttempt.practiceDefinitionId, attempt);
      }
    });
    if (!items.length) return `<section class="today-card today-practice-section"><div class="today-section-head"><div><p class="today-eyebrow">练习安排</p><h2>老师开放的任务与自主练习</h2></div></div><div class="today-empty-row">${icon("book")}<p>当前没有已开放的练习。这里不会显示演示题目或虚构任务。</p></div><a class="today-text-link" href="/student/practices/">前往练习中心 ${icon("arrow")}</a></section>`;
    return `<section class="today-card today-practice-section"><div class="today-section-head"><div><p class="today-eyebrow">练习安排</p><h2>老师开放的任务与自主练习</h2></div><a href="/student/practices/">全部练习 ${icon("arrow")}</a></div><div class="today-practice-grid">${items.slice(0, 6).map((practice) => renderPractice(practice, attemptByDefinition)).join("")}</div></section>`;
  }

  function renderLegacyTasks(tasks) {
    if (!tasks.length) return "";
    return `<section class="today-card today-task-section"><div class="today-section-head"><div><p class="today-eyebrow">课程任务</p><h2>老师安排的课程学习</h2></div><span class="today-count">${tasks.length} 项</span></div><div class="today-record-list">${tasks.map((task) => {
      const progress = Number(task.progressPercent);
      const validProgress = Number.isFinite(progress) && progress >= 0 && progress <= 100;
      const href = `/student/learn/spring-2?assignmentId=${encodeURIComponent(task.assignmentId)}`;
      return `<article class="today-record-row"><span class="today-record-icon">${icon("school")}</span><div class="today-record-copy"><div class="today-record-title"><strong>${safe(task.title)}</strong><span class="today-status teacher">老师任务</span></div><p>${safe(task.courseTitle || "老师安排的课程")} · 截止 ${safe(dateText(task.dueAt, { month: "numeric", day: "numeric" }))}</p>${validProgress ? `<div class="today-real-progress" aria-label="课程进度 ${Math.round(progress)}%"><span style="width:${progress}%"></span></div><small>课程活动已完成 ${Math.round(progress)}%</small>` : ""}</div><a class="today-record-link" href="${safe(href)}">${progress > 0 ? "继续课程" : "开始课程"} ${icon("arrow")}</a></article>`;
    }).join("")}</div></section>`;
  }

  function renderPending(waiting, attempts, attemptsError) {
    const pending = attempts.filter((entry) => ["SUBMITTED", "PROCESSING"].includes(entry.status));
    if (!waiting.length && !pending.length && !attemptsError) return "";
    const waitingSummary = waiting.length
      ? `<p class="today-processing-summary">${waiting.length} 项练习正等待老师复核。复核完成后，正式反馈会出现在成长与学习记录里。</p>`
      : "";
    const content = attemptsError
      ? renderSupplementError("Attempt 状态", attemptsError, "attempts-retry")
      : pending.length
        ? `<div class="today-record-list">${pending.map(renderAttempt).join("")}</div>`
        : waiting.length
          ? `<div class="today-empty-row">${icon("clock")}<p>当前无法从 Attempt 列表定位到单条处理中记录。可以先查看本人学习记录。</p><a class="today-text-link" href="/assessment/history/">查看学习记录 ${icon("arrow")}</a></div>`
          : `<div class="today-empty-row">${icon("check")}<p>当前没有等待处理的 Attempt。</p></div>`;
    return `<section class="today-card today-pending-section"><div class="today-section-head"><div><p class="today-eyebrow">提交状态</p><h2>正在处理的记录</h2></div>${pending.length ? `<span class="today-count">${pending.length} 项</span>` : ""}</div>${waitingSummary}${content}</section>`;
  }

  function renderCourse(course) {
    if (!course?.assignmentId || !(course.title || course.course?.title)) return "";
    const title = course.title || course.course.title;
    const progress = Number(course.progressPercent);
    const hasProgress = Number.isFinite(progress) && progress >= 0 && progress <= 100;
    const description = course.description || "";
    const nextActivity = course.nextActivity?.title;
    const minutes = Number(course.estimatedMinutes);
    const meta = [
      Number.isFinite(minutes) && minutes > 0 ? `约 ${minutes} 分钟` : "",
      nextActivity ? `下一步：${nextActivity}` : "",
    ].filter(Boolean);
    return `<article class="today-course-item"><div class="today-course-symbol">${icon("book")}</div><div class="today-course-body"><p class="today-eyebrow">课程路径</p><h3>${safe(title)}</h3>${description ? `<p>${safe(description)}</p>` : ""}${meta.length ? `<div class="today-course-meta">${meta.map((entry) => `<span>${safe(entry)}</span>`).join("")}</div>` : ""}${hasProgress ? `<div class="today-course-progress"><span><i style="width:${progress}%"></i></span><small>活动完成 ${Math.round(progress)}%</small></div>` : ""}<a href="/student/courses/course-detail/?id=${encodeURIComponent(course.assignmentId)}" class="today-text-link">${hasProgress && progress > 0 ? "继续课程" : "进入课程"} ${icon("arrow")}</a></div></article>`;
  }

  function renderCourses(result) {
    if (result.error) return `<div data-course-state="error"><p class="today-inline-error">课程列表加载失败，暂时无法确认可学课程。</p>${renderSupplementError("课程路径", result.error, "courses-retry")}</div>`;
    const courses = Array.isArray(result.courses) ? result.courses.filter((course) => course?.assignmentId && (course.title || course.course?.title)) : [];
    return `<section class="today-card today-course-section" data-course-state="${courses.length ? "ready" : "empty"}"><div class="today-section-head"><div><p class="today-eyebrow">课程路径</p><h2>继续你的课程学习</h2></div><a href="/student/courses">查看全部课程 ${icon("arrow")}</a></div>${courses.length ? `<div class="today-course-grid">${courses.slice(0, 2).map(renderCourse).join("")}</div>` : `<div class="today-empty-row">${icon("book")}<p>当前学籍下没有可继续的课程任务。</p><a class="today-text-link" href="/student/courses">查看课程中心 ${icon("arrow")}</a></div>`}</section>`;
  }

  function render(data) {
    const { profile, today, courses, practices, attempts } = data;
    const primary = today.primaryAction || null;
    const waiting = Array.isArray(today.waiting) ? today.waiting : [];
    const practiceItems = Array.isArray(practices.items) ? practices.items : [];
    const legacyTasks = Array.isArray(today.legacyTasks) ? today.legacyTasks : [];
    const active = attempts.items.filter((entry) => ["CREATED", "IN_PROGRESS"].includes(entry.status));
    const processing = attempts.items.some((entry) => ["SUBMITTED", "PROCESSING"].includes(entry.status));
    const formal = today.summary?.latestFormalAssessment || null;
    const noWork = !primary && waiting.length === 0 && practiceItems.length === 0 && legacyTasks.length === 0 && active.length === 0 && !processing;
    const unresolved = Boolean(courses.error || practices.error || attempts.error);
    app.dataset.state = noWork && unresolved ? "partial" : noWork ? "empty" : waiting.length || attempts.items.some((entry) => ["SUBMITTED", "PROCESSING"].includes(entry.status)) ? "processing" : "ready";
    const studentName = profile.displayName ? `${safe(profile.displayName)}，今天好` : "今天好";
    const schoolLine = [profile.schoolName, profile.gradeBand, profile.className].filter(Boolean).map(safe).join(" · ");
    const loc = schoolLine || "当前学校与班级信息暂不可用";
    const attemptItems = attempts.error
      ? renderSupplementError("Attempt 状态", attempts.error, "attempts-retry")
      : active.length
        ? `<section class="today-card today-task-section"><div class="today-section-head"><div><p class="today-eyebrow">继续学习</p><h2>上次还没完成</h2></div><span class="today-count">${active.length} 项</span></div><div class="today-record-list">${active.map(renderAttempt).join("")}</div></section>`
        : "";

    app.innerHTML = `<header class="today-header"><div class="today-header-copy"><p class="today-overline">${icon("spark")} 学习由你开始</p><h1>${studentName}</h1><p class="today-school-line">${icon("school")} ${loc}</p></div><time class="today-date" datetime="${new Date().toISOString()}"><span>${dateText(undefined, { month: "long", day: "numeric" })}</span><small>星期${weekdays[new Date().getDay()]}</small></time></header><section class="today-overview"><div class="today-primary-wrap">${renderPrimary(primary, waiting, profile, unresolved)}</div><aside class="today-side"><article class="today-card today-summary"><div class="today-summary-head"><span class="today-mini-icon">${icon("report")}</span><div><p class="today-eyebrow">正式反馈</p><h2>最近一次正式结果</h2></div></div>${renderLatestFormal(formal)}</article><article class="today-card today-track-card"><div class="today-summary-head"><span class="today-mini-icon">${icon("leaf")}</span><div><p class="today-eyebrow">学习进度轨</p><h2>最近的学习状态</h2></div></div>${actionProgress({ today, practices: { items: practiceItems }, legacyTasks }, attempts.items)}</article></aside></section><div class="today-content"><div class="today-column">${attemptItems}${renderPending(waiting, attempts.items, attempts.error)}${renderLegacyTasks(legacyTasks)}${renderPracticeSection(practices, attempts.items)}</div><div class="today-column"><div class="today-course-wrap">${renderCourses(courses)}</div><section class="today-card today-next-card"><div class="today-next-icon">${icon("leaf")}</div><p class="today-eyebrow">需要自己选择时</p><h2>你的学习记录都在这里</h2><p>查看已完成练习、正在处理的记录和老师发布的反馈。</p><a class="today-button today-button-outline" href="/student/growth/">打开成长报告 ${icon("arrow")}</a><a class="today-text-link" href="/assessment/history/">查看全部学习记录 ${icon("arrow")}</a></section></div></div>`;
    const showcase = window.YuzanTodayShowcase;
    if (showcase?.render) {
      // The live primary action and progress must remain ABOVE any optional
      // discovery. Never put a four-button navigation grid in the first fold.
      const extra = showcase.render({ today, practices, courses, attempts });
      if (extra) app.querySelector(".today-overview")?.insertAdjacentHTML("afterend", extra);
    }
    const courseWrap = app.querySelector(".today-course-wrap");
    if (courseWrap) courseWrap.innerHTML = renderCourses(courses);
    bindRetries(data);
    app.querySelector("[data-today-retry]")?.addEventListener("click", init);
    app.querySelector("[data-primary-action]")?.addEventListener("click", (event) => runPrimary(event, primary));
  }

  function bindRetries(data) {
    const retries = [
      ["[data-courses-retry]", "courses"],
      ["[data-practices-retry]", "practices"],
      ["[data-attempts-retry]", "attempts"],
    ];
    retries.forEach(([selector, key]) => {
      app.querySelector(selector)?.addEventListener("click", () => reloadSection(data, key));
    });
  }

  async function reloadSection(data, section) {
    const button = app.querySelector(`[data-${section}-retry]`);
    if (!button || button.disabled) return;
    button.disabled = true;
    button.textContent = "正在重试…";
    try {
      if (section === "courses") {
        data.courses = await loadCourses();
      } else if (section === "practices") {
        data.practices = await loadPractices();
      } else {
        data.attempts = await loadAttempts();
      }
      if (sameIdentity(readIdentity(), loadedIdentity)) render(data);
      else init();
    } catch (error) {
      button.disabled = false;
      button.textContent = "重试";
      button.title = failureMessage(error);
    }
  }

  async function runPrimary(event, action) {
    if (!action) return;
    const control = event?.currentTarget || app.querySelector("[data-primary-action]");
    if (control?.tagName === "A") return;
    if (control?.tagName && control.tagName !== "BUTTON") return;
    const identity = readIdentity();
    if (!sameIdentity(identity, loadedIdentity)) {
      init();
      return;
    }
    app.querySelector("[data-primary-error]")?.remove();
    control.disabled = true;
    control.textContent = "正在准备…";
    try {
      if (action.kind === "START_REMEDIATION") {
        if (!action.target?.sourceSessionId) throw new Error("缺少正式测评来源，无法准备专项巩固");
        const result = unwrap(await YuzanApi.createAssessmentRemediation(action.target.sourceSessionId));
        if (!sameIdentity(readIdentity(), identity)) {
          init();
          return;
        }
        if (!result?.attemptId) throw new Error("专项巩固练习未能准备完成");
        location.href = `/student/practices/attempts/${encodeURIComponent(result.attemptId)}/runner/`;
        return;
      }
      if (action.kind === "BASELINE") {
        if (!action.target?.practiceDefinitionId) throw new Error("缺少练习定义，无法准备第一次测评");
        const result = unwrap(await YuzanApi.createOrResumePractice(action.target.practiceDefinitionId));
        if (!sameIdentity(readIdentity(), identity)) {
          init();
          return;
        }
        if (!result?.attemptId) throw new Error("第一次测评未能准备完成");
        location.href = `/student/practices/attempts/${encodeURIComponent(result.attemptId)}/runner/`;
        return;
      }
      const href = localHref(action.target?.href);
      if (!href) throw new Error("学习任务缺少有效入口，请重新加载。");
      location.href = href;
    } catch (error) {
      if (!sameIdentity(readIdentity(), identity)) {
        init();
        return;
      }
      control.disabled = false;
      control.innerHTML = `${safe(action.cta)} ${icon("arrow")}`;
      const feedback = app.querySelector("[data-primary-feedback]");
      if (feedback) feedback.innerHTML = failureFooter(error);
      else {
        const paragraph = document.createElement("p");
        paragraph.dataset.primaryError = "";
        paragraph.setAttribute("role", "alert");
        paragraph.textContent = `${failureMessage(error)} 可以重试上方学习按钮。`;
        control.after(paragraph);
      }
      if (error?.status === 401) feedback?.insertAdjacentHTML("beforeend", '<a href="/login/">重新登录</a>');
    }
  }

  async function loadCourses() {
    const result = unwrap(await YuzanApi.listStudentCourses({ limit: 4 }));
    if (!Array.isArray(result?.courses)) throw new Error("课程列表响应不可用，请重试。");
    return { courses: result.courses };
  }

  async function loadPractices() {
    const result = unwrap(await YuzanApi.listPractices({ sort: "RECOMMENDED" }));
    if (!Array.isArray(result?.items)) throw new Error("练习列表响应不可用，请重试。");
    return { items: result.items };
  }

  async function loadAttempts() {
    const items = [];
    const seenCursors = new Set();
    let cursor = "";
    let complete = false;
    for (let pageNumber = 0; pageNumber < 30; pageNumber += 1) {
      const page = unwrap(await YuzanApi.listAssessmentSessions({ limit: 100, ...(cursor ? { cursor } : {}) }));
      if (!Array.isArray(page?.items)) throw new Error("Attempt 状态响应不可用，请重试。");
      items.push(...page.items);
      const nextCursor = page.nextCursor || "";
      if (!nextCursor) {
        if (page.hasMore) throw new Error("Attempt 列表分页游标缺失，已停止读取。");
        complete = true;
        break;
      }
      if (seenCursors.has(nextCursor)) throw new Error("Attempt 列表分页游标重复，已停止读取。");
      seenCursors.add(nextCursor);
      cursor = nextCursor;
    }
    if (!complete) throw new Error("Attempt 记录过多，请稍后重试读取。");
    const candidates = items.filter((item) => ["CREATED", "IN_PROGRESS", "SUBMITTED", "PROCESSING"].includes(item.status)).slice(0, 20);
    const results = await Promise.all(candidates.map(async (item) => {
      try {
        const attempt = unwrap(await YuzanApi.getPracticeAttempt(item.id));
        const practiceTitle = (await Promise.resolve(item.practiceTitle)) || null;
        let itemProgress = null;
        if (["CREATED", "IN_PROGRESS"].includes(item.status) && typeof YuzanApi.getPracticeAttemptItems === "function") {
          const rawItems = unwrap(await YuzanApi.getPracticeAttemptItems(item.id));
          const list = Array.isArray(rawItems) ? rawItems : rawItems?.items;
          if (Array.isArray(list) && list.length) {
            itemProgress = {
              answered: list.filter((entry) => ["ANSWERED", "REVIEWED", "FINALIZED"].includes(entry.status) || entry.studentAnswer?.finalSubmittedAt).length,
              total: list.length,
            };
          }
        }
        return { ...item, practiceAttempt: attempt, practiceTitle, itemProgress };
      } catch (error) {
        if (error?.status === 404) return { ...item, practiceAttempt: null, itemProgress: null };
        throw error;
      }
    }));
    const byId = new Map(results.map((item) => [item.id, item]));
    return { items: items.map((item) => byId.get(item.id) || item), nextCursor: null, hasMore: false };
  }

  function settle(result, fallbackKey) {
    if (result.status === "rejected") return { error: result.reason, [fallbackKey]: [] };
    return result.value;
  }

  async function init() {
    const version = ++loadVersion;
    app.dataset.state = "loading";
    app.setAttribute("aria-busy", "true");
    app.innerHTML = `<section class="today-loading"><span class="today-loading-mark" aria-hidden="true">${icon("leaf")}</span><p>正在读取当前学籍的学习安排…</p></section>`;
    const identity = readIdentity();
    loadedIdentity = identity;
    if (!identity.hasToken) {
      location.href = "/login/";
      return;
    }
    if (!identity.schoolId) {
      location.href = "/select-school/";
      return;
    }

    try {
      const profilePromise = typeof YuzanApi.getStudentProfile === "function"
        ? YuzanApi.getStudentProfile()
        : Promise.resolve({ profile: { userId: identity.userId || "", displayName: "", schoolName: "", gradeBand: null, className: null, identityUnavailable: true } });
      const [profileResult, todayResult, coursesResult, practicesResult, attemptsResult] = await Promise.allSettled([
        profilePromise,
        YuzanApi.getStudentToday(),
        loadCourses(),
        loadPractices(),
        loadAttempts(),
      ]);
      if (version !== loadVersion) return;
      const current = readIdentity();
      if (!sameIdentity(current, identity)) {
        init();
        return;
      }
      if (profileResult.status === "rejected") throw profileResult.reason;
      if (todayResult.status === "rejected") throw todayResult.reason;
      const profile = unwrap(profileResult.value)?.profile || unwrap(profileResult.value);
      const today = unwrap(todayResult.value);
      if (!profile || typeof profile.userId !== "string") throw new Error("个人学籍信息响应不可用");
      if (!profile.identityUnavailable && identity.userId && identity.userId !== profile.userId) throw new Error("登录身份已变化，请刷新后重新读取。");
      if (!today || today.version !== "student-today-v1" || !Array.isArray(today.waiting) || !Array.isArray(today.legacyTasks)) {
        throw new Error("今日学习数据版本不可用");
      }
      const data = {
        profile,
        today,
        courses: settle(coursesResult, "courses"),
        practices: settle(practicesResult, "items"),
        attempts: settle(attemptsResult, "items"),
      };
      if (data.courses.error && data.courses.error.status === 401) throw data.courses.error;
      if (data.practices.error && data.practices.error.status === 401) throw data.practices.error;
      if (data.attempts.error && data.attempts.error.status === 401) throw data.attempts.error;
      if (version !== loadVersion || !sameIdentity(readIdentity(), identity)) return;
      window.__studentTodayData = today;
      app.removeAttribute?.("aria-busy");
      render(data);
    } catch (error) {
      if (version === loadVersion && sameIdentity(readIdentity(), identity)) renderError(error);
    }
  }

  window.addEventListener?.("storage", (event) => {
    if (["yuzan-access-token", "yuzan-current-user", "yuzan-active-school-id"].includes(event.key)) init();
  });
  window.addEventListener?.("focus", () => {
    if (loadedIdentity && !sameIdentity(readIdentity(), loadedIdentity)) init();
  });
  window.addEventListener?.("pageshow", (event) => {
    if (event?.persisted || (loadedIdentity && !sameIdentity(readIdentity(), loadedIdentity))) init();
  });

  init();
})();
