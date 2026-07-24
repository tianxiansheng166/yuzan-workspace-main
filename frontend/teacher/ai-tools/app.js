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
      if (status === 'SUCCEEDED') {
        stopPolling();
        activeJobId = null;
        generatePath.disabled = false;
        generatePath.innerHTML = '<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1L18 9l-4.6 1.9L12 15l-1.4-4.1L6 9l4.6-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7z"/></svg>生成备课路径';
        // Only mark path-ready after confirmed SUCCEEDED with a draft
        if (job.draftId) {
          document.body.classList.add('path-ready');
          document.querySelectorAll('.stage-card').forEach((card, index) => {
            card.classList.toggle('active-stage', index <= 2);
          });
          showJobSuccess('AI 备课路径已生成');
          showToast('备课路径已生成，可点击各阶段工具开始备课');
          loadDrafts();
        } else {
          showJobSuccess('AI 生成完成，草稿创建中…');
          // Brief delay then reload to pick up draft
          setTimeout(() => pollJobStatus(jobId), 2000);
        }
      } else if (status === 'FAILED') {
        stopPolling();
        activeJobId = null;
        generatePath.disabled = false;
        generatePath.innerHTML = '<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1L18 9l-4.6 1.9L12 15l-1.4-4.1L6 9l4.6-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7z"/></svg>生成备课路径';
        const errMsg = job.errorMessage || job.errorCode || 'AI 服务处理失败';
        showJobError('生成失败：' + errMsg);
        // Do NOT add path-ready on failure — no fake success
      } else if (status === 'PROVIDER_NOT_CONFIGURED' || status === 'PROVIDER_UNAVAILABLE') {
        stopPolling();
        activeJobId = null;
        generatePath.disabled = false;
        generatePath.innerHTML = '<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1L18 9l-4.6 1.9L12 15l-1.4-4.1L6 9l4.6-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7z"/></svg>生成备课路径';
        const msg = status === 'PROVIDER_NOT_CONFIGURED' ? 'AI 服务暂未配置' : 'AI 服务不可达';
        showJobError(msg);
      } else if (status === 'OUTPUT_SCHEMA_INVALID') {
        stopPolling();
        activeJobId = null;
        generatePath.disabled = false;
        generatePath.innerHTML = '<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1L18 9l-4.6 1.9L12 15l-1.4-4.1L6 9l4.6-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7z"/></svg>生成备课路径';
        showJobError('AI 输出格式异常，请重试');
      } else if (status === 'TIMEOUT') {
        stopPolling();
        activeJobId = null;
        generatePath.disabled = false;
        generatePath.innerHTML = '<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1L18 9l-4.6 1.9L12 15l-1.4-4.1L6 9l4.6-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7z"/></svg>生成备课路径';
        showJobError('AI 生成超时，请重试');
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
      // Do NOT add path-ready — no fake success on polling failure
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
      showToast('请先登录后再使用 AI 备课功能');
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
        } else if (result && (result.status === 'PROVIDER_NOT_CONFIGURED' || result.code === 'PROVIDER_NOT_CONFIGURED')) {
          generatePath.disabled = false;
          generatePath.innerHTML = '<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1L18 9l-4.6 1.9L12 15l-1.4-4.1L6 9l4.6-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7z"/></svg>生成备课路径';
          showJobError('AI 服务暂未配置，请联系管理员');
          // No path-ready — not a success
        } else if (result && (result.status === 'PROVIDER_UNAVAILABLE' || result.code === 'PROVIDER_UNAVAILABLE')) {
          generatePath.disabled = false;
          generatePath.innerHTML = '<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1L18 9l-4.6 1.9L12 15l-1.4-4.1L6 9l4.6-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7z"/></svg>生成备课路径';
          showJobError('AI 服务不可达，请稍后重试');
        } else {
          generatePath.disabled = false;
          generatePath.innerHTML = '<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1L18 9l-4.6 1.9L12 15l-1.4-4.1L6 9l4.6-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7z"/></svg>生成备课路径';
          showJobError('创建任务失败，请重试');
        }
      } catch (err) {
        generatePath.disabled = false;
        generatePath.innerHTML = '<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1L18 9l-4.6 1.9L12 15l-1.4-4.1L6 9l4.6-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7z"/></svg>生成备课路径';
        showJobError('请求失败：' + err.message);
        // No path-ready on API call failure
      }
      return;
    }

    // Fallback: no async job API available
    showToast('AI 备课服务暂不可用');
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
          openDraftEditor(row.dataset.draftId);
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

      // Use the 4 diagnostic booleans from the API
      const providerConfigured = status.providerConfigured;
      const flowiseAvailable = status.flowiseAvailable;
      const workflowAvailable = status.workflowAvailable;
      const workerAvailable = status.workerAvailable;

      if (!providerConfigured) {
        statusEl.className = 'disabled';
        statusEl.textContent = '未配置　去配置 ›';
      } else if (!flowiseAvailable) {
        statusEl.className = 'disabled';
        statusEl.textContent = '不可用　查看说明 ›';
      } else if (!workflowAvailable) {
        statusEl.className = 'warning';
        statusEl.textContent = '需导入　查看说明 ›';
      } else if (!workerAvailable) {
        statusEl.className = 'warning';
        statusEl.textContent = '队列断开　查看说明 ›';
      } else if (status.status === 'ACTIVE') {
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

  /* ── Draft Editor ── */
  const draftEditorBackdrop = document.querySelector('#draftEditorBackdrop');
  const draftEditorTitle = document.querySelector('#draftEditorTitle');
  const draftEditorMeta = document.querySelector('#draftEditorMeta');
  const revisionConflictEl = document.querySelector('#revisionConflict');
  const draftSaveBtn = document.querySelector('#draftSaveBtn');
  const draftApproveBtn = document.querySelector('#draftApproveBtn');
  const draftBackBtn = document.querySelector('#draftBackBtn');
  const draftEditorEl = document.querySelector('.draft-editor');

  // Field IDs mapped to content keys
  const DRAFT_FIELDS = [
    { id: 'draftFieldTitle', key: 'title', type: 'input' },
    { id: 'draftFieldSummary', key: 'summary' },
    { id: 'draftFieldObjectives', key: 'objectives' },
    { id: 'draftFieldKeyPoints', key: 'keyPoints' },
    { id: 'draftFieldDifficulties', key: 'difficulties' },
    { id: 'draftFieldClassFlow', key: 'lessonFlow' },
    { id: 'draftFieldDifferentiatedSupport', key: 'differentiation' },
    { id: 'draftFieldWorksheetDraft', key: 'worksheetDraft' },
    { id: 'draftFieldExerciseDraft', key: 'practiceDraft' },
    { id: 'draftFieldGlossary', key: 'glossary' },
    { id: 'draftFieldRisks', key: 'risks' },
    { id: 'draftFieldTeacherChecklist', key: 'teacherReviewChecklist' },
  ];

  let currentDraft = null;  // { id, revision, status, title, content }

  function populateDraftFields(draft) {
    const content = draft.content || {};
    DRAFT_FIELDS.forEach(f => {
      const el = document.querySelector('#' + f.id);
      if (!el) return;
      if (f.key === 'title') {
        el.value = draft.title || '';
      } else {
        const val = content[f.key];
        el.value = formatFieldValue(val);
      }
    });
  }

  /**
   * Format a draft field value for display in a textarea.
   * - Arrays of strings → one per line
   * - Arrays of objects → JSON stringification per item
   * - Objects → pretty-printed JSON
   * - Primitives → string
   */
  function formatFieldValue(val) {
    if (val == null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) {
      if (val.length === 0) return '';
      // Array of primitives → one per line
      if (typeof val[0] === 'string' || typeof val[0] === 'number') {
        return val.join('\n');
      }
      // Array of objects → JSON each on its own line
      return val.map(item => JSON.stringify(item, null, 2)).join('\n---\n');
    }
    // Object → pretty JSON
    return JSON.stringify(val, null, 2);
  }

  function collectDraftContent() {
    const content = {};
    DRAFT_FIELDS.forEach(f => {
      const el = document.querySelector('#' + f.id);
      if (!el) return;
      if (f.key === 'title') return; // title handled separately
      const raw = (el.value || '').trim();
      if (!raw) return;

      // Preserve structured types: try JSON parse for object/array fields
      const schemaKey = f.key;
      if (schemaKey === 'lessonFlow' || schemaKey === 'objectives' ||
          schemaKey === 'keyPoints' || schemaKey === 'difficulties' ||
          schemaKey === 'glossary' || schemaKey === 'risks' ||
          schemaKey === 'resourceSuggestions' ||
          schemaKey === 'teacherReviewChecklist') {
        // These are arrays — try to parse back from the display format
        content[f.key] = tryParseArrayField(raw);
      } else if (schemaKey === 'differentiation' || schemaKey === 'practiceDraft' ||
                 schemaKey === 'worksheetDraft' || schemaKey === 'context') {
        // These are objects — try JSON parse
        content[f.key] = tryParseObjectField(raw);
      } else {
        content[f.key] = raw;
      }
    });

    // Preserve schemaVersion and context from the original AI output
    if (currentDraft && currentDraft.content) {
      if (currentDraft.content.schemaVersion) {
        content.schemaVersion = currentDraft.content.schemaVersion;
      }
      if (currentDraft.content.context) {
        content.context = currentDraft.content.context;
      }
    }

    return content;
  }

  /**
   * Try to parse a textarea value back into an array.
   * Handles both JSON arrays and newline-separated items.
   */
  function tryParseArrayField(raw) {
    // If it starts with '[' try full JSON parse
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
      try { return JSON.parse(trimmed); } catch {}
    }
    // If contains --- separators (array-of-objects format), parse each
    if (trimmed.includes('\n---\n')) {
      const items = trimmed.split('\n---\n').map(s => {
        const item = s.trim();
        try { return JSON.parse(item); } catch { return item; }
      });
      return items;
    }
    // Otherwise split by newline for string arrays
    return trimmed.split('\n').filter(s => s.trim());
  }

  /**
   * Try to parse a textarea value back into an object.
   */
  function tryParseObjectField(raw) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
      try { return JSON.parse(trimmed); } catch {}
    }
    return trimmed;
  }

  function setDraftEditorReadonly(readOnly) {
    if (draftEditorEl) {
      draftEditorEl.classList.toggle('readonly', readOnly);
    }
  }

  async function openDraftEditor(draftId) {
    const api = window.YuzanApi;
    if (!api || !api.getLessonPlanDraft) return;

    draftEditorBackdrop.hidden = false;
    document.body.style.overflow = 'hidden';
    draftEditorTitle.textContent = '加载中…';
    draftEditorMeta.textContent = '';
    revisionConflictEl.hidden = true;
    setDraftEditorReadonly(false);
    draftSaveBtn.disabled = true;
    draftApproveBtn.disabled = true;

    try {
      const draft = await api.getLessonPlanDraft(draftId);
      if (!draft) {
        showToast('草稿不存在');
        closeDraftEditor();
        return;
      }
      currentDraft = draft;
      draftEditorTitle.textContent = draft.title || '未命名备课草稿';

      const statusLabel = draft.status === 'APPROVED' ? '已确认' : '草稿';
      const revLabel = 'v' + (draft.revision || 0);
      const dateStr = draft.updatedAt ? new Date(draft.updatedAt).toLocaleDateString('zh-CN') : '';
      draftEditorMeta.textContent = statusLabel + ' · ' + revLabel + ' · ' + dateStr;

      populateDraftFields(draft);

      const isApproved = draft.status === 'APPROVED';
      setDraftEditorReadonly(isApproved);
      draftSaveBtn.disabled = isApproved;
      draftApproveBtn.disabled = isApproved;
      draftApproveBtn.textContent = isApproved ? '已确认' : '确认采纳';

    } catch (err) {
      showToast('加载草稿失败：' + err.message);
      closeDraftEditor();
    }
  }

  function closeDraftEditor() {
    draftEditorBackdrop.hidden = true;
    document.body.style.overflow = '';
    currentDraft = null;
  }

  // Save draft with expectedRevision for optimistic concurrency
  draftSaveBtn.addEventListener('click', async () => {
    if (!currentDraft) return;
    const api = window.YuzanApi;
    if (!api || !api.updateLessonPlanDraft) return;

    const title = document.querySelector('#draftFieldTitle').value.trim();
    const content = collectDraftContent();

    draftSaveBtn.disabled = true;
    draftSaveBtn.textContent = '保存中…';

    try {
      const result = await api.updateLessonPlanDraft(
        currentDraft.id,
        title,
        content,
        currentDraft.revision  // expectedRevision for optimistic concurrency
      );

      // Update local revision from server response
      if (result && result.revision != null) {
        currentDraft.revision = result.revision;
      }
      if (result && result.title) {
        currentDraft.title = result.title;
        draftEditorTitle.textContent = result.title;
      }
      if (result && result.updatedAt) {
        const dateStr = new Date(result.updatedAt).toLocaleDateString('zh-CN');
        const statusLabel = currentDraft.status === 'APPROVED' ? '已确认' : '草稿';
        draftEditorMeta.textContent = statusLabel + ' · v' + currentDraft.revision + ' · ' + dateStr;
      }

      revisionConflictEl.hidden = true;
      showToast('草稿已保存');

    } catch (err) {
      // Check for revision conflict (HTTP 409 or code CONFLICT)
      if (err.status === 409 || err.code === 'CONFLICT' || (err.message && err.message.includes('冲突'))) {
        revisionConflictEl.hidden = false;
        showToast('版本冲突：草稿已被其他操作修改，请关闭后重新打开');
      } else {
        showToast('保存失败：' + err.message);
      }
    } finally {
      draftSaveBtn.disabled = false;
      draftSaveBtn.textContent = '保存';
    }
  });

  // Approve draft — teacher confirmation
  draftApproveBtn.addEventListener('click', async () => {
    if (!currentDraft) return;
    const api = window.YuzanApi;
    if (!api || !api.approveLessonPlanDraft) return;

    draftApproveBtn.disabled = true;
    draftApproveBtn.textContent = '确认中…';

    try {
      await api.approveLessonPlanDraft(currentDraft.id);
      currentDraft.status = 'APPROVED';
      setDraftEditorReadonly(true);
      draftApproveBtn.textContent = '已确认';
      draftApproveBtn.disabled = true;
      draftSaveBtn.disabled = true;

      const dateStr = new Date().toLocaleDateString('zh-CN');
      draftEditorMeta.textContent = '已确认 · v' + currentDraft.revision + ' · ' + dateStr;
      showToast('草稿已确认采纳');
      loadDrafts(); // refresh draft list
    } catch (err) {
      showToast('确认失败：' + err.message);
      draftApproveBtn.disabled = false;
      draftApproveBtn.textContent = '确认采纳';
    }
  });

  // Back to list
  draftBackBtn.addEventListener('click', () => {
    closeDraftEditor();
  });

  // Close on backdrop click or Escape
  draftEditorBackdrop.addEventListener('click', (e) => {
    if (e.target === draftEditorBackdrop) closeDraftEditor();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !draftEditorBackdrop.hidden) closeDraftEditor();
  });

  /* ── Load courses from API ── */
  async function loadCourses() {
    const api = window.YuzanApi;
    if (!api || !api.listCourseVersions || !api.getToken || !api.getToken()) return;
    if (!courseSelect) return;

    try {
      const courseVersions = await api.listCourseVersions({ status: 'PUBLISHED', limit: 50 });
      if (!courseVersions || !courseVersions.length) return;

      // Clear existing options (keep the placeholder)
      while (courseSelect.options.length > 1) {
        courseSelect.remove(1);
      }

      courseVersions.forEach(cv => {
        const courseName = cv.course?.title || cv.title || '未命名课程';
        const versionLabel = cv.versionName ? ' · ' + cv.versionName : '';
        const units = cv.units || [];
        let lastUnitOpt = null;

        // Option group for course version
        const optGroup = document.createElement('optgroup');
        optGroup.label = courseName + versionLabel;

        if (units.length > 0) {
          units.forEach(unit => {
            const unitName = unit.title || '未命名单元';
            const lessons = unit.lessons || [];

            // Add unit as an option
            const unitOpt = document.createElement('option');
            unitOpt.value = cv.id;  // courseVersionId for the whole version
            unitOpt.textContent = '├ ' + unitName;
            optGroup.appendChild(unitOpt);
            lastUnitOpt = unitOpt;

            // Add lessons under unit
            lessons.forEach(lesson => {
              const lessonOpt = document.createElement('option');
              lessonOpt.value = cv.id;
              lessonOpt.textContent = '│　· ' + (lesson.title || '未命名课时');
              optGroup.appendChild(lessonOpt);
            });
          });
        } else {
          // No units — just add the course version itself
          const opt = document.createElement('option');
          opt.value = cv.id;
          opt.textContent = courseName + versionLabel;
          optGroup.appendChild(opt);
        }

        // Fix last unit prefix
        if (lastUnitOpt) {
          lastUnitOpt.textContent = lastUnitOpt.textContent.replace('├ ', '└ ');
        }

        courseSelect.appendChild(optGroup);
      });
    } catch (err) {
      // Silent failure — keep placeholder option
    }
  }

  initToolsState();
  loadCourses();

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
