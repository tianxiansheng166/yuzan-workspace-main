(() => {
  "use strict";
  const root = document.querySelector("#teacher-diagnostic-root");
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  const percentage = (value) =>
    value == null
      ? "—"
      : `${Number(value).toFixed(Number(value) % 1 ? 1 : 0)}%`;
  const score = (value) =>
    value == null
      ? "未测评"
      : `${Number(value).toFixed(Number(value) % 1 ? 1 : 0)} 分`;
  const delta = (value, state) =>
    state === "BASELINE_ONLY"
      ? "首次测评"
      : value == null
        ? "—"
        : `${value > 0 ? "+" : ""}${value} 分`;
  const stateLabel = (state) =>
    ({
      NOT_ASSESSED: "未测评",
      IN_PROGRESS: "测评中",
      COMPLETED: "已完成",
      NEEDS_ATTENTION: "建议关注",
    })[state] || "未测评";
  let catalog = null;
  let dashboard = null;
  let dashboardRequestId = 0;
  let selectedEnrollmentIds = new Set();

  function empty(message) {
    root.innerHTML = `<div class="diagnostic-empty"><h1>学情诊断</h1><p>${esc(message)}</p></div>`;
  }

  function renderCatalog() {
    const classes = catalog?.availableClasses || [];
    const practices = catalog?.availablePractices || [];
    if (!classes.length) return empty("当前账号没有可访问的任课班级。");
    if (!practices.length) return empty("当前学校还没有可用的正式题库测评。");
    root.innerHTML = `<div class="diagnostic-wrap">
      <header class="diagnostic-header"><div><span class="diagnostic-kicker">QUESTION BANK · CLASS VIEW</span><h1>学情诊断</h1><p>查看一个班级在同一水平正式测评中的学习状态；不进行学生间排名。</p></div><div class="diagnostic-actions"><button class="review-link" id="teacher-pilot-feedback" type="button">反馈问题</button><a class="review-link" href="/teacher/reviews/">进入待复核队列</a></div></header>
      <section class="diagnostic-selectors" aria-label="诊断筛选">
        <label>班级<select id="diagnostic-class">${classes.map((entry) => `<option value="${esc(entry.classId)}">${esc(entry.grade)} · ${esc(entry.className)}（${entry.activeStudentCount} 人）</option>`).join("")}</select></label>
        <label>正式测评水平<select id="diagnostic-practice">${practices.map((entry) => `<option value="${esc(entry.practiceDefinitionId)}">${esc(entry.difficulty)} · ${esc(entry.title)}</option>`).join("")}</select></label>
      </section>
      <div id="diagnostic-content" class="diagnostic-content"><div class="diagnostic-loading">正在加载所选班级…</div></div>
    </div>`;
    root
      .querySelector("#diagnostic-class")
      .addEventListener("change", loadDashboard);
    root
      .querySelector("#diagnostic-practice")
      .addEventListener("change", loadDashboard);
    root.querySelector("#teacher-pilot-feedback").addEventListener("click", openPilotFeedback);
    loadDashboard();
  }

  async function openPilotFeedback() {
    let history = [];
    try { history = (await window.YuzanApi.listMyPilotFeedback()).items || []; } catch (error) { return window.alert(error.message || "反馈记录暂不可用"); }
    const modal = document.createElement("div");
    modal.className = "diagnostic-feedback-modal";
    modal.innerHTML = `<div class="diagnostic-feedback-card" role="dialog" aria-label="反馈问题"><button type="button" class="diagnostic-feedback-close" aria-label="关闭">×</button><h2>反馈问题</h2><p>请描述遇到的问题，不要填写手机号等敏感信息。不会提交学生答案或复核证据。</p><label>问题类型<select data-feedback-category><option value="USABILITY">使用体验</option><option value="TECHNICAL">系统问题</option><option value="CONTENT">题目内容</option><option value="OTHER">其他</option></select></label><textarea data-feedback-message minlength="5" maxlength="1000" placeholder="至少输入 5 个字"></textarea><button type="button" class="review-link" data-feedback-submit>提交反馈</button><section class="diagnostic-feedback-history"><b>我的反馈</b>${history.length ? history.map(entry => `<p>${esc(entry.message)} · ${esc({ OPEN: "待处理", ACKNOWLEDGED: "已知悉", RESOLVED: "已解决" }[entry.status] || entry.status)}${entry.resolutionNote ? `：${esc(entry.resolutionNote)}` : ""}</p>`).join("") : "<p>暂无反馈。</p>"}</section></div>`;
    document.body.append(modal);
    modal.querySelector(".diagnostic-feedback-close").addEventListener("click", () => modal.remove());
    modal.querySelector("[data-feedback-submit]").addEventListener("click", async () => {
      const message = modal.querySelector("[data-feedback-message]").value.trim();
      if (message.length < 5) return window.alert("请至少描述 5 个字。");
      const button = modal.querySelector("[data-feedback-submit]");
      button.disabled = true;
      try { await window.YuzanApi.createPilotFeedback({ category: modal.querySelector("[data-feedback-category]").value, message, currentPath: location.pathname }); modal.remove(); window.alert("反馈已提交，管理员处理后可在这里查看状态。"); } catch (error) { button.disabled = false; window.alert(`反馈提交失败：${error.message || "请稍后重试"}`); }
    });
  }

  function card(value, label, hint = "") {
    return `<article class="metric-card"><strong>${esc(value)}</strong><span>${esc(label)}</span>${hint ? `<small>${esc(hint)}</small>` : ""}</article>`;
  }

  function renderDashboard() {
    const host = root.querySelector("#diagnostic-content");
    const summary = dashboard.summary;
    const attention = dashboard.students.filter(
      (student) => student.needsAttention,
    ).length;
    host.innerHTML = `
      <section class="metric-grid">
        ${card(`${summary.assessedStudents} / ${summary.eligibleStudents}`, "已测人数 / 总人数", `${summary.inProgressStudents} 人测评中，${summary.notAssessedStudents} 人未测评`)}
        ${card(percentage(summary.coveragePercentage), "覆盖率")}
        ${card(score(summary.averageScore), "班级平均（仅已测学生）")}
        ${card(`${summary.pendingReviewItemCount} 题`, "待教师复核", `${summary.pendingReviewStudentCount} 名学生`)}
      </section>
      ${summary.versionMixed ? '<p class="version-note">部分测评使用不同内容版本，已按同一正式测评水平聚合。</p>' : ""}
      ${summary.dataQualityIssueCount ? `<p class="quality-note">有 ${summary.dataQualityIssueCount} 条历史记录暂未纳入聚合，请在已有测评流程中核查。</p>` : ""}
      <section class="diagnostic-grid-two">
        <article class="panel"><div class="panel-head"><h2>能力概览</h2><span>已测学生的诊断百分比</span></div><div class="domain-grid">${dashboard.domains.map((entry) => `<div class="domain-card"><span>${esc(entry.displayName)}</span><strong>${percentage(entry.averagePercentage)}</strong><small>${entry.studentCount} 名学生</small></div>`).join("")}</div></article>
        <article class="panel"><div class="panel-head"><h2>班级建议重点巩固</h2><span>按题型聚合，不是学生排序</span></div><ol class="family-list">${dashboard.commonDifficulties.map((entry) => `<li><div><strong>${esc(entry.displayName)}</strong><small>${entry.priorityStudentCount} 名学生列为优先巩固</small></div><b>${percentage(entry.averagePercentage)}</b></li>`).join("") || '<li class="empty-row">暂无可用正式测评数据</li>'}</ol><div class="strengths"><span>掌握较好：</span>${dashboard.strengths.map((entry) => `<i>${esc(entry.displayName)} ${percentage(entry.averagePercentage)}</i>`).join("") || "—"}</div></article>
      </section>
      <section class="panel student-panel"><div class="panel-head"><div><h2>学生正式测评状态</h2><span>${attention} 名学生建议进一步关注；比较仅限学生本人同一水平的前一次正式测评。</span></div><button class="attention-filter" id="attention-filter" type="button">仅看建议关注</button></div>
        <div class="assignment-bar"><span id="selected-count">已选择 0 名学生</span><label>巩固范围<select id="remediation-focus"><option value="ALL_RETRY">各自待巩固题目</option>${dashboard.commonDifficulties.map((entry) => `<option value="${esc(entry.family)}">${esc(entry.displayName)}专项</option>`).join('')}${dashboard.families.filter((entry) => !dashboard.commonDifficulties.some((common) => common.family === entry.family)).map((entry) => `<option value="${esc(entry.family)}">${esc(entry.displayName)}专项</option>`).join('')}</select></label><button type="button" class="assign-remediation" id="assign-remediation" disabled>布置专项巩固</button></div>
        <div class="student-table-wrap"><table><thead><tr><th><input id="select-all-students" type="checkbox" aria-label="选择当前学生"></th><th>姓名</th><th>状态</th><th>最近正式分</th><th>与本人上次比较</th><th>优先巩固</th><th>专项巩固</th><th>待复核</th><th></th></tr></thead><tbody id="diagnostic-students"></tbody></table></div>
      </section>
      <section id="student-detail" class="student-detail" hidden></section>`;
    renderStudents(false);
    bindAssignmentControls();
    root
      .querySelector("#attention-filter")
      ?.addEventListener("click", (event) => {
        const active = event.currentTarget.classList.toggle("active");
        event.currentTarget.textContent = active
          ? "显示全部学生"
          : "仅看建议关注";
        renderStudents(active);
      });
  }

  function renderStudents(attentionOnly) {
    const body = root.querySelector("#diagnostic-students");
    const students = dashboard.students.filter(
      (student) => !attentionOnly || student.needsAttention,
    );
    body.innerHTML =
      students
        .map(
          (student) => `<tr>
      <td><input type="checkbox" data-select-enrollment="${esc(student.enrollmentId)}" ${selectedEnrollmentIds.has(student.enrollmentId) ? "checked" : ""} aria-label="选择 ${esc(student.displayName)}"></td><td><strong>${esc(student.displayName)}</strong></td><td><span class="state state-${esc(student.state)}">${stateLabel(student.state)}</span></td>
      <td>${score(student.latestScore)}</td><td class="self-delta">${esc(delta(student.latestVsPrevious, student.comparisonState))}</td>
      <td>${esc(student.topPriority?.displayName || "—")}</td><td>${student.assignedRemediation ? `老师布置 · ${esc(student.assignedRemediation.latestStatus)}${student.assignedRemediation.activeCount ? `（${student.assignedRemediation.activeCount} 项进行中）` : ""}` : (student.remediationSummary ? `专项巩固 ${student.remediationSummary.completedRounds} 轮 · ${percentage(student.remediationSummary.latestPercentage)}` : "—")}</td>
      <td>${student.pendingReviewCount ? `${student.pendingReviewCount} 题` : "—"}</td><td><button type="button" class="student-open" data-enrollment="${esc(student.enrollmentId)}">查看</button></td>
    </tr>`,
        )
        .join("") ||
      '<tr><td class="empty-row" colspan="9">没有符合当前筛选的学生。</td></tr>';
    body.querySelectorAll('[data-select-enrollment]').forEach((input) => input.addEventListener("change", () => {
      if (input.checked) selectedEnrollmentIds.add(input.dataset.selectEnrollment);
      else selectedEnrollmentIds.delete(input.dataset.selectEnrollment);
      updateAssignmentControls();
    }));
    body
      .querySelectorAll(".student-open")
      .forEach((button) =>
        button.addEventListener("click", () =>
          loadStudentDetail(button.dataset.enrollment),
        ),
      );
  }

  function updateAssignmentControls() {
    const count = selectedEnrollmentIds.size;
    const button = root.querySelector("#assign-remediation");
    const label = root.querySelector("#selected-count");
    if (button) button.disabled = count === 0;
    if (label) label.textContent = `已选择 ${count} 名学生`;
  }

  function bindAssignmentControls() {
    root.querySelector("#select-all-students")?.addEventListener("change", (event) => {
      if (event.currentTarget.checked) dashboard.students.forEach((student) => selectedEnrollmentIds.add(student.enrollmentId));
      else selectedEnrollmentIds.clear();
      renderStudents(false);
      updateAssignmentControls();
    });
    root.querySelector("#assign-remediation")?.addEventListener("click", async (event) => {
      const classId = root.querySelector("#diagnostic-class")?.value;
      const practiceDefinitionId = root.querySelector("#diagnostic-practice")?.value;
      const focusValue = root.querySelector("#remediation-focus")?.value;
      if (!classId || !practiceDefinitionId || !focusValue || !selectedEnrollmentIds.size) return;
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = "正在布置…";
      try {
        const result = await YuzanApi.createTeacherQuestionBankRemediationAssignments(classId, {
          practiceDefinitionId,
          enrollmentIds: [...selectedEnrollmentIds],
          focus: focusValue === "ALL_RETRY" ? { mode: "ALL_RETRY" } : { mode: "FAMILY", family: focusValue },
        });
        const skipped = result.skipped ? `，${result.skipped} 人暂无匹配的正式待巩固题目` : "";
        alert(`已布置 ${result.assigned} 项，恢复 ${result.resumed} 项${skipped}。`);
        selectedEnrollmentIds.clear();
        await loadDashboard();
      } catch (error) {
        alert(error.message || "布置失败，请稍后重试");
        button.disabled = false;
        button.textContent = "布置专项巩固";
      }
    });
    updateAssignmentControls();
  }

  function renderStudentDetail(detail) {
    const panel = root.querySelector("#student-detail");
    panel.hidden = false;
    panel.innerHTML = `<div class="detail-head"><div><span class="diagnostic-kicker">STUDENT · SAME LEVEL</span><h2>${esc(detail.displayName)}</h2><p>最近正式结果 ${score(detail.latestScore)}，${esc(delta(detail.latestVsPrevious, detail.comparisonState))}</p></div><div><a href="/teacher/assessments/detail/?sessionId=${encodeURIComponent(detail.latestSessionId || "")}">查看正式报告</a><a href="/teacher/reviews/">查看已有复核</a></div></div>
      ${detail.latestDiagnosis ? `<div class="detail-domains">${detail.latestDiagnosis.domains.map((entry) => `<div><span>${esc(entry.displayName)}</span><strong>${percentage(entry.percentage)}</strong></div>`).join("")}</div>` : '<p class="empty-row">该学生在所选水平暂无完整正式测评结果。</p>'}
      <div class="detail-columns"><div><h3>重点题型</h3><ul>${detail.familyPriorities.map((entry) => `<li>${esc(entry.displayName)} <b>${percentage(entry.percentage)}</b></li>`).join("") || "<li>暂无</li>"}</ul></div><div><h3>专项巩固</h3><ul>${detail.remediationRounds.map((entry) => `<li>${entry.itemCount} 道题，${entry.masteredCount} 道已掌握 <b>${percentage(entry.percentage)}</b></li>`).join("") || "<li>暂无专项巩固记录</li>"}</ul></div><div><h3>正式测评记录</h3><ul>${detail.formalHistory.map((entry) => `<li>${score(entry.overallScore)} <small>${new Date(entry.completedAt).toLocaleDateString("zh-CN")}</small></li>`).join("") || "<li>暂无</li>"}</ul></div></div>`;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadDashboard() {
    const classId = root.querySelector("#diagnostic-class")?.value;
    const practiceDefinitionId = root.querySelector(
      "#diagnostic-practice",
    )?.value;
    const host = root.querySelector("#diagnostic-content");
    if (!classId || !practiceDefinitionId || !host) return;
    const requestId = ++dashboardRequestId;
    host.innerHTML = '<div class="diagnostic-loading">正在加载所选班级…</div>';
    try {
      const nextDashboard = await YuzanApi.getTeacherQuestionBankDiagnosticDashboard(
        classId,
        practiceDefinitionId,
      );
      if (requestId !== dashboardRequestId) return;
      dashboard = nextDashboard;
      selectedEnrollmentIds = new Set([...selectedEnrollmentIds].filter((id) => dashboard.students.some((student) => student.enrollmentId === id)));
      renderDashboard();
    } catch (error) {
      if (requestId !== dashboardRequestId) return;
      host.innerHTML = `<div class="diagnostic-error">加载失败：${esc(error.message || "请稍后重试")}<br><button type="button" id="diagnostic-retry">重试</button></div>`;
      host
        .querySelector("#diagnostic-retry")
        ?.addEventListener("click", loadDashboard);
    }
  }

  async function loadStudentDetail(enrollmentId) {
    const panel = root.querySelector("#student-detail");
    const classId = root.querySelector("#diagnostic-class")?.value;
    const practiceDefinitionId = root.querySelector(
      "#diagnostic-practice",
    )?.value;
    if (!panel || !classId || !practiceDefinitionId || !enrollmentId) return;
    panel.hidden = false;
    panel.innerHTML = '<div class="diagnostic-loading">正在加载学生诊断…</div>';
    try {
      renderStudentDetail(
        await YuzanApi.getTeacherQuestionBankDiagnosticStudentDetail(
          classId,
          enrollmentId,
          practiceDefinitionId,
        ),
      );
    } catch (error) {
      panel.innerHTML = `<div class="diagnostic-error">无法打开学生诊断：${esc(error.message || "请稍后重试")}</div>`;
    }
  }

  async function init() {
    if (!window.YuzanApi?.requireAuth?.()) return;
    try {
      catalog = await YuzanApi.getTeacherQuestionBankDiagnosticCatalog();
      renderCatalog();
    } catch (error) {
      empty(`加载失败：${error.message || "请稍后重试"}`);
    }
  }
  init();
})();
