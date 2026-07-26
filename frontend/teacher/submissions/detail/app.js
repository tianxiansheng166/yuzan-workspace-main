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
      const data = await YuzanApi.request(`/schools/${schoolId}/submissions/${submissionId}`);
      submissionData = data;
      applySubmissionDetail(data);
    } catch (err) {
      showToast(err.message || '加载提交详情失败');
      applyEmptyState();
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

    // 录音
    const recordingUrl = data.recordingUrl || data.recording || '';
    if (recordingUrl) {
      const section = document.getElementById('recordingSection');
      section.style.display = '';
      const title = data.recordingTitle || assignmentTitle || '朗读录音';
      document.getElementById('recordingTitle').textContent = title;
      const duration = data.recordingDuration || data.duration || 0;
      document.getElementById('recordingDuration').textContent = duration > 0
        ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`
        : '—';
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
    ['btnGrade', 'btnAccept', 'btnReturn'].forEach((id) => {
      const button = document.getElementById(id);
      button.disabled = true;
      button.title = '没有可复核的提交证据';
    });
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

  // ── 播放按钮 ──
  document.getElementById('playBtn').addEventListener('click', () => {
    const btn = document.getElementById('playBtn');
    btn.classList.toggle('playing');
    btn.textContent = btn.classList.contains('playing') ? '❚❚' : '▶';
    showToast(btn.classList.contains('playing') ? '开始播放录音' : '暂停播放录音');
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
