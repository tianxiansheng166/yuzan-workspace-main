(() => {
  'use strict';

  const mapView = document.querySelector("#mapView");
  const listView = document.querySelector("#listView");
  const viewButtons = [...document.querySelectorAll("[data-view]")];
  const gradeFilter = document.querySelector("#gradeFilter");
  const modalBackdrop = document.querySelector("#modalBackdrop");
  const modalTitle = document.querySelector("#modalTitle");
  const modalText = document.querySelector("#modalText");
  const modalMark = document.querySelector("#modalMark");
  const toast = document.querySelector("#toast");
  const classCountEl = document.querySelector(".page-heading p");
  const listTbody = document.querySelector("#listView tbody");
  let toastTimer;
  let classes = [];
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function openClass(classId) {
    if (!classId) {
      showToast("班级标识缺失，无法进入");
      return;
    }
    const schoolId = typeof YuzanApi !== "undefined" ? YuzanApi.getActiveSchoolId() : "";
    const query = schoolId ? `?schoolId=${encodeURIComponent(schoolId)}` : "";
    location.href = `/teacher/classes/${encodeURIComponent(classId)}${query}`;
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
    const cards = mapView.querySelectorAll(".class-card");
    cards.forEach((card) => {
      card.hidden = grade !== "all" && card.dataset.grade !== grade;
    });
  });

  // ── LIVE_LOCAL: 选中班级卡片 ──
  mapView.addEventListener("click", (event) => {
    const card = event.target.closest(".class-card");
    if (!card || event.target.closest("button")) return;
    mapView.querySelectorAll(".class-card").forEach((item) => item.classList.remove("selected-card"));
    card.classList.add("selected-card");
  });

  // ── LIVE_ROUTE: 进入班级 → 使用真实classId跳转 ──
  mapView.addEventListener("click", (event) => {
    const btn = event.target.closest('[data-action="enter"]');
    if (!btn) return;
    const card = btn.closest(".class-card");
    const classId = card?.dataset?.classId;
    openClass(classId);
  });
  listTbody?.addEventListener("click", (event) => {
    const btn = event.target.closest('[data-action="enter"]');
    if (!btn) return;
    const classId = btn.dataset.classId;
    openClass(classId);
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

  // ── API: 加载真实班级列表 ──
  const CARD_COLORS = ['red', 'orange', 'green', 'blue', 'gray'];

  function renderClassCards(items) {
    // 移除旧的硬编码卡片和创建空按钮
    mapView.querySelectorAll(".class-card, .create-empty, .class-loading").forEach(el => el.remove());

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'class-empty-state';
      empty.textContent = '当前账号暂无已授权班级。';
      mapView.appendChild(empty);
      return;
    }
    items.forEach((cls, i) => {
      const color = CARD_COLORS[i % CARD_COLORS.length];
      const grade = cls.grade || '';
      const gradeLabel = grade ? (grade.endsWith('年级') ? grade : `${grade}年级`) : '年级未设置';
      const card = document.createElement("article");
      card.className = `class-card ${color}-card`;
      card.dataset.grade = grade;
      card.dataset.classId = cls.id;
      card.tabIndex = 0;
      if (i === 0) card.classList.add("selected-card");
      card.innerHTML = `
        <span class="class-book ${color}">▮</span>
        <div class="card-top"><span class="grade ${color}-bg">${escapeHtml(gradeLabel)}</span></div>
        <h3>${escapeHtml(cls.name || '未命名班级')}</h3>
        <p>在读学生 ${Number(cls.studentCount) || 0} 人</p>
        <hr />
        <div class="metrics"><span>授权班级数据</span><b>来自当前教师账号</b></div>
        <button class="enter-card" data-action="enter">进入班级</button>
      `;
      // 设置位置（沿学习路径分散）
      const positions = [
        { left: '11%', top: '10%' }, { left: '54%', top: '22%' },
        { left: '13%', top: '47%' }, { left: '63%', top: '56%' }, { left: '19%', top: '76%' },
      ];
      const pos = positions[i % positions.length];
      card.style.left = pos.left;
      card.style.top = pos.top;
      mapView.appendChild(card);
    });

  }

  function renderListTable(items) {
    if (!listTbody) return;
    if (!items.length) {
      listTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px">当前账号暂无已授权班级。</td></tr>';
      return;
    }
    listTbody.innerHTML = items.map(cls => {
      return `<tr><td>${escapeHtml(cls.name || '未命名班级')}</td><td>${escapeHtml(cls.grade || '—')}</td><td>${Number(cls.studentCount) || 0}</td><td><button data-action="enter" data-class-id="${escapeHtml(cls.id)}">进入班级</button></td></tr>`;
    }).join('');
  }

  function updateGradeFilter(items) {
    const grades = [...new Set(items.map(c => c.grade).filter(Boolean))];
    const current = gradeFilter.value;
    // 保留"全部年级"选项，替换其余
    gradeFilter.innerHTML = '<option value="all">全部年级</option>' +
      grades.map(g => `<option value="${g}">${g}年级</option>`).join('');
    if (current && grades.includes(current)) gradeFilter.value = current;
  }

  async function loadClasses() {
    if (typeof YuzanApi === 'undefined' || !YuzanApi.getToken()) {
      showToast('请先登录');
      location.href = '/login';
      return;
    }
    const schoolId = YuzanApi.getActiveSchoolId();
    if (!schoolId) {
      showToast('请先选择学校');
      location.href = '/select-school';
      return;
    }
    try {
      const data = await YuzanApi.request(`/schools/${schoolId}/classes/teachers/me?limit=50`);
      const items = data?.items || data || [];
      classes = items;
      if (classCountEl) classCountEl.textContent = `共 ${items.length} 个班级`;
      renderClassCards(items);
      renderListTable(items);
      updateGradeFilter(items);
    } catch (err) {
      showToast(err.message || '加载班级列表失败');
      classes = [];
      mapView.querySelectorAll(".class-card, .create-empty, .class-loading").forEach(el => el.remove());
      const error = document.createElement('div');
      error.className = 'class-empty-state';
      error.textContent = err.status === 403 ? '当前账号无权读取此学校的班级。请切换学校或联系管理员。' : `${err.message || '班级数据加载失败'}。请刷新后重试。`;
      mapView.appendChild(error);
      if (classCountEl) classCountEl.textContent = '班级数据暂不可用';
      if (listTbody) listTbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px">${escapeHtml(error.textContent)}</td></tr>`;
    }
  }

  loadClasses();
})();
