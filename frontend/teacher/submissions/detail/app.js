(() => {
  'use strict';

  const toast = document.getElementById('toast');
  const playbackAudio = document.getElementById('submissionAudio');
  const playbackStatus = document.getElementById('recordingStatus');
  let timer;
  const showToast = (msg) => {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => toast.classList.remove('show'), 1800);
  };

  let submissionId = '';
  let schoolId = '';
  let submissionData = null;
  let submissionLoaded = false;
  let feedbackLoaded = false;
  let feedbackNeedsRefresh = false;
  let feedbackMutationInFlight = false;
  let latestFeedback = null;

  // ── 路由：从 URL 获取 submissionId ──
  function getSubmissionIdFromPath() {
    // /teacher/submissions/:submissionId — 3rd segment
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length >= 3 && parts[0] === 'teacher' && parts[1] === 'submissions') {
      return parts[2];
    }
    return '';
  }

  // ── API：加载提交详情 ──
  async function loadSubmissionDetail() {
    if (!submissionId) {
      showToast('缺少提交标识，无法加载');
      setPlaybackStatus('提交标识缺失，无法查询录音。', 'error');
      return;
    }
    if (typeof YuzanApi === 'undefined' || !YuzanApi.getToken()) {
      setPlaybackStatus('请先登录后查看录音。', 'authorization-error');
      showToast('请先登录');
      location.href = '/login';
      return;
    }
    schoolId = YuzanApi.getActiveSchoolId();
    if (!schoolId) {
      setPlaybackStatus('请先选择学校后查看录音。', 'authorization-error');
      showToast('请先选择学校');
      location.href = '/select-school';
      return;
    }

    submissionLoaded = false;
    feedbackLoaded = false;
    feedbackNeedsRefresh = false;
    latestFeedback = null;
    syncReviewControls();
    setFeedbackReadStatus('正在读取服务器反馈记录…', 'loading');
    // Feedback is a separate authorized resource. Defer its request until this
    // page has started loading the submission and its recording independently.
    setTimeout(() => loadSubmissionFeedback(), 0);

    try {
      const requestedSchoolId = schoolId;
      const data = await YuzanApi.request(`/schools/${encodeURIComponent(requestedSchoolId)}/submissions/${encodeURIComponent(submissionId)}`);
      if (YuzanApi.getActiveSchoolId() !== requestedSchoolId) {
        submissionLoaded = false;
        feedbackNeedsRefresh = true;
        setFeedbackActionStatus('当前学校已变化，正在重新读取此提交的状态。', 'pending');
        void refreshAuthoritativeReviewState();
        return;
      }
      submissionData = data;
      submissionLoaded = Boolean(data && typeof data === 'object');
      applySubmissionDetail(data);
      await loadSubmissionRecordingPlayback();
    } catch (err) {
      showToast(err.message || '加载提交详情失败');
      submissionData = null;
      submissionLoaded = false;
      applyEmptyState();
      showPlaybackFailure(err);
      syncReviewControls();
    }
  }

  function setFeedbackReadStatus(message, state) {
    const status = document.getElementById('feedbackReadStatus');
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
  }

  function setFeedbackActionStatus(message, state = 'info') {
    const status = document.getElementById('feedbackActionStatus');
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
  }

  function feedbackErrorMessage(err, action) {
    const status = Number(err?.status);
    if (err?.code === 'INVALID_FEEDBACK_RESPONSE') return '反馈服务返回的数据格式无效，请刷新后重试。';
    if (status === 400) return action === 'save'
      ? '反馈内容无效，请检查评语后重试。'
      : '无法读取反馈记录，请刷新后重试。';
    if (status === 401) return action === 'save'
      ? '登录已过期，反馈未确认成功，请重新登录后刷新状态。'
      : '登录已过期，请重新登录后读取反馈记录。';
    if (status === 403) return action === 'save'
      ? '你无权处理此提交，反馈未保存。'
      : '你无权读取此提交的反馈记录。';
    if (status === 404) return action === 'save'
      ? '提交不存在或已不可用，反馈未保存。'
      : '未找到此提交的反馈记录。';
    if (status === 409) return action === 'save'
      ? '提交状态已变化。请刷新状态核实后再操作；本次不会自动重试。'
      : '提交状态已变化，请刷新后查看最新反馈。';
    if (status >= 500) return action === 'save'
      ? '服务暂时无法确认反馈是否保存。请刷新状态核实，不要重复提交。'
      : '服务暂时无法读取反馈记录，请刷新后重试。';
    return action === 'save'
      ? '网络连接失败，无法确认反馈是否保存。请刷新状态核实，不要重复提交。'
      : '网络连接失败，反馈记录暂时无法读取。请刷新后重试。';
  }

  function feedbackPath() {
    return `/schools/${encodeURIComponent(schoolId)}/submissions/${encodeURIComponent(submissionId)}/feedback`;
  }

  function selectLatestFeedback(items) {
    if (!Array.isArray(items)) {
      throw Object.assign(new Error('Invalid feedback response'), { code: 'INVALID_FEEDBACK_RESPONSE' });
    }
    const matching = items.filter((item) => item && item.submissionId === submissionId);
    matching.sort((left, right) => {
      const leftTime = Date.parse(left.releasedAt || '');
      const rightTime = Date.parse(right.releasedAt || '');
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
        return rightTime - leftTime;
      }
      return (Number(right.revision) || 0) - (Number(left.revision) || 0);
    });
    return matching[0] || null;
  }

  function formatFeedbackDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '—'
      : date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function renderLatestFeedback() {
    const section = document.getElementById('teacherReviewSection');
    if (section) section.style.display = '';
    const record = latestFeedback;
    const decision = record?.decision === 'ACCEPT'
      ? '已通过'
      : record?.decision === 'RETURN'
        ? '已退回'
        : record?.decision || '暂无反馈';
    const fields = [
      ['reviewStatus', decision],
      ['reviewComment', record?.comment || '—'],
      ['reviewScore', record?.score !== undefined && record?.score !== null ? String(record.score) : '—'],
      ['reviewReleasedAt', formatFeedbackDate(record?.releasedAt)],
    ];
    for (const [id, value] of fields) {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    }
    setFeedbackReadStatus(record ? '已显示服务器保存的最近一次反馈。' : '服务器尚无此提交的反馈记录。', 'ready');
  }

  async function loadSubmissionFeedback() {
    try {
      const activeSchoolId = YuzanApi.getActiveSchoolId();
      if (!activeSchoolId) {
        throw Object.assign(new Error('Active school is missing'), { status: 403 });
      }
      if (schoolId && schoolId !== activeSchoolId) {
        schoolId = activeSchoolId;
        submissionLoaded = false;
        feedbackNeedsRefresh = true;
        setFeedbackActionStatus('当前学校已变化，正在重新读取此提交的状态。', 'pending');
        return await refreshAuthoritativeReviewState();
      }
      schoolId = activeSchoolId;
      const items = await YuzanApi.request(feedbackPath());
      latestFeedback = selectLatestFeedback(items);
      feedbackLoaded = true;
      renderLatestFeedback();
      syncReviewControls();
      return true;
    } catch (err) {
      feedbackLoaded = false;
      feedbackNeedsRefresh = true;
      setFeedbackReadStatus(feedbackErrorMessage(err, 'read'), 'error');
      syncReviewControls();
      return false;
    }
  }

  function syncReviewControls() {
    const activeSchoolMatches = typeof YuzanApi !== 'undefined'
      && YuzanApi.getActiveSchoolId() === schoolId;
    const ready = activeSchoolMatches && submissionLoaded && feedbackLoaded && !feedbackNeedsRefresh && !feedbackMutationInFlight;
    const canReview = ready && submissionData?.status === 'NEEDS_REVIEW';
    for (const id of ['btnAccept', 'btnReturn']) {
      const button = document.getElementById(id);
      if (button) button.disabled = !canReview;
    }
    const comment = document.getElementById('feedbackComment');
    if (comment) comment.disabled = !canReview;

    const refresh = document.getElementById('btnRefreshFeedback');
    if (refresh) refresh.hidden = !feedbackNeedsRefresh;

    const eligibility = document.getElementById('feedbackEligibility');
    if (!eligibility) return;
    if (!submissionLoaded) {
      eligibility.textContent = '提交详情尚未确认，暂不能提交反馈。';
    } else if (!activeSchoolMatches) {
      eligibility.textContent = '当前学校已变化，请刷新提交状态后再操作。';
    } else if (!feedbackLoaded || feedbackNeedsRefresh) {
      eligibility.textContent = '当前状态尚未从服务器完整确认，请刷新状态后再操作。';
    } else if (submissionData?.status === 'NEEDS_REVIEW') {
      eligibility.textContent = '此提交正等待复核。填写评语后可选择通过或退回。';
    } else {
      eligibility.textContent = `当前提交状态为“${mapStatus(submissionData?.status).label}”，只有待复核提交可以处理。`;
    }
  }

  async function refreshAuthoritativeReviewState(options = {}) {
    feedbackNeedsRefresh = true;
    syncReviewControls();
    setFeedbackReadStatus('正在刷新提交状态与反馈记录…', 'loading');
    const activeSchoolId = YuzanApi.getActiveSchoolId();
    if (!activeSchoolId) {
      setFeedbackReadStatus('请先选择学校后刷新反馈状态。', 'error');
      setFeedbackActionStatus('未能确认当前学校，反馈状态仍需刷新。', 'error');
      return false;
    }
    schoolId = activeSchoolId;
    const submissionPath = `/schools/${encodeURIComponent(schoolId)}/submissions/${encodeURIComponent(submissionId)}`;
    const [submissionResult, feedbackResult] = await Promise.allSettled([
      YuzanApi.request(submissionPath),
      YuzanApi.request(feedbackPath()),
    ]);

    let detailError = null;
    let feedbackError = null;
    if (submissionResult.status === 'fulfilled' && submissionResult.value && typeof submissionResult.value === 'object') {
      submissionData = submissionResult.value;
      submissionLoaded = true;
      applySubmissionDetail(submissionData);
    } else {
      detailError = submissionResult.status === 'rejected'
        ? submissionResult.reason
        : Object.assign(new Error('Submission detail is missing'), { status: 404 });
      submissionLoaded = false;
    }

    if (feedbackResult.status === 'fulfilled') {
      try {
        latestFeedback = selectLatestFeedback(feedbackResult.value);
        feedbackLoaded = true;
        renderLatestFeedback();
      } catch (err) {
        feedbackError = err;
        feedbackLoaded = false;
      }
    } else {
      feedbackError = feedbackResult.reason;
      feedbackLoaded = false;
    }

    const refreshed = submissionLoaded && feedbackLoaded;
    if (!refreshed) {
      feedbackNeedsRefresh = true;
      const error = detailError || feedbackError;
      const message = feedbackErrorMessage(error, 'read');
      setFeedbackReadStatus(message, 'error');
      setFeedbackActionStatus(options.afterDecision
        ? `反馈已保存，但状态刷新失败：${message} 请使用“刷新提交与反馈状态”重试，不要再次提交。`
        : `状态刷新失败：${message}`, 'error');
      syncReviewControls();
      return false;
    }

    if (options.afterDecision) {
      const expectedStatus = options.afterDecision === 'ACCEPT' ? 'ACCEPTED' : 'RETURNED';
      const confirmed = submissionData.status === expectedStatus
        && latestFeedback?.decision === options.afterDecision;
      if (!confirmed) {
        feedbackNeedsRefresh = true;
        setFeedbackActionStatus('服务器已接受反馈，但最新状态与反馈记录尚未一致；请刷新核实，不要重复提交。', 'error');
        syncReviewControls();
        return false;
      }
      const comment = document.getElementById('feedbackComment');
      if (comment) comment.value = '';
      feedbackNeedsRefresh = false;
      setFeedbackActionStatus('反馈已保存，提交状态与反馈记录已从服务器同步。', 'success');
    } else {
      feedbackNeedsRefresh = false;
      setFeedbackActionStatus('已从服务器刷新提交状态与反馈记录。', 'success');
    }
    syncReviewControls();
    return true;
  }

  function feedbackButtonLabel(id) {
    return id === 'btnAccept' ? '通过' : '退回';
  }

  async function submitFeedback(decision, event) {
    event?.preventDefault?.();
    if (decision !== 'ACCEPT' && decision !== 'RETURN') return;
    if (feedbackMutationInFlight) return;

    const activeSchoolId = YuzanApi.getActiveSchoolId();
    if (!activeSchoolId || activeSchoolId !== schoolId) {
      feedbackNeedsRefresh = true;
      setFeedbackActionStatus('当前学校已变化或未选择，请刷新提交状态后再操作。', 'error');
      syncReviewControls();
      return;
    }
    if (!submissionLoaded || !feedbackLoaded || feedbackNeedsRefresh || submissionData?.status !== 'NEEDS_REVIEW') {
      setFeedbackActionStatus('当前服务器状态不允许提交反馈，请刷新后再确认。', 'error');
      syncReviewControls();
      return;
    }

    const commentInput = document.getElementById('feedbackComment');
    const comment = String(commentInput?.value || '').trim();
    if (!comment) {
      setFeedbackActionStatus('请填写有内容的评语后再提交。', 'error');
      commentInput?.focus?.();
      return;
    }

    feedbackMutationInFlight = true;
    syncReviewControls();
    setFeedbackActionStatus('正在向服务器提交反馈…', 'pending');
    const button = document.getElementById(decision === 'ACCEPT' ? 'btnAccept' : 'btnReturn');
    if (button) button.textContent = '提交中…';
    try {
      await YuzanApi.request(feedbackPath(), {
        method: 'POST',
        body: JSON.stringify({ decision, comment }),
      });
    } catch (err) {
      feedbackMutationInFlight = false;
      if (button) button.textContent = feedbackButtonLabel(decision === 'ACCEPT' ? 'btnAccept' : 'btnReturn');
      feedbackNeedsRefresh = Number(err?.status) !== 400;
      setFeedbackActionStatus(feedbackErrorMessage(err, 'save'), 'error');
      syncReviewControls();
      return;
    }

    feedbackMutationInFlight = false;
    if (button) button.textContent = feedbackButtonLabel(decision === 'ACCEPT' ? 'btnAccept' : 'btnReturn');
    feedbackNeedsRefresh = true;
    setFeedbackActionStatus('服务器已接收反馈，正在刷新提交状态与反馈记录…', 'pending');
    await refreshAuthoritativeReviewState({ afterDecision: decision });
  }

  function setPlaybackStatus(message, state) {
    playbackStatus.textContent = message;
    playbackStatus.dataset.state = state;
  }

  function clearPlaybackSource() {
    playbackAudio.pause();
    playbackAudio.removeAttribute('src');
    playbackAudio.hidden = true;
    playbackAudio.load();
  }

  function showPlaybackFailure(err) {
    clearPlaybackSource();
    if (err?.status === 401 || err?.status === 403) {
      setPlaybackStatus('无权查看或播放此提交的录音。', 'authorization-error');
    } else if (err?.status === 404) {
      setPlaybackStatus('当前提交没有可播放的录音。', 'no-recording');
    } else {
      setPlaybackStatus('录音暂时无法加载，请稍后重试。', 'load-error');
    }
  }

  function isHttpMediaUrl(value) {
    try {
      const url = new URL(value, location.origin);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  async function loadSubmissionRecordingPlayback() {
    const section = document.getElementById('recordingSection');
    section.style.display = '';
    clearPlaybackSource();
    setPlaybackStatus('正在检查此提交的录音权限…', 'loading');

    try {
      const path = `/schools/${encodeURIComponent(schoolId)}/submissions/${encodeURIComponent(submissionId)}/recording-playback`;
      const evidence = await YuzanApi.request(path);
      const downloadUrl = typeof evidence?.downloadUrl === 'string'
        ? evidence.downloadUrl.trim()
        : '';
      if (!downloadUrl || !isHttpMediaUrl(downloadUrl)) {
        setPlaybackStatus('当前提交没有可播放的录音。', 'no-recording');
        return;
      }

      const assignmentTitle = submissionData?.assignmentTitle || submissionData?.title;
      document.getElementById('recordingTitle').textContent = assignmentTitle || '朗读录音';
      const durationMs = Number(evidence.durationMs);
      document.getElementById('recordingDuration').textContent = Number.isFinite(durationMs) && durationMs > 0
        ? `时长：${Math.floor(durationMs / 60000)}:${String(Math.floor(durationMs / 1000) % 60).padStart(2, '0')}`
        : '时长：—';
      playbackAudio.src = downloadUrl;
      playbackAudio.hidden = false;
      setPlaybackStatus('录音已授权。使用播放器控件开始播放。', 'ready');
    } catch (err) {
      showPlaybackFailure(err);
    }
  }

  // ── 渲染：提交详情 ──
  function applySubmissionDetail(data) {
    if (!data) { applyEmptyState(); return; }

    // 学生信息
    const studentName = data.studentName || data.enrollmentName || '未命名学生';
    const enrollmentId = data.enrollmentId || '';
    document.getElementById('studentName').textContent = studentName;
    document.getElementById('studentInfo').textContent = enrollmentId ? `Enrollment: ${enrollmentId}` : '—';

    // 面包屑：学生链接
    const crumbStudent = document.getElementById('crumbStudent');
    if (crumbStudent && enrollmentId) {
      crumbStudent.textContent = studentName;
      crumbStudent.href = `/teacher/students/${enrollmentId}`;
    }

    // 提交时间
    const submittedAt = data.submittedAt
      ? new Date(data.submittedAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '—';
    document.getElementById('submitTime').textContent = `提交时间：${submittedAt}`;

    // 页面标题
    document.title = `${studentName} 的提交｜语赞心声`;

    // 任务信息
    const assignmentTitle = data.assignmentTitle || data.title || '—';
    const assignmentType = mapAssignmentType(data.assignmentType || data.type);
    const statusInfo = mapStatus(data.status);
    document.getElementById('assignmentTitle').textContent = assignmentTitle;
    document.getElementById('assignmentType').textContent = assignmentType;
    const statusEl = document.getElementById('submitStatus');
    statusEl.textContent = statusInfo.label;
    statusEl.style.color = statusInfo.color;

    // 书面答案
    const answer = data.writtenAnswer || data.answer || data.textResponse || '';
    document.getElementById('writtenAnswer').textContent = answer || '数据不足';

    // 自动评分
    const autoScores = data.autoScores || data.scores || data.machineScores || null;
    if (autoScores) {
      const section = document.getElementById('autoScoreSection');
      section.style.display = '';
      document.getElementById('scorePronunciation').textContent = autoScores.pronunciation != null ? `${autoScores.pronunciation}` : '—';
      document.getElementById('scoreFluency').textContent = autoScores.fluency != null ? `${autoScores.fluency}` : '—';
      document.getElementById('scoreEmotion').textContent = autoScores.emotion != null ? `${autoScores.emotion}` : '—';
      document.getElementById('scoreOverall').textContent = autoScores.overall != null ? `${autoScores.overall}` : '—';
    }

    // 操作按钮状态
    const isReviewed = data.status === 'REVIEWED' || data.status === 'ACCEPTED';
    const gradeButton = document.getElementById('btnGrade');
    if (gradeButton) gradeButton.disabled = isReviewed;
    syncReviewControls();
  }

  function applyEmptyState() {
    document.getElementById('studentName').textContent = '数据不足';
    document.getElementById('studentInfo').textContent = '—';
    document.getElementById('submitTime').textContent = '提交时间：—';
    document.getElementById('assignmentTitle').textContent = '—';
    document.getElementById('assignmentType').textContent = '—';
    document.getElementById('submitStatus').textContent = '—';
    document.getElementById('writtenAnswer').textContent = '数据不足';
  }

  function mapAssignmentType(type) {
    switch (type) {
      case 'READING': return '朗读任务';
      case 'ORAL': return '口语练习';
      case 'WRITTEN': return '书面练习';
      case 'RECORDING': return '录音任务';
      default: return type || '—';
    }
  }

  function mapStatus(status) {
    switch (status) {
      case 'SUBMITTED': return { label: '已提交', color: '#2b8757' };
      case 'NEEDS_REVIEW': return { label: '待复核', color: '#f18b18' };
      case 'REVIEWED': return { label: '已反馈', color: '#2b8757' };
      case 'ACCEPTED': return { label: '已通过', color: '#2b8757' };
      case 'RETURNED': case 'REJECTED': return { label: '已退回', color: '#d70710' };
      case 'PROCESSING': return { label: '处理中', color: 'inherit' };
      default: return { label: status || '—', color: 'inherit' };
    }
  }

  // ── 操作按钮 ──
  document.getElementById('btnGrade').addEventListener('click', () => {
    if (!submissionId) return;
    location.href = `/teacher/reviews/${encodeURIComponent(submissionId)}`;
  });

  document.getElementById('btnAccept').addEventListener('click', (event) => {
    return submitFeedback('ACCEPT', event);
  });
  document.getElementById('btnReturn').addEventListener('click', (event) => {
    return submitFeedback('RETURN', event);
  });
  const refreshFeedbackButton = document.getElementById('btnRefreshFeedback');
  if (refreshFeedbackButton) {
    refreshFeedbackButton.addEventListener('click', () => {
      return refreshAuthoritativeReviewState();
    });
  }

  // Playback status follows native media events; only "playing" confirms playback started.
  playbackAudio.addEventListener('playing', () => {
    setPlaybackStatus('正在播放录音。', 'playing');
  });
  playbackAudio.addEventListener('pause', () => {
    if (playbackAudio.getAttribute('src') && playbackAudio.currentTime > 0 && !playbackAudio.ended) {
      setPlaybackStatus('播放已暂停。', 'paused');
    }
  });
  playbackAudio.addEventListener('ended', () => {
    if (playbackAudio.getAttribute('src')) setPlaybackStatus('录音播放完成。', 'ended');
  });
  playbackAudio.addEventListener('error', () => {
    if (!playbackAudio.getAttribute('src')) return;
    clearPlaybackSource();
    setPlaybackStatus('录音媒体加载失败，请稍后重试。', 'media-error');
  });

  // ── 侧栏不支持导航 ──
  document.querySelectorAll('.subnav a').forEach(link => {
    const txt = link.textContent.trim();
    if (txt === '学生' || link.classList.contains('current')) return;
    link.removeAttribute('href');
    link.style.cursor = 'not-allowed';
    link.style.opacity = '.55';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showToast(`${txt}功能暂未开通`);
    });
  });

  // ── 初始化 ──
  submissionId = getSubmissionIdFromPath();
  loadSubmissionDetail();
})();
