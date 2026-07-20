(() => {
  'use strict';

  const mapView = document.querySelector("#mapView");
  const listView = document.querySelector("#listView");
  const viewButtons = [...document.querySelectorAll("[data-view]")];
  const gradeFilter = document.querySelector("#gradeFilter");
  const classCards = [...document.querySelectorAll(".class-card")];
  const modalBackdrop = document.querySelector("#modalBackdrop");
  const modalTitle = document.querySelector("#modalTitle");
  const modalText = document.querySelector("#modalText");
  const modalMark = document.querySelector("#modalMark");
  const toast = document.querySelector("#toast");
  let toastTimer;

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function openModal(type) {
    const data = {
      guide: ["班级学习路径指南", "通过课程、任务、测评和复盘四个阶段组织班级教学进度。", "⌁"],
    };
    const [title, text, mark] = data[type] || ["操作详情", "该功能暂未开通。", "!"];
    modalTitle.textContent = title;
    modalText.textContent = text;
    modalMark.textContent = mark;
    modalBackdrop.hidden = false;
    document.body.style.overflow = "hidden";
    modalBackdrop.dataset.type = type;
  }

  function closeModal() {
    modalBackdrop.hidden = true;
    document.body.style.overflow = "";
  }

  // ── LIVE_LOCAL: 视图切换（地图/列表） ──
  viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      viewButtons.forEach((item) => item.classList.toggle("active", item === button));
      mapView.hidden = view !== "map";
      listView.hidden = view !== "list";
      showToast(view === "map" ? "已切换到地图视图" : "已切换到列表视图");
    });
  });

  // ── LIVE_LOCAL: 年级筛选 ──
  gradeFilter.addEventListener("change", () => {
    const grade = gradeFilter.value;
    classCards.forEach((card) => {
      card.hidden = grade !== "all" && card.dataset.grade !== grade;
    });
  });

  // ── LIVE_LOCAL: 选中班级卡片 ──
  classCards.forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      classCards.forEach((item) => item.classList.remove("selected-card"));
      card.classList.add("selected-card");
    });
  });

  // ── LIVE_ROUTE: 进入班级 → 跳转班级详情 ──
  document.querySelectorAll('[data-action="enter"]').forEach((button) => {
    button.addEventListener("click", () => {
      location.href = "/teacher/classes/detail/";
    });
  });

  // ── UNSUPPORTED: 创建班级（后端无教师自建班级API） ──
  document.querySelectorAll('[data-action="create"]').forEach((button) => {
    button.disabled = true;
    button.title = "创建班级功能暂未开通，请联系管理员";
    button.style.opacity = ".55";
    button.style.cursor = "not-allowed";
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showToast("创建班级功能暂未开通，请联系管理员");
    });
  });

  // ── UNSUPPORTED: 导入学生 ──
  document.querySelectorAll('[data-action="import"]').forEach((button) => {
    button.disabled = true;
    button.title = "导入学生功能暂未开通";
    button.style.opacity = ".55";
    button.style.cursor = "not-allowed";
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showToast("导入学生功能暂未开通");
    });
  });

  // ── LIVE_LOCAL: 查看指南 → 弹窗 ──
  document.querySelectorAll('[data-action="guide"]').forEach((button) => {
    button.addEventListener("click", () => openModal("guide"));
  });

  // ── LIVE_ROUTE / UNSUPPORTED: 快捷操作 ──
  document.querySelectorAll('[data-action="task"]').forEach((button) => {
    button.addEventListener("click", () => { location.href = "/teacher/assignments"; });
  });
  document.querySelectorAll('[data-action="assessment"]').forEach((button) => {
    button.addEventListener("click", () => { location.href = "/teacher/assessments/create"; });
  });
  document.querySelectorAll('[data-action="analytics"]').forEach((button) => {
    button.addEventListener("click", () => { location.href = "/teacher/assessments/detail/"; });
  });
  document.querySelectorAll('[data-action="resource"]').forEach((button) => {
    button.disabled = true;
    button.title = "资源中心功能暂未开通";
    button.style.opacity = ".55";
    button.style.cursor = "not-allowed";
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showToast("资源中心功能暂未开通");
    });
  });

  // ── UNSUPPORTED: 侧栏无对应页面的链接 ──
  document.querySelectorAll("[data-unsupported]").forEach((el) => {
    el.style.opacity = ".55";
    el.style.cursor = "not-allowed";
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showToast(el.dataset.unsupported || "该功能暂未开通");
    });
  });

  // ── UNSUPPORTED: 日历导航和今日安排 ──
  document.querySelectorAll(".calendar-card button, .schedule-card button").forEach((button) => {
    const txt = button.textContent.trim();
    if (txt === "‹" || txt === "›") {
      // LIVE_LOCAL: 月份前后翻页
      button.addEventListener("click", () => showToast("日历翻页功能暂未开通"));
    } else if (txt.includes("查看全部") || txt.includes("›")) {
      button.addEventListener("click", () => showToast("日程详情功能暂未开通"));
    }
  });

  // ── UNSUPPORTED: 待处理事项按钮 ──
  document.querySelectorAll(".todo-card button").forEach((button) => {
    button.addEventListener("click", () => showToast("待处理事项功能暂未开通"));
  });

  // ── LIVE_LOCAL: Modal 控件 ──
  document.querySelector("#modalClose").addEventListener("click", closeModal);
  document.querySelector("#modalCancel").addEventListener("click", closeModal);
  document.querySelector("#modalConfirm").addEventListener("click", () => {
    closeModal();
  });

  modalBackdrop.addEventListener("click", (event) => {
    if (event.target === modalBackdrop) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modalBackdrop.hidden) closeModal();
  });
})();
