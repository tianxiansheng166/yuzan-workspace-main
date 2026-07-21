(() => {
  "use strict";
  const categories = [
    "全部",
    "发音基础",
    "听说理解",
    "朗读表达",
    "阅读写作",
    "古诗文",
  ];
  const state = {
    courses: [],
    theme: "全部",
    filters: { gradeBand: "", difficulty: "", source: "", status: "" },
    detail: null,
  };
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value = "") =>
    String(value).replace(
      /[&<>'"]/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[char],
    );
  const sourceLabel = {
    TEACHER_ASSIGNED: "教师布置",
    RECOMMENDED: "学习推荐",
    SELF_STUDY: "自主学习",
  };
  const statusLabel = {
    NOT_STARTED: "未开始",
    IN_PROGRESS: "进行中",
    COMPLETED: "已完成",
    RESULT_PENDING: "结果处理中",
  };
  const typeLabel = {
    TEXT: "阅读",
    VIDEO: "视频",
    AUDIO: "听力",
    CHOICE: "选择",
    FILL_BLANK: "填空",
    SPEECH: "口语",
  };

  function toast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
      el.hidden = true;
    }, 2600);
  }
  function errorMarkup(title, message, retry) {
    return `<h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p>${retry ? '<button type="button" class="text-button" data-retry>重新加载</button>' : ""}`;
  }
  function coursePath() {
    const match = location.pathname.match(/^\/student\/courses\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  async function loadCatalog() {
    $("#catalogLoading").hidden = false;
    $("#catalogState").hidden = true;
    $("#catalogContent").hidden = true;
    if (!navigator.onLine) {
      showCatalogState(
        "当前处于离线状态",
        "课程目录需要联网读取。已下载内容仍可从离线管理进入。",
        true,
      );
      return;
    }
    try {
      const data = await YuzanApi.listStudentCourses();
      state.courses = Array.isArray(data?.courses) ? data.courses : [];
      $("#catalogLoading").hidden = true;
      $("#catalogContent").hidden = false;
      buildFilterOptions();
      render();
      const assignmentId = coursePath();
      if (assignmentId) await openDetail(assignmentId, false);
    } catch (error) {
      if (error.status === 401) {
        location.href =
          "/login?returnTo=" + encodeURIComponent(location.pathname);
        return;
      }
      showCatalogState(
        error.status === 403 ? "没有课程访问权限" : "课程暂时无法加载",
        error.message || "请稍后重试。",
        true,
      );
    }
  }
  function showCatalogState(title, message, retry) {
    $("#catalogLoading").hidden = true;
    const panel = $("#catalogState");
    panel.innerHTML = errorMarkup(title, message, retry);
    panel.hidden = false;
    panel.querySelector("[data-retry]")?.addEventListener("click", loadCatalog);
  }
  function buildFilterOptions() {
    for (const [id, key] of [
      ["gradeFilter", "gradeBand"],
      ["difficultyFilter", "difficulty"],
    ]) {
      const select = $("#" + id);
      [
        ...new Set(state.courses.map((course) => course[key]).filter(Boolean)),
      ].forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.append(option);
      });
    }
    $("#themeFilters").innerHTML = categories
      .map(
        (category) =>
          `<button type="button" class="theme-filter${category === state.theme ? " active" : ""}" data-theme="${category}">${category}</button>`,
      )
      .join("");
  }
  function filteredCourses() {
    return state.courses.filter(
      (course) =>
        (state.theme === "全部" || course.capabilityTheme === state.theme) &&
        Object.entries(state.filters).every(
          ([key, value]) => !value || course[key] === value,
        ),
    );
  }
  function render() {
    const courses = filteredCourses();
    const active = state.courses.filter(
      (course) =>
        course.status === "IN_PROGRESS" || course.status === "RESULT_PENDING",
    );
    $("#totalCount").textContent = state.courses.length;
    $("#activeCount").textContent = active.length;
    $("#resultCount").textContent = `显示 ${courses.length} 门`;
    document
      .querySelectorAll(".theme-filter")
      .forEach((button) =>
        button.classList.toggle("active", button.dataset.theme === state.theme),
      );
    const next =
      state.courses.find((course) => course.status === "IN_PROGRESS") ||
      state.courses.find((course) => course.status === "RESULT_PENDING") ||
      state.courses[0];
    $("#continueSection").hidden = !next;
    $("#continueCourse").innerHTML = next ? continueMarkup(next) : "";
    $("#courseList").innerHTML = courses.map(courseRowMarkup).join("");
    $("#emptyState").hidden = courses.length > 0;
    const completed = state.courses
      .filter((course) => course.status === "COMPLETED")
      .slice(0, 3);
    $("#recentCompleted").innerHTML = completed.length
      ? completed
          .map(
            (course) =>
              `<div class="recent-item"><strong>${escapeHtml(course.title)}</strong><span>${course.completedAt ? new Date(course.completedAt).toLocaleDateString("zh-CN") : "已完成"}</span></div>`,
          )
          .join("")
      : '<p class="recent-empty">完成第一门课程后，学习记录会出现在这里。</p>';
    bindCourseLinks();
  }
  function continueMarkup(course) {
    const next = course.nextActivity?.title || "查看完成记录";
    return `<article class="continue-card"><div class="continue-cover" style="background-image:url('${escapeHtml(course.coverAsset || "/assets/student-course-header.jpg")}')"></div><div class="continue-body"><p class="eyebrow">${escapeHtml(statusLabel[course.status])} · ${course.progressPercent}%</p><h3>${escapeHtml(course.title)}</h3><p>${escapeHtml(course.description || "沿章节路径继续完成课程。")}</p><div class="progress-track"><i style="width:${Number(course.progressPercent) || 0}%"></i></div><p class="continue-next">下一活动：${escapeHtml(next)}</p><button type="button" class="primary-button" data-course-id="${course.assignmentId}">${course.status === "NOT_STARTED" ? "查看课程" : "继续学习"}</button></div></article>`;
  }
  function courseRowMarkup(course) {
    return `<a class="course-row" href="/student/courses/${course.assignmentId}" data-course-id="${course.assignmentId}"><img class="course-cover" src="${escapeHtml(course.coverAsset || "/assets/student-course-1.jpg")}" alt=""><div class="course-copy"><div class="course-kicker"><span>${escapeHtml(course.capabilityTheme || "综合能力")}</span><span>${escapeHtml(sourceLabel[course.source] || course.source)}</span></div><h3>${escapeHtml(course.title)}</h3><p>${escapeHtml(course.description || "")}</p><div class="course-meta"><span>${escapeHtml(course.gradeBand || "适用学段待定")}</span><span>${escapeHtml(course.difficulty || "难度待定")}</span><span>约 ${Number(course.estimatedMinutes) || 0} 分钟</span><span>下一活动：${escapeHtml(course.nextActivity?.title || "已完成")}</span></div></div><div class="course-progress"><div class="progress-ring" style="--progress:${Number(course.progressPercent) || 0}"><span>${Number(course.progressPercent) || 0}%</span></div><span class="status-label">${escapeHtml(statusLabel[course.status] || course.status)}</span></div></a>`;
  }
  function bindCourseLinks() {
    document.querySelectorAll("[data-course-id]").forEach((element) =>
      element.addEventListener("click", (event) => {
        event.preventDefault();
        openDetail(element.dataset.courseId, true);
      }),
    );
  }

  async function openDetail(assignmentId, push) {
    if (push) {
      history.pushState(
        { courseDetail: assignmentId },
        "",
        `/student/courses/${assignmentId}`,
      );
    }
    const layer = $("#detailLayer");
    layer.hidden = false;
    layer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    $("#detailLoading").hidden = false;
    $("#detailError").hidden = true;
    $("#detailContent").hidden = true;
    try {
      const detail = await YuzanApi.getStudentCourse(assignmentId);
      state.detail = detail;
      renderDetail(detail);
      $("#detailLoading").hidden = true;
      $("#detailContent").hidden = false;
      $(".detail-panel").scrollTop = 0;
    } catch (error) {
      $("#detailLoading").hidden = true;
      const panel = $("#detailError");
      panel.hidden = false;
      panel.innerHTML = errorMarkup(
        error.status === 403 ? "无权查看这门课程" : "课程详情暂时无法打开",
        error.message || "请稍后重试。",
        false,
      );
    }
  }
  function renderDetail(detail) {
    const version = detail.courseVersion || {};
    const completion = detail.courseCompletion || { progressPercent: 0 };
    const submission = detail.existingSubmission;
    const courseSubmitted = submission && ["SUBMITTED", "PROCESSING", "NEEDS_REVIEW", "REVIEWED", "ACCEPTED"].includes(submission.status);
    const courseActionLabel = !submission ? "开始课程" : completion.progressPercent < 100 ? "继续学习" : courseSubmitted ? "查看完成记录" : "提交课程";
    $("#detailStatus").textContent =
      statusLabel[
        state.courses.find(
          (course) => course.assignmentId === detail.assignment?.id,
        )?.status
      ] || "";
    const objectives = Array.isArray(version.objectives)
      ? version.objectives
      : [];
    const activityCount = (detail.units || []).reduce(
      (sum, unit) =>
        sum +
        unit.lessons.reduce(
          (lessonSum, lesson) => lessonSum + lesson.activities.length,
          0,
        ),
      0,
    );
    const outlines = (detail.units || [])
      .map(
        (unit) =>
          `<section class="outline-unit"><h3>${escapeHtml(unit.title)}</h3>${unit.lessons.map((lesson) => `<div class="outline-lesson"><strong>${escapeHtml(lesson.title)}</strong>${lesson.activities.map((activity, index) => `<div class="outline-activity"><span class="activity-index">${index + 1}</span><span>${escapeHtml(activity.title)} · ${escapeHtml(typeLabel[activity.type] || activity.type)}</span>${activity.required ? '<span class="activity-required">必修</span>' : ""}</div>`).join("")}</div>`).join("")}</section>`,
      )
      .join("");
    $("#detailContent").innerHTML =
      `<section class="detail-hero"><img src="${escapeHtml(version.coverAsset || "/assets/student-course-header.jpg")}" alt=""><div class="detail-intro"><p class="eyebrow">${escapeHtml(version.capabilityTheme || "综合课程")}</p><h1 id="detailTitle">${escapeHtml(version.title || detail.assignment?.title)}</h1><p>${escapeHtml(version.description || "")}</p><div class="detail-facts"><span>${escapeHtml(version.gradeBand || "学段待定")}</span><span>${escapeHtml(version.difficulty || "难度待定")}</span><span>约 ${Number(version.estimatedMinutes) || 0} 分钟</span><span>${activityCount} 个活动</span><span>${detail.practiceReferences?.length || 0} 个课程练习</span></div></div></section><div class="detail-body"><div><section><h2>学习目标</h2>${objectives.length ? `<ol class="objective-list">${objectives.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>` : "<p>课程发布者暂未填写学习目标。</p>"}</section><section><h2>章节与活动</h2>${outlines}</section></div><aside class="completion-sheet"><p class="eyebrow">完成条件</p><h2>${completion.progressPercent}% 学习完成</h2><p class="completion-progress">${completion.completedRequiredCount || 0} / ${completion.requiredActivityCount || activityCount} 个必修活动 · ${completion.completedPracticeCount || 0} / ${completion.requiredPracticeCount || 0} 个必做练习</p><ul><li>完成全部必修 Activity</li><li>提交全部必做 Practice</li><li>口语评分可在完成后继续处理</li><li>学习达标度：${escapeHtml(completion.attainmentStatus || "PENDING")}</li><li>设备要求：${version.deviceRequirements?.microphone ? "需要麦克风，" : "无需麦克风，"}需要音频播放</li></ul><button type="button" class="primary-button" id="startCourse">${courseActionLabel}</button></aside></div>`;
    $("#startCourse").addEventListener("click", startCourse);
  }
  async function startCourse() {
    const button = $("#startCourse");
    button.disabled = true;
    button.textContent = "正在准备课程…";
    try {
      const assignmentId = state.detail.assignment.id;
      const currentSubmission = state.detail.existingSubmission;
      if (currentSubmission && state.detail.courseCompletion.progressPercent === 100) {
        if (["SUBMITTED", "PROCESSING", "NEEDS_REVIEW", "REVIEWED", "ACCEPTED"].includes(currentSubmission.status)) {
          button.disabled = false;
          button.textContent = "查看完成记录";
          toast(`学习完成度 100%，达标状态 ${state.detail.courseCompletion.attainmentStatus}`);
          return;
        }
        const submitted = await YuzanApi.submitStudentCourse(assignmentId, currentSubmission.id, currentSubmission.revision);
        state.detail.existingSubmission = submitted.submission;
        state.detail.courseCompletion = submitted.courseCompletion;
        renderDetail(state.detail);
        toast(`课程已提交，达标状态 ${submitted.courseCompletion.attainmentStatus}`);
        return;
      }
      const result =
        await YuzanApi.createOrResumeCourseSubmission(assignmentId);
      const submission = result.submission;
      const activity =
        state.detail.nextActivity ||
        state.detail.units?.[0]?.lessons?.[0]?.activities?.[0];
      if (!activity) {
        toast("课程暂时没有可执行活动");
        button.disabled = false;
        return;
      }
      location.href = `/student/courses/${assignmentId}/submissions/${submission.id}/activities/${activity.id}`;
    } catch (error) {
      button.disabled = false;
      button.textContent = "重试进入课程";
      toast(error.message || "课程准备失败");
    }
  }
  function closeDetail(fromHistory) {
    $("#detailLayer").hidden = true;
    $("#detailLayer").setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    state.detail = null;
    if (!fromHistory && coursePath()) history.back();
  }

  $("#themeFilters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme]");
    if (button) {
      state.theme = button.dataset.theme;
      render();
    }
  });
  for (const [id, key] of [
    ["gradeFilter", "gradeBand"],
    ["difficultyFilter", "difficulty"],
    ["sourceFilter", "source"],
    ["statusFilter", "status"],
  ])
    $("#" + id).addEventListener("change", (event) => {
      state.filters[key] = event.target.value;
      render();
    });
  $("#clearFilters").addEventListener("click", () => {
    state.theme = "全部";
    state.filters = { gradeBand: "", difficulty: "", source: "", status: "" };
    document.querySelectorAll(".filter-sheet select").forEach((select) => {
      select.value = "";
    });
    render();
  });
  document
    .querySelectorAll("[data-close-detail]")
    .forEach((button) =>
      button.addEventListener("click", () => closeDetail(false)),
    );
  addEventListener("popstate", () => {
    const id = coursePath();
    if (id) openDetail(id, false);
    else closeDetail(true);
  });
  addEventListener("online", () => {
    if (!state.courses.length) loadCatalog();
  });
  addEventListener("offline", () =>
    toast("网络已断开，未同步操作不会显示为已完成"),
  );
  loadCatalog();
})();
