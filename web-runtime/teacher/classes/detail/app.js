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
  // LIVE_ROUTE: course → /teacher/courses/
  // LIVE_API: practice → POST supplementary-practice, assessment → POST class assessments
  // UNSUPPORTED: export, analysis, group, volunteer, report
  const actionRoutes = {
    course: '/teacher/courses/',
  };
  const actionUnsupported = {
    export: '导出班级报表功能暂未开通',
    analysis: '问题分析详情功能暂未开通',
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
    } else if (action === 'practice') {
      btn.addEventListener("click", async () => {
        if (!schoolId || !classId || typeof YuzanApi === 'undefined') { showToast('请先登录'); return; }
        btn.disabled = true; btn.textContent = '布置中...';
        try {
          await YuzanApi.request(`/schools/${schoolId}/classes/${classId}/supplementary-practice`, {
            method: 'POST', body: JSON.stringify({ title: '补充练习', description: '基于班级学情自动推送' }),
          });
          showToast('补充练习已布置');
        } catch (err) { showToast(err.message || '布置失败'); }
        finally { btn.disabled = false; btn.textContent = '去布置'; }
      });
    } else if (action === 'assessment') {
      btn.addEventListener("click", async () => {
        if (!schoolId || !classId || typeof YuzanApi === 'undefined') { showToast('请先登录'); return; }
        btn.disabled = true; btn.textContent = '创建中...';
        try {
          await YuzanApi.request(`/schools/${schoolId}/classes/${classId}/assessments`, {
            method: 'POST', body: JSON.stringify({ type: 'FORMATIVE' }),
          });
          showToast('阶段测评已发起');
        } catch (err) { showToast(err.message || '发起失败'); }
        finally { btn.disabled = false; btn.textContent = '去测评'; }
      });
    } else if (action === 'assign-selected') {
      btn.addEventListener("click", async () => {
        if (!schoolId || !classId || typeof YuzanApi === 'undefined') { showToast('请先登录'); return; }
        // 收集勾选的学生 enrollmentId
        const checked = document.querySelectorAll('.roster-row input[type=checkbox]:checked');
        const enrollmentIds = [...checked].map(c => c.closest('.roster-row')?.dataset.enrollmentId).filter(Boolean);
        if (enrollmentIds.length === 0) { showToast('请先在学生名单中勾选学生'); return; }
        btn.disabled = true; btn.textContent = '布置中...';
        try {
          await YuzanApi.request(`/schools/${schoolId}/classes/${classId}/supplementary-practice`, {
            method: 'POST', body: JSON.stringify({ title: '定向补充练习', description: `为${enrollmentIds.length}名学生推送`, targetEnrollmentIds: enrollmentIds }),
          });
          showToast(`已为${enrollmentIds.length}名学生布置补充练习`);
        } catch (err) { showToast(err.message || '布置失败'); }
        finally { btn.disabled = false; btn.textContent = '去布置'; }
      });
    } else if (action === 'pending-reviews') {
      btn.addEventListener("click", () => { location.href = '/teacher/reviews/'; });
    } else if (action === 'save-plan') {
      btn.addEventListener("click", async () => {
        if (!schoolId || !classId || typeof YuzanApi === 'undefined') { showToast('请先登录'); return; }
        // 为所有风险学生保存学习计划
        const riskRows = document.querySelectorAll('.roster-row[data-risk="AT_RISK"],.roster-row[data-risk="INACTIVE"]');
        const enrollmentIds = [...riskRows].map(r => r.dataset.enrollmentId).filter(Boolean);
        if (enrollmentIds.length === 0) { showToast('当前无风险学生需要保存计划'); return; }
        btn.disabled = true; btn.textContent = '保存中...';
        let saved = 0;
        for (const eid of enrollmentIds) {
          try {
            await YuzanApi.request(`/schools/${schoolId}/reports/${eid}/learning-plan`, {
              method: 'POST', body: JSON.stringify({ goals: ['加强薄弱知识点练习', '提升课堂参与度'], strategies: ['每日5分钟专项练习', '增加口语表达机会'] }),
            });
            saved++;
          } catch (_) { /* skip individual failures */ }
        }
        showToast(`已为${saved}名学生保存学习计划`);
        btn.disabled = false; btn.textContent = '保存';
      });
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

    // 更新概览指标：任务完成率、测评参与率、风险学生数
    const overviewMetrics = document.querySelectorAll('.overview-card .overview-metric');
    if (detail.submissionRate !== undefined && overviewMetrics[1]) {
      overviewMetrics[1].querySelector('strong').textContent = `${Math.round(detail.submissionRate * 100)}%`;
    }
    if (detail.assessmentParticipationRate !== undefined && overviewMetrics[3]) {
      overviewMetrics[3].querySelector('strong').textContent = `${Math.round(detail.assessmentParticipationRate * 100)}%`;
    }
    if (detail.atRiskStudentCount !== undefined) {
      const riskEl = document.getElementById('atRiskBadge');
      if (riskEl) riskEl.textContent = `${detail.atRiskStudentCount} 人需关注`;
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
      const detail = await YuzanApi.request(`/schools/${schoolId}/classes/${classId}/dashboard`);
      applyClassDetail(detail);
    } catch (err) {
      showToast(err.message || '加载班级详情失败');
    }
    // 并行加载 student-summaries、assignment-summaries、assessment-summaries
    const basePath = `/schools/${schoolId}/classes/${classId}`;
    const [studentRes, assignmentRes, assessmentRes] = await Promise.allSettled([
      YuzanApi.request(`${basePath}/student-summaries`),
      YuzanApi.request(`${basePath}/assignment-summaries`),
      YuzanApi.request(`${basePath}/assessment-summaries`),
    ]);
    if (studentRes.status === 'fulfilled') renderStudentRoster(studentRes.value);
    else renderStudentRoster(null);
    if (assignmentRes.status === 'fulfilled') renderAssignmentList(assignmentRes.value);
    else renderAssignmentList(null);
    if (assessmentRes.status === 'fulfilled') renderAssessmentList(assessmentRes.value);
    else renderAssessmentList(null);
    renderPendingItems(classDetail);
  }

  // ── 渲染：学生名单 ──
  function renderStudentRoster(summaries) {
    const table = document.getElementById('rosterTable');
    if (!table) return;
    if (!summaries || !Array.isArray(summaries) || summaries.length === 0) {
      table.innerHTML = '<div class="empty-hint">数据不足，暂无相关信息</div>';
      return;
    }
    const header = '<div class="roster-row header"><b><input type="checkbox" id="checkAll" title="全选"></b><b>姓名</b><b>课程进度</b><b>已提交/未交</b><b>最新测评</b><b>得分</b><b>录音数</b><b>主要问题</b><b>最近活跃</b><b>风险状态</b></div>';
    const rows = summaries.map(s => {
      const riskClass = s.riskStatus === 'OK' ? 'risk-ok' : s.riskStatus === 'AT_RISK' ? 'risk-at' : 'risk-inactive';
      const riskLabel = s.riskStatus === 'OK' ? '正常' : s.riskStatus === 'AT_RISK' ? '关注' : '不活跃';
      return `<div class="roster-row" data-enrollment-id="${s.enrollmentId || ''}" data-risk="${s.riskStatus || 'OK'}">
        <b><input type="checkbox" class="roster-check" data-enrollment-id="${s.enrollmentId || ''}"></b>
        <b>${s.studentName || '—'}</b>
        <span>${s.courseProgress != null ? Math.round(s.courseProgress * 100) + '%' : '—'}</span>
        <span>${s.submittedCount ?? 0} / ${s.unsubmittedCount ?? 0}</span>
        <span>${s.latestAssessment || '—'}</span>
        <span>${s.score != null ? s.score : '—'}</span>
        <span>${s.recordingCount ?? 0}</span>
        <span>${s.mainIssue || '—'}</span>
        <span>${s.lastActiveAt || '—'}</span>
        <span class="${riskClass}">${riskLabel}</span>
      </div>`;
    }).join('');
    table.innerHTML = header + rows;
    // 全选
    const checkAll = document.getElementById('checkAll');
    if (checkAll) {
      checkAll.addEventListener('change', () => {
        document.querySelectorAll('.roster-check').forEach(c => { c.checked = checkAll.checked; });
      });
    }
  }

  // ── 渲染：任务和答案 ──
  function renderAssignmentList(summaries) {
    const list = document.getElementById('assignmentList');
    if (!list) return;
    if (!summaries || !Array.isArray(summaries) || summaries.length === 0) {
      list.innerHTML = '<div class="empty-hint">数据不足，暂无相关信息</div>';
      return;
    }
    list.innerHTML = summaries.map(a => {
      const statusLabel = a.status === 'PUBLISHED' ? '已发布' : a.status === 'DRAFT' ? '草稿' : a.status === 'CLOSED' ? '已关闭' : a.status || '—';
      return `<div class="assignment-row" data-assignment-id="${a.assignmentId || ''}">
        <div class="assignment-info">
          <strong>${a.title || '—'}</strong>
          <small>${a.courseName || '—'}</small>
        </div>
        <span class="assignment-status">${statusLabel}</span>
        <span>${a.submittedCount ?? 0} / ${a.totalCount ?? 0}</span>
        <span class="pending-count">${a.pendingReviewCount ?? 0} 待批改</span>
        <button class="view-answers-btn" data-assignment-id="${a.assignmentId || ''}" data-title="${a.title || ''}" data-submitted="${a.submittedCount ?? 0}" data-pending="${a.pendingReviewCount ?? 0}">查看答案</button>
      </div>`;
    }).join('');
  }

  // ── 渲染：测评结果 ──
  function renderAssessmentList(summaries) {
    const list = document.getElementById('assessmentList');
    if (!list) return;
    if (!summaries || !Array.isArray(summaries) || summaries.length === 0) {
      list.innerHTML = '<div class="empty-hint">数据不足，暂无相关信息</div>';
      return;
    }
    list.innerHTML = summaries.map(a => {
      const statusLabel = a.status === 'COMPLETED' ? '已完成' : a.status === 'IN_PROGRESS' ? '进行中' : a.status === 'SCHEDULED' ? '未开始' : a.status || '—';
      const typeLabel = a.type === 'FORMATIVE' ? '形成性' : a.type === 'SUMMATIVE' ? '总结性' : a.type || '—';
      return `<div class="assessment-row">
        <div class="assessment-info">
          <strong>${a.title || '—'}</strong>
          <small>${typeLabel}</small>
        </div>
        <span class="assessment-status">${statusLabel}</span>
        <span>${a.completedCount ?? 0} / ${a.totalCount ?? 0}</span>
        <span>均分 ${a.averageScore != null ? a.averageScore : '—'}</span>
        <span>中位 ${a.medianScore != null ? a.medianScore : '—'}</span>
      </div>`;
    }).join('');
  }

  // ── 渲染：待处理事项 ──
  function renderPendingItems(dashboard) {
    const list = document.getElementById('pendingList');
    if (!list) return;
    if (!dashboard) {
      list.innerHTML = '<div class="empty-hint">数据不足，暂无相关信息</div>';
      return;
    }
    const items = [
      { label: '待批改', value: dashboard.pendingReviewCount ?? 0, icon: '📝' },
      { label: '未提交任务', value: dashboard.unsubmittedAssignmentCount ?? 0, icon: '📋' },
      { label: '风险学生', value: dashboard.atRiskStudentCount ?? 0, icon: '⚠️' },
      { label: '待测评', value: dashboard.pendingAssessmentCount ?? 0, icon: '📊' },
    ];
    list.innerHTML = items.map(item =>
      `<div class="pending-item"><span class="pending-icon">${item.icon}</span><strong>${item.value}</strong><span>${item.label}</span></div>`
    ).join('');
  }

  // ── 事件委托：学生行点击 ──
  document.addEventListener('click', e => {
    const rosterRow = e.target.closest('.roster-row[data-enrollment-id]');
    if (rosterRow && rosterRow.dataset.enrollmentId) {
      location.href = `/teacher/students/${rosterRow.dataset.enrollmentId}`;
      return;
    }
  });

  // ── 事件委托：查看答案按钮 ──
  document.addEventListener('click', async e => {
    const btn = e.target.closest('.view-answers-btn');
    if (!btn) return;
    const aid = btn.dataset.assignmentId;
    const title = btn.dataset.title || '任务详情';
    const submitted = btn.dataset.submitted ?? '0';
    const pending = btn.dataset.pending ?? '0';
    drawerTitle.textContent = title;
    drawerText.textContent = '任务提交概要';
    // 尝试加载该任务的提交列表
    if (schoolId && aid && typeof YuzanApi !== 'undefined') {
      try {
        const subs = await YuzanApi.request(`/schools/${schoolId}/submissions?assignmentId=${aid}&limit=20`);
        if (Array.isArray(subs) && subs.length > 0) {
          drawerData.innerHTML = subs.map(s => {
            const studentName = s.studentName || s.enrollmentId?.slice(0, 8) || '—';
            const time = s.submittedAt ? new Date(s.submittedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
            const status = s.status === 'REVIEWED' ? '已复核' : s.status === 'SUBMITTED' ? '待复核' : s.status || '—';
            const score = s.autoScore != null ? s.autoScore : '—';
            return `<div class="drawer-row"><b>${studentName}</b><span>${time}</span><span>${status}</span><span>得分: ${score}</span></div>`;
          }).join('');
        } else {
          drawerData.innerHTML = `<div>提交数：${submitted}</div><div>待批改数：${pending}</div>`;
        }
      } catch (_) {
        drawerData.innerHTML = `<div>提交数：${submitted}</div><div>待批改数：${pending}</div>`;
      }
    } else {
      drawerData.innerHTML = `<div>提交数：${submitted}</div><div>待批改数：${pending}</div>`;
    }
    drawerBackdrop.hidden = false;
    document.body.style.overflow = 'hidden';
    drawerBackdrop.dataset.type = 'assignment-answers';
  });

  classId = getClassIdFromPath();
  loadClassDetail();
})();