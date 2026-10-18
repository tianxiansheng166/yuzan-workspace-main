import {
  assessmentReviewQueue,
  assignmentSubmissionSummary,
  dashboardErrorMessage,
  identityKey,
  knownCount,
  readCollection,
  studentActivitySummary,
  submissionReviewCount,
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
const globalState = $("#dashboardState");
const workflowSection = $("#workflowSection");
const primaryGrid = $("#primaryGrid");
const learningGrid = $("#learningGrid");
const refreshButton = $("#dashboardRefresh");
const requestVersion = { dashboard: 0, classes: 0, students: 0, queue: 0 };

const dashboardState = { loading: false, data: null, error: null, updatedAt: null };
const classesState = { loading: false, data: null, error: null, updatedAt: null };
const studentsState = { loading: false, data: null, error: null, classId: "", updatedAt: null };
const queueState = { loading: false, data: null, error: null, updatedAt: null };
let classes = [];
let selectedClassId = "";
let currentIdentity = readIdentity();

function readIdentity() {
  const api = window.YuzanApi;
  let user = null;
  try {
    user = api?.getStoredUser?.() || null;
  } catch {
    user = null;
  }
  return {
    schoolId: api?.getActiveSchoolId?.() || "",
    token: api?.getToken?.() || "",
    userId: user?.id || user?.userId || "",
    userName: user?.displayName || "",
  };
}

function identitySnapshot(identity = currentIdentity) {
  return { ...identity, key: identityKey(identity) };
}

function invalidateRequests() {
  for (const key of Object.keys(requestVersion)) requestVersion[key] += 1;
}

function resetDataForIdentity() {
  dashboardState.loading = false;
  dashboardState.data = null;
  dashboardState.error = null;
  dashboardState.updatedAt = null;
  classesState.loading = false;
  classesState.data = null;
  classesState.error = null;
  classesState.updatedAt = null;
  studentsState.loading = false;
  studentsState.data = null;
  studentsState.error = null;
  studentsState.classId = "";
  studentsState.updatedAt = null;
  queueState.loading = false;
  queueState.data = null;
  queueState.error = null;
  queueState.updatedAt = null;
  classes = [];
  selectedClassId = "";
}

function observeApiIdentityMutations() {
  const api = window.YuzanApi;
  if (!api) return;
  for (const method of ["setActiveSchoolId", "setToken", "setStoredUser"]) {
    const original = api[method];
    if (typeof original !== "function" || original.__teacherHomeObserved) continue;
    const observed = function (...args) {
      const result = original.apply(this, args);
      queueMicrotask(syncIdentity);
      return result;
    };
    observed.__teacherHomeObserved = true;
    api[method] = observed;
  }
}

function syncIdentity() {
  const next = readIdentity();
  if (identityKey(next) === identityKey(currentIdentity)) return true;

  currentIdentity = next;
  invalidateRequests();
  resetDataForIdentity();
  renderAll();
  updateGlobalState();
  if (next.token && next.schoolId) loadAll(identitySnapshot(next));
  return false;
}

function isCurrentContext(context) {
  const next = readIdentity();
  if (identityKey(next) !== identityKey(currentIdentity)) {
    syncIdentity();
    return false;
  }
  return context.key === identityKey(currentIdentity);
}

function currentUserCacheKey() {
  return currentIdentity.userId || "current-user";
}

function setStatus(element, text, tone = "neutral") {
  if (!element) return;
  element.textContent = text;
  element.dataset.tone = tone;
}

function readTime(timestamp) {
  if (!timestamp) return "尚未读取";
  return `读取成功 ${new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp))}`;
}

function clearAndSetState(message, { tone = "neutral", link = null, button = null } = {}) {
  if (!globalState) return;
  globalState.classList.toggle("is-error", tone === "error");
  globalState.dataset.tone = tone;
  globalState.replaceChildren();
  const text = document.createElement("span");
  text.textContent = message;
  globalState.append(text);
  if (link) {
    const anchor = document.createElement("a");
    anchor.href = link.href;
    anchor.textContent = link.label;
    globalState.append(anchor);
  }
  if (button) {
    const action = document.createElement("button");
    action.type = "button";
    action.textContent = button.label;
    action.addEventListener("click", button.onClick);
    globalState.append(action);
  }
}

function updateGlobalState() {
  if (!currentIdentity.token) {
    clearAndSetState("登录已失效，教师工作台数据已清除。", {
      tone: "error",
      link: { href: "/login/", label: "重新登录" },
    });
    root?.setAttribute("aria-busy", "false");
    return;
  }
  if (!currentIdentity.schoolId) {
    clearAndSetState("请先选择当前工作学校。", {
      tone: "error",
      link: { href: "/select-school/", label: "选择学校" },
    });
    root?.setAttribute("aria-busy", "false");
    return;
  }

  const sections = [
    ["教学任务", dashboardState],
    ["班级与学情", classesState],
    ["学生学情", studentsState],
    ["题库人工复核", queueState],
  ];
  const failures = sections.filter(([, section]) => section.error).map(([name]) => name);
  const loading = sections.some(([, section]) => section.loading) || studentsState.loading;
  root?.setAttribute("aria-busy", loading ? "true" : "false");
  if (failures.length) {
    clearAndSetState(`部分数据区读取失败：${failures.join("、")}。其他已读取区域仍可使用；可在对应区域单独重试。`, { tone: "error" });
  } else if (loading) {
    clearAndSetState("正在分别读取本人授权的任务、班级、学情与题库复核数据…");
  } else if (dashboardState.updatedAt && classesState.updatedAt && queueState.updatedAt) {
    clearAndSetState("各数据区均已从服务端读取；更新时间按区域显示。", { tone: "success" });
  } else {
    clearAndSetState("等待本人授权数据读取完成…");
  }
}

function showIdentityFailure() {
  if (!currentIdentity.token) {
    clearAndSetState("登录已失效，教师工作台数据已清除。", {
      tone: "error",
      link: { href: "/login/", label: "重新登录" },
    });
  } else if (!currentIdentity.schoolId) {
    clearAndSetState("请先选择当前工作学校。", {
      tone: "error",
      link: { href: "/select-school/", label: "选择学校" },
    });
  }
}

function formatDateTime(value) {
  if (!value) return "截止时间未读取";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "截止时间格式无效"
    : new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
}

function taskHref(task) {
  return typeof task?.id === "string" && task.id.trim()
    ? `/teacher/assignments/?assignmentId=${encodeURIComponent(task.id)}`
    : "";
}

function submissionHref(review) {
  return typeof review?.submissionId === "string" && review.submissionId.trim()
    ? `/teacher/submissions/${encodeURIComponent(review.submissionId)}`
    : "";
}

function assessmentReviewHref(item) {
  return typeof item?.itemId === "string" && item.itemId.trim()
    ? `/teacher/reviews/${encodeURIComponent(item.itemId)}`
    : "";
}

function classHref(item) {
  if (typeof item?.id !== "string" || !item.id.trim() || !currentIdentity.schoolId) return "";
  if (item.schoolId && item.schoolId !== currentIdentity.schoolId) return "";
  const query = new URLSearchParams({ schoolId: currentIdentity.schoolId });
  return `/teacher/classes/${encodeURIComponent(item.id)}?${query}`;
}

function studentHref(student, classId) {
  if (typeof student?.enrollmentId !== "string" || !student.enrollmentId.trim() || !classId || !currentIdentity.schoolId) {
    return "";
  }
  const query = new URLSearchParams({ schoolId: currentIdentity.schoolId, classId });
  return `/teacher/students/${encodeURIComponent(student.enrollmentId)}?${query}`;
}

function workflowCount(id) {
  return knownCount(workflowItem(dashboardState.data, id)?.count);
}

function renderActionCards() {
  const host = $("#workflowCards");
  if (!host) return;
  const dashboard = dashboardState.data;
  const dashboardReviews = readCollection(dashboard?.reviews);
  const firstSubmission = dashboardReviews.items.find((item) => submissionHref(item));
  const firstQueueItem = queueState.data?.items?.find((item) => assessmentReviewHref(item));
  const firstClass = classes.find((item) => classHref(item));
  const submissionCount = submissionReviewCount(dashboard);
  const itemCount = queueState.data?.total ?? null;
  const definitions = [
    {
      id: "task",
      title: "进行中教学任务",
      subtitle: dashboardState.data ? "打开本人授权任务列表" : "任务数据尚未读取",
      count: workflowCount("task"),
      href: "/teacher/assignments/",
      icon: "i-task",
      tone: "task",
    },
    {
      id: "submission",
      title: "教学任务提交待查看",
      subtitle: "学生提交 · Submission 记录",
      count: submissionCount,
      href: submissionHref(firstSubmission) || "/teacher/assignments/",
      icon: "i-submission",
      tone: "submission",
    },
    {
      id: "item-review",
      title: "题库人工评分待复核",
      subtitle: "题目证据 · Review item 记录",
      count: itemCount,
      href: assessmentReviewHref(firstQueueItem) || "/teacher/reviews/",
      icon: "i-review",
      tone: "item-review",
    },
    {
      id: "student",
      title: "本人授权班级学生",
      subtitle: classesState.data ? "打开本人授权班级" : "班级数据尚未读取",
      count: workflowCount("student"),
      href: classHref(firstClass) || "/teacher/classes/",
      icon: "i-people",
      tone: "student",
    },
  ];
  host.innerHTML = definitions.map((item) => {
    const countText = item.count === null ? "—" : String(item.count);
    const countLabel = item.count === null ? "数量尚未读取" : `数量 ${item.count}`;
    return `<a class="workflow-card workflow-card-${item.tone}" href="${esc(item.href)}" aria-label="${esc(item.title)}，${esc(countLabel)}">
      <span class="workflow-icon" aria-hidden="true"><svg><use href="#${item.icon}"/></svg></span>
      <span class="workflow-copy"><strong>${esc(item.title)}</strong><small>${esc(item.subtitle)}</small></span>
      <b class="workflow-count" aria-hidden="true">${esc(countText)}</b>
    </a>`;
  }).join("");
  workflowSection.hidden = false;
}

function renderDashboard() {
  const status = $("#dashboardDataStatus");
  const taskHost = $("#taskList");
  const submissionHost = $("#reviewList");
  const submissionCountHost = $("#submissionReviewCount");
  if (dashboardState.loading) {
    setStatus(status, "正在读取教师任务数据…", "loading");
    submissionCountHost.textContent = "—";
    submissionCountHost.setAttribute("aria-label", "教学任务提交待查看数量正在读取");
    taskHost.innerHTML = '<p class="loading-note">正在读取本人授权任务…</p>';
    submissionHost.innerHTML = '<p class="loading-note">正在读取教学任务提交…</p>';
  } else if (dashboardState.error) {
    const message = dashboardErrorMessage(dashboardState.error);
    setStatus(status, `任务数据读取失败：${message}`, "error");
    submissionCountHost.textContent = "—";
    submissionCountHost.setAttribute("aria-label", "教学任务提交待查看数量读取失败");
    taskHost.innerHTML = '<p class="error-note">任务与教学提交列表暂不可用，未显示旧数据。</p><button class="retry-inline" type="button" data-retry-dashboard>重试读取教学数据</button>';
    submissionHost.innerHTML = '<p class="error-note">教学任务提交列表暂不可用，未显示旧数据。</p>';
    taskHost.querySelector("[data-retry-dashboard]")?.addEventListener("click", () => loadDashboard());
  } else if (dashboardState.data) {
    setStatus(status, readTime(dashboardState.updatedAt), "success");
    const tasks = readCollection(dashboardState.data.tasks);
    if (!tasks.available) {
      taskHost.innerHTML = '<p class="unknown-note">服务端尚未返回任务列表。</p>';
    } else if (!tasks.items.length) {
      taskHost.innerHTML = '<p class="empty-note">当前没有进行中的本人授权教学任务。</p>';
    } else {
      taskHost.innerHTML = tasks.items.map((task) => {
        const href = taskHref(task);
        const row = `<span class="row-mark" aria-hidden="true"><svg><use href="#i-task"/></svg></span><span class="row-main"><strong>${esc(task.title || "任务标题未提供")}</strong><small>截止 ${esc(formatDateTime(task.dueAt))}</small></span><span class="row-value">${esc(assignmentSubmissionSummary(task))}</span>`;
        return href
          ? `<a class="dashboard-row task-row" href="${esc(href)}" aria-label="打开任务 ${esc(task.title || task.id)}">${row}</a>`
          : `<div class="dashboard-row task-row task-row-invalid"><span class="row-mark" aria-hidden="true"><svg><use href="#i-task"/></svg></span><span class="row-main"><strong>${esc(task.title || "任务标题未提供")}</strong><small>服务端未返回可用的任务标识</small></span><span class="row-value">不可打开</span></div>`;
      }).join("");
    }

    const reviews = readCollection(dashboardState.data.reviews);
    const pendingCount = submissionReviewCount(dashboardState.data);
    submissionCountHost.textContent = pendingCount === null ? "—" : String(pendingCount);
    submissionCountHost.setAttribute("aria-label", pendingCount === null ? "教学任务提交待查看数量尚未读取" : `教学任务提交待查看 ${pendingCount} 项`);
    if (!reviews.available) {
      submissionHost.innerHTML = '<p class="unknown-note">服务端尚未返回待查看提交列表。</p>';
    } else if (!reviews.items.length) {
      submissionHost.innerHTML = pendingCount === 0
        ? '<p class="empty-note">服务端确认目前没有待查看的教学任务提交。</p>'
        : pendingCount === null
          ? '<p class="unknown-note">提交列表为空，但服务端未返回待办总数。</p>'
          : '<p class="unknown-note">服务端返回待办总数，但未返回可打开的提交条目。</p>';
    } else {
      submissionHost.innerHTML = reviews.items.map((review) => {
        const href = submissionHref(review);
        const row = `<span class="row-mark submission-mark" aria-hidden="true"><svg><use href="#i-submission"/></svg></span><span class="row-main"><strong>${esc(review.studentName || "学生姓名未提供")}</strong><small>${esc(review.taskTitle || "教学任务提交")} · ${esc(formatDateTime(review.submittedAt))}</small></span><span class="row-value">查看提交</span>`;
        return href
          ? `<a class="dashboard-row review-row" href="${esc(href)}">${row}</a>`
          : `<div class="dashboard-row review-row review-row-invalid"><span class="row-mark submission-mark" aria-hidden="true"><svg><use href="#i-submission"/></svg></span><span class="row-main"><strong>${esc(review.studentName || "学生姓名未提供")}</strong><small>${esc(review.taskTitle || "教学任务提交")}</small></span><span class="row-value">Submission ID 未返回</span></div>`;
      }).join("");
    }
  } else {
    setStatus(status, "任务数据尚未读取", "neutral");
    submissionCountHost.textContent = "—";
    submissionCountHost.setAttribute("aria-label", "教学任务提交待查看数量尚未读取");
    taskHost.innerHTML = '<p class="unknown-note">等待教师任务数据读取。</p>';
    submissionHost.innerHTML = '<p class="unknown-note">等待教学任务提交数据读取。</p>';
  }
  renderActionCards();
  primaryGrid.hidden = false;
}

function renderAssessmentQueue() {
  const status = $("#assessmentReviewStatus");
  const countHost = $("#assessmentReviewCount");
  const host = $("#assessmentReviewList");
  if (queueState.loading) {
    countHost.textContent = "—";
    countHost.setAttribute("aria-label", "题库人工评分待复核数量正在读取");
    setStatus(status, "正在读取题库人工复核队列…", "loading");
    host.innerHTML = '<p class="loading-note">正在读取本人授权的题库复核项目…</p>';
  } else if (queueState.error) {
    countHost.textContent = "—";
    countHost.setAttribute("aria-label", "题库人工评分待复核数量读取失败");
    setStatus(status, `题库复核队列读取失败：${dashboardErrorMessage(queueState.error)}`, "error");
    host.innerHTML = `<p class="error-note">题库人工评分队列暂不可用，教学任务与班级数据仍可使用。</p><button class="retry-inline" type="button" data-retry-queue>重试读取复核队列</button>`;
    host.querySelector("[data-retry-queue]")?.addEventListener("click", () => loadQueue());
  } else if (queueState.data) {
    const queue = queueState.data;
    countHost.textContent = queue.total === null ? "—" : String(queue.total);
    countHost.setAttribute("aria-label", queue.total === null ? "题库人工评分待复核总数尚未读取" : `题库人工评分待复核 ${queue.total} 项`);
    setStatus(status, `${readTime(queueState.updatedAt)} · 服务端队列总数 ${queue.total === null ? "尚未读取" : queue.total}`, queue.total === null ? "warning" : "success");
    if (!queue.itemsAvailable) {
      host.innerHTML = '<p class="unknown-note">服务端未返回题库复核项目列表，暂不显示条目。</p>';
    } else if (!queue.items.length && queue.total === 0) {
      host.innerHTML = '<p class="empty-note">服务端确认本人授权范围内暂无待复核题目。</p>';
    } else if (!queue.items.length) {
      host.innerHTML = queue.total === null
        ? '<p class="unknown-note">项目列表为空，服务端总数尚未读取。</p>'
        : `<p class="unknown-note">服务端返回 ${queue.total} 道待复核题目，但没有返回可打开的项目。</p>`;
    } else {
      const validItems = queue.items.filter((item) => assessmentReviewHref(item));
      const invalidCount = queue.items.length - validItems.length;
      host.innerHTML = `${invalidCount ? '<p class="error-note">部分复核项目缺少真实 itemId，未生成跳转链接。</p>' : ""}${validItems.map((item) => {
        const href = assessmentReviewHref(item);
        const studentName = item?.student?.displayName || "学生姓名未提供";
        const practiceTitle = item?.practice?.title || "练习名称未提供";
        const strategy = item?.strategy || "题型未提供";
        return `<a class="dashboard-row assessment-review-row" href="${esc(href)}"><span class="row-mark item-review-mark" aria-hidden="true"><svg><use href="#i-review"/></svg></span><span class="row-main"><strong>${esc(studentName)}</strong><small>${esc(practiceTitle)} · ${esc(strategy)}</small></span><span class="row-value">打开题目</span></a>`;
      }).join("")}`;
    }
  } else {
    countHost.textContent = "—";
    countHost.setAttribute("aria-label", "题库人工评分待复核数量尚未读取");
    setStatus(status, "题库复核队列尚未读取", "neutral");
    host.innerHTML = '<p class="unknown-note">等待题库复核队列读取。</p>';
  }
  renderActionCards();
}

function classDisplayName(item) {
  const grade = item?.grade
    ? (String(item.grade).endsWith("年级") ? item.grade : `${item.grade}年级`)
    : "年级未设置";
  return `${grade} ${item?.name || "班级名称未提供"}`;
}

function selectedClassName() {
  return classes.find((item) => item.id === selectedClassId) ? classDisplayName(classes.find((item) => item.id === selectedClassId)) : "未选择班级";
}

function studentStatusText() {
  if (studentsState.loading) return `正在读取${selectedClassName()}的学情…`;
  if (studentsState.error) return `学情读取失败：${dashboardErrorMessage(studentsState.error)}`;
  if (studentsState.updatedAt) return `${readTime(studentsState.updatedAt)} · ${selectedClassName()}`;
  return selectedClassId ? `${selectedClassName()}的学情尚未读取` : "尚未选择授权班级";
}

function renderStudents() {
  const host = $("#studentState");
  const status = $("#studentDataStatus");
  setStatus(status, studentStatusText(), studentsState.error ? "error" : studentsState.loading ? "loading" : studentsState.updatedAt ? "success" : "neutral");
  if (studentsState.loading) {
    host.innerHTML = '<p class="loading-note">正在读取所选班级的真实学生学情…</p>';
    return;
  }
  if (studentsState.error) {
    const switchLink = studentsState.error.status === 403
      ? '<a class="retry-inline" href="/select-school/">切换工作学校</a>'
      : "";
    host.innerHTML = `<p class="error-note">${esc(dashboardErrorMessage(studentsState.error))}</p>${switchLink}<button type="button" class="retry-inline" data-retry-students>重试读取本班学情</button>`;
    host.querySelector("[data-retry-students]")?.addEventListener("click", () => loadStudents(selectedClassId));
    return;
  }
  if (!studentsState.data) {
    host.innerHTML = `<p class="unknown-note">${selectedClassId ? "等待该班级学生学情读取。" : "选择本人授权班级后读取学生记录。"}</p>`;
    return;
  }
  const collection = readCollection(studentsState.data);
  if (!collection.available) {
    host.innerHTML = '<p class="error-note">服务端响应缺少学生列表；未保留其他班级的记录。</p>';
    return;
  }
  if (!collection.items.length) {
    host.innerHTML = '<p class="empty-note">该授权班级暂无学生学习记录。</p>';
    return;
  }
  const sorted = [...collection.items].sort((left, right) => {
    const leftDate = left?.lastActiveAt ? new Date(left.lastActiveAt).getTime() : 0;
    const rightDate = right?.lastActiveAt ? new Date(right.lastActiveAt).getTime() : 0;
    return rightDate - leftDate;
  });
  host.innerHTML = sorted.slice(0, 8).map((student) => {
    const name = student?.displayName || "学生姓名未提供";
    const href = studentHref(student, studentsState.classId);
    const row = `<span class="student-avatar" aria-hidden="true">${esc(name.slice(0, 1))}</span><span class="row-main"><strong>${esc(name)}</strong><small>${esc(studentActivitySummary(student))}</small></span><span class="row-value">${href ? "查看学生详情" : "学籍标识未返回"}</span>`;
    return href
      ? `<a class="dashboard-row student-row" href="${esc(href)}">${row}</a>`
      : `<div class="dashboard-row student-row student-row-invalid">${row}</div>`;
  }).join("");
}

function renderClasses() {
  const host = $("#classList");
  const select = $("#studentClassSelect");
  const status = $("#classDataStatus");
  if (classesState.loading) {
    setStatus(status, "正在读取本人授权班级…", "loading");
    host.innerHTML = '<p class="loading-note">正在读取当前学校的班级…</p>';
    select.innerHTML = '<option value="">班级加载中…</option>';
    studentsState.data = null;
    studentsState.error = null;
    studentsState.updatedAt = null;
    renderStudents();
    return;
  }
  if (classesState.error) {
    setStatus(status, `班级读取失败：${dashboardErrorMessage(classesState.error)}`, "error");
    const schoolLink = classesState.error.status === 403
      ? '<a class="retry-inline" href="/select-school/">切换工作学校</a>'
      : "";
    host.innerHTML = `<p class="error-note">本人授权班级暂不可用，学生记录已清除。</p>${schoolLink}<button class="retry-inline" type="button" data-retry-classes>重试读取班级</button>`;
    host.querySelector("[data-retry-classes]")?.addEventListener("click", () => loadClasses());
    select.innerHTML = '<option value="">班级暂不可用</option>';
    selectedClassId = "";
    studentsState.data = null;
    studentsState.error = null;
    studentsState.updatedAt = null;
    studentsState.classId = "";
    renderStudents();
    return;
  }
  if (!classesState.data) {
    setStatus(status, "班级尚未读取", "neutral");
    host.innerHTML = '<p class="unknown-note">等待本人授权班级列表读取。</p>';
    select.innerHTML = '<option value="">尚未读取</option>';
    renderStudents();
    return;
  }
  const collection = readCollection(classesState.data);
  if (!collection.available) {
    setStatus(status, "服务端响应缺少班级列表。", "error");
    host.innerHTML = '<p class="error-note">服务端未返回班级列表，未显示旧班级或旧学生记录。</p>';
    select.innerHTML = '<option value="">班级列表不可用</option>';
    return;
  }
  classes = collection.items.filter((item) => item && typeof item.id === "string" && item.id.trim());
  setStatus(status, `${readTime(classesState.updatedAt)} · ${classes.length} 个本人授权班级`, "success");
  if (!classes.length) {
    selectedClassId = "";
    host.innerHTML = '<p class="empty-note">当前教师在所选学校没有已授权班级。</p>';
    select.innerHTML = '<option value="">暂无本人授权班级</option>';
    studentsState.data = null;
    studentsState.classId = "";
    studentsState.error = null;
    studentsState.updatedAt = null;
    renderStudents();
    renderActionCards();
    return;
  }

  const cacheKey = `teacher-home-class:${currentIdentity.schoolId}:${currentUserCacheKey()}`;
  const rememberedId = sessionStorage.getItem(cacheKey);
  selectedClassId = classes.some((item) => item.id === selectedClassId)
    ? selectedClassId
    : classes.some((item) => item.id === rememberedId) ? rememberedId : classes[0].id;
  select.innerHTML = classes.map((item) => {
    const selected = item.id === selectedClassId;
    return `<option value="${esc(item.id)}" ${selected ? "selected" : ""}>${esc(classDisplayName(item))}</option>`;
  }).join("");
  host.innerHTML = classes.map((item) => {
    const selected = item.id === selectedClassId;
    const studentCount = knownCount(item.studentCount);
    const countText = studentCount === null ? "学生人数尚未读取" : `${studentCount} 名在读学生`;
    const href = classHref(item);
    const body = `<button type="button" class="class-select" data-class-id="${esc(item.id)}" aria-pressed="${selected}"><strong>${esc(classDisplayName(item))}</strong><span>${esc(countText)}</span></button>${href ? `<a href="${esc(href)}" aria-label="进入${esc(classDisplayName(item))}">进入班级 <svg aria-hidden="true"><use href="#i-arrow"/></svg></a>` : '<span class="row-issue">学校或班级标识不匹配</span>'}`;
    return `<div class="class-card ${selected ? "selected" : ""}">${body}</div>`;
  }).join("");
  host.querySelectorAll("[data-class-id]").forEach((button) => button.addEventListener("click", () => {
    selectClass(button.dataset.classId);
  }));
  select.onchange = (event) => selectClass(event.target.value);
  select.value = selectedClassId;
  renderActionCards();
}

function selectClass(classId) {
  if (!classes.some((item) => item.id === classId) || classId === selectedClassId) return;
  selectedClassId = classId;
  sessionStorage.setItem(`teacher-home-class:${currentIdentity.schoolId}:${currentUserCacheKey()}`, classId);
  studentsState.data = null;
  studentsState.error = null;
  studentsState.classId = "";
  studentsState.updatedAt = null;
  renderClasses();
  loadStudents(classId);
}

function renderIdentity() {
  const name = dashboardState.data?.greeting?.name || currentIdentity.userName || "教师";
  const schoolName = dashboardState.data?.greeting?.schoolName || "当前工作学校";
  $("#teacherGreeting").textContent = `你好，${name}老师`;
  $("#dashboardWelcome").textContent = "先处理已提交的教学任务，再查看题库人工评分待复核项目。所有数字按各服务端数据区分别读取。";
  $("#schoolName").textContent = schoolName;
  $("#todayDate").textContent = dashboardState.data?.greeting?.date || "日期由教师工作台读取";
  const priority = dashboardState.data?.priority;
  const action = $("#primaryTaskAction");
  if (action) {
    action.href = priority?.assignmentId
      ? `/teacher/assignments/?assignmentId=${encodeURIComponent(priority.assignmentId)}`
      : "/teacher/assignments/";
    const label = action.querySelector("[data-primary-action-label]");
    if (label) label.textContent = priority?.title ? `继续处理：${priority.title}` : "打开任务管理";
  }
}

function renderAll() {
  renderIdentity();
  renderDashboard();
  renderAssessmentQueue();
  renderClasses();
}

async function loadDashboard(context = identitySnapshot()) {
  if (!context.token || !context.schoolId) {
    syncIdentity();
    showIdentityFailure();
    return;
  }
  const version = ++requestVersion.dashboard;
  dashboardState.loading = true;
  dashboardState.data = null;
  dashboardState.error = null;
  dashboardState.updatedAt = null;
  renderAll();
  updateGlobalState();
  try {
    const response = await window.YuzanApi.getDashboard();
    if (version !== requestVersion.dashboard || !isCurrentContext(context)) return;
    if (!response || typeof response !== "object" || Array.isArray(response)) {
      throw new Error("教师仪表盘响应格式无效");
    }
    dashboardState.data = response;
    dashboardState.updatedAt = Date.now();
  } catch (error) {
    if (version !== requestVersion.dashboard || !isCurrentContext(context)) return;
    dashboardState.error = error;
  } finally {
    if (version === requestVersion.dashboard && isCurrentContext(context)) {
      dashboardState.loading = false;
      renderAll();
      updateGlobalState();
    }
  }
}

async function loadClasses(context = identitySnapshot()) {
  if (!context.token || !context.schoolId) {
    syncIdentity();
    showIdentityFailure();
    return;
  }
  const version = ++requestVersion.classes;
  classesState.loading = true;
  classesState.data = null;
  classesState.error = null;
  classesState.updatedAt = null;
  classes = [];
  selectedClassId = "";
  studentsState.data = null;
  studentsState.error = null;
  studentsState.updatedAt = null;
  studentsState.classId = "";
  requestVersion.students += 1;
  renderClasses();
  renderActionCards();
  updateGlobalState();
  try {
    const response = await window.YuzanApi.listClasses({ limit: 100 });
    if (version !== requestVersion.classes || !isCurrentContext(context)) return;
    const collection = readCollection(response);
    if (!collection.available) throw new Error("班级接口响应缺少本人授权列表");
    classesState.data = response;
    classesState.updatedAt = Date.now();
  } catch (error) {
    if (version !== requestVersion.classes || !isCurrentContext(context)) return;
    classesState.error = error;
  } finally {
    if (version === requestVersion.classes && isCurrentContext(context)) {
      classesState.loading = false;
      renderClasses();
      renderActionCards();
      if (!classesState.error && selectedClassId) {
        sessionStorage.setItem(`teacher-home-class:${currentIdentity.schoolId}:${currentUserCacheKey()}`, selectedClassId);
        loadStudents(selectedClassId, context);
      }
      updateGlobalState();
    }
  }
}

async function loadStudents(classId, context = identitySnapshot()) {
  const version = ++requestVersion.students;
  studentsState.loading = true;
  studentsState.data = null;
  studentsState.error = null;
  studentsState.classId = classId;
  studentsState.updatedAt = null;
  renderStudents();
  if (!classId || !context.token || !context.schoolId) {
    studentsState.loading = false;
    renderStudents();
    return;
  }
  updateGlobalState();
  try {
    const response = await window.YuzanApi.getClassStudentSummaries(classId);
    if (version !== requestVersion.students || selectedClassId !== classId || !isCurrentContext(context)) return;
    const collection = readCollection(response);
    if (!collection.available) throw new Error("学情接口响应缺少学生列表");
    studentsState.data = response;
    studentsState.updatedAt = Date.now();
  } catch (error) {
    if (version !== requestVersion.students || selectedClassId !== classId || !isCurrentContext(context)) return;
    studentsState.error = error;
  } finally {
    if (version === requestVersion.students && selectedClassId === classId && isCurrentContext(context)) {
      studentsState.loading = false;
      renderStudents();
      updateGlobalState();
    }
  }
}

async function loadQueue(context = identitySnapshot()) {
  if (!context.token || !context.schoolId) {
    syncIdentity();
    showIdentityFailure();
    return;
  }
  const version = ++requestVersion.queue;
  queueState.loading = true;
  queueState.data = null;
  queueState.error = null;
  queueState.updatedAt = null;
  renderAssessmentQueue();
  updateGlobalState();
  try {
    const response = await window.YuzanApi.getAssessmentReviewQueue();
    if (version !== requestVersion.queue || !isCurrentContext(context)) return;
    queueState.data = assessmentReviewQueue(response);
    queueState.updatedAt = Date.now();
  } catch (error) {
    if (version !== requestVersion.queue || !isCurrentContext(context)) return;
    queueState.error = error;
  } finally {
    if (version === requestVersion.queue && isCurrentContext(context)) {
      queueState.loading = false;
      renderAssessmentQueue();
      updateGlobalState();
    }
  }
}

function loadAll(context = identitySnapshot()) {
  if (!context.token || !context.schoolId) {
    showIdentityFailure();
    renderAll();
    return;
  }
  void loadDashboard(context);
  void loadClasses(context);
  void loadQueue(context);
}

refreshButton?.addEventListener("click", () => loadAll(identitySnapshot()));
window.addEventListener("storage", syncIdentity);
window.addEventListener("focus", syncIdentity);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") syncIdentity();
});
observeApiIdentityMutations();
loadAll(identitySnapshot());
