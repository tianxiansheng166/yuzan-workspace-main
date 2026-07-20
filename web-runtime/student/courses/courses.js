(() => {
  'use strict';

  let allCourses = [];
  let currentFilter = 'all';

  const courseGrid = document.querySelector('#courseGrid');
  const emptyState = document.querySelector('#emptyState');

  function statusLabel(status) {
    const map = {
      NOT_STARTED: '未开始',
      IN_PROGRESS: '进行中',
      COMPLETED: '已完成',
      ACTIVE: '进行中',
    };
    return map[status] || status || '未知';
  }

  function statusBadgeClass(status) {
    if (status === 'COMPLETED' || status === 'completed') return 'badge-completed';
    if (status === 'IN_PROGRESS' || status === 'ACTIVE' || status === 'active') return 'badge-active';
    return 'badge-not_started';
  }

  function courseIcon(title) {
    if (/春/.test(title)) return '🌱';
    if (/夏/.test(title)) return '☀';
    if (/秋/.test(title)) return '🍂';
    if (/冬/.test(title)) return '❄';
    return '▣';
  }

  function renderCourseCard(course) {
    const progress = course.progress ?? course.completionRate ?? 0;
    const progressPct = Math.round(progress * 100) || 0;
    const status = course.status || course.enrollmentStatus || 'NOT_STARTED';
    const title = course.title || course.courseTitle || '未命名课程';
    const meta = [course.gradeBand, course.subject].filter(Boolean).join(' · ') || '语文朗读';

    const card = document.createElement('a');
    card.className = 'course-card';
    card.href = course.assignmentId
      ? `/student/learn/spring-2?assignmentId=${encodeURIComponent(course.assignmentId)}`
      : `/student/today`;
    card.dataset.status = status;

    card.innerHTML = `
      <div class="cover">
        <span>${courseIcon(title)}</span>
        <span class="badge ${statusBadgeClass(status)}">${statusLabel(status)}</span>
      </div>
      <div class="body">
        <h3>${title}</h3>
        <p class="meta">${meta}</p>
        <div class="progress-bar"><i style="width:${progressPct}%"></i></div>
        <div class="progress-label"><span>学习进度</span><span>${progressPct}%</span></div>
      </div>
    `;

    return card;
  }

  function renderCourses(courses) {
    // 清除骨架屏
    courseGrid.innerHTML = '';

    const filtered = currentFilter === 'all'
      ? courses
      : courses.filter(c => {
          const s = (c.status || c.enrollmentStatus || '').toUpperCase();
          if (currentFilter === 'active') return s === 'IN_PROGRESS' || s === 'ACTIVE';
          if (currentFilter === 'completed') return s === 'COMPLETED';
          if (currentFilter === 'not_started') return s === 'NOT_STARTED';
          return true;
        });

    if (filtered.length === 0) {
      courseGrid.style.display = 'none';
      emptyState.style.display = '';
      return;
    }

    courseGrid.style.display = '';
    emptyState.style.display = 'none';

    filtered.forEach(course => {
      courseGrid.appendChild(renderCourseCard(course));
    });
  }

  function updateStats(courses) {
    const total = courses.length;
    const active = courses.filter(c => {
      const s = (c.status || c.enrollmentStatus || '').toUpperCase();
      return s === 'IN_PROGRESS' || s === 'ACTIVE';
    }).length;
    const done = courses.filter(c => {
      const s = (c.status || c.enrollmentStatus || '').toUpperCase();
      return s === 'COMPLETED';
    }).length;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statActive').textContent = active;
    document.getElementById('statDone').textContent = done;
  }

  // 筛选按钮
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderCourses(allCourses);
    });
  });

  async function init() {
    if (!YuzanApi.requireAuth()) return;

    const schoolId = YuzanApi.getActiveSchoolId();
    if (!schoolId) {
      YuzanDemo.toast('请先选择学校', 'warning');
      location.href = '/select-school';
      return;
    }

    try {
      // 优先使用 student/courses-dashboard API
      let coursesData = null;
      try {
        coursesData = await YuzanApi.getStudentCoursesDashboard();
      } catch {}

      // 解析课程数据
      if (coursesData) {
        allCourses = Array.isArray(coursesData)
          ? coursesData
          : (coursesData.courses || coursesData.items || []);
      }

      // 如果 dashboard API 为空，回退到 learning/tasks
      if (allCourses.length === 0) {
        try {
          const tasksData = await YuzanApi.request(`/schools/${schoolId}/learning/tasks`);
          const taskList = Array.isArray(tasksData) ? tasksData : (tasksData?.items || []);
          allCourses = taskList.map(t => ({
            ...t,
            courseTitle: t.courseTitle || t.title,
            status: t.status || 'IN_PROGRESS',
            progress: t.progress || 0,
          }));
        } catch {}
      }

      updateStats(allCourses);
      renderCourses(allCourses);

    } catch (err) {
      YuzanDemo.toast(err.message || '加载课程列表失败', 'error');
      console.error(err);
      courseGrid.innerHTML = '';
      emptyState.style.display = '';
    }
  }

  init();
})();
