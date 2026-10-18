(() => {
  "use strict";

  const app = document.querySelector("#growthApp");
  const iconPaths = {
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 5.5v13A2.5 2.5 0 0 1 6.5 16H20M8 7h8M8 10h6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    feedback: '<path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.6 8.6 0 0 1-3.8-.9L4 20l1.3-3.5A7 7 0 0 1 4 12c0-4.4 3.6-8 8-8s8 3.1 8 7.5Z"/><path d="M8 11h8M8 14h5"/>',
    flag: '<path d="M5 21V4m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
    leaf: '<path d="M20 4c-8 0-14 3-14 10a6 6 0 0 0 6 6c7 0 8-8 8-16Z"/><path d="M4 21c2-5 6-8 12-11"/>',
    report: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h7"/>',
    school: '<path d="m3 10 9-6 9 6M5 11v8m4-8v8m6-8v8m4-8v8M3 21h18"/>',
    spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/>',
    trend: '<path d="M4 18 10 12l4 3 6-8"/><path d="M14 7h6v6"/>',
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
    `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.book}</svg>`;

  const unwrap = (value) =>
    value && typeof value === "object" && Object.hasOwn(value, "data")
      ? value.data
      : value;

  const statusLabel = (status) =>
    ({
      CREATED: "未开始",
      IN_PROGRESS: "进行中",
      SUBMITTED: "已提交",
      PROCESSING: "处理中",
      COMPLETED: "已完成",
      CANCELLED: "已取消",
    })[status] || "状态待确认";

  const activeStatuses = new Set(["CREATED", "IN_PROGRESS", "SUBMITTED", "PROCESSING"]);

  function formatDate(value, withTime = false) {
    if (!value) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return new Intl.DateTimeFormat("zh-CN", withTime
      ? { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }
      : { year: "numeric", month: "long", day: "numeric" }).format(date);
  }

  function failureMessage(error) {
    if (error?.status === 401) return "登录已过期，请重新登录后查看。";
    if (error?.status === 403) return "当前账号无权查看这所学校或学籍下的成长记录。";
    if (error?.status === 404) return "这条学习记录已不可用，请刷新后重新读取当前账号的数据。";
    if (error?.status === 409) return "学习记录正在校验中，请稍后重试。";
    if (error?.name === "TypeError" || error?.status === 0) return "网络连接失败，请检查网络后重试。";
    return error?.message || "暂时无法读取成长记录，请稍后重试。";
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

  function authRedirect(error) {
    if (error?.status === 401) return '<a class="growth-button growth-button-primary" href="/login/">重新登录</a>';
    if (error?.status === 403) return '<a class="growth-button growth-button-secondary" href="/select-school/">检查当前学校</a>';
    return "";
  }

  function renderError(error) {
    const title = error?.status === 401
      ? "请重新登录"
      : error?.status === 403
        ? "当前学籍暂时无法查看"
        : error?.status === 404
          ? "学习记录暂时不可用"
          : "成长记录暂时打不开";
    app.dataset.state = "error";
    app.removeAttribute("aria-busy");
    app.innerHTML = `<section class="growth-error" role="alert"><span class="growth-error-mark">!</span><p class="growth-eyebrow">个人数据未加载</p><h1>${title}</h1><p>${safe(failureMessage(error))}</p><div class="growth-actions"><button class="growth-button growth-button-secondary" type="button" data-growth-retry>重新读取</button>${authRedirect(error)}</div></section>`;
    app.querySelector("[data-growth-retry]")?.addEventListener("click", init);
  }

  async function loadSessions() {
    const items = [];
    const seenCursors = new Set();
    let cursor = "";
    for (let pageNumber = 0; pageNumber < 30; pageNumber += 1) {
      const page = unwrap(await YuzanApi.listAssessmentSessions({ limit: 100, ...(cursor ? { cursor } : {}) }));
      if (!Array.isArray(page?.items)) throw new Error("Attempt 列表响应不可用。");
      items.push(...page.items);
      const nextCursor = page.nextCursor || "";
      if (!nextCursor) {
        if (page.hasMore) throw new Error("Attempt 分页游标缺失，已停止加载。");
        return items;
      }
      if (seenCursors.has(nextCursor)) throw new Error("Attempt 列表分页游标重复，已停止加载。");
      seenCursors.add(nextCursor);
      cursor = nextCursor;
    }
    throw new Error("Attempt 历史记录过多，请缩小时间范围后重试。");
  }

  async function listAttemptItems(sessionId, isPractice) {
    const result = unwrap(isPractice
      ? await YuzanApi.getPracticeAttemptItems(sessionId)
      : await YuzanApi.listAssessmentItems(sessionId));
    const items = Array.isArray(result) ? result : result?.items;
    if (!Array.isArray(items)) return null;
    return {
      total: items.length,
      answered: items.filter((item) =>
        ["ANSWERED", "REVIEWED", "FINALIZED"].includes(item.status) || Boolean(item.studentAnswer?.finalSubmittedAt),
      ).length,
    };
  }

  async function hydrateAttempts(sessions) {
    const active = sessions
      .filter((session) => activeStatuses.has(session.status))
      .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0));
    return Promise.all(active.slice(0, 10).map(async (session) => {
      let detail = null;
      let isPractice = false;
      try {
        detail = unwrap(await YuzanApi.getPracticeAttempt(session.id));
        isPractice = Boolean(detail?.practiceDefinitionId);
      } catch (error) {
        if (error?.status !== 404) throw error;
        detail = unwrap(await YuzanApi.getAssessmentSession(session.id));
      }
      if (!detail?.id) return { ...session, unavailable: true };
      let itemProgress = null;
      if (["CREATED", "IN_PROGRESS"].includes(detail.status)) {
        itemProgress = await listAttemptItems(detail.id, isPractice);
      }
      return { ...session, ...detail, isPractice, itemProgress };
    }));
  }

  async function loadReports(historySessions) {
    const candidates = historySessions
      .filter((session) => session.purpose !== "REMEDIATION" && session.sessionId)
      .slice(0, 8);
    const results = await Promise.all(candidates.map(async (session) => {
      try {
        const report = unwrap(await YuzanApi.getAssessmentReport(session.sessionId));
        if (!report || typeof report !== "object" || !report.generatedAt) {
          return { session, report: null, state: "not-generated" };
        }
        const needsReview = report.summary?.requiresTeacherReview === true || report.summary?.scoringState === "NEEDS_REVIEW";
        const complete = typeof report.dataCompleteness === "number" && report.dataCompleteness >= 100;
        return { session, report, state: needsReview ? "review-pending" : complete ? "ready" : "incomplete" };
      } catch (error) {
        if (error?.status === 404) return { session, report: null, state: "not-generated" };
        if (error?.status === 401 || error?.status === 403) throw error;
        return { session, report: null, state: "error", error };
      }
    }));
    return results;
  }

  function trendSeries(progress) {
    const levels = Array.isArray(progress?.formalLevels) ? progress.formalLevels : [];
    return levels.map((level) => {
      const points = (Array.isArray(level.attempts) ? level.attempts : [])
        .filter((attempt) => typeof attempt.overallScore === "number" && Number.isFinite(attempt.overallScore) && attempt.completedAt)
        .sort((left, right) => new Date(left.completedAt) - new Date(right.completedAt));
      const unique = points.filter((point, index) => index === 0 || point.completedAt !== points[index - 1].completedAt);
      return { ...level, points: unique };
    }).filter((level) => level.points.length >= 3);
  }

  function renderTrend(progress) {
    const series = trendSeries(progress);
    if (!series.length) {
      const levels = Array.isArray(progress?.formalLevels) ? progress.formalLevels : [];
      const hasBaseline = levels.some((level) => Array.isArray(level.attempts) && level.attempts.length > 0);
      return `<section class="growth-card growth-chart-card"><div class="growth-section-heading"><div><p class="growth-eyebrow">正式测评趋势</p><h2>成长曲线</h2></div>${icon("trend", "growth-section-icon")}</div><div class="growth-chart-empty"><span>${icon("trend")}</span><strong>${hasBaseline ? "趋势记录还不够" : "还没有正式测评时间序列"}</strong><p>${hasBaseline ? "同一水平累计至少三次正式结果后，这里才绘制变化曲线。" : "完成正式测评并生成报告后，真实结果会按时间记录在这里。"}</p></div></section>`;
    }

    const level = series.sort((left, right) => new Date(right.latestCompletedAt) - new Date(left.latestCompletedAt))[0];
    const points = level.points;
    const width = 640;
    const height = 250;
    const left = 44;
    const right = 22;
    const top = 22;
    const bottom = 55;
    const min = Math.min(...points.map((point) => point.overallScore));
    const max = Math.max(...points.map((point) => point.overallScore));
    const pad = max === min ? Math.max(1, Math.abs(max) * 0.05) : (max - min) * 0.16;
    const low = min - pad;
    const high = max + pad;
    const xAt = (index) => left + (points.length === 1 ? 0 : (index / (points.length - 1)) * (width - left - right));
    const yAt = (score) => top + ((high - score) / (high - low)) * (height - top - bottom);
    const path = points.map((point, index) => `${index ? "L" : "M"} ${xAt(index).toFixed(2)} ${yAt(point.overallScore).toFixed(2)}`).join(" ");
    const tick = (score) => Number.isInteger(score) ? String(score) : score.toFixed(1);
    const nodes = points.map((point, index) => `<g><circle cx="${xAt(index).toFixed(2)}" cy="${yAt(point.overallScore).toFixed(2)}" r="5"/><text x="${xAt(index).toFixed(2)}" y="${(yAt(point.overallScore) - 13).toFixed(2)}" text-anchor="middle">${safe(tick(point.overallScore))}</text><text class="growth-chart-date" x="${xAt(index).toFixed(2)}" y="${height - 22}" text-anchor="middle">${safe(formatDate(point.completedAt).replace(/年/g, "/").replace(/月/g, "/").replace(/日/g, ""))}</text></g>`).join("");
    const accessible = points.map((point, index) => `第 ${index + 1} 次，${formatDate(point.completedAt)}，${point.overallScore} 分`).join("；");
    return `<section class="growth-card growth-chart-card"><div class="growth-section-heading"><div><p class="growth-eyebrow">正式测评趋势</p><h2>${safe(level.level)} · 成长曲线</h2><p>同一水平的正式结果，按真实完成时间排列</p></div><span class="growth-chart-count">${points.length} 次结果</span></div><div class="growth-chart-wrap"><svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="growthChartTitle growthChartDesc"><title id="growthChartTitle">${safe(level.level)}正式测评结果变化</title><desc id="growthChartDesc">${safe(accessible)}</desc><line class="growth-chart-baseline" x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}"/><path class="growth-chart-path" d="${path}"/>${nodes}</svg></div>${level.practiceVersionChanged ? '<p class="growth-chart-note">同一水平的练习版本发生过变化，分数用于了解阶段记录，请结合每次正式报告阅读。</p>' : ""}<div class="growth-chart-caption"><span>${safe(formatDate(points[0].completedAt))}</span><span>正式结果 · 分</span><span>${safe(formatDate(points.at(-1).completedAt))}</span></div></section>`;
  }

  function renderStage(progress, completedCount, pendingCount) {
    const latest = progress.latest;
    const recentFormal = latest?.formal;
    const recentRemediation = latest?.remediation;
    const stageTitle = recentFormal ? `${latest.level} · 已建立正式学习基线` : completedCount ? "练习记录已形成，等待正式报告" : "从第一项真实练习开始";
    const message = recentFormal
      ? `最近一次正式结果完成于 ${formatDate(recentFormal.completedAt)}${typeof recentFormal.latestVsPrevious === "number" ? `；较上次 ${recentFormal.latestVsPrevious > 0 ? "提高" : recentFormal.latestVsPrevious < 0 ? "下降" : "持平"} ${Math.abs(recentFormal.latestVsPrevious)} 分` : "；这是目前的正式基线"}。`
      : completedCount
        ? "你已经有完成记录；只有服务端生成的正式报告会进入正式趋势。"
        : "当前学籍还没有已完成的测评记录，不会预填进度或成绩。";
    const round = recentRemediation ? `<div class="growth-stage-extra"><span>${icon("flag")}</span><p><b>最近一次专项巩固</b><br>${safe(recentRemediation.itemCount)} 道题 · ${safe(recentRemediation.masteredCount)} 道已掌握 · 追回 ${safe(recentRemediation.recoveredPoints)} 分</p></div>` : "";
    return `<section class="growth-stage-card"><div class="growth-stage-art" aria-hidden="true"><svg viewBox="0 0 240 190" fill="none"><path d="M120 169c-2-32 0-67 7-103" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M124 137c-21-5-35-20-42-42 22 0 39 11 46 31" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M126 118c21-8 35-22 41-43-20 0-38 11-46 31" fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M130 91c-15-6-25-17-29-34 16 1 28 9 33 24" fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M132 79c13-9 19-22 17-38-14 6-22 17-23 33" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M106 170h43" stroke="currentColor" stroke-opacity=".25" stroke-width="1.5" stroke-linecap="round"/><path d="M99 167c7-4 14-4 21 0m22 0c6-4 12-4 18 0" stroke="currentColor" stroke-opacity=".22" stroke-width="1.4" stroke-linecap="round"/></svg></div><div class="growth-stage-copy"><p class="growth-eyebrow">你的学习阶段</p><h2>${safe(stageTitle)}</h2><p>${safe(message)}</p><div class="growth-stage-facts"><span>${completedCount} 次已完成记录</span><span>${pendingCount} 项未完成 Attempt</span></div>${round}</div></section>`;
  }

  function activeAttemptHref(attempt) {
    if (["SUBMITTED", "PROCESSING"].includes(attempt.status)) {
      return attempt.purpose === "REMEDIATION"
        ? `/student/practices/attempts/${encodeURIComponent(attempt.id)}/processing/`
        : `/assessment/sessions/${encodeURIComponent(attempt.id)}/processing/`;
    }
    return attempt.isPractice
      ? `/student/practices/attempts/${encodeURIComponent(attempt.id)}/runner/`
      : `/assessment/sessions/${encodeURIComponent(attempt.id)}/`;
  }

  function renderAttempt(attempt, titleByDefinition) {
    const practiceId = attempt.practiceDefinitionId;
    const title = titleByDefinition.get(practiceId) || (attempt.purpose === "REMEDIATION" ? "专项巩固 Attempt" : "测评 Attempt");
    const isProcessing = ["SUBMITTED", "PROCESSING"].includes(attempt.status);
    const progress = attempt.itemProgress;
    const progressText = progress
      ? `已完成 ${progress.answered} / ${progress.total} 道`
      : "当前进度由服务端保存";
    return `<article class="growth-attempt-row"><span class="growth-attempt-icon ${isProcessing ? "processing" : ""}">${icon(isProcessing ? "clock" : "book")}</span><div class="growth-attempt-copy"><div><strong>${safe(title)}</strong><span class="growth-state-chip ${isProcessing ? "waiting" : "active"}">${safe(statusLabel(attempt.status))}</span></div><p>${safe(progressText)} · 最近更新 ${safe(formatDate(attempt.updatedAt || attempt.createdAt, true))}</p></div><a class="growth-inline-link" href="${safe(activeAttemptHref(attempt))}">${isProcessing ? "查看状态" : "继续练习"} ${icon("trend")}</a></article>`;
  }

  function renderAttempts(sessions, attempts, practices) {
    const pending = sessions.filter((session) => activeStatuses.has(session.status));
    if (!pending.length) {
      return `<section class="growth-card growth-record-card"><div class="growth-section-heading"><div><p class="growth-eyebrow">当前进度</p><h2>未完成 Attempt</h2></div>${icon("clock", "growth-section-icon")}</div><div class="growth-empty-inline">${icon("check")}<p>当前没有未完成或处理中 Attempt。</p></div></section>`;
    }
    const titleByDefinition = new Map(practices.items.map((practice) => [practice.id, practice.title]));
    const detailed = new Map(attempts.map((attempt) => [attempt.id, attempt]));
    const rows = pending.slice(0, 8).map((session) => {
      const attempt = detailed.get(session.id) || session;
      return renderAttempt(attempt, titleByDefinition);
    }).join("");
    return `<section class="growth-card growth-record-card"><div class="growth-section-heading"><div><p class="growth-eyebrow">当前进度</p><h2>未完成 Attempt</h2></div><span class="growth-chart-count">${pending.length} 项</span></div><div class="growth-attempt-list">${rows}</div>${pending.length > 8 ? '<a class="growth-inline-link growth-view-more" href="/assessment/history/">查看学习历史</a>' : ""}</section>`;
  }

  function reportSummary(report) {
    if (typeof report.overallScore === "number" && Number.isFinite(report.overallScore)) return `${report.overallScore} 分`;
    return "报告暂未提供总分";
  }

  function renderReports(results) {
    const reportError = results.find((entry) => entry.state === "error");
    if (reportError) {
      return `<section class="growth-card growth-record-card"><div class="growth-section-heading"><div><p class="growth-eyebrow">正式反馈</p><h2>已完成结果与教师反馈</h2></div>${icon("report", "growth-section-icon")}</div><div class="growth-inline-error" role="alert"><p>${safe(failureMessage(reportError.error))}</p><button class="growth-button growth-button-secondary" type="button" data-growth-retry>重试</button></div></section>`;
    }
    const official = results.filter((entry) => entry.state === "ready");
    const reviewPending = results.filter((entry) => entry.state === "review-pending");
    const incomplete = results.filter((entry) => entry.state === "incomplete");
    const notGenerated = results.filter((entry) => entry.state === "not-generated");
    const cards = official.map(({ session, report }) => {
      const retryCandidates = Array.isArray(report.diagnosis?.retryCandidates) ? report.diagnosis.retryCandidates : [];
      const candidateRows = retryCandidates.slice(0, 5).map((candidate) => `<li>${safe(candidate.displayName || candidate.family || "待巩固题目")}</li>`).join("");
      const teacherComments = Array.isArray(report.teacherFeedback)
        ? report.teacherFeedback
          .filter((entry) => entry && typeof entry.comment === "string" && entry.comment.trim())
          .map((entry) => `<li>${safe(entry.comment)}</li>`)
          .join("")
        : "";
      const reportPath = `/assessment/sessions/${encodeURIComponent(session.sessionId)}/report/`;
      return `<article class="growth-report-row"><span class="growth-report-icon">${icon("report")}</span><div class="growth-report-copy"><div class="growth-report-title"><strong>${safe(session.type === "READING" ? "朗读测评" : session.type === "WRITTEN" ? "书面测评" : "综合测评")}</strong><span>${safe(reportSummary(report))}</span></div><p>报告生成于 ${safe(formatDate(report.generatedAt, true))}</p>${candidateRows ? `<div class="growth-retry-focus"><b>报告中标记的待巩固题目</b><ul>${candidateRows}</ul></div>` : ""}${teacherComments ? `<div class="growth-report-feedback"><b>教师评语</b><ul>${teacherComments}</ul></div>` : ""}</div><a class="growth-inline-link" href="${safe(reportPath)}">查看正式报告 ${icon("trend")}</a></article>`;
    }).join("");
    const missing = notGenerated.length
      ? `<div class="growth-not-generated"><span>${icon("clock")}</span><p><b>${notGenerated.length} 条已完成记录尚未生成正式报告</b><br>这些记录不会显示成绩。</p></div>`
      : "";
    const reviewNotice = reviewPending.length
      ? `<div class="growth-not-generated review"><span>${icon("feedback")}</span><p><b>${reviewPending.length} 条报告正在等待教师复核</b><br>未审核的语音题不会显示正式成绩。</p></div>`
      : "";
    const incompleteNotice = incomplete.length
      ? `<div class="growth-not-generated"><span>${icon("clock")}</span><p><b>${incomplete.length} 条报告的数据尚未完整</b><br>数据完整前不会展示总分。</p></div>`
      : "";
    const empty = !official.length && !notGenerated.length && !reviewPending.length && !incomplete.length
      ? `<div class="growth-empty-inline">${icon("report")}<p>当前没有已完成的正式测评记录。</p></div>`
      : "";
    return `<section class="growth-card growth-record-card"><div class="growth-section-heading"><div><p class="growth-eyebrow">正式反馈</p><h2>已完成结果与待巩固内容</h2></div><a class="growth-inline-link" href="/assessment/history/">查看学习历史 ${icon("trend")}</a></div><div class="growth-report-list">${cards}</div>${reviewNotice}${incompleteNotice}${missing}${empty}</section>`;
  }

  function renderPractices(practices, attempts) {
    const titleById = new Map(practices.items.map((practice) => [practice.id, practice]));
    const attemptsByDefinition = new Map();
    attempts.forEach((attempt) => {
      const id = attempt.practiceDefinitionId;
      if (id && !attemptsByDefinition.has(id)) attemptsByDefinition.set(id, attempt);
    });
    if (!practices.items.length) {
      return `<section class="growth-card growth-practice-card"><div class="growth-section-heading"><div><p class="growth-eyebrow">下一步</p><h2>继续练习</h2></div>${icon("book", "growth-section-icon")}</div><div class="growth-empty-inline">${icon("book")}<p>当前学籍没有开放的练习。老师开放任务后会显示在练习中心。</p></div></section>`;
    }
    const rows = practices.items.slice(0, 5).map((practice) => {
      const attempt = attemptsByDefinition.get(practice.id);
      const state = attempt?.status || practice.studentState?.completionStatus || "NOT_STARTED";
      const teacher = practice.mode === "ASSIGNMENT";
      const kind = teacher ? "老师开放" : practice.catalogType === "SPECIALIZED" ? "专项训练" : "自主练习";
      const href = attempt && ["CREATED", "IN_PROGRESS"].includes(attempt.status)
        ? activeAttemptHref(attempt)
        : `/student/practices/${encodeURIComponent(practice.id)}/`;
      const action = attempt && ["CREATED", "IN_PROGRESS"].includes(attempt.status)
        ? "继续练习"
        : state === "COMPLETED" ? "再次练习" : "查看练习";
      return `<article class="growth-practice-row"><span class="growth-practice-icon ${teacher ? "teacher" : ""}">${icon(teacher ? "school" : "leaf")}</span><div><small>${safe(kind)} · ${safe(statusLabel(state))}</small><strong>${safe(practice.title)}</strong><p>${safe(practice.summary || "")}</p></div><a class="growth-inline-link" href="${safe(href)}">${action} ${icon("trend")}</a></article>`;
    }).join("");
    return `<section class="growth-card growth-practice-card"><div class="growth-section-heading"><div><p class="growth-eyebrow">下一步</p><h2>继续练习</h2></div><a class="growth-inline-link" href="/student/practices/">练习中心 ${icon("trend")}</a></div><div class="growth-practice-list">${rows}</div></section>`;
  }

  function renderTimeline(events, progress, sessions) {
    const entries = [];
    (Array.isArray(events.events) ? events.events : []).forEach((event) => {
      const occurredAt = event.timestamp || event.occurredAt;
      if (!occurredAt) return;
      entries.push({
        id: `${event.type || "event"}-${event.id || occurredAt}`,
        type: event.type === "FEEDBACK" ? "feedback" : "completed",
        title: event.title || (event.type === "FEEDBACK" ? "老师反馈" : "测评完成"),
        description: event.description || event.summary || "",
        occurredAt,
      });
    });
    (Array.isArray(progress.milestones) ? progress.milestones : []).forEach((milestone) => {
      entries.push({
        id: `milestone-${milestone.sessionId}`,
        type: milestone.kind === "REMEDIATION" ? "remediation" : "completed",
        title: milestone.label,
        description: "来自当前学籍的正式学习进度记录。",
        occurredAt: milestone.occurredAt,
      });
    });
    sessions.filter((session) => activeStatuses.has(session.status)).forEach((session) => {
      const date = session.updatedAt || session.createdAt;
      if (!date) return;
      entries.push({
        id: `attempt-${session.id}`,
        type: "active",
        title: session.status === "PROCESSING" || session.status === "SUBMITTED" ? "练习正在处理中" : "练习进行中",
        description: `${statusLabel(session.status)} · 当前 Attempt`,
        occurredAt: date,
      });
    });
    const unique = [...new Map(entries.map((entry) => [entry.id, entry])).values()]
      .sort((left, right) => new Date(right.occurredAt) - new Date(left.occurredAt));
    if (!unique.length) {
      return `<section class="growth-card growth-timeline-card"><div class="growth-section-heading"><div><p class="growth-eyebrow">学习时间线</p><h2>最近的学习记录</h2></div>${icon("clock", "growth-section-icon")}</div><div class="growth-empty-inline">${icon("clock")}<p>当前学籍还没有可显示的练习、正式结果或老师反馈。</p></div></section>`;
    }
    return `<section class="growth-card growth-timeline-card"><div class="growth-section-heading"><div><p class="growth-eyebrow">学习时间线</p><h2>最近的学习记录</h2></div><span class="growth-chart-count">${unique.length} 条</span></div><ol class="growth-timeline">${unique.slice(0, 10).map((entry) => `<li class="growth-timeline-item ${entry.type}"><span class="growth-timeline-node">${icon(entry.type === "feedback" ? "feedback" : entry.type === "active" ? "clock" : entry.type === "remediation" ? "flag" : "check")}</span><div><div class="growth-timeline-heading"><strong>${safe(entry.title)}</strong><time datetime="${safe(new Date(entry.occurredAt).toISOString())}">${safe(formatDate(entry.occurredAt, true))}</time></div>${entry.description ? `<p>${safe(entry.description)}</p>` : ""}</div></li>`).join("")}</ol></section>`;
  }

  function renderFeedback(events) {
    const feedback = (Array.isArray(events.events) ? events.events : [])
      .filter((event) => event.type === "FEEDBACK" && (event.description || event.comment))
      .sort((left, right) => new Date(right.timestamp || right.occurredAt || 0) - new Date(left.timestamp || left.occurredAt || 0));
    if (!feedback.length) {
      return `<section class="growth-card growth-feedback-card"><div class="growth-section-heading"><div><p class="growth-eyebrow">老师的声音</p><h2>老师反馈</h2></div>${icon("feedback", "growth-section-icon")}</div><div class="growth-empty-inline">${icon("feedback")}<p>当前没有已发布的教师反馈。</p></div></section>`;
    }
    return `<section class="growth-card growth-feedback-card"><div class="growth-section-heading"><div><p class="growth-eyebrow">老师的声音</p><h2>老师反馈</h2></div><span class="growth-chart-count">${feedback.length} 条</span></div><div class="growth-feedback-list">${feedback.slice(0, 5).map((entry) => `<article class="growth-feedback-row"><span class="growth-feedback-mark">${icon("feedback")}</span><div><div class="growth-feedback-heading"><strong>${safe(entry.title || "老师反馈")}</strong><time datetime="${safe(new Date(entry.timestamp || entry.occurredAt).toISOString())}">${safe(formatDate(entry.timestamp || entry.occurredAt, true))}</time></div><p>${safe(entry.description || entry.comment)}</p></div></article>`).join("")}</div><a class="growth-inline-link" href="/assessment/history/">查看学习记录 ${icon("trend")}</a></section>`;
  }

  function latestActivityAt(history, events, progress, sessions) {
    const values = [
      ...(history.sessions || []).map((session) => session.completedAt),
      ...(events.events || []).map((event) => event.timestamp || event.occurredAt),
      ...(progress.milestones || []).map((milestone) => milestone.occurredAt),
      ...sessions.map((session) => session.updatedAt || session.createdAt),
    ].filter((value) => value && Number.isFinite(new Date(value).getTime()));
    if (!values.length) return "暂无学习时间记录";
    const latest = values.sort((left, right) => new Date(right) - new Date(left))[0];
    return formatDate(latest, true);
  }

  function render(data) {
    const { profile, history, events, progress, sessions, attempts, practices, reports } = data;
    const completed = Array.isArray(history.sessions) ? history.sessions : [];
    const pendingCount = sessions.filter((session) => activeStatuses.has(session.status)).length;
    const remediationCount = (progress.remediation || []).reduce((sum, entry) => sum + (entry.rounds?.length || 0), 0);
    const schoolDetails = [profile.schoolName, profile.gradeBand, profile.className].filter(Boolean).map(safe).join(" · ") || "当前学校与班级信息暂不可用";
    const title = profile.displayName ? `${safe(profile.displayName)}的成长记录` : "我的成长记录";
    app.dataset.state = completed.length || pendingCount || events.events?.length ? "ready" : "empty";
    app.removeAttribute("aria-busy");
    app.innerHTML = `<header class="growth-header"><div><p class="growth-overline">${icon("spark")} 记录真实的每一步</p><h1>${title}</h1><p class="growth-school-line">${icon("school")} ${schoolDetails}</p></div><a class="growth-back-link" href="/student/today/">${icon("trend")} 回到今日学习</a></header><section class="growth-summary-grid"><article class="growth-summary-tile"><span>${icon("check")}</span><div><small>已完成记录</small><strong>${completed.length}</strong><p>来自本人已完成的 Attempt</p></div></article><article class="growth-summary-tile"><span>${icon("clock")}</span><div><small>未完成 Attempt</small><strong>${pendingCount}</strong><p>包含进行中与处理中状态</p></div></article><article class="growth-summary-tile"><span>${icon("flag")}</span><div><small>专项巩固轮次</small><strong>${remediationCount}</strong><p>来自已完成的专项记录</p></div></article><article class="growth-summary-tile"><span>${icon("clock")}</span><div><small>最近学习时间</small><strong class="growth-summary-date">${safe(latestActivityAt(history, events, progress, sessions))}</strong><p>按本人最近一次记录更新</p></div></article></section><div class="growth-layout"><div class="growth-main-column">${renderStage(progress, completed.length, pendingCount)}${renderTrend(progress)}${renderAttempts(sessions, attempts, practices)}${renderReports(reports)}${renderTimeline(events, progress, sessions)}</div><aside class="growth-side-column">${renderPractices(practices, attempts)}${renderFeedback(events)}<section class="growth-card growth-note-card"><span>${icon("report")}</span><div><h2>关于正式成绩</h2><p>这里只展示服务端已经生成的正式报告。待审核语音、处理中记录和缺失报告不会显示成分数。</p></div></section></aside></div>`;
    app.querySelector("[data-growth-retry]")?.addEventListener("click", init);
  }

  async function init() {
    const version = ++loadVersion;
    app.dataset.state = "loading";
    app.setAttribute("aria-busy", "true");
    app.innerHTML = `<section class="growth-loading" aria-busy="true"><span class="growth-loading-mark" aria-hidden="true">↗</span><p>正在读取当前学籍的学习记录…</p></section>`;
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
      const [profileRaw, historyRaw, eventsRaw, progressRaw, sessions, practiceRaw] = await Promise.all([
        YuzanApi.getStudentProfile(),
        YuzanApi.getAssessmentHistory({ range: "all" }),
        YuzanApi.getAssessmentHistoryEvents(),
        YuzanApi.getQuestionBankProgress(),
        loadSessions(),
        YuzanApi.listPractices({ sort: "RECOMMENDED" }),
      ]);
      if (version !== loadVersion) return;
      const profileValue = unwrap(profileRaw);
      const profile = profileValue?.profile || profileValue;
      const history = unwrap(historyRaw);
      const events = unwrap(eventsRaw);
      const progress = unwrap(progressRaw);
      const practiceValue = unwrap(practiceRaw);
      const practices = Array.isArray(practiceValue?.items) ? practiceValue : null;
      if (!profile || typeof profile.userId !== "string") throw new Error("个人学籍信息响应不可用。");
      if (identity.userId && identity.userId !== profile.userId) throw new Error("登录身份已变化，请刷新后重新读取。");
      if (!Array.isArray(history?.sessions) || !Array.isArray(events?.events) || !Array.isArray(sessions) || !practices || progress?.version !== "qb-progress-v1") {
        throw new Error("成长数据响应不完整，请重试。");
      }
      if (!sameIdentity(readIdentity(), identity)) {
        init();
        return;
      }
      const [attempts, reports] = await Promise.all([
        hydrateAttempts(sessions),
        loadReports(history.sessions),
      ]);
      if (version !== loadVersion || !sameIdentity(readIdentity(), identity)) return;
      render({ profile, history, events, progress, sessions, attempts, practices, reports });
    } catch (error) {
      if (version === loadVersion && sameIdentity(readIdentity(), identity)) renderError(error);
    }
  }

  window.addEventListener("storage", (event) => {
    if (["yuzan-access-token", "yuzan-current-user", "yuzan-active-school-id"].includes(event.key)) init();
  });
  window.addEventListener("focus", () => {
    if (loadedIdentity && !sameIdentity(readIdentity(), loadedIdentity)) init();
  });
  window.addEventListener("pageshow", () => {
    if (loadedIdentity && !sameIdentity(readIdentity(), loadedIdentity)) init();
  });

  init();
})();
