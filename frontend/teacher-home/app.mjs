import {
  dashboardErrorMessage,
  listItems,
  studentActivitySummary,
  workflowItem,
} from "./dashboard-model.mjs";

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[char]));

const root = $("#teacherDashboard");
const state = $("#dashboardState");
const workflowSection = $("#workflowSection");
const primaryGrid = $("#primaryGrid");
const learningGrid = $("#learningGrid");
const schoolId = window.YuzanApi?.getActiveSchoolId?.() || "";
let dashboardData = null;
let classes = [];
let classLoadError = null;
let studentRequestId = 0;

function showState(message, { error = false, retry = false, selectSchool = false, login = false } = {}) {
  state.classList.toggle("is-error", error);
  state.innerHTML = `<span>${esc(message)}</span>${selectSchool ? '<a href="/select-school">切换学校</a>' : ""}${login ? '<a href="/login">重新登录</a>' : ""}${retry ? '<button type="button" data-retry-dashboard>重新加载</button>' : ""}`;
  state.hidden = false;
  state.querySelector("[data-retry-dashboard]")?.addEventListener("click", loadDashboard);
}

function routeForWorkflow(item, courses) {
  if (item.id === "task") return "/teacher/assignments";
  if (item.id === "review") return "/teacher/reviews/";
  if (item.id === "student") return "/teacher/classes";
  if (item.id === "course" && courses[0]?.id) {
    return `/teacher/courses/spring/studio/?courseVersionId=${encodeURIComponent(courses[0].id)}`;
  }
  return "";
}

function renderIdentity(dashboard) {
  const greeting = dashboard?.greeting || {};
  const name = greeting.name || window.YuzanApi?.getStoredUser?.()?.displayName || "教师";
  const activeSchoolId = window.YuzanApi?.getActiveSchoolId?.() || "";
  const membership = (window.YuzanApi?.getStoredUser?.()?.memberships || [])
    .find((item) => item?.schoolId === activeSchoolId);
  const schoolName = greeting.schoolName || membership?.schoolName || "当前学校";
  $("#teacherGreeting").textContent = `你好，${name}老师`;
  $("#dashboardWelcome").textContent = "以下信息来自当前账号可访问的课程、任务、班级与学习记录。";
  $("#schoolName").textContent = schoolName;
  $("#todayDate").textContent = greeting.date || new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  }).format(new Date());
}

