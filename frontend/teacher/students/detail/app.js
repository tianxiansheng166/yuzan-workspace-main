(() => {
  'use strict';

  const toast = document.getElementById('toast');
  const errorBox = document.getElementById('studentError');
  let toastTimer;
  let schoolId = '';
  let classId = '';
  let enrollmentId = '';

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function errorText(error) {
    if (error?.status === 401) return '登录已过期，请重新登录后查看学生详情。';
    if (error?.status === 403) return '当前账号无权访问该学校或班级中的学生记录。';
    if (error?.status === 404) return '学生学籍或授权班级不存在，或学籍已失效。';
    return `${error?.message || '学生详情暂不可用'}。请检查网络后重试。`;
  }

  function showError(message, status) {
    errorBox.hidden = false;
    errorBox.innerHTML = `<p>${escapeHtml(message)}</p>${status === 401 ? '<a href="/login/">重新登录</a>' : ''}`;
    document.querySelector('#learningSummary').innerHTML = '<p>学习进度暂不可用。</p>';
    document.querySelector('#studentAssignments').innerHTML = '<p>任务记录暂不可用。</p>';
    document.querySelector('#studentAssessments').innerHTML = '<p>测评记录暂不可用。</p>';
    document.querySelector('#studentEvidence').innerHTML = '<p>录音与提交证据暂不可用。</p>';
  }

  function dateText(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '—'
      : date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function loadUrlContext() {
    const parts = location.pathname.split('/').filter(Boolean);
    enrollmentId = parts[0] === 'teacher' && parts[1] === 'students' ? parts[2] || '' : '';
    const params = new URLSearchParams(location.search);
    schoolId = params.get('schoolId') || '';
    classId = params.get('classId') || '';
  }

  function setActionLinks(student) {
    const classQuery = new URLSearchParams({ schoolId, studentId: enrollmentId });
    const classUrl = `/teacher/classes/${encodeURIComponent(classId)}?${classQuery}#students`;
    const back = document.getElementById('backToClass');
    back.href = classUrl;
    document.getElementById('assignSupplementary').href = classUrl;
    document.getElementById('classBreadcrumb').textContent = student.className || '授权班级';
    document.getElementById('classBreadcrumb').href = back.href;
    document.getElementById('schoolContext').textContent = `学校 ${schoolId}`;
  }

  function renderStudent(data) {
    const student = data.enrollment;
    if (!student || student.id !== enrollmentId || student.classId !== classId) {
      throw new Error('学生详情与当前班级路径不一致，请返回本人授权班级重试。');
    }
    const name = student.displayName || '未命名学生';
    document.title = `${name}｜学生详情｜语赞心声`;
    document.querySelector('.student-copy h1').innerHTML = `${escapeHtml(name)} <span>${escapeHtml(student.className)}</span>`;
    const profileLines = document.querySelectorAll('.student-copy p');
    profileLines[0].textContent = `${student.grade || '年级未设置'} · 学籍 ${student.status === 'ACTIVE' ? '在读' : student.status}`;
    profileLines[1].textContent = `加入班级：${dateText(student.joinedAt)}`;
    setActionLinks(student);
    renderLearning(data.learning);
    renderAssignments(data.assignments);
    renderAssessments(data.assessments);
    renderEvidence(data.recordings);
  }

  function renderLearning(learning = {}) {
    const summary = document.getElementById('learningSummary');
    const rate = learning.completionRate;
    const progress = rate == null
      ? '<p>尚无可用的学习活动进度记录。</p>'
      : `<div class="student-progress-row"><strong>${escapeHtml(rate)}%</strong><span>完成 ${escapeHtml(learning.completedActivities)} / ${escapeHtml(learning.totalActivities)} 项真实活动</span></div><div class="student-progress-track"><i style="width:${Math.max(0, Math.min(100, Number(rate)))}%"></i></div>`;
    summary.innerHTML = `${progress}<p>最近活动：${escapeHtml(dateText(learning.lastActivityAt))}</p>`;
    document.getElementById('activityLastSeen').textContent = learning.lastActivityAt
      ? `最近活动：${dateText(learning.lastActivityAt)}`
      : '尚无学习活动记录';
  }

  const assignmentStatus = (status) => ({
    OPEN: '进行中', DRAFT: '草稿', SCHEDULED: '已排期', CLOSED: '已关闭', CANCELLED: '已取消',
  }[status] || status || '—');
  const submissionStatus = (status) => ({
    IN_PROGRESS: '进行中', PENDING_SYNC: '待同步', SUBMITTED: '待复核', PROCESSING: '处理中',
    NEEDS_REVIEW: '待复核', REVIEWED: '已复核', RETURNED: '已退回', ACCEPTED: '已通过',
  }[status] || status || '未提交');

  function renderAssignments(assignments) {
    const root = document.getElementById('studentAssignments');
    if (!Array.isArray(assignments)) {
      root.innerHTML = '<p>服务端没有返回任务记录。</p>';
      return;
    }
    if (!assignments.length) {
      root.innerHTML = '<p>该学生当前没有目标任务记录。</p>';
      return;
    }
    root.innerHTML = assignments.map((assignment) => {
      const submission = assignment.submissionStatus
        ? `已提交：${submissionStatus(assignment.submissionStatus)}`
        : '尚未提交';
      const query = new URLSearchParams({ assignmentId: assignment.assignmentId, classId, enrollmentId });
      const reviewLink = assignment.submissionId
        ? `<a href="/teacher/submissions/${encodeURIComponent(assignment.submissionId)}?${query}">打开真实提交与复核 →</a>`
        : '';
      const feedback = assignment.feedback
        ? `<p class="record-feedback">教师反馈：${escapeHtml(assignment.feedback.comment || '已保存')} ${assignment.feedback.score == null ? '' : `· ${escapeHtml(assignment.feedback.score)} 分`}</p>`
        : '';
      return `<article class="student-record-row">
        <div><strong>${escapeHtml(assignment.title)}</strong><p>${escapeHtml(assignment.courseTitle || '课程版本未命名')} · ${escapeHtml(assignmentStatus(assignment.status))} · 截止 ${escapeHtml(dateText(assignment.dueAt))}</p><p>${escapeHtml(submission)}</p>${feedback}${reviewLink}</div>
      </article>`;
    }).join('');
  }

  function renderAssessments(assessments) {
    const root = document.getElementById('studentAssessments');
    const diagnostics = document.getElementById('diagnosticLinks');
    if (!Array.isArray(assessments)) {
      root.innerHTML = '<p>服务端没有返回测评记录。</p>';
      return;
    }
    if (!assessments.length) {
      root.innerHTML = '<p>暂无测评会话或正式报告。</p>';
      diagnostics.innerHTML = '<p>暂无可进入的测评诊断。</p>';
      return;
    }
    root.innerHTML = assessments.map((assessment) => {
      const formalResult = assessment.overallScore == null
        ? '尚无正式报告分数'
        : `正式报告 ${escapeHtml(assessment.overallScore)} 分`;
      return `<article class="student-record-row"><div>
        <strong>${escapeHtml(assessment.title || '测评会话')}</strong>
        <p>${escapeHtml(assessment.type)} · ${escapeHtml(assessment.status)} · ${escapeHtml(dateText(assessment.completedAt || assessment.createdAt))}</p>
        <p>${formalResult}${assessment.reportGeneratedAt ? ` · 报告生成于 ${escapeHtml(dateText(assessment.reportGeneratedAt))}` : ''}</p>
      </div></article>`;
    }).join('');
    const links = assessments.filter((item) => item.practiceDefinitionId);
    diagnostics.innerHTML = links.length
      ? links.map((item) => {
          const query = new URLSearchParams({ schoolId, classId, enrollmentId, practiceDefinitionId: item.practiceDefinitionId });
          return `<p><a href="/teacher/diagnostics/?${query}">${escapeHtml(item.title || item.type || '测评')} · 查看授权学情诊断 →</a></p>`;
        }).join('')
      : '<p>没有关联练习定义的测评暂不提供诊断入口。</p>';
  }

  function renderEvidence(recordings) {
    const root = document.getElementById('studentEvidence');
    if (!Array.isArray(recordings)) {
      root.innerHTML = '<p>服务端没有返回录音记录。</p>';
      return;
    }
    if (!recordings.length) {
      root.innerHTML = '<p>暂无录音证据。</p>';
      return;
    }
    root.innerHTML = recordings.map((recording) => {
      const label = recording.assignmentTitle || '学习录音';
      const playable = ['COMPLETE', 'PROCESSING', 'READY'].includes(recording.status);
      return `<article class="student-record-row evidence-record" data-recording-id="${escapeHtml(recording.recordingId)}">
        <div><strong>${escapeHtml(label)}</strong><p>${escapeHtml(recording.status)} · ${recording.durationMs == null ? '时长未知' : `${Math.round(recording.durationMs / 1000)} 秒`} · ${escapeHtml(dateText(recording.createdAt))}</p>
        ${playable ? `<button type="button" data-play-recording="${escapeHtml(recording.recordingId)}">加载录音证据</button>` : '<span>录音尚未准备好播放</span>'}
        <div class="recording-player" data-recording-player="${escapeHtml(recording.recordingId)}"></div></div>
      </article>`;
    }).join('');
  }

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-play-recording]');
    if (!button) return;
    const recordingId = button.dataset.playRecording;
    const player = document.querySelector(`[data-recording-player="${CSS.escape(recordingId)}"]`);
    button.disabled = true;
    button.textContent = '正在读取授权录音…';
    try {
      const evidence = await YuzanApi.request(`/schools/${schoolId}/recordings/${encodeURIComponent(recordingId)}/evidence`);
      if (!evidence?.downloadUrl) throw new Error('录音服务未返回可播放证据');
      player.innerHTML = `<audio controls preload="none" src="${escapeHtml(evidence.downloadUrl)}">当前浏览器无法播放该录音。</audio>`;
      button.textContent = '录音证据已加载';
    } catch (error) {
      button.disabled = false;
      button.textContent = '重试读取录音证据';
      player.innerHTML = `<p role="alert">${escapeHtml(errorText(error))}</p>`;
      showToast(error.status === 403 ? '当前账号无权查看该录音' : '录音证据读取失败');
    }
  });

  async function loadStudentDetail() {
    loadUrlContext();
    if (!enrollmentId || !classId || !schoolId) {
      showError('缺少真实学校、班级或学生学籍标识。请从本人授权班级的学生名单进入。');
      return;
    }
    if (typeof YuzanApi === 'undefined' || !YuzanApi.getToken()) {
      location.href = '/login/';
      return;
    }
    const activeSchoolId = YuzanApi.getActiveSchoolId();
    if (!activeSchoolId) {
      location.href = '/select-school/';
      return;
    }
    document.getElementById('schoolContext').textContent = `学校 ${schoolId}`;
    try {
      const data = await YuzanApi.request(`/schools/${encodeURIComponent(schoolId)}/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(enrollmentId)}`);
      renderStudent(data);
    } catch (error) {
      const message = errorText(error);
      showError(message, error.status);
      document.querySelector('.student-copy h1').textContent = '学生详情暂不可用';
      showToast(message);
      if (error.status === 401) location.href = '/login/';
    }
  }

  loadStudentDetail();
})();
