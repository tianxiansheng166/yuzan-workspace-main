(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
  const state = { courses: [], status: "ALL", query: "" };

  function render() {
    const visible = YuzanAssignmentsData.filter(state.courses, state.status, state.query);
    $("#taskGrid").innerHTML = visible.map((course) => `
      <a class="assignment-card" href="${esc(YuzanAssignmentsData.detailHref(course.assignmentId))}">
        <div class="assignment-cover">
          <img src="${esc(window.YuzanVisualAssets?.courseCover(course) || course.coverAsset)}" alt="${esc(course.title)}课程封面" loading="lazy" onerror="this.onerror=null;this.src='/assets/generated-covers/course-spring-reading.png'" />
          <span class="assignment-status" data-status="${esc(course.status)}">${esc(course.statusLabel)}</span>
        </div>
        <div class="assignment-card-body">
          <div class="assignment-card-meta"><span>${esc(course.theme)}</span>${course.gradeBand ? `<span>${esc(course.gradeBand)}</span>` : ""}</div>
          <h3>${esc(course.title)}</h3>
          <p class="assignment-card-description">${esc(course.description || "打开课程，查看课堂视频、课件和练习内容。")}</p>
          <div class="assignment-progress">
            <div class="assignment-progress-copy"><span>${course.nextActivity ? `下一步：${esc(course.nextActivity)}` : "课程学习进度"}</span><strong>${course.progressPercent}%</strong></div>
            <div class="assignment-progress-track" aria-label="课程进度 ${course.progressPercent}%"><span style="width:${course.progressPercent}%"></span></div>
          </div>
          <div class="assignment-card-footer"><span>${course.estimatedMinutes ? `约 ${course.estimatedMinutes} 分钟` : "按自己的节奏学习"}</span><span class="assignment-open">${course.status === "COMPLETED" ? "查看课程" : course.progressPercent > 0 ? "继续学习" : "开始学习"}<span aria-hidden="true">→</span></span></div>
        </div>
      </a>`).join("");
    $("#taskResultCount").textContent = `显示 ${visible.length} / ${state.courses.length} 门`;
    $("#taskNoMatch").hidden = visible.length > 0 || state.courses.length === 0;
  }

  function showFailure(error) {
    $("#taskLoading").hidden = true;
    $("#taskResults").hidden = true;
    $("#taskError").hidden = false;
    $("#taskErrorMessage").textContent = error && error.status === 403
      ? "当前学校暂时没有可读取的课程任务，请检查学校选择或稍后重试。"
      : error && error.message
        ? error.message
        : "请确认网络连接后重试。";
  }

  async function load() {
    $("#taskLoading").hidden = false;
    $("#taskError").hidden = true;
    $("#taskEmpty").hidden = true;
    $("#taskResults").hidden = true;
    if (!window.YuzanApi || !YuzanApi.getToken || !YuzanApi.getToken()) {
      location.href = "/login?returnTo=" + encodeURIComponent("/student/assignments");
      return;
    }
    try {
      const first = await YuzanApi.listStudentCourses({ limit: 100 });
      let payload = first;
      let rows = Array.isArray(first && first.courses) ? first.courses.slice() : [];
      let cursor = first && first.nextCursor;
      let page = 0;
      while (first && first.hasMore && cursor && page < 7) {
        payload = await YuzanApi.listStudentCourses({ limit: 100, cursor });
        rows.push(...(Array.isArray(payload && payload.courses) ? payload.courses : []));
        cursor = payload && payload.nextCursor;
        page += 1;
        if (!payload.hasMore) break;
      }
      state.courses = YuzanAssignmentsData.normalize({ courses: rows });
      $("#taskTotal").textContent = String(state.courses.length);
      $("#taskActive").textContent = String(state.courses.filter((course) => ["IN_PROGRESS", "RESULT_PENDING"].includes(course.status)).length);
      $("#taskDone").textContent = String(state.courses.filter((course) => course.status === "COMPLETED").length);
      $("#taskLoading").hidden = true;
      if (!state.courses.length) {
        $("#taskEmpty").hidden = false;
        return;
      }
      $("#taskResults").hidden = false;
      render();
    } catch (error) {
      if (error && error.status === 401) {
        location.href = "/login?returnTo=" + encodeURIComponent("/student/assignments");
        return;
      }
      if (error && error.status === 403 && YuzanApi.getActiveSchoolId && !YuzanApi.getActiveSchoolId()) {
        location.href = "/select-school/";
        return;
      }
      showFailure(error);
    }
  }

  document.querySelectorAll("[data-status-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.status = button.dataset.statusFilter;
      document.querySelectorAll("[data-status-filter]").forEach((item) => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      render();
    });
  });
  $("#taskSearch").addEventListener("input", (event) => { state.query = event.target.value; render(); });
  $("#taskRetry").addEventListener("click", load);
  load();
})();
