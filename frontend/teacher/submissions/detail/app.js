(() => {
  'use strict';

  const toast = document.getElementById('toast');
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
  let hasReviewEvidence = false;

  const reviewButtonIds = ['btnGrade', 'btnAccept', 'btnReturn'];

  function setReviewControls(enabled, reason) {
    reviewButtonIds.forEach((id) => {
      const button = document.getElementById(id);
      button.disabled = !enabled;
      button.title = enabled ? '' : reason;
    });
  }

  function setEvidenceState(kind, message) {
    const state = document.getElementById('evidenceState');
    state.classList.remove('ready', 'blocked');
    if (kind) state.classList.add(kind);
    document.getElementById('evidenceMessage').textContent = message;
  }

  async function hasTeacherReviewRole() {
    let user = YuzanApi.getStoredUser();
    if (!user) {
      try {
        const me = await YuzanApi.me();
        user = me?.user || YuzanApi.getStoredUser();
      } catch {
        return false;
      }
    }
    const memberships = Array.isArray(user?.memberships) ? user.memberships : [];
    return memberships.some((membership) => (
      membership?.schoolId === schoolId
      && ['TEACHER', 'SCHOOL_ADMIN'].includes(membership?.role)
    ));
  }

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
      if (!(await hasTeacherReviewRole())) {
        applyEmptyState('当前账号没有教师复核权限。此页面不会请求或展示该提交。');
        return;
      }
      const data = await YuzanApi.request(`/schools/${schoolId}/submissions/${submissionId}`);
      submissionData = data;
      applySubmissionDetail(data);
    } catch (err) {
      if (err.status === 403) {
        applyEmptyState('服务端拒绝访问：当前账号无权复核该提交。');
      } else {
        applyEmptyState('无法读取提交证据，复核操作已关闭。');
      }
      showToast(actionableError(err, '加载提交详情失败'));
    }
  }

  // ── 渲染：提交详情 ──
  function applySubmissionDetail(data) {
    if (!data) { applyEmptyState(); return; }
    document.getElementById('btnGrade').textContent = '批改';
    document.getElementById('btnAccept').textContent = '通过';
    document.getElementById('btnReturn').textContent = '退回';

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
    const answer = String(data.writtenAnswer || data.answer || data.textResponse || '').trim();
    document.getElementById('writtenAnswer').textContent = answer || '数据不足';

    // 录音
    const recordingUrl = data.recordingUrl
      || (typeof data.recording === 'string' ? data.recording : data.recording?.url)
      || '';
    const recordingSection = document.getElementById('recordingSection');
    const playButton = document.getElementById('playBtn');
    const recordingAudio = document.getElementById('recordingAudio');
    recordingSection.style.display = 'none';
    playButton.disabled = true;
    recordingAudio.removeAttribute('src');
    if (recordingUrl) {
      recordingSection.style.display = '';
      recordingAudio.src = recordingUrl;
      playButton.disabled = false;
      const title = data.recordingTitle || assignmentTitle || '朗读录音';
      document.getElementById('recordingTitle').textContent = title;
      const duration = data.recordingDuration || data.duration || 0;
      document.getElementById('recordingDuration').textContent = duration > 0
        ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`
        : '—';
    }

    hasReviewEvidence = Boolean(answer || recordingUrl);
    const canReview = hasReviewEvidence && data.status === 'NEEDS_REVIEW';
    if (hasReviewEvidence) {
      setEvidenceState('ready', recordingUrl
        ? '已读取当前提交的录音证据，可播放后进行复核。'
        : '已读取当前提交的书面答案，可进行复核。');
    } else {
      setEvidenceState('blocked', '当前提交没有答案或录音证据，播放、批改、通过和退回均已关闭。请等待学生完成提交。');
    }

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

    // 教师复核
    const review = data.teacherReview || data.review || data.feedback || null;
    if (review || data.teacherComment || data.reviewScore != null) {
      const section = document.getElementById('teacherReviewSection');
      section.style.display = '';
      const reviewStatus = review?.status || data.reviewStatus || data.status || '—';
      const reviewComment = review?.comment || data.teacherComment || '';
      const reviewScore = review?.score != null ? review.score : data.reviewScore;
      document.getElementById('reviewStatus').textContent = mapReviewStatus(reviewStatus);
      document.getElementById('reviewComment').textContent = reviewComment || '—';
      document.getElementById('reviewScore').textContent = reviewScore != null ? `${reviewScore}` : '—';
    }

    // 操作按钮状态
    const reason = !hasReviewEvidence
      ? '没有可复核的答案或录音证据'
      : `当前状态 ${mapStatus(data.status).label} 不允许再次复核`;
    setReviewControls(canReview, reason);
  }

  function applyEmptyState(message = '没有可复核的提交证据。') {
    submissionData = null;
    hasReviewEvidence = false;
    document.getElementById('studentName').textContent = '数据不足';
    document.getElementById('studentInfo').textContent = '—';
    document.getElementById('submitTime').textContent = '提交时间：—';
    document.getElementById('assignmentTitle').textContent = '—';
    document.getElementById('assignmentType').textContent = '—';
    document.getElementById('submitStatus').textContent = '—';
    document.getElementById('writtenAnswer').textContent = '数据不足';
    document.getElementById('recordingSection').style.display = 'none';
    document.getElementById('playBtn').disabled = true;
    setEvidenceState('blocked', message);
    setReviewControls(false, message);
  }

  function actionableError(err, fallback) {
    if (err?.status === 400) return '请求未通过校验：请确认反馈具体、完整后重试。';
    if (err?.status === 403) return '服务端拒绝操作：当前账号没有该提交的复核权限。';
    if (err?.status === 409) return '提交已被其他页面更新，请刷新后基于最新状态重试。';
    return err?.message || fallback;
  }

  async function submitFeedback(decision, comment, button, pendingText) {
    if (!submissionId || !schoolId || !hasReviewEvidence || button.disabled) return;
    const originalText = button.textContent;
    setReviewControls(false, '正在保存复核结果');
    button.textContent = pendingText;
    try {
      await YuzanApi.request(`/schools/${schoolId}/submissions/${submissionId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ decision, comment }),
      });
      showToast(decision === 'RETURN' ? '退回反馈已保存，正在刷新状态' : '通过结果已保存，正在刷新状态');
      await loadSubmissionDetail();
    } catch (err) {
      button.textContent = originalText;
      if (err.status === 403) {
        setReviewControls(false, '服务端拒绝复核权限');
      } else if (err.status === 409) {
        await loadSubmissionDetail();
      } else {
        setReviewControls(Boolean(hasReviewEvidence && submissionData?.status === 'NEEDS_REVIEW'), '');
      }
      showToast(actionableError(err, '复核结果保存失败，请重试'));
    }
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
      case 'REJECTED': case 'RETURNED': case 'REDO_REQUIRED': return { label: '已退回', color: '#d70710' };
      default: return { label: status || '—', color: 'inherit' };
    }
  }

  function mapReviewStatus(status) {
    switch (status) {
      case 'ACCEPTED': case 'APPROVED': return '已通过';
      case 'REJECTED': case 'RETURNED': return '已退回';
      case 'REVIEWED': return '已反馈';
      case 'PENDING': case 'NEEDS_REVIEW': return '待复核';
      default: return status || '—';
    }
  }

  // ── 操作按钮 ──
  document.getElementById('btnGrade').addEventListener('click', () => {
    if (!submissionId) return;
    location.href = `/teacher/reviews/${submissionId}`;
  });

  document.getElementById('btnAccept').addEventListener('click', async () => {
    const btn = document.getElementById('btnAccept');
    await submitFeedback('ACCEPT', '证据已核验，予以通过', btn, '处理中…');
  });

  const returnDialog = document.getElementById('returnDialog');
  const returnComment = document.getElementById('returnComment');
  const returnValidation = document.getElementById('returnValidation');
  document.getElementById('btnReturn').addEventListener('click', () => {
    if (!hasReviewEvidence) return;
    returnValidation.textContent = '';
    returnDialog.showModal();
    returnComment.focus();
  });
  document.getElementById('cancelReturn').addEventListener('click', () => returnDialog.close());
  document.getElementById('returnForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const comment = returnComment.value.trim();
    if (comment.length < 2) {
      returnValidation.textContent = '请填写至少 2 个字的具体修改建议。';
      returnComment.focus();
      return;
    }
    returnDialog.close();
    await submitFeedback('RETURN', comment, document.getElementById('btnReturn'), '处理中…');
  });

  // ── 播放按钮 ──
  document.getElementById('playBtn').addEventListener('click', async () => {
    const btn = document.getElementById('playBtn');
    const audio = document.getElementById('recordingAudio');
    if (btn.disabled || !audio.src) return;
    if (audio.paused) {
      try {
        await audio.play();
        btn.textContent = '❚❚';
        btn.setAttribute('aria-label', '暂停录音');
      } catch {
        showToast('录音无法播放，请检查证据文件是否仍可访问。');
      }
    } else {
      audio.pause();
    }
  });
  document.getElementById('recordingAudio').addEventListener('pause', () => {
    const btn = document.getElementById('playBtn');
    btn.textContent = '▶';
    btn.setAttribute('aria-label', '播放录音');
  });
  document.getElementById('recordingAudio').addEventListener('ended', () => {
    const btn = document.getElementById('playBtn');
    btn.textContent = '▶';
    btn.setAttribute('aria-label', '播放录音');
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
