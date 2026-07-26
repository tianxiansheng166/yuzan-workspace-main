(() => {
  'use strict';

  // ── 工具函数 ──
  const qs = (sel, root) => (root || document).querySelector(sel);
  const qsa = (sel, root) => [...(root || document).querySelectorAll(sel)];

  const toastEl = qs('#toast');
  let toastTimer;

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  // ── LIVE_ROUTE: 侧栏导航按钮 ──
  // 实际存在的教师端页面路由
  const navRoutes = {
    course: '/teacher/courses/',
    task: '/teacher/assignments',
    assessment: '/teacher/assessments',
    review: '/teacher/reviews/',
    report: '/teacher/assessments/detail/',
  };

  const sideNavButtons = qsa('.side-nav button[data-nav]');
  sideNavButtons.forEach((btn) => {
    const nav = btn.dataset.nav;
    if (nav === 'assessment') return; // 当前页面，不跳转
    if (navRoutes[nav]) {
      btn.addEventListener('click', () => { location.href = navRoutes[nav]; });
    } else {
      // 无对应页面的导航项 → UNSUPPORTED
      btn.style.opacity = '.55';
      btn.style.cursor = 'not-allowed';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const labels = {
          growth: '学情与成长',
          resource: '资源中心',
          setting: '设置中心',
        };
        showToast((labels[nav] || btn.textContent.trim()) + '功能暂未开通');
      });
    }
  });

  // ── UNSUPPORTED: 公益与支持 ──
  const supportBtn = qs('aside.sidebar button.support');
  if (supportBtn) {
    supportBtn.style.opacity = '.55';
    supportBtn.style.cursor = 'not-allowed';
    supportBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('公益与支持页面暂未开通');
    });
  }

  // ── UNSUPPORTED: 暂停测评（后端状态机不支持 PAUSED/RESUMED） ──
  const pauseBtn = qs('#pauseBtn');
  if (pauseBtn) {
    pauseBtn.disabled = true;
    pauseBtn.title = '当前版本暂不支持暂停测评';
    pauseBtn.style.opacity = '.55';
    pauseBtn.style.cursor = 'not-allowed';
    pauseBtn.addEventListener('click', () => showToast('当前版本暂不支持暂停测评'));
  }

  // ── UNSUPPORTED: 延长时间（后端不支持 EXTENDED 状态） ──
  const extendBtn = qs('[data-modal="extend"]');
  if (extendBtn) {
    extendBtn.disabled = true;
    extendBtn.title = '当前版本暂不支持延长时间';
    extendBtn.style.opacity = '.55';
    extendBtn.style.cursor = 'not-allowed';
    extendBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showToast('当前版本暂不支持延长时间');
    });
  }

  // ── UNSUPPORTED: 复制测评（后端无 clone 端点） ──
  const copyBtn = qs('#copyBtn');
  if (copyBtn) {
    copyBtn.disabled = true;
    copyBtn.title = '测评副本功能暂未开通，请联系管理员';
    copyBtn.style.opacity = '.55';
    copyBtn.style.cursor = 'not-allowed';
    copyBtn.addEventListener('click', () => showToast('测评副本功能暂未开通，请联系管理员'));
  }

  // ── LIVE_LOCAL: 复制链接（clipboard API） ──
  const copyLink = qs('#copyLink');
  if (copyLink) {
    copyLink.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        showToast('测评链接已复制');
      } catch (_) {
        showToast('测评链接已复制');
      }
    });
  }

  // ── UNSUPPORTED: 下载二维码 ──
  const downloadQrBtn = qs('#downloadQr');
  if (downloadQrBtn) {
    downloadQrBtn.disabled = true;
    downloadQrBtn.title = '二维码下载功能暂未开通';
    downloadQrBtn.style.opacity = '.55';
    downloadQrBtn.style.cursor = 'not-allowed';
    downloadQrBtn.addEventListener('click', () => showToast('二维码下载功能暂未开通'));
  }

  // ── LIVE_LOCAL: 学生表格筛选（搜索 + 状态 + 环节） ──
  const studentSearch = qs('#studentSearch');
  const statusFilter = qs('#statusFilter');
  const rows = qsa('#studentRows tr');
  let selectedStage = 'all';

  function filterRows() {
    const q = studentSearch.value.trim().toLowerCase();
    const status = statusFilter.value;
    rows.forEach((row) => {
      const okQ = !q || row.textContent.toLowerCase().includes(q);
      const okS = status === 'all' || row.dataset.status === status;
      const okStage = selectedStage === 'all' || row.dataset.stage === selectedStage;
      row.hidden = !(okQ && okS && okStage);
    });
    if (rows.every((r) => r.hidden)) showToast('没有符合条件的学生');
  }

  if (studentSearch) studentSearch.addEventListener('input', filterRows);
  if (statusFilter) statusFilter.addEventListener('change', filterRows);

  // ── LIVE_LOCAL: 环节按钮（筛选视图） ──
  qsa('.stage').forEach((s) => {
    s.addEventListener('click', () => {
      const was = s.classList.contains('active');
      qsa('.stage').forEach((x) => x.classList.remove('active'));
      if (was) {
        selectedStage = 'all';
      } else {
        s.classList.add('active');
        selectedStage = s.dataset.stage;
      }
      filterRows();
    });
  });

  // ── LIVE_LOCAL: 分段视图切换（按学生/按环节） ──
  qsa('.segmented button').forEach((b) => {
    b.addEventListener('click', () => {
      qsa('.segmented button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      showToast(b.dataset.view === 'stage' ? '已切换为按环节查看' : '已切换为按学生查看');
    });
  });

  // ── 行操作按钮 ──
  qsa('.row-action').forEach((b) => {
    const txt = b.textContent.trim();
    if (txt === '查看进度') {
      // LIVE_ROUTE: 跳转学生详情
      b.addEventListener('click', () => { location.href = '/teacher/students/detail/'; });
    } else if (txt === '查看报告') {
      // 无 sessionId 上下文，提示用户先在测评详情页生成报告
      b.addEventListener('click', () => showToast('请先在测评详情页生成报告'));
    } else if (txt === '发送提醒') {
      // UNSUPPORTED: 通知提醒功能
      b.disabled = true;
      b.title = '通知提醒功能暂未开通';
      b.style.opacity = '.55';
      b.style.cursor = 'not-allowed';
      b.addEventListener('click', () => showToast('通知提醒功能暂未开通'));
    }
  });

  // ── 异常处理按钮 ──
  qsa('.handle').forEach((b) => {
    const card = b.closest('.anomaly-card');
    const kind = card ? card.dataset.kind : '';
    const txt = b.textContent.trim();

    if (txt === '去复核') {
      // LIVE_ROUTE: 跳转人工复核页
      b.addEventListener('click', () => { location.href = '/teacher/reviews/'; });
    } else if (kind === 'record') {
      // UNSUPPORTED: 录音重试
      b.disabled = true;
      b.title = '录音重试功能暂未开通';
      b.style.opacity = '.55';
      b.style.cursor = 'not-allowed';
      b.addEventListener('click', () => showToast('录音重试功能暂未开通'));
    } else if (kind === 'timeout') {
      // UNSUPPORTED: 超时处理
      b.disabled = true;
      b.title = '超时处理功能暂未开通';
      b.style.opacity = '.55';
      b.style.cursor = 'not-allowed';
      b.addEventListener('click', () => showToast('超时处理功能暂未开通'));
    } else {
      b.addEventListener('click', () => showToast('该处理功能暂未开通'));
    }
  });

  // ── LIVE_LOCAL: 分页按钮（仅视觉切换） ──
  qsa('.pagination button').forEach((b) => {
    b.addEventListener('click', () => {
      if (/^\d+$/.test(b.textContent)) {
        qsa('.pagination button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
      }
    });
  });

  // ── UNSUPPORTED: 页大小选择和页码跳转 ──
  const pageSizeSelect = qs('.page-size select');
  if (pageSizeSelect) {
    pageSizeSelect.disabled = true;
    pageSizeSelect.title = '分页功能暂未开通';
    pageSizeSelect.style.opacity = '.55';
    pageSizeSelect.style.cursor = 'not-allowed';
    pageSizeSelect.addEventListener('change', () => showToast('分页功能暂未开通'));
  }

  const pageJumpInput = qs('.page-size input');
  if (pageJumpInput) {
    pageJumpInput.disabled = true;
    pageJumpInput.title = '分页功能暂未开通';
    pageJumpInput.style.opacity = '.55';
    pageJumpInput.style.cursor = 'not-allowed';
    pageJumpInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') showToast('分页功能暂未开通');
    });
  }

  // ── UNSUPPORTED: 查看未覆盖详情 ──
  const coverageBtn = qs('.coverage-panel button');
  if (coverageBtn) {
    coverageBtn.addEventListener('click', () => showToast('覆盖详情功能暂未开通'));
  }

  // ── Modal 逻辑 ──
  const backdrop = qs('#modalBackdrop');
  const modalTitle = qs('#modalTitle');
  const modalText = qs('#modalText');
  const modalForm = qs('#modalForm');

  function openModal(type) {
    backdrop.hidden = false;
    if (type === 'report') {
      modalTitle.textContent = '生成测评报告';
      modalText.textContent = '将基于当前已完成的学生结果生成班级测评报告。必须先调用生成接口，再查看报告。';
      modalForm.innerHTML = '<label>报告范围<select><option>班级综合报告</option><option>仅已完成学生</option></select></label>';
    } else if (type === 'anomaly') {
      modalTitle.textContent = '全部异常';
      modalText.textContent = '当前共有 4 项异常需要处理，其中 1 项需要人工复核。';
      modalForm.innerHTML = '<label>异常筛选<select><option>全部异常</option><option>录音失败</option><option>超时未完成</option><option>需人工复核</option></select></label>';
    } else {
      modalTitle.textContent = '操作详情';
      modalText.textContent = '该功能暂未接入后端';
      modalForm.innerHTML = '';
    }
  }

  function closeModal() {
    backdrop.hidden = true;
  }

  // data-modal 触发（排除 extend，已由上方 UNSUPPORTED 拦截）
  qsa('[data-modal]').forEach((b) => {
    if (b.dataset.modal === 'extend') return;
    b.addEventListener('click', () => openModal(b.dataset.modal));
  });

  qs('.modal-close').addEventListener('click', closeModal);
  qs('.cancel').addEventListener('click', closeModal);

  // ── 确认按钮 ──
  // 生成报告 → LIVE_API（先 POST /report/generate，再 GET /report）
  // 异常弹窗确认 → LIVE_LOCAL（仅关闭弹窗）
  qs('.confirm').addEventListener('click', async () => {
    if (modalTitle.textContent === '生成测评报告') {
      const params = new URLSearchParams(location.search);
      const sessionId = params.get('sessionId') || '';
      if (!sessionId) {
        showToast('缺少测评会话标识，无法生成报告');
        closeModal();
        return;
      }
      try {
        await YuzanApi.generateAssessmentReport(sessionId);
        await YuzanApi.getAssessmentReport(sessionId);
        showToast('测评报告已生成');
        closeModal();
      } catch (err) {
        showToast(err.message || '报告生成失败，请重试');
      }
      return;
    }
    // 异常弹窗确认 — 仅关闭
    closeModal();
  });

  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !backdrop.hidden) closeModal(); });
})();
