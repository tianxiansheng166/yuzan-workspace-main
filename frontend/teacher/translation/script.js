(() => {
  'use strict';

  const API_BASE = '/schools';
  const CHAR_LIMIT = 5000;
  const POLL_INTERVAL = 2000;
  const FINAL_STATUSES = ['COMPLETED', 'PROVIDER_UNAVAILABLE', 'FAILED'];

  let currentSchoolId = null;
  let currentDirection = 'BO_ZH'; // BO→ZH or ZH→BO
  let currentJobId = null;
  let jobsCache = [];
  let pollingTimers = {};

  // ── 初始化 ──────────────────────────────────────────────

  async function init() {
    try {
      currentSchoolId = YuzanApi.getActiveSchoolId();
      if (!currentSchoolId) {
        const session = await YuzanApi.me();
        currentSchoolId = session?.activeSchoolId || YuzanApi.getActiveSchoolId();
      }
      if (!currentSchoolId) {
        showUnavailable('请先登录并选择学校');
        return;
      }
    } catch {
      showUnavailable('请先登录并选择学校');
      return;
    }
    bindEvents();
    loadMyJobs();
    updateServiceStatus();
  }

  // ── API helper ──────────────────────────────────────────

  async function translateApi(path, options = {}) {
    return YuzanApi.request(
      `${API_BASE}/${currentSchoolId}/translations${path}`,
      options,
    );
  }

  // ── 服务状态 ────────────────────────────────────────────

  async function updateServiceStatus() {
    const el = document.getElementById('service-status');
    if (!el) return;
    try {
      await translateApi('/glossary', { method: 'GET' });
      el.className = 'status ok';
      el.textContent = '● 翻译服务可用';
    } catch {
      el.className = 'status unavailable';
      el.textContent = '● 翻译服务不可用';
    }
  }

  // ── 创建翻译 ────────────────────────────────────────────

  async function createTranslation() {
    const sourceText = getSourceText();
    if (!sourceText || !sourceText.trim()) return;
    if (sourceText.length > CHAR_LIMIT) {
      showCharLimitWarning();
      return;
    }

    const [src, tgt] = currentDirection.split('_');
    if (src === tgt) {
      showError('源语言和目标语言不能相同');
      return;
    }

    setTranslatingState(true);
    clearResult();

    try {
      const job = await translateApi('/jobs', {
        method: 'POST',
        body: JSON.stringify({
          sourceLanguage: src,
          targetLanguage: tgt,
          sourceText: sourceText,
        }),
      });

      currentJobId = job.id;
      addJobToCache(job);
      updateProgressFromJob(job);
      startPolling(job.id);
    } catch (err) {
      handleApiError(err);
    } finally {
      setTranslatingState(false);
    }
  }

  // ── 轮询 Job 状态 ───────────────────────────────────────

  function startPolling(jobId) {
    if (pollingTimers[jobId]) return;

    const poll = async () => {
      try {
        const job = await translateApi(`/jobs/${jobId}`, { method: 'GET' });
        updateJobInCache(job);
        updateResultDisplay(job);
        updateProgressFromJob(job);

        if (FINAL_STATUSES.includes(job.status)) {
          delete pollingTimers[jobId];
          return;
        }
        pollingTimers[jobId] = setTimeout(poll, POLL_INTERVAL);
      } catch {
        delete pollingTimers[jobId];
      }
    };
    poll();
  }

  // ── 更新结果显示 ────────────────────────────────────────

  function updateResultDisplay(job) {
    const resultText = job.revisedResult || job.machineResult || '';
    setTargetText(resultText);

    if (job.reviewStatus === 'NEEDS_REVIEW') {
      showReviewBadge('待审核', 'needs-review');
    } else if (job.reviewStatus === 'APPROVED') {
      showReviewBadge('已审核', 'approved');
    } else if (job.reviewStatus === 'REJECTED') {
      showReviewBadge('已驳回', 'rejected');
    } else {
      hideReviewBadge();
    }

    // 显示修订/审批按钮
    const reviseBtn = document.getElementById('save-revision-btn');
    const approveBtn = document.getElementById('approve-btn');
    if (reviseBtn && approveBtn && job.status === 'COMPLETED') {
      reviseBtn.style.display = '';
      approveBtn.style.display = '';
      reviseBtn.dataset.jobId = job.id;
      reviseBtn.dataset.revision = job.revision || 0;
      approveBtn.dataset.jobId = job.id;
      approveBtn.dataset.revision = job.revision || 0;
    } else {
      if (reviseBtn) reviseBtn.style.display = 'none';
      if (approveBtn) approveBtn.style.display = 'none';
    }

    if (job.status === 'PROVIDER_UNAVAILABLE') {
      showError('翻译服务暂不可用，请稍后再试');
    } else if (job.status === 'FAILED') {
      showError('翻译失败，请重试');
    } else if (job.status === 'COMPLETED' && !job.machineResult) {
      showError('翻译结果为空');
    }
  }

  // ── 进度面板动态更新 ────────────────────────────────────

  function updateProgressFromJob(job) {
    const items = document.querySelectorAll('.progress-list li');
    if (!items.length) return;

    const steps = ['识别语言', '理解语义', '转换表达', '优化校对', '生成结果'];
    let activeStep = 0;

    switch (job.status) {
      case 'CREATED':
      case 'QUEUED':
        activeStep = 0;
        break;
      case 'PROCESSING':
        activeStep = 3;
        break;
      case 'COMPLETED':
        activeStep = 5;
        break;
      case 'PROVIDER_UNAVAILABLE':
      case 'FAILED':
        activeStep = -1;
        break;
      default:
        activeStep = 0;
    }

    items.forEach((li, i) => {
      li.className = '';
      if (activeStep >= 0 && i < activeStep) {
        li.className = 'done';
      } else if (activeStep >= 0 && i === activeStep) {
        li.className = 'active';
      }
    });
  }

  // ── 修订翻译 ────────────────────────────────────────────

  async function reviseJob(jobId, revisedResult, expectedRevision) {
    try {
      const job = await translateApi(`/jobs/${jobId}/revise`, {
        method: 'PATCH',
        body: JSON.stringify({ revisedResult, expectedRevision }),
      });
      updateJobInCache(job);
      updateResultDisplay(job);
    } catch (err) {
      if (err.status === 409) {
        showError('该翻译已被其他人修改，请刷新后重试');
      } else {
        handleApiError(err);
      }
    }
  }

  // ── 审批翻译 ────────────────────────────────────────────

  async function approveJob(jobId, expectedRevision) {
    try {
      const job = await translateApi(`/jobs/${jobId}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ expectedRevision }),
      });
      updateJobInCache(job);
      updateResultDisplay(job);
    } catch (err) {
      if (err.status === 409) {
        showError('该翻译版本已过期，请刷新后重试');
      } else {
        handleApiError(err);
      }
    }
  }

  // ── 加载我的翻译历史 ────────────────────────────────────

  async function loadMyJobs() {
    try {
      const result = await translateApi('/jobs/me?limit=50', { method: 'GET' });
      jobsCache = result.items || result || [];
      renderJobHistory(jobsCache);
    } catch {
      renderJobHistory([]);
    }
  }

  // ── 渲染翻译历史列表 ────────────────────────────────────

  function renderJobHistory(jobs) {
    const container = document.querySelector('.history-panel .history-list');
    if (!container) return;

    if (!jobs.length) {
      container.innerHTML = `
        <div class="history-empty">
          <div class="doc-icon">🗎</div>
          <h3>暂无翻译历史</h3>
          <p>您的翻译记录将显示在这里，便于快速回顾与复用。</p>
        </div>`;
      return;
    }

    container.innerHTML = jobs
      .map(
        (job) => `
      <div class="history-item" data-job-id="${job.id}">
        <div class="history-direction">${langLabel(job.sourceLanguage)} → ${langLabel(job.targetLanguage)}</div>
        <div class="history-status status-${job.status.toLowerCase()}">
          ${statusLabel(job)}
        </div>
        <div class="history-time">${formatTime(job.createdAt)}</div>
      </div>`,
      )
      .join('');

    container.querySelectorAll('.history-item').forEach((el) => {
      el.addEventListener('click', () => {
        const job = jobsCache.find((j) => j.id === el.dataset.jobId);
        if (job) loadJobToWorkspace(job);
      });
    });
  }

  function langLabel(code) {
    return code === 'BO' ? '藏文' : code === 'ZH' ? '中文' : code;
  }

  function statusLabel(job) {
    if (job.reviewStatus === 'APPROVED') return '已审核';
    if (job.reviewStatus === 'NEEDS_REVIEW') return '待审核';
    if (job.reviewStatus === 'REJECTED') return '已驳回';
    switch (job.status) {
      case 'CREATED':
      case 'QUEUED':
      case 'PROCESSING':
        return '翻译中...';
      case 'COMPLETED':
        return '已完成';
      case 'PROVIDER_UNAVAILABLE':
        return '服务不可用';
      case 'FAILED':
        return '失败';
      default:
        return job.status;
    }
  }

  function formatTime(iso) {
    try {
      return new Date(iso).toLocaleString('zh-CN');
    } catch {
      return iso;
    }
  }

  // ── 事件绑定 ────────────────────────────────────────────

  function bindEvents() {
    const translateBtn = document.getElementById('translate-btn');
    if (translateBtn) translateBtn.addEventListener('click', createTranslation);

    const swapBtn = document.getElementById('swap-btn');
    if (swapBtn) swapBtn.addEventListener('click', swapLanguages);

    // 字符计数
    const textarea = document.querySelector('.source-panel textarea');
    if (textarea) {
      textarea.addEventListener('input', () => {
        const len = textarea.value.length;
        const counter = document.querySelector('.source-panel .char-count');
        if (counter) counter.textContent = `${len}/${CHAR_LIMIT}`;
        const muted = document.querySelector('.source-panel .muted');
        if (muted && !counter) muted.textContent = `${len}/${CHAR_LIMIT}`;
        if (len > CHAR_LIMIT) showCharLimitWarning();
        else hideError();
      });
    }

    // 清空按钮
    const clearBtn = document.querySelector('.source-panel .panel-actions .clear-btn');
    if (clearBtn) clearBtn.addEventListener('click', clearSource);

    // 修订保存按钮
    const reviseBtn = document.getElementById('save-revision-btn');
    if (reviseBtn) {
      reviseBtn.addEventListener('click', () => {
        const jobId = reviseBtn.dataset.jobId;
        const expectedRevision = parseInt(reviseBtn.dataset.revision, 10);
        const revisedResult = document.querySelector('.target-panel textarea')?.value || '';
        if (jobId && revisedResult) reviseJob(jobId, revisedResult, expectedRevision);
      });
    }

    // 审批按钮
    const approveBtn = document.getElementById('approve-btn');
    if (approveBtn) {
      approveBtn.addEventListener('click', () => {
        const jobId = approveBtn.dataset.jobId;
        const expectedRevision = parseInt(approveBtn.dataset.revision, 10);
        if (jobId) approveJob(jobId, expectedRevision);
      });
    }
  }

  // ── 交换语言 ────────────────────────────────────────────

  function swapLanguages() {
    currentDirection = currentDirection === 'BO_ZH' ? 'ZH_BO' : 'BO_ZH';
    const dirText = document.querySelector('.direction-text');
    if (dirText)
      dirText.textContent =
        currentDirection === 'BO_ZH' ? '藏文 → 中文' : '中文 → 藏文';

    const leftBox = document.querySelector('.lang-box.left');
    const rightBox = document.querySelector('.lang-box.right');
    if (leftBox && rightBox) {
      const leftHtml = leftBox.innerHTML;
      const rightHtml = rightBox.innerHTML;
      leftBox.innerHTML = rightHtml;
      rightBox.innerHTML = leftHtml;
    }

    // 更新面板标题
    const srcHead = document.querySelector(
      '.source-panel .panel-head strong',
    );
    const tgtHead = document.querySelector(
      '.target-panel .panel-head strong',
    );
    if (srcHead && tgtHead) {
      if (currentDirection === 'BO_ZH') {
        srcHead.textContent = '源语言（藏文）';
        tgtHead.textContent = '目标语言（中文）';
      } else {
        srcHead.textContent = '源语言（中文）';
        tgtHead.textContent = '目标语言（藏文）';
      }
    }
  }

  // ── DOM helpers ─────────────────────────────────────────

  function getSourceText() {
    return document.querySelector('.source-panel textarea')?.value || '';
  }

  function setTargetText(text) {
    const ta = document.querySelector('.target-panel textarea');
    if (ta) ta.value = text;
    // 更新目标字数
    const counter = document.querySelector('.target-panel .char-count');
    if (counter) counter.textContent = `${text.length}/${CHAR_LIMIT}`;
    const muted = document.querySelector('.target-panel .muted');
    if (muted && !counter) muted.textContent = `${text.length}/${CHAR_LIMIT}`;
  }

  function clearSource() {
    const ta = document.querySelector('.source-panel textarea');
    if (ta) ta.value = '';
    const counter = document.querySelector('.source-panel .char-count');
    if (counter) counter.textContent = `0/${CHAR_LIMIT}`;
    const muted = document.querySelector('.source-panel .muted');
    if (muted && !counter) muted.textContent = `0/${CHAR_LIMIT}`;
  }

  function clearResult() {
    setTargetText('');
    hideReviewBadge();
    const reviseBtn = document.getElementById('save-revision-btn');
    const approveBtn = document.getElementById('approve-btn');
    if (reviseBtn) reviseBtn.style.display = 'none';
    if (approveBtn) approveBtn.style.display = 'none';
  }

  function setTranslatingState(translating) {
    const btn = document.getElementById('translate-btn');
    if (btn) {
      btn.disabled = translating;
      btn.textContent = translating ? '翻译中...' : '✈ 翻译';
    }
  }

  function showReviewBadge(text, className) {
    const badge = document.getElementById('review-badge');
    if (badge) {
      badge.textContent = text;
      badge.className = 'review-badge ' + className;
      badge.style.display = '';
    }
  }

  function hideReviewBadge() {
    const badge = document.getElementById('review-badge');
    if (badge) badge.style.display = 'none';
  }

  function showCharLimitWarning() {
    showError(`输入文本不能超过${CHAR_LIMIT}字符`);
  }

  function showUnavailable(msg) {
    const el = document.getElementById('service-status');
    if (el) {
      el.className = 'status unavailable';
      el.textContent = '● ' + msg;
    }
    const content = document.querySelector('.content');
    if (content && !el) {
      const notice = document.createElement('div');
      notice.className = 'unavailable-notice';
      notice.textContent = msg;
      content.prepend(notice);
    }
  }

  function showError(msg) {
    let el = document.getElementById('translation-error');
    if (!el) {
      el = document.createElement('div');
      el.id = 'translation-error';
      el.className = 'translation-error';
      const workspace = document.querySelector('.workspace-grid');
      if (workspace) workspace.before(el);
    }
    el.textContent = msg;
    el.style.display = '';
  }

  function hideError() {
    const el = document.getElementById('translation-error');
    if (el) el.style.display = 'none';
  }

  function handleApiError(err) {
    if (err.status === 429) showError('请求过于频繁，请稍后再试');
    else if (err.status === 503) showError('翻译服务暂不可用');
    else if (err.status === 403) showError('无权访问该翻译');
    else showError('操作失败，请重试');
  }

  function loadJobToWorkspace(job) {
    currentJobId = job.id;
    updateResultDisplay(job);
    updateProgressFromJob(job);
    if (!FINAL_STATUSES.includes(job.status)) {
      startPolling(job.id);
    }
  }

  function addJobToCache(job) {
    jobsCache.unshift(job);
    renderJobHistory(jobsCache);
  }

  function updateJobInCache(job) {
    const idx = jobsCache.findIndex((j) => j.id === job.id);
    if (idx >= 0) jobsCache[idx] = job;
    else jobsCache.unshift(job);
    renderJobHistory(jobsCache);
  }

  // ── 启动 ────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
