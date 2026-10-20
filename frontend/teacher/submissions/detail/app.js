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

    try {
      const data = await YuzanApi.request(`/schools/${schoolId}/submissions/${submissionId}`);
      submissionData = data;
      applySubmissionDetail(data);
      await loadSubmissionRecordingPlayback();
    } catch (err) {
      showToast(err.message || '加载提交详情失败');
      applyEmptyState();
      showPlaybackFailure(err);
    }
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
    const isReviewed = data.status === 'REVIEWED' || data.status === 'ACCEPTED';
    document.getElementById('btnGrade').disabled = isReviewed;
    document.getElementById('btnAccept').disabled = isReviewed;
    document.getElementById('btnReturn').disabled = isReviewed;
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
      case 'REJECTED': return { label: '已退回', color: '#d70710' };
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
    if (!submissionId || !schoolId) return;
    const btn = document.getElementById('btnAccept');
    btn.disabled = true;
    btn.textContent = '处理中…';
    try {
      await YuzanApi.request(`/schools/${schoolId}/submissions/${submissionId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ decision: 'ACCEPT', comment: '已通过' }),
      });
      showToast('已标记为通过');
      const statusEl = document.getElementById('submitStatus');
      statusEl.textContent = '已通过';
      statusEl.style.color = '#2b8757';
      btn.textContent = '已通过';
    } catch (err) {
      btn.disabled = false;
      btn.textContent = '通过';
      showToast(err.message || '操作失败');
    }
  });

  document.getElementById('btnReturn').addEventListener('click', async () => {
    if (!submissionId || !schoolId) return;
    const btn = document.getElementById('btnReturn');
    btn.disabled = true;
    btn.textContent = '处理中…';
    try {
      await YuzanApi.request(`/schools/${schoolId}/submissions/${submissionId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ decision: 'REJECT', comment: '请重新提交' }),
      });
      showToast('已退回');
      const statusEl = document.getElementById('submitStatus');
      statusEl.textContent = '已退回';
      statusEl.style.color = '#d70710';
      btn.textContent = '已退回';
    } catch (err) {
      btn.disabled = false;
      btn.textContent = '退回';
      showToast(err.message || '操作失败');
    }
  });

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
