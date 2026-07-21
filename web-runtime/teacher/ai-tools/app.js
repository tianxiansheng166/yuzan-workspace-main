(() => {
  const goalInput = document.querySelector('#goalInput');
  const goalCount = document.querySelector('#goalCount');
  const courseSelect = document.querySelector('#courseSelect');
  const stageGrid = document.querySelector('#stageGrid');
  const generatePath = document.querySelector('#generatePath');
  const routeButtons = [...document.querySelectorAll('[data-route]')];
  const modalBackdrop = document.querySelector('#modalBackdrop');
  const modalTitle = document.querySelector('#modalTitle');
  const modalText = document.querySelector('#modalText');
  const modalMark = document.querySelector('#modalMark');
  const toast = document.querySelector('#toast');
  const jobStatusBar = document.querySelector('#jobStatusBar');
  const jobStatusText = document.querySelector('#jobStatusText');
  const jobCancelButton = document.querySelector('#jobCancelBtn');
  const draftListEl = document.querySelector('#draftList');
  const aiServiceRow = document.querySelector('#aiServiceRow');
  let toastTimer;

  /* ── 工具状态 ── */
  let toolsState = null;
  let inviteCodeValue = '';
  let activeJobId = null;
  let pollTimer = null;

  const content = {
    privacy: ['数据安全与隐私保护', '外部工具打开前会提示数据范围。平台不会把学生敏感信息自动发送给第三方服务，AI 结果必须由教师复核。', '盾'],
    'copy-code': ['复制邀请码', '邀请码将复制到剪贴板，可用于邀请校内教师加入当前教学空间。', '⧉'],
    guide: ['新手引导', '引导将依次介绍备课目标、推荐路径、外部服务状态和资源库。', '2/4'],
    'route-help': ['路径说明', '推荐路径按"理解教材—构建思路—生成图示—翻译术语—形成学习单"组织，教师可随时切换自定义路径。', '?'],
    mindmate: ['进入 MindMate', '打开前将展示传递的数据范围。当前演示仅显示交互，不会离开本地页面。', 'M'],
    'material-analysis': ['教材解析', '查看课文结构、教学目标、重点难点与建议活动。', '书'],
    'new-idea': ['选择或新建思路', '可从已有备课思路中选择，或新建一条教学设计思路。', '+'],
    mindgraph: ['创建思维导图', '将当前备课目标和已选课程作为输入，生成可编辑的课堂图示草稿。', '图'],
    'from-route': ['从思路生成图示', '完成步骤 2 后，可把教学思路转换为结构化图示。', '→'],
    translate: ['打开藏汉翻译工具', '外部翻译服务只接收当前选中的术语，不自动传输学生信息。', '译'],
    glossary: ['术语对照表', '查看本课程中已确认的藏汉术语及教师修订记录。', '表'],
    worksheet: ['生成学习单', '系统将根据已确认的备课路径创建可编辑学习单草稿。', '单'],
    'preview-edit': ['预览与编辑', '预览学习单结构并修改题目、活动和难度。', '✎'],
    courseware: ['教学资源', '进入对应资源分类，浏览经过授权的课文、课件与教案素材。', '资'],
    activities: ['活动素材', '浏览课堂活动、游戏和协作任务模板。', '活'],
    media: ['图片视频', '浏览可用于课堂的图片、音频和视频素材。', '媒'],
    'question-bank': ['试题库', '按年级、单元和能力维度筛选练习与试题。', '题'],
    'resource-center': ['进入资源库', '进入完整教学资源库并保留当前课程筛选条件。', '◎'],
    'open-recent': ['打开最近项目', '将恢复该项目的最近编辑状态。', '↗'],
    draft: ['继续编辑草稿', '草稿会在当前工具中打开，不会自动发布。', '✎'],
    'manage-services': ['管理外部服务', '查看授权范围、连接状态和服务不可用说明。', '⚙']
  };

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('show');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function openModal(action) {
    const [title, text, mark] = content[action] || ['操作说明', '该功能已连接到本地交互演示。', '✓'];
    modalTitle.textContent = title;
    modalText.textContent = text;
    modalMark.textContent = mark;
    modalBackdrop.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modalBackdrop.hidden = true;
    document.body.style.overflow = '';
  }

  goalInput.addEventListener('input', () => {
    goalCount.textContent = String(goalInput.value.length);
  });

  /* ── 作业状态显示 ── */
  function showJobStatus(text, canCancel) {
    if (!jobStatusBar) return;
    jobStatusText.textContent = text;
    jobStatusBar.hidden = false;
    jobStatusBar.dataset.state = 'running';
    jobCancelButton.style.display = canCancel ? '' : 'none';
  }

  function showJobSuccess(text) {
    if (!jobStatusBar) return;
    jobStatusText.textContent = text;
    jobStatusBar.dataset.state = 'success';
    jobCancelButton.style.display = 'none';
    setTimeout(() => { jobStatusBar.hidden = true; }, 5000);
  }

  function showJobError(text) {
    if (!jobStatusBar) return;
    jobStatusText.textContent = text;
    jobStatusBar.dataset.state = 'error';
    jobCancelButton.style.display = 'none';
    setTimeout(() => { jobStatusBar.hidden = true; }, 8000);
  }

  function hideJobStatus() {
    if (jobStatusBar) jobStatusBar.hidden = true;
  }

  /* ── 作业轮询 ── */
  function stopPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  async function pollJobStatus(jobId) {
    const api = window.YuzanApi;
    if (!api || !api.getLessonPlanJob) return;

    try {
      const job = await api.getLessonPlanJob(jobId);
      if (!job) { stopPolling(); return; }

      const status = job.status;
      if (status === 'COMPLETED') {
        stopPolling();
        activeJobId = null;
        generatePath.disabled = false;
        generatePath.innerHTML = '<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1L18 9l-4.6 1.9L12 15l-1.4-4.1L6 9l4.6-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7z"/></svg>生成备课路径';
        document.body.classList.add('path-ready');
        document.querySelectorAll('.stage-card').forEach((card, index) => {
          card.classList.toggle('active-stage', index <= 2);
        });
        showJobSuccess('AI 备课路径已生成');
        showToast('备课路径已生成，可点击各阶段工具开始备课');
        loadDrafts();
      } else if (status === 'FAILED') {
        stopPolling();
        activeJobId = null;
        generatePath.disabled = false;
        generatePath.innerHTML = '<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1L18 9l-4.6 1.9L12 15l-1.4-4.1L6 9l4.6-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7z"/></svg>生成备课路径';
        const errMsg = job.errorMessage || 'AI 服务处理失败';
        showJobError('生成失败：' + errMsg);
        document.body.classList.add('path-ready');
        document.querySelectorAll('.stage-card').forEach((card, index) => {
          card.classList.toggle('active-stage', index <= 1);
        });
      } else if (status === 'CANCELLED') {
        stopPolling();
        activeJobId = null;
        generatePath.disabled = false;
        generatePath.innerHTML = '<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1L18 9l-4.6 1.9L12 15l-1.4-4.1L6 9l4.6-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7z"/></svg>生成备课路径';
        hideJobStatus();
        showToast('已取消生成');
      } else {
        // QUEUED or RUNNING — continue polling
        const label = status === 'QUEUED' ? '排队中…' : 'AI 正在生成备课路径…';
        showJobStatus(label, true);
        pollTimer = setTimeout(() => pollJobStatus(jobId), 3000);
      }
    } catch (err) {
      stopPolling();
      activeJobId = null;
      generatePath.disabled = false;
      generatePath.innerHTML = '<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1L18 9l-4.6 1.9L12 15l-1.4-4.1L6 9l4.6-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7z"/></svg>生成备课路径';
      showJobError('查询状态失败：' + err.message);
    }
  }

  /* ── 生成备课路径 - 调用异步作业 API ── */
  generatePath.addEventListener('click', async () => {
    const hasInput = goalInput.value.trim() || courseSelect.value;
    if (!hasInput) {
      goalInput.focus();
      showToast('请先填写备课目标或选择关联课程');
      return;
    }

    const api = window.YuzanApi;
    if (!api || !api.getToken || !api.getToken()) {
      // 无 API 连接，使用本地演示
      document.body.classList.add('path-ready');
      document.querySelectorAll('.stage-card').forEach((card, index) => {
        card.classList.toggle('active-stage', index <= 1);
      });
      showToast('已生成推荐备课路径，当前建议从构建思路开始');
      return;
    }

    // 优先使用新的异步作业 API
    if (api.createLessonPlanJob) {
      generatePath.disabled = true;
      generatePath.innerHTML = '<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1L18 9l-4.6 1.9L12 15l-1.4-4.1L6 9l4.6-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7z"/></svg>提交中…';

      try {
        const result = await api.createLessonPlanJob(
          goalInput.value.trim(),
          courseSelect.value || undefined,
          undefined,
          undefined
        );

        if (result && result.jobId) {
          activeJobId = result.jobId;
          showJobStatus('AI 正在生成备课路径…', true);
          showToast('已提交备课路径生成请求');
          pollJobStatus(result.jobId);
        } else if (result && result.code === 'PROVIDER_NOT_CONFIGURED') {
          generatePath.disabled = false;
          generatePath.innerHTML = '<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1L18 9l-4.6 1.9L12 15l-1.4-4.1L6 9l4.6-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7z"/></svg>生成备课路径';
          document.body.classList.add('path-ready');
          document.querySelectorAll('.stage-card').forEach((card, index) => {
            card.classList.toggle('active-stage', index <= 1);
          });
          showJobError('AI 服务暂未配置');
          showToast('AI 服务暂未配置，已展示默认备课路径供参考');
        } else {
          generatePath.disabled = false;
          generatePath.innerHTML = '<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1L18 9l-4.6 1.9L12 15l-1.4-4.1L6 9l4.6-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7z"/></svg>生成备课路径';
          document.body.classList.add('path-ready');
          document.querySelectorAll('.stage-card').forEach((card, index) => {
            card.classList.toggle('active-stage', index <= 1);
          });
          showToast('已展示默认备课路径');
        }
      } catch (err) {
        generatePath.disabled = false;
        generatePath.innerHTML = '<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1L18 9l-4.6 1.9L12 15l-1.4-4.1L6 9l4.6-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7z"/></svg>生成备课路径';
        document.body.classList.add('path-ready');
        document.querySelectorAll('.stage-card').forEach((card, index) => {
          card.classList.toggle('active-stage', index <= 1);
        });
        showJobError('请求失败：' + err.message);
      }
      return;
    }

    // 降级：使用旧的同步 generatePlan API
    generatePath.disabled = true;
    const originalText = generatePath.textContent;
    generatePath.textContent = '正在生成…';
    try {
      const result = await api.generatePlan(
        goalInput.value.trim(),
        courseSelect.value || undefined,
        undefined
      );
      if (result && result.status === 'PROVIDER_NOT_CONFIGURED') {
        document.body.classList.add('path-ready');
        document.querySelectorAll('.stage-card').forEach((card, index) => {
          card.classList.toggle('active-stage', index <= 1);
        });
        showToast('AI 服务暂未配置，已展示默认备课路径供参考');
      } else if (result && result.status === 'PENDING') {
        document.body.classList.add('path-ready');
        document.querySelectorAll('.stage-card').forEach((card, index) => {
          card.classList.toggle('active-stage', index <= 1);
        });
        showToast('已提交备课路径生成请求，请稍后查看结果');
      } else {
        document.body.classList.add('path-ready');
        document.querySelectorAll('.stage-card').forEach((card, index) => {
          card.classList.toggle('active-stage', index <= 1);
        });
        showToast('已生成推荐备课路径，当前建议从构建思路开始');
      }
    } catch (err) {
      document.body.classList.add('path-ready');
      document.querySelectorAll('.stage-card').forEach((card, index) => {
        card.classList.toggle('active-stage', index <= 1);
      });
      showToast('路径生成请求已发送，当前展示默认路径');
    } finally {
      generatePath.disabled = false;
      generatePath.textContent = originalText;
    }
  });

  /* ── 取消作业 ── */
  if (jobCancelButton) {
    jobCancelButton.addEventListener('click', async () => {
      if (!activeJobId) return;
      const api = window.YuzanApi;
      if (!api || !api.cancelLessonPlanJob) return;
      try {
        await api.cancelLessonPlanJob(activeJobId);
        stopPolling();
        activeJobId = null;
        generatePath.disabled = false;
        generatePath.innerHTML = '<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1L18 9l-4.6 1.9L12 15l-1.4-4.1L6 9l4.6-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7z"/></svg>生成备课路径';
        hideJobStatus();
        showToast('已取消生成');
      } catch (err) {
        showToast('取消失败：' + err.message);
      }
    });
  }

  routeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      routeButtons.forEach((item) => item.classList.toggle('active', item === button));
      if (button.dataset.route === 'custom') {
        stageGrid.querySelectorAll('.stage-card').forEach((card) => card.setAttribute('draggable', 'true'));
        showToast('已切换到自定义路径，可调整工具顺序');
      } else {
        stageGrid.querySelectorAll('.stage-card').forEach((card) => card.removeAttribute('draggable'));
        showToast('已恢复推荐路径');
      }
    });
  });

  /* ── 复制邀请码 - 优先从 API 获取 ── */
  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const action = button.dataset.action;
      if (action === 'copy-code') {
        const api = window.YuzanApi;
        let codeToCopy = '';

        if (api && api.getToken && api.getToken()) {
          try {
            const result = await api.getInviteCode();
            if (result && result.code) {
              codeToCopy = result.code;
              inviteCodeValue = result.code;
              const codeEl = document.querySelector('#inviteCode');
              if (codeEl) codeEl.textContent = result.code;
            }
          } catch (err) {
            // API 失败，使用页面上已有的邀请码
          }
        }

        if (!codeToCopy) {
          const codeEl = document.querySelector('#inviteCode');
          codeToCopy = codeEl ? codeEl.textContent : '';
        }

        if (codeToCopy) {
          try { await navigator.clipboard.writeText(codeToCopy); } catch (_) {}
          showToast('邀请码已复制');
        } else {
          showToast('邀请码暂不可用，请稍后重试');
        }
        return;
      }

      // ── LIVE_ROUTE: 翻译工具 → /teacher/translation ──
      if (action === 'translate') {
        location.href = '/teacher/translation';
        return;
      }

      openModal(action);
    });
  });

  document.querySelector('#dismissTip').addEventListener('click', () => {
    document.querySelector('.page-tip').hidden = true;
    showToast('已关闭本次提示');
  });

  document.querySelector('#modalClose').addEventListener('click', closeModal);
  document.querySelector('#modalCancel').addEventListener('click', closeModal);
  document.querySelector('#modalConfirm').addEventListener('click', () => {
    closeModal();
  });
  modalBackdrop.addEventListener('click', (event) => {
    if (event.target === modalBackdrop) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modalBackdrop.hidden) closeModal();
  });

  /* ── 加载草稿列表 ── */
  async function loadDrafts() {
    const api = window.YuzanApi;
    if (!api || !api.listLessonPlanDrafts || !api.getToken || !api.getToken()) return;
    if (!draftListEl) return;

    try {
      const drafts = await api.listLessonPlanDrafts();
      if (!drafts || !drafts.length) {
        draftListEl.innerHTML = '<div class="draft-empty">暂无备课草稿</div>';
        return;
      }

      draftListEl.innerHTML = drafts.slice(0, 5).map(d => {
        const statusLabel = d.status === 'APPROVED' ? '已确认' : d.status === 'DRAFT' ? '草稿' : d.status;
        const dateStr = d.updatedAt ? new Date(d.updatedAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : '';
        return '<button class="draft-row" data-draft-id="' + d.id + '">' +
          '<span class="row-icon red-pencil">✎</span>' +
          '<div><b>' + (d.title || '未命名备课草稿') + '</b>' +
          '<small><span>AI备课</span>　' + statusLabel + ' · ' + dateStr + '</small></div>' +
          '<em>›</em></button>';
      }).join('');

      draftListEl.querySelectorAll('[data-draft-id]').forEach(row => {
        row.addEventListener('click', () => {
          showToast('正在打开草稿…');
        });
      });
    } catch (err) {
      draftListEl.innerHTML = '<div class="draft-empty">加载失败</div>';
    }
  }

  /* ── 更新 AI 服务状态 ── */
  async function loadWorkflowStatus() {
    const api = window.YuzanApi;
    if (!api || !api.getLessonPlanWorkflowStatus || !api.getToken || !api.getToken()) return;
    if (!aiServiceRow) return;

    try {
      const status = await api.getLessonPlanWorkflowStatus();
      if (!status) return;

      const statusEl = aiServiceRow.querySelector('em');
      if (!statusEl) return;

      if (status.available === false || status.status === 'UNAVAILABLE') {
        statusEl.className = 'disabled';
        statusEl.textContent = '不可用　查看说明 ›';
      } else if (status.status === 'PENDING' || status.status === 'QUEUED') {
        statusEl.className = 'warning';
        statusEl.textContent = '配置中…';
      } else if (status.available === true || status.status === 'ACTIVE') {
        statusEl.className = 'connected';
        statusEl.textContent = '✓ 已连接';
      } else {
        statusEl.className = 'warning';
        statusEl.textContent = '需配置　去配置 ›';
      }
    } catch (err) {
      // 静默失败
    }
  }

  /* ── 页面初始化 - 加载工具状态 ── */
  async function initToolsState() {
    const api = window.YuzanApi;
    if (!api || !api.getToken || !api.getToken()) return;

    try {
      const state = await api.getTeacherToolsState();
      if (!state) return;
      toolsState = state;

      // 更新邀请码显示
      if (state.inviteCode && state.inviteCode.code) {
        inviteCodeValue = state.inviteCode.code;
        const codeEl = document.querySelector('#inviteCode');
        if (codeEl) codeEl.textContent = state.inviteCode.code;
      }

      // 如果有外部服务状态，可以用来更新 UI
      if (state.externalServices && state.externalServices.length > 0) {
        const hasUnavailable = state.externalServices.some(s => !s.enabled || s.status === 'PROVIDER_UNAVAILABLE');
        if (hasUnavailable) {
          const tipEl = document.querySelector('.page-tip');
          if (tipEl) {
            const tipText = tipEl.querySelector('p');
            if (tipText) {
              tipText.textContent = '部分外部服务暂未配置，AI 工具功能可能受限。配置完成后可正常使用。';
            }
          }
        }
      }
    } catch (err) {
      console.warn('加载工具状态失败:', err.message);
    }

    // 并行加载草稿列表和 AI 工作流状态
    loadDrafts();
    loadWorkflowStatus();
  }

  initToolsState();

  // ── UNSUPPORTED: 侧栏 data-unsupported 链接 ──
  document.querySelectorAll('.sidebar [data-unsupported]').forEach(el => {
    el.style.opacity = '.55';
    el.style.cursor = 'not-allowed';
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showToast(el.dataset.unsupported || '该功能暂未开通');
    });
  });

  // ── UNSUPPORTED: topbar 按钮 ──
  document.querySelectorAll('.help-button, .notification, .profile-button').forEach(el => {
    el.style.cursor = 'not-allowed';
    el.title = '该功能暂未开通';
  });
})();
