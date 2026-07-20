(() => {
  'use strict';

  const toast = document.getElementById("toast");
  const drawerBackdrop = document.getElementById("drawerBackdrop");
  const drawerTitle = document.getElementById("drawerTitle");
  const drawerText = document.getElementById("drawerText");
  const drawerData = document.getElementById("drawerData");
  let toastTimer;

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function openDrawer(key) {
    const data = {
      settings: ["班级设置", "管理班级基本信息、授课教师与学生可见范围。当前版本仅可查看。", "班级：五年级二班<br>学生人数：42 人<br>当前状态：在学"],
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
  const pronunciationRows = [
    ["1","zh / z / j","48 次","22 人"],["2","n / l","36 次","18 人"],["3","ang / eng","29 次","14 人"],["4","前鼻音（an/en/in/un）","24 次","12 人"],["5","平舌音 / 翘舌音","19 次","9 人"]
  ];
  const writingRows = [
    ["1","偏旁位置不稳","31 次","16 人"],["2","形近字混淆","26 次","13 人"],["3","标点使用不当","22 次","11 人"],["4","笔画顺序错误","18 次","9 人"],["5","段落衔接不足","15 次","8 人"]
  ];

  function renderIssues(rows) {
    document.getElementById("issueTable").innerHTML =
      '<div class="issue-row header"><span></span><b>问题</b><b>出现次数</b><b>涉及学生</b></div>' +
      rows.map(r => `<div class="issue-row"><span>${r[0]}</span><b>${r[1]}</b><em>${r[2]}</em><em>${r[3]}</em></div>`).join("");
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
})();