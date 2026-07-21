(() => {
  'use strict';

  const toast = document.getElementById("toast");
  const drawerBackdrop = document.getElementById("drawerBackdrop");
  const drawerTitle = document.getElementById("drawerTitle");
  const drawerText = document.getElementById("drawerText");
  const drawerData = document.getElementById("drawerData");
  let toastTimer;
  let classId = '';
  let schoolId = '';
  let classDetail = null;

  function getClassIdFromPath() {
    // /teacher/classes/:classId — 3rd segment
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length >= 3 && parts[0] === 'teacher' && parts[1] === 'classes') {
      return parts[2];
    }
    return '';
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function openDrawer(key) {
    const name = classDetail?.className || classDetail?.name || '未命名班级';
    const count = classDetail?.studentCount ?? '—';
    const data = {
      settings: ["班级设置", "管理班级基本信息、授课教师与学生可见范围。当前版本仅可查看。", `班级：${name}<br>学生人数：${count} 人<br>当前状态：在学`],
    };
    const item = data[key] || ["操作详情", "该功能暂未开通。", ""];
    drawerTitle.textContent = item[0];
    drawerText.textContent = item[1];
    drawerData.innerHTML = item[2];
    drawerBackdrop.hidden = false;
    document.body.style.overflow = "hidden";
    drawerBackdrop.dataset.type = key;
  }

  function closeDrawer() {
    drawerBackdrop.hidden = true;
    document.body.style.overflow = "";
  }

  // ── data-action 按钮分类 ──
  // LIVE_ROUTE: course → /teacher/courses/, assessment → /teacher/assessments/create
  // UNSUPPORTED: export, analysis, practice, group, volunteer, report
  const actionRoutes = {
    course: '/teacher/courses/',
    assessment: '/teacher/assessments/create',
  };
  const actionUnsupported = {
    export: '导出班级报表功能暂未开通',
    analysis: '问题分析详情功能暂未开通',
    practice: '布置补充练习功能暂未开通',
    group: '创建小组任务功能暂未开通',
    volunteer: '志愿者协作功能暂未开通',
    report: '班级学情报告功能暂未开通',
  };

  document.querySelectorAll("[data-action]").forEach(btn => {
    const action = btn.dataset.action;
    if (actionRoutes[action]) {
      btn.addEventListener("click", () => { location.href = actionRoutes[action]; });
    } else if (action === 'settings') {
      btn.addEventListener("click", () => openDrawer('settings'));
    } else if (actionUnsupported[action]) {
      btn.disabled = true;
      btn.title = actionUnsupported[action];
      btn.style.opacity = '.55';
      btn.style.cursor = 'not-allowed';
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        showToast(actionUnsupported[action]);
      });
    }
  });

  // ── LIVE_LOCAL: 阶段卡片选择 ──
  document.querySelectorAll(".stage-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".stage-card").forEach(x => x.classList.remove("selected"));
      card.classList.add("selected");
    });
  });

  // ── LIVE_LOCAL: 问题类型 Tab ──
  let pronunciationRows = [];
  let writingRows = [];

  function renderIssues(rows) {
    const table = document.getElementById("issueTable");
    if (!table) return;
    if (rows.length === 0) {
      table.innerHTML = '<div style="padding:16px;color:#888;text-align:center">数据不足，暂无问题分析</div>';
      return;
    }
    table.innerHTML =
      '<div class="issue-row header"><span></span><b>问题</b><b>出现次数</b><b>涉及学生</b></div>' +
      rows.map(r => `<div class="issue-row"><span>${r[0]}</span><b>${r[1]}</b><em>${r[2]} 次</em><em>${r[3]} 人</em></div>`).join("");
  }

  document.querySelectorAll("[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-tab]").forEach(x => x.classList.toggle("selected", x === btn));
      renderIssues(btn.dataset.tab === "writing" ? writingRows : pronunciationRows);
    });
  });

  // ── LIVE_LOCAL: 日期范围选择器 ──
  const dateBtn = document.getElementById("dateRangeBtn");
  const pop = document.getElementById("datePopover");
  if (dateBtn && pop) {
    dateBtn.addEventListener("click", e => {
      e.stopPropagation();
      pop.hidden = !pop.hidden;
    });
    pop.addEventListener("click", e => e.stopPropagation());
    document.addEventListener("click", () => pop.hidden = true);
    document.getElementById("applyDate").addEventListener("click", () => {
      const s = document.getElementById("startDate").value;
      const e = document.getElementById("endDate").value;
      document.getElementById("dateRangeText").textContent = `${s} ~ ${e}`;
      pop.hidden = true;
      showToast("数据时间范围已更新");
    });
  }

  // ── UNSUPPORTED: 侧栏无对应页面的链接 ──
  document.querySelectorAll("[data-unsupported]").forEach(el => {
    el.style.opacity = '.55';
    el.style.cursor = 'not-allowed';
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showToast(el.dataset.unsupported || "该功能暂未开通");
    });
  });

  // ── Drawer 控件 ──
  document.getElementById("drawerClose").addEventListener("click", closeDrawer);
  drawerBackdrop.addEventListener("click", e => { if (e.target === drawerBackdrop) closeDrawer(); });
  document.getElementById("drawerConfirm").addEventListener("click", () => {
    closeDrawer();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeDrawer(); if (pop) pop.hidden = true; }
  });

  // ── API: 加载真实班级详情 ──
  function applyClassDetail(detail) {
    classDetail = detail;
    // 更新页面标题
    const name = detail.className || detail.name || '未命名班级';
    document.title = `${name}｜语赞心声`;

    // 更新侧栏"学生"链接 — 使用真实classId
    const navStudentsLink = document.getElementById('navStudentsLink');
    if (navStudentsLink && classId) {
      navStudentsLink.href = `/teacher/classes/${classId}#students`;
    }

    // 更新面包屑和标题
    const crumbs = document.querySelector('.crumbs');
    if (crumbs) {
      const classBread = crumbs.querySelector('b');
      if (classBread) classBread.textContent = name;
    }
    const h1 = document.querySelector('.class-title h1');
    if (h1) h1.innerHTML = `${name} <span>在学</span>`;

    // 更新班级描述
    const desc = document.querySelector('.class-title p');
    if (desc) desc.innerHTML = `${detail.schoolName || '学校'} <i></i> 班级编号：${detail.classId?.slice(0,12) || '—'} <i></i> 学生人数：${detail.studentCount ?? '—'} 人 <i></i> 教师：${detail.teacherName || '—'}`;

    // 更新当前课程
    if (detail.currentCourse) {
      const courseH2 = document.querySelector('.course-copy h2');
      if (courseH2) courseH2.innerHTML = `${detail.currentCourse.title || '—'} <span>进行中</span>`;
    }

    // 更新整体进度
    const progressStr = `${detail.overallProgress ?? 0}`;
    const progressB = document.querySelector('.metric.progress strong');
    if (progressB) progressB.textContent = progressStr + '%';
    const progressBar = document.querySelector('.metric.progress i b');
    if (progressBar) progressBar.style.width = progressStr + '%';

    // 更新待批改
    const pendingEl = document.querySelector('.class-title [data-pending]');
    if (pendingEl && detail.pendingReviewCount !== undefined) {
      pendingEl.textContent = `待批改：${detail.pendingReviewCount}`;
    }

    // 更新成长路径阶段
    if (detail.stages && detail.stages.length > 0) {
      const stageCards = document.querySelectorAll('.stage-card');
      detail.stages.forEach((stage, i) => {
        if (!stageCards[i]) return;
        const strong = stageCards[i].querySelector('strong');
        if (strong) strong.textContent = stage.title;
        const ps = stageCards[i].querySelectorAll('p');
        if (ps[0]) ps[0].textContent = `完成率 ${Math.round((stage.completionRate ?? 0) * 100)}%`;
        if (ps[1]) ps[1].textContent = `${stage.participantCount ?? 0} / ${stage.totalCount ?? 0}`;
      });
    }

    // 更新发音问题
    if (detail.pronunciationClusters && detail.pronunciationClusters.length > 0) {
      pronunciationRows = detail.pronunciationClusters.map((item, i) => [
        String(i + 1), item.label || item.type, String(item.occurrenceCount ?? item.affectedCount ?? 0), String(item.affectedStudentCount ?? item.affectedCount ?? 0)
      ]);
      renderIssues(pronunciationRows);
    } else {
      pronunciationRows = [];
      renderIssues([]);
    }
  }

  async function loadClassDetail() {
    if (!classId) {
      showToast('缺少班级标识，无法加载');
      return;
    }
    if (typeof YuzanApi === 'undefined' || !YuzanApi.getToken()) {
      showToast('请先登录');
      location.href = '/login';
      return;
    }
    schoolId = YuzanApi.getActiveSchoolId();
    if (!schoolId) {
      showToast('请先选择学校');
      location.href = '/select-school';
      return;
    }
    try {
      const detail = await YuzanApi.request(`/schools/${schoolId}/classes/${classId}/detail`);
      applyClassDetail(detail);
    } catch (err) {
      showToast(err.message || '加载班级详情失败');
    }
    // 并行加载pending-stats
    try {
      const stats = await YuzanApi.request(`/schools/${schoolId}/classes/${classId}/pending-stats`);
      if (stats) {
        const overviewCard = document.querySelector('.overview-card');
        if (overviewCard) {
          const metrics = overviewCard.querySelectorAll('.overview-metric');
          if (metrics[0]) metrics[0].querySelector('strong').textContent = `${stats.pendingReviewCount ?? 0}`;
        }
      }
    } catch (_) { /* 非关键，忽略 */ }
  }

  classId = getClassIdFromPath();
  loadClassDetail();
})();