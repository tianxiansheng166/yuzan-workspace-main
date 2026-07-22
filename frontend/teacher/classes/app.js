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
    if (classId) {
      location.href = `/teacher/classes/${classId}`;
    } else {
      showToast("班级标识缺失，无法进入");
    }
  });
  listTbody?.addEventListener("click", (event) => {
    const btn = event.target.closest('[data-action="enter"]');
    if (!btn) return;
    const classId = btn.dataset.classId;
    if (classId) {
      location.href = `/teacher/classes/${classId}`;
    } else {
      showToast("班级标识缺失，无法进入");
    }
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
  const STATE_MAP = { true: 'done', false: 'pending' };

  function renderClassCards(items) {
    // 移除旧的硬编码卡片和创建空按钮
    mapView.querySelectorAll(".class-card, .create-empty").forEach(el => el.remove());

    const createBtn = document.querySelector('[data-action="create"]'); // 保留创建按钮逻辑
    items.forEach((cls, i) => {
      const color = CARD_COLORS[i % CARD_COLORS.length];
      const progress = cls.overallProgress ?? cls.completionRate ?? 0;
      const coverage = cls.submissionRate ?? cls.assessmentRate ?? 0;
      const grade = cls.grade || '';
      const card = document.createElement("article");
      card.className = `class-card ${color}-card`;
      card.dataset.grade = grade;
      card.dataset.classId = cls.classId || cls.id;
      card.tabIndex = 0;
      if (i === 0) card.classList.add("selected-card");
      card.innerHTML = `
        <span class="class-book ${color}">▮</span>
        <div class="card-top"><span class="grade ${color}-bg">${grade}</span><button class="state-dot ${STATE_MAP[progress > 50]} ${color === 'green' ? 'green-dot' : ''} ${color === 'blue' ? 'blue-dot' : ''}">${progress > 50 ? '✓' : ''}</button></div>
        <h3>${cls.name || cls.className || '未命名班级'}</h3>
        <p>学生 ${cls.studentCount ?? 0} 人 <i></i> ${cls.teacherName || '—'}　${cls.subject || '语文'}</p>
        <hr />
        <div class="metrics"><span>学习进度 <b>${progress}%</b></span><span>覆盖率 <b class="${coverage >= 70 ? 'green-text' : color + '-text'}">${coverage}%</b></span></div>
        <div class="bar"><i style="width:${progress}%;background:var(--${color}-bar, #7a838a)"></i></div>
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

    // 重新添加创建空按钮
    const createEmpty = document.createElement("button");
    createEmpty.className = "create-empty";
    createEmpty.dataset.action = "create";
    createEmpty.style.left = "68%";
    createEmpty.style.top = "82%";
    createEmpty.innerHTML = '<span class="briefcase"><svg viewBox="0 0 32 32"><path d="M5 10h22v17H5zM11 10V6h10v4M12 17h8"/></svg></span><span><strong>创建新班级</strong><small>开启新的教学旅程</small></span>';
    mapView.appendChild(createEmpty);
    // 绑定创建按钮的UNSUPPORTED逻辑
    createEmpty.disabled = true;
    createEmpty.title = "创建班级功能暂未开通，请联系管理员";
    createEmpty.style.opacity = ".55";
    createEmpty.style.cursor = "not-allowed";
    createEmpty.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); showToast("创建班级功能暂未开通，请联系管理员"); });
  }

  function renderListTable(items) {
    if (!listTbody) return;
    listTbody.innerHTML = items.map(cls => {
      const progress = cls.overallProgress ?? cls.completionRate ?? 0;
      const coverage = cls.submissionRate ?? cls.assessmentRate ?? 0;
      return `<tr><td>${cls.name || cls.className || '未命名班级'}</td><td>${cls.grade || ''}</td><td>${cls.studentCount ?? 0}</td><td>${cls.teacherName || '—'}</td><td>${progress}%</td><td>${coverage}%</td><td><button data-action="enter" data-class-id="${cls.classId || cls.id}">进入班级</button></td></tr>`;
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
      // 回退：保留静态卡片，但给它们添加通用classId提示
      mapView.querySelectorAll(".class-card").forEach(card => {
        if (!card.dataset.classId) card.dataset.classId = '';
      });
    }
  }

  loadClasses();
})();