function renderWorkflow(dashboard) {
  const courses = listItems(dashboard?.courses);
  const cards = ["course", "task", "review", "student"]
    .map((id) => workflowItem(dashboard, id))
    .filter(Boolean);
  $("#workflowCards").innerHTML = cards.map((item) => {
    const href = routeForWorkflow(item, courses);
    const contents = `<span class="workflow-icon"><svg><use href="#${item.id === "course" ? "i-course" : item.id === "task" ? "i-task" : item.id === "review" ? "i-review" : "i-people"}"/></svg></span><span class="workflow-copy"><strong>${esc(item.title)}</strong><small>${esc(item.subtitle)}</small></span><b class="workflow-count">${Number(item.count) || 0}</b>`;
    return href
      ? `<a class="workflow-card" href="${esc(href)}">${contents}</a>`
      : `<div class="workflow-card" aria-disabled="true">${contents}</div>`;
  }).join("");
  workflowSection.hidden = false;
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "时间未设置" : new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function renderTasks(dashboard) {
  const tasks = listItems(dashboard?.tasks);
  $("#taskList").innerHTML = tasks.length
    ? tasks.map((task) => {
      const total = Number(task.total) || 0;
      const done = Number(task.done) || 0;
      const progress = total > 0 ? `${done} / ${total} 人已提交` : "暂无有效目标学生";
      const href = `/teacher/assignments?assignmentId=${encodeURIComponent(task.id)}`;
      return `<a class="dashboard-row task-row" href="${esc(href)}"><span class="row-mark"><svg><use href="#i-task"/></svg></span><span class="row-main"><strong>${esc(task.title)}</strong><small>截止 ${esc(formatDateTime(task.dueAt))}</small></span><span class="row-value">${esc(progress)}</span></a>`;
    }).join("")
    : '<p class="empty-note">当前没有进行中的教学任务。</p>';
}

function renderReviews(dashboard) {
  const reviews = listItems(dashboard?.reviews);
  $("#reviewList").innerHTML = reviews.length
    ? reviews.map((review) => {
      const href = `/teacher/submissions/${encodeURIComponent(review.submissionId)}`;
      return `<a class="dashboard-row review-row" href="${esc(href)}"><span class="row-mark"><svg><use href="#i-review"/></svg></span><span class="row-main"><strong>${esc(review.studentName || "学生")}</strong><small>${esc(review.taskTitle || "待复核提交")} · ${esc(formatDateTime(review.submittedAt))}</small></span><span class="row-value">查看提交</span></a>`;
    }).join("")
    : '<p class="empty-note">当前没有待复核提交。</p>';
}

function classDisplayName(item) {
  const grade = item.grade ? (item.grade.endsWith("年级") ? item.grade : `${item.grade}年级`) : "未设置年级";
  return `${grade} ${item.name || "未命名班级"}`;
}

function renderClasses() {
  const list = $("#classList");
  if (classLoadError) {
    list.innerHTML = `<p class="error-note">${esc(dashboardErrorMessage(classLoadError))}</p>${classLoadError.status === 403 ? '<a class="retry-inline" href="/select-school">切换学校</a>' : ''}<button type="button" class="retry-inline" data-retry-classes>重试加载班级</button>`;
    list.querySelector("[data-retry-classes]")?.addEventListener("click", loadClasses);
    return;
  }
  if (!classes.length) {
    list.innerHTML = '<p class="empty-note">当前账号暂无已授权班级。</p>';
    $("#studentClassSelect").innerHTML = '<option value="">暂无班级</option>';
    $("#studentState").textContent = "没有可查看的班级学生记录。";
    return;
  }
  const rememberedId = sessionStorage.getItem(`teacher-home-class:${schoolId}`);
  const selectedId = classes.some((item) => item.id === rememberedId) ? rememberedId : classes[0].id;
  $("#studentClassSelect").innerHTML = classes.map((item) =>
    `<option value="${esc(item.id)}" ${item.id === selectedId ? "selected" : ""}>${esc(classDisplayName(item))}</option>`,
  ).join("");
  list.innerHTML = classes.map((item) => {
    const isSelected = item.id === selectedId;
    return `<div class="class-card ${isSelected ? "selected" : ""}"><button type="button" class="class-select" data-class-id="${esc(item.id)}" aria-pressed="${isSelected}"><strong>${esc(classDisplayName(item))}</strong><span>${Number(item.studentCount) || 0} 名在读学生</span></button><a href="/teacher/classes/${encodeURIComponent(item.id)}" aria-label="进入${esc(classDisplayName(item))}">进入班级 <svg><use href="#i-arrow"/></svg></a></div>`;
  }).join("");
  list.querySelectorAll("[data-class-id]").forEach((button) => button.addEventListener("click", () => {
    const nextClassId = button.dataset.classId;
    $("#studentClassSelect").value = nextClassId;
    sessionStorage.setItem(`teacher-home-class:${schoolId}`, nextClassId);
    list.querySelectorAll(".class-card").forEach((card) => card.classList.toggle("selected", card.querySelector("[data-class-id]") === button));
    list.querySelectorAll("[data-class-id]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    loadStudents(nextClassId);
  }));
  $("#studentClassSelect").value = selectedId;
  $("#studentClassSelect").onchange = (event) => {
    sessionStorage.setItem(`teacher-home-class:${schoolId}`, event.target.value);
    list.querySelectorAll(".class-card").forEach((card) => {
      const button = card.querySelector("[data-class-id]");
      const selected = button?.dataset.classId === event.target.value;
      card.classList.toggle("selected", selected);
      button?.setAttribute("aria-pressed", String(selected));
    });
    loadStudents(event.target.value);
  };
  loadStudents(selectedId);
}

async function loadStudents(classId) {
  const requestId = ++studentRequestId;
  const host = $("#studentState");
  if (!classId) {
    host.textContent = "没有选择班级。";
    return;
  }
  host.textContent = "正在加载该班级的真实学习记录…";
  try {
    const students = listItems(await window.YuzanApi.getClassStudentSummaries(classId));
    if (requestId !== studentRequestId) return;
    if (!students.length) {
      host.innerHTML = '<p class="empty-note">该班级暂无学生学习记录。</p>';
      return;
    }
    const sorted = [...students].sort((left, right) =>
      new Date(right.lastActiveAt || 0).getTime() - new Date(left.lastActiveAt || 0).getTime(),
    );
    host.innerHTML = sorted.slice(0, 6).map((student) => {
      const href = `/teacher/classes/${encodeURIComponent(classId)}?studentId=${encodeURIComponent(student.enrollmentId)}#students`;
      return `<a class="dashboard-row student-row" href="${esc(href)}"><span class="student-avatar">${esc((student.displayName || "学").slice(0, 1))}</span><span class="row-main"><strong>${esc(student.displayName || "学生")}</strong><small>${esc(studentActivitySummary(student))}</small></span><span class="row-value">查看班级记录</span></a>`;
    }).join("");
  } catch (error) {
    if (requestId !== studentRequestId) return;
    host.innerHTML = `<p class="error-note">${esc(dashboardErrorMessage(error))}</p>${error.status === 403 ? '<a class="retry-inline" href="/select-school">切换学校</a>' : ''}<button type="button" class="retry-inline" data-retry-students>重试加载学情</button>`;
    host.querySelector("[data-retry-students]")?.addEventListener("click", () => loadStudents(classId));
  }
}

async function loadClasses() {
  classLoadError = null;
  try {
    const result = await window.YuzanApi.listClasses({ limit: 100 });
    classes = listItems(result);
  } catch (error) {
    classLoadError = error;
    classes = [];
  }
  renderClasses();
}

async function loadDashboard() {
  if (!window.YuzanApi?.getToken?.()) {
    location.href = "/login";
    return;
  }
  if (!window.YuzanApi.getActiveSchoolId()) {
    showState("请先选择当前工作学校。", { error: true, selectSchool: true });
    root.setAttribute("aria-busy", "false");
    return;
  }
  root.setAttribute("aria-busy", "true");
  $("#dashboardRefresh").disabled = true;
  showState("正在从教师仪表盘和班级接口读取数据…");
  const [dashboardResult, classesResult] = await Promise.allSettled([
    window.YuzanApi.getDashboard(),
    window.YuzanApi.listClasses({ limit: 100 }),
  ]);
  if (dashboardResult.status === "rejected") {
    showState(dashboardErrorMessage(dashboardResult.reason), {
      error: true,
      retry: dashboardResult.reason?.status !== 401,
      selectSchool: dashboardResult.reason?.status === 403,
      login: dashboardResult.reason?.status === 401,
    });
    workflowSection.hidden = true;
    primaryGrid.hidden = true;
    learningGrid.hidden = true;
    root.setAttribute("aria-busy", "false");
    $("#dashboardRefresh").disabled = false;
    return;
  }

  dashboardData = dashboardResult.value || {};
  renderIdentity(dashboardData);
  renderWorkflow(dashboardData);
  renderTasks(dashboardData);
  renderReviews(dashboardData);
  primaryGrid.hidden = false;

  if (classesResult.status === "fulfilled") {
    classLoadError = null;
    classes = listItems(classesResult.value);
  } else {
    classLoadError = classesResult.reason;
    classes = [];
  }
  renderClasses();
  learningGrid.hidden = false;
  const syncText = classesResult.status === "fulfilled"
    ? `已加载 ${classes.length} 个本人授权班级 · ${new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date())} 更新`
    : "仪表盘已加载；班级服务失败，可在班级区重试。";
  $("#dashboardSync").textContent = syncText;
  showState(classesResult.status === "fulfilled" ? "数据来自当前教师授权范围。" : "部分班级数据暂不可用，任务和复核信息仍可查看。", {
    error: classesResult.status === "rejected",
  });
  root.setAttribute("aria-busy", "false");
  $("#dashboardRefresh").disabled = false;
}

$("#dashboardRefresh").addEventListener("click", loadDashboard);
loadDashboard();
