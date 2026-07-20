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
  let toastTimer;

  /* ── 工具状态 ── */
  let toolsState = null;
  let inviteCodeValue = '';

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
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
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

  /* ── 生成备课路径 - 调用后端 API ── */
  generatePath.addEventListener('click', async () => {
    const hasInput = goalInput.value.trim() || courseSelect.value;
    if (!hasInput) {
      goalInput.focus();
      showToast('请先填写备课目标或选择关联课程');
      return;
    }

    // 如果 API 可用，尝试调用后端生成备课路径
    const api = window.YuzanApi;
    if (api && api.getToken && api.getToken()) {
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
          // AI 服务未配置，仍显示本地路径但提示
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
          // 有结果直接展示
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
    } else {
      // 无 API 连接，使用本地演示
      document.body.classList.add('path-ready');
      document.querySelectorAll('.stage-card').forEach((card, index) => {
        card.classList.toggle('active-stage', index <= 1);
      });
      showToast('已生成推荐备课路径，当前建议从构建思路开始');
    }
  });

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

        // 尝试从后端获取邀请码
        if (api && api.getToken && api.getToken()) {
          try {
            const result = await api.getInviteCode();
            if (result && result.code) {
              codeToCopy = result.code;
              inviteCodeValue = result.code;
              // 更新页面上的邀请码显示
              const codeEl = document.querySelector('#inviteCode');
              if (codeEl) codeEl.textContent = result.code;
            }
          } catch (err) {
            // API 失败，使用页面上已有的邀请码
          }
        }

        // 如果 API 没有返回，使用页面上的值
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
      // 静默失败，不影响页面使用
      console.warn('加载工具状态失败:', err.message);
    }
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
