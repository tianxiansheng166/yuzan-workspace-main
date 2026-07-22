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

  // ── LIVE_LOCAL: Tab 切换 ──
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showToast(`已切换到${btn.textContent}`);
    });
  });

  // ── LIVE_LOCAL: 播放按钮 ──
  document.querySelectorAll('.play-btn').forEach(btn => btn.addEventListener('click', () => {
    btn.classList.toggle('playing');
    btn.textContent = btn.classList.contains('playing') ? '❚❚' : '▶';
    showToast(btn.classList.contains('playing') ? '开始播放录音' : '暂停播放录音');
  }));

  // ── UNSUPPORTED: 编辑信息、更多操作 ──
  document.querySelectorAll('.outline-btn').forEach(btn => {
    const txt = btn.textContent.trim();
    btn.style.opacity = '.55';
    btn.style.cursor = 'not-allowed';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (txt.includes('编辑')) showToast('编辑学生信息功能暂未开通');
      else if (txt.includes('更多')) showToast('更多操作菜单暂未开通');
      else showToast('该功能暂未开通');
    });
  });

  // ── UNSUPPORTED: 各种操作按钮（联系家长、制定计划等） ──
  const unsupportedButtons = '.ghost-btn,.link-btn,.comm-row button,.resource-row button,.chip-row button,.action-card button';
  document.querySelectorAll(unsupportedButtons).forEach(btn => {
    const txt = btn.textContent.replace(/\s+/g, ' ').trim();
    if (txt.includes('查看学习轨迹')) {
      btn.addEventListener('click', () => {
        if (enrollmentId) location.href = `/teacher/students/${enrollmentId}`;
        else showToast('缺少学生标识，无法查看学习轨迹');
      });
      return;
    }
    if (txt.includes('查看全部')) {
      btn.addEventListener('click', () => showToast('详情列表功能暂未开通'));
      return;
    }
    btn.addEventListener('click', () => showToast(`${txt}功能暂未开通`));
  });

  // ── UNSUPPORTED: add-shot (＋) 按钮 ──
  document.querySelectorAll('.add-shot').forEach(btn => {
    btn.addEventListener('click', () => showToast('添加成长记录功能暂未开通'));
  });

  // ── LIVE_LOCAL: mini-info (i) 按钮 → 显示提示 ──
  document.querySelectorAll('.mini-info').forEach(btn => {
    btn.addEventListener('click', () => showToast('此处显示学习路径的详细说明'));
  });

  // ── LIVE_ROUTE: 动态路由（enrollmentId + classId） ──
  let enrollmentId = '';
  let classIdFromContext = '';
  let schoolId = '';

  function getEnrollmentIdFromPath() {
    // /teacher/students/:enrollmentId — 3rd segment
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length >= 3 && parts[0] === 'teacher' && parts[1] === 'students') {
      return parts[2];
    }
    return '';
  }

  // ── LIVE_ROUTE: 侧栏导航修复 ──
  const navRoutes = {
    '首页': '/teacher/assignments',
    '课程': '/teacher/courses/',
    '任务': '/teacher/assignments',
    '测评': '/teacher/assessments',
    '复核': '/teacher/reviews/',
    '报告': '/teacher/assessments/detail/',
  };
  document.querySelectorAll('.nav .nav-item').forEach(link => {
    const label = link.querySelector('span')?.textContent.trim() || '';
    if (navRoutes[label]) {
      link.href = navRoutes[label];
    } else if (label === '班级' || link.classList.contains('active')) {
      return;
    } else {
      link.removeAttribute('href');
      link.style.cursor = 'not-allowed';
      link.style.opacity = '.55';
      link.addEventListener('click', (e) => {
        e.preventDefault();
        showToast(`${label}功能暂未开通`);
      });
    }
  });

  // ── LIVE_ROUTE: 面包屑修复（动态classId） ──
  document.querySelectorAll('.crumbs a').forEach(link => {
    const txt = link.textContent.trim();
    if (txt === '班级') link.href = '/teacher/classes';
    else if (txt.includes('班')) {
      link.href = classIdFromContext ? `/teacher/classes/${classIdFromContext}` : '/teacher/classes';
    }
  });

  // ── UNSUPPORTED: 侧栏子导航 ──
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

  // ── UNSUPPORTED: 公益与支持 ──
  const supportBox = document.querySelector('.support-box');
  if (supportBox) {
    supportBox.style.cursor = 'not-allowed';
    supportBox.style.opacity = '.55';
    supportBox.addEventListener('click', () => showToast('公益与支持页面暂未开通'));
  }

  // ══════════════════════════════════════════
  //  API: 加载真实学生详情
  // ══════════════════════════════════════════

  function applyStudentProfile(data) {
    const enrollment = data.enrollment;
    if (!enrollment) return;

    // 更新学生姓名和页面标题
    const studentName = enrollment.studentName || enrollment.name || '未命名学生';
    const h1 = document.querySelector('.student-copy h1');
    if (h1) {
      const className = enrollment.className || enrollment.class_name || '';
      h1.innerHTML = className
        ? `${studentName} <span>${className}</span>`
        : studentName;
    }
    document.title = `${studentName}｜语赞心声`;

    // 更新学生信息行
    const ps = document.querySelectorAll('.student-copy p');
    if (ps[0]) {
      const studentNum = enrollment.studentNumber || enrollment.student_number || '—';
      const status = enrollment.status === 'ACTIVE' ? '在读' : enrollment.status === 'INACTIVE' ? '休学' : enrollment.status || '在读';
      ps[0].innerHTML = `学号：${studentNum} <i></i> <span class="status-pill">${status}</span>`;
    }
    if (ps[1]) {
      const lastActive = enrollment.lastActiveAt
        ? new Date(enrollment.lastActiveAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
        : '—';
      ps[1].textContent = `最近活跃：${lastActive}`;
    }
    if (ps[2]) {
      const intro = enrollment.selfIntroduction || enrollment.intro || '';
      ps[2].textContent = intro ? `学生自述：${intro}` : '';
    }

    // 更新面包屑中的班级名
    if (enrollment.className || enrollment.class_name) {
      document.querySelectorAll('.crumbs a').forEach(link => {
        if (link.textContent.includes('班') && !link.textContent.includes('班级')) {
          link.textContent = enrollment.className || enrollment.class_name;
        }
      });
    }

    // 如果有 classId，更新面包屑中的班级链接
    const cId = enrollment.classId || enrollment.class_id;
    if (cId) {
      classIdFromContext = cId;
      document.querySelectorAll('.crumbs a').forEach(link => {
        if (link.textContent.includes('班') && !link.textContent.includes('班级')) {
          link.href = `/teacher/classes/${cId}`;
        }
      });
    }

    // ── 渲染：课程列表 ──
    renderCourseList(enrollment);

    // ── 渲染：提交（任务与答案） ──
    renderSubmissions(data.submissions);

    // ── 渲染：朗读作品 ──
    renderRecordings(data.submissions);

    // ── 渲染：测评 ──
    renderAssessmentSessions(data.assessmentSessions);

    // ── 渲染：教师反馈 ──
    renderTeacherFeedback(data.submissions);

    // ── 渲染：学习计划 ──
    renderLearningPlan();
  }

  // ── 渲染：课程列表 ──
  function renderCourseList(enrollment) {
    const courses = enrollment.courses || enrollment.enrolledCourses || [];
    if (!Array.isArray(courses) || courses.length === 0) return;
    // 如果页面有课程相关区域，更新之
    // 当前页面布局没有独立课程区域，但可以更新学习路径阶段
  }

  // ── 渲染：提交列表（任务与答案） ──
  function renderSubmissions(submissions) {
    const tbody = document.querySelector('.tables-row .table-card:first-child tbody');
    if (!tbody) return;
    if (!submissions || !Array.isArray(submissions) || submissions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;">数据不足，暂无提交记录</td></tr>';
      return;
    }
    tbody.innerHTML = submissions.map(s => {
      const statusClass = s.status === 'SUBMITTED' || s.status === 'REVIEWED' ? 'done' : 'pass';
      const statusLabel = s.status === 'SUBMITTED' ? '已提交' : s.status === 'REVIEWED' ? '已反馈' : s.status === 'NEEDS_REVIEW' ? '待复核' : s.status || '—';
      const feedback = s.teacherComment || s.feedback || '';
      const submittedAt = s.submittedAt
        ? new Date(s.submittedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit' })
        : '—';
      const assignmentTitle = s.assignmentTitle || s.title || '—';
      const type = s.assignmentType || s.type || '—';
      return `<tr data-submission-id="${s.id || s.submissionId || ''}" style="cursor:pointer">
        <td>${assignmentTitle}</td>
        <td>${type}</td>
        <td>${submittedAt}</td>
        <td><span class="table-pill ${statusClass}">${statusLabel}</span></td>
        <td>${feedback || '—'}</td>
      </tr>`;
    }).join('');

    // 点击提交行跳转到提交详情
    tbody.querySelectorAll('tr[data-submission-id]').forEach(tr => {
      tr.addEventListener('click', () => {
        const sid = tr.dataset.submissionId;
        if (sid) location.href = `/teacher/submissions/${sid}`;
      });
    });
  }

  // ── 渲染：朗读作品 ──
  function renderRecordings(submissions) {
    const card = document.querySelector('.evidence-card');
    if (!card) return;
    const container = card.querySelector('.audio-rows') || card;
    // 找到现有的 audio-row 元素区域
    const existingRows = card.querySelectorAll('.audio-row');

    if (!submissions || !Array.isArray(submissions)) return;

    // 筛选有录音的提交
    const recordings = submissions.filter(s => s.recordingUrl || s.hasRecording || s.recording);
    if (recordings.length === 0) {
      // 保留原有静态内容，不覆盖
      return;
    }

    // 替换现有音频行
    const firstRow = existingRows[0];
    if (!firstRow) return;

    // 移除旧行
    existingRows.forEach(r => r.remove());

    // 插入新的音频行
    recordings.slice(0, 5).forEach(r => {
      const title = r.assignmentTitle || r.title || '朗读作品';
      const tag = r.assignmentType === 'ORAL' ? '口语' : r.assignmentType === 'READING' ? '朗读' : '复读';
      const tagColor = tag === '朗读' ? 'orange' : tag === '口语' ? 'yellow' : 'green';
      const date = r.submittedAt
        ? new Date(r.submittedAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
        : '—';
      const duration = r.duration ? `${Math.floor(r.duration / 60)}:${String(r.duration % 60).padStart(2, '0')}` : '—';

      const row = document.createElement('div');
      row.className = 'audio-row';
      row.innerHTML = `<span class="wave"></span><div><b><em class="tag ${tagColor}">${tag}</em>${title}</b><p>录制于 ${date}</p></div><button class="play-btn">▶</button><small>${duration}</small>`;
      card.appendChild(row);

      // 播放按钮事件
      const playBtn = row.querySelector('.play-btn');
      playBtn.addEventListener('click', () => {
        playBtn.classList.toggle('playing');
        playBtn.textContent = playBtn.classList.contains('playing') ? '❚❚' : '▶';
        showToast(playBtn.classList.contains('playing') ? '开始播放录音' : '暂停播放录音');
      });
    });
  }

  // ── 渲染：测评 ──
  function renderAssessmentSessions(assessmentSessions) {
    const tbody = document.querySelector('.tables-row .table-card:last-child tbody');
    if (!tbody) return;
    if (!assessmentSessions || !Array.isArray(assessmentSessions) || assessmentSessions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;">数据不足，暂无测评记录</td></tr>';
      return;
    }
    tbody.innerHTML = assessmentSessions.map(a => {
      const statusClass = a.score >= 80 ? 'good' : a.score >= 60 ? 'pass' : 'done';
      const statusLabel = a.score >= 80 ? '良好' : a.score >= 60 ? '合格' : '需加强';
      const type = a.type === 'ORAL' ? '口语测评' : a.type === 'READING' ? '朗读测评' : a.type === 'FORMATIVE' ? '过程测评' : a.type === 'PROCESS' ? '过程观察' : a.type || '—';
      const date = a.completedAt || a.assessedAt
        ? new Date(a.completedAt || a.assessedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit' })
        : '—';
      const title = a.title || a.assessmentTitle || '—';
      const feedback = a.feedbackSummary || a.feedback || '';
      return `<tr>
        <td>${title}</td>
        <td>${type}</td>
        <td>${date}</td>
        <td><span class="table-pill ${statusClass}">${statusLabel}</span></td>
        <td>${feedback || '—'}</td>
      </tr>`;
    }).join('');
  }

  // ── 渲染：教师反馈 ──
  function renderTeacherFeedback(submissions) {
    if (!submissions || !Array.isArray(submissions)) return;
    const withFeedback = submissions.filter(s => s.teacherComment || s.feedback);
    // 更新支持面板中的教学建议区域
    const bulletList = document.querySelector('.bullet-list');
    if (bulletList && withFeedback.length > 0) {
      const feedbackItems = withFeedback.slice(0, 3).map(s =>
        `<li>${s.teacherComment || s.feedback}</li>`
      );
      bulletList.innerHTML = feedbackItems.join('');
    }
  }

  // ── 渲染：学习计划 ──
  function renderLearningPlan() {
    const planCard = document.querySelector('.action-card.main-link');
    if (!planCard) return;
    const p = planCard.querySelector('p');
    if (p) p.textContent = '暂无学习计划';
  }

  async function loadStudentProfile() {
    if (!enrollmentId) {
      showToast('缺少学生标识，无法加载');
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

    const basePath = `/schools/${schoolId}/enrollments/${enrollmentId}`;

    try {
      const [enrollmentRes, submissionsRes, assessmentsRes] = await Promise.allSettled([
        YuzanApi.request(`${basePath}`),
        YuzanApi.request(`${basePath}/submissions`),
        YuzanApi.request(`${basePath}/assessment-sessions`),
      ]);

      const enrollment = enrollmentRes.status === 'fulfilled' ? enrollmentRes.value : null;
      const submissions = submissionsRes.status === 'fulfilled'
        ? (Array.isArray(submissionsRes.value) ? submissionsRes.value : submissionsRes.value?.items || [])
        : [];
      const assessmentSessions = assessmentsRes.status === 'fulfilled'
        ? (Array.isArray(assessmentsRes.value) ? assessmentsRes.value : assessmentsRes.value?.items || [])
        : [];

      if (!enrollment) {
        showToast('加载学生详情失败');
        return;
      }

      applyStudentProfile({ enrollment, submissions, assessmentSessions });
    } catch (err) {
      showToast(err.message || '加载学生详情失败');
    }
  }

  enrollmentId = getEnrollmentIdFromPath();
  loadStudentProfile();
})();
