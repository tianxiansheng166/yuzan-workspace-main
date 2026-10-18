(() => {
  'use strict';

  const modal = document.querySelector('#modal');
  const form = document.querySelector('#taskForm');
  const table = document.querySelector('.task-table');
  const dialogError = form.querySelector('.dialog-error');

  let classes = [];
  let courseVersions = [];
  let assignments = [];
  let schoolId = '';
  let assignmentStats = new Map();
  let dashboardData = null;
  let dashboardError = null;
  let attentionFilter = '';

  const statusMap = {
    DRAFT: { label: '已保存草稿', cls: 'gold' },
    SCHEDULED: { label: '已排期（需手动开放）', cls: 'gold' },
    OPEN: { label: '已发布', cls: 'green' },
    CLOSED: { label: '已结束', cls: 'gray' },
    CANCELLED: { label: '已取消', cls: 'red' },
    ARCHIVED: { label: '已归档', cls: 'gray' },
  };

  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function formatDateTimeFull(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function getClassById(classId) {
    return classes.find((c) => c.id === classId);
  }

  function classDisplay(assignment) {
    const classTarget = assignment.targets?.find((t) => t.targetType === 'CLASS');
    if (classTarget) {
      const cls = getClassById(classTarget.classId);
      return cls ? `${cls.grade}${cls.name}` : '班级未指定';
    }
    const studentTarget = assignment.targets?.find((t) => t.targetType === 'STUDENT');
    if (studentTarget) return '学生个人';
    return '班级未指定';
  }

  function submissionDisplay(assignment) {
    const stats = assignmentStats.get(assignment.id);
    if (!stats || stats.error) return '提交统计暂不可用';
    return `${stats.submittedCount} / ${stats.totalStudents} 人已提交`;
  }

  function statusDisplay(status) {
    const s = statusMap[status] || { label: status, cls: '' };
    return `<em class="${s.cls}">${s.label}</em>`;
  }

  function ensureAuth() {
    if (!YuzanApi.getToken()) {
      YuzanDemo.toast('请先登录', 'warning');
      location.href = '/login';
      return false;
    }
    schoolId = YuzanApi.getActiveSchoolId();
    if (!schoolId) {
      YuzanDemo.toast('请先选择学校', 'warning');
      location.href = '/select-school';
      return false;
    }
    return true;
  }

  async function loadClasses() {
    const data = await YuzanApi.request(`/schools/${schoolId}/classes/teachers/me`, { method: 'GET' });
    classes = Array.isArray(data) ? data : (data.items || []);
    populateClassSelect();
  }

  async function loadCourseVersions() {
    const data = await YuzanApi.request(`/schools/${schoolId}/course-versions?limit=100`, { method: 'GET' });
    courseVersions = (Array.isArray(data) ? data : (data.items || [])).filter(c => c.status === 'PUBLISHED');
    form.courseVersionId.innerHTML = courseVersions.map(c => `<option value="${escape(c.id)}">${escape(c.title)} · v${c.version}</option>`).join('');
    if (courseVersions.length > 0) {
      form.courseVersionId.value = courseVersions[0].id;
    }
  }

  async function loadAssignments() {
    const data = await YuzanApi.request(`/schools/${schoolId}/assignments?limit=100`, { method: 'GET' });
    assignments = Array.isArray(data) ? data : (data.items || []);
    const [statsResults, dashboardResult] = await Promise.all([
      Promise.all(assignments.map(async (assignment) => {
        try {
          return [assignment.id, await YuzanApi.getAssignmentStats(assignment.id)];
        } catch (error) {
          return [assignment.id, { error }];
        }
      })),
      YuzanApi.getDashboard().then((value) => ({ value }), (error) => ({ error })),
    ]);
    assignmentStats = new Map(statsResults);
    dashboardData = dashboardResult.value || null;
    dashboardError = dashboardResult.error || null;
    renderTable();
    renderAttention();
    revealRequestedAssignment();
  }

  function revealRequestedAssignment() {
    const requestedId = new URLSearchParams(location.search).get('assignmentId');
    if (!requestedId) return;
    const row = [...table.querySelectorAll('.row[data-id]')].find(item => item.dataset.id === requestedId);
    if (!row) return;
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    row.click();
  }

  function renderAttention() {
    const openTasks = assignments.filter((assignment) => assignment.status === 'OPEN');
    const statFailures = assignments.some((assignment) => assignmentStats.get(assignment.id)?.error);
    const missingTargetCount = statFailures
      ? null
      : openTasks.reduce((sum, assignment) => sum + (assignmentStats.get(assignment.id)?.notSubmittedCount ?? 0), 0);
    const pendingReviewCount = dashboardData?.workflow?.find((item) => item.id === 'review')?.count;
    document.getElementById('attentionOpenCount').textContent = String(openTasks.length);
    document.getElementById('attentionMissingCount').textContent = missingTargetCount == null ? '—' : String(missingTargetCount);
    document.getElementById('attentionReviewCount').textContent = Number.isFinite(pendingReviewCount) ? String(pendingReviewCount) : '—';

    const missingRows = openTasks
      .filter((assignment) => (assignmentStats.get(assignment.id)?.notSubmittedCount ?? 0) > 0)
      .slice(0, 3)
      .map((assignment) => {
        const count = assignmentStats.get(assignment.id).notSubmittedCount;
        return `<li data-kind="missing"><i>!</i><div><h3>${escape(assignment.title)}</h3><p>${count} 个任务目标尚未提交。</p><a data-nav href="/teacher/assignments?assignmentId=${encodeURIComponent(assignment.id)}">查看任务　›</a></div></li>`;
      });
    const reviewRows = (dashboardData?.reviews || []).slice(0, 3).map((review) =>
      `<li data-kind="review"><i>✓</i><div><h3>${escape(review.studentName || '学生')} · ${escape(review.taskTitle || '待复核')}</h3><p>${escape(formatDateTime(review.submittedAt))} 提交。</p><a data-nav href="/teacher/submissions/${encodeURIComponent(review.submissionId)}">查看提交　›</a></div></li>`,
    );
    const list = document.getElementById('attentionList');
    const rows = [...missingRows, ...reviewRows];
    if (rows.length) {
      list.innerHTML = rows.join('');
    } else if (dashboardError) {
      list.innerHTML = `<li><i>!</i><div><h3>复核统计暂不可用</h3><p>${escape(dashboardError.message || '检查网络或权限后重新加载。')}</p><a data-nav href="/teacher/reviews/">打开复核队列　›</a></div></li>`;
    } else {
      list.innerHTML = '<li><i>✓</i><div><h3>当前没有待跟进项</h3><p>统计来自当前教师授权任务和复核提交。</p></div></li>';
    }
  }

  function populateClassSelect() {
    const select = form.querySelector('select[name="classId"]');
    select.innerHTML = classes.length
      ? classes.map((c) => `<option value="${escape(c.id)}">${escape(c.grade)}${escape(c.name)}</option>`).join('')
      : '<option value="">暂无班级</option>';
  }

  function renderTable() {
    const thead = table.querySelector('.thead');
    const pager = table.querySelector('.pager');
    table.innerHTML = '';
    table.appendChild(thead);

    if (assignments.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'row empty-row';
      empty.innerHTML = '<span style="grid-column:1 / -1;text-align:center;color:#888;padding:24px 0;">暂无教学任务，点击右上角「新建任务」创建</span>';
      table.appendChild(empty);
    } else {
      assignments.forEach((a) => {
        const row = document.createElement('div');
        row.className = 'row';
        row.dataset.id = a.id;
        row.dataset.status = a.status;
        row.dataset.class = classDisplay(a);
        row.innerHTML = `<span>›　<b>${escape(a.title)}</b></span><span>${escape(classDisplay(a))}</span><span>${formatDateTime(a.dueAt)}</span><span>${submissionDisplay(a)}</span><span>${statusDisplay(a.status)}</span><span><button class="row-menu" aria-label="更多操作">•••</button></span>`;
        bindRow(row, a);
        table.appendChild(row);
      });
    }

    if (pager) {
      pager.querySelector('span').textContent = `第 1–${assignments.length} 条，共 ${assignments.length} 条`;
      table.appendChild(pager);
    }

    applyFilters();
  }

  function renderLoadError(error) {
    const thead = table.querySelector('.thead');
    const pager = table.querySelector('.pager');
    table.innerHTML = '';
    if (thead) table.appendChild(thead);
    const row = document.createElement('div');
    row.className = 'row empty-row';
    row.innerHTML = `<span style="grid-column:1 / -1;text-align:center;color:#a02b24;padding:24px 0;">${escape(error?.message || '任务数据加载失败')}。请重新加载。</span>`;
    table.appendChild(row);
    if (pager) table.appendChild(pager);
  }

  function bindRow(row, assignment) {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.row-menu')) {
        YuzanDemo.toast('任务操作菜单功能暂未开通', 'warning');
        return;
      }
      if (e.target.closest('[data-nav]')) {
        return;
      }

      const existing = row.nextElementSibling?.classList.contains('dynamic-detail') ? row.nextElementSibling : null;
      if (existing) {
        existing.remove();
        row.classList.remove('expanded');
        return;
      }

      [...table.querySelectorAll('.dynamic-detail')].forEach((d) => d.remove());
      [...table.querySelectorAll('.row.expanded')].forEach((r) => r.classList.remove('expanded'));

      row.classList.add('expanded');
      const detail = document.createElement('div');
      detail.className = 'detail dynamic-detail';
      detail.innerHTML = `
        <div class="timeline">
          <div><b>布置时间</b><small>${formatDateTimeFull(assignment.startsAt)}</small></div>
          <div><b>截止时间</b><small>${formatDateTimeFull(assignment.dueAt)}</small></div>
          <div><b>任务状态</b><small>${(statusMap[assignment.status] || { label: assignment.status }).label}</small></div>
        </div>
        <div class="desc">
          <h3>任务描述</h3>
          <p>${escape(assignment.title)}</p>
          <h3>操作</h3>
          <p>保存草稿后确认排期，再手动开放给目标学生。</p>
          ${assignment.status === 'DRAFT' ? '<button data-transition="schedule">确认排期</button>' : assignment.status === 'SCHEDULED' ? '<button data-transition="open">立即开放</button>' : ''}<p role="status" class="transition-status"></p><p>排期后需手动立即开放；暂不支持未来自动发布。</p>
        </div>`;
      detail.querySelector('[data-transition]')?.addEventListener('click', async (event) => {
        const button = event.currentTarget;
        if (button.disabled) return;
        button.disabled = true;
        const feedback = detail.querySelector('.transition-status');
        try {
          const updated = await YuzanApi.request(`/schools/${schoolId}/assignments/${assignment.id}/${button.dataset.transition}`, {
            method: 'POST', body: JSON.stringify({ expectedRevision: assignment.revision }),
          });
          feedback.textContent = updated.status === 'OPEN' ? '已发布' : '已排期，需手动立即开放';
          YuzanDemo.toast(feedback.textContent, 'success');
          await loadAssignments();
        } catch (err) {
          feedback.textContent = `${err.message || '发布失败'}。请重新加载最新状态后再操作。`;
          const retry = document.createElement('button');
          retry.textContent = '重新加载';
          retry.onclick = () => loadAssignments().catch(e => { feedback.textContent = e.message; });
          feedback.append(retry);
        }
      });
      row.after(detail);
    });
  }

  // LIVE_LOCAL: 时间筛选仅做 UI 切换，未实际按时间范围过滤任务数据
  function applyFilters() {
    const statusBtn = document.querySelector('.filter[data-filter="status"]');
    const classBtn = document.querySelector('.filter[data-filter="class"]');
    const statusText = statusBtn?.textContent.replace(/　⌄/, '') || '全部状态';
    const classText = classBtn?.textContent.replace(/　⌄/, '') || '全部班级';

    table.querySelectorAll('.row').forEach((row) => {
      if (row.classList.contains('empty-row')) return;
      let visible = true;
      if (statusText !== '全部状态') {
        const rowStatus = statusMap[row.dataset.status]?.label || row.dataset.status;
        if (rowStatus !== statusText) visible = false;
      }
      if (visible && classText !== '全部班级' && row.dataset.class !== classText) {
        visible = false;
      }
      if (visible && attentionFilter === 'open' && row.dataset.status !== 'OPEN') visible = false;
      if (visible && attentionFilter === 'missing' && (assignmentStats.get(row.dataset.id)?.notSubmittedCount ?? 0) <= 0) visible = false;
      if (visible && attentionFilter === 'review' && (assignmentStats.get(row.dataset.id)?.needsReviewCount ?? 0) <= 0) visible = false;
      row.hidden = !visible;
    });
  }

  async function init() {
    if (!ensureAuth()) return;
    try {
      await Promise.all([loadClasses(), loadCourseVersions()]);
      await loadAssignments();
    } catch (err) {
      YuzanDemo.toast(err.message || '加载教学任务失败', 'error');
      renderLoadError(err);
    }
  }

  document.getElementById('reloadAssignments').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try { await init(); }
    finally { button.disabled = false; }
  });

  document.querySelector('.new').addEventListener('click', () => {
    if (classes.length === 0) {
      YuzanDemo.toast('当前没有可用班级，无法创建任务', 'warning');
      return;
    }
    if (courseVersions.length === 0) {
      YuzanDemo.toast('当前没有可用课程版本，无法创建任务', 'warning');
      return;
    }
    const d = new Date(Date.now() + 7 * 864e5);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    form.deadline.value = d.toISOString().slice(0, 16);
    const start = new Date();
    start.setMinutes(start.getMinutes() - start.getTimezoneOffset());
    form.startsAt.value = start.toISOString().slice(0, 16);
    dialogError.textContent = '';
    modal.showModal();
    form.title.focus();
  });

  modal.addEventListener('click', (e) => {
    const r = modal.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) modal.close();
  });

  form.addEventListener('submit', async (e) => {
    if (e.submitter?.value === 'cancel') return;
    e.preventDefault();
    if (!form.reportValidity()) return;

    const title = form.title.value.trim();
    const classId = form.classId.value;
    const courseVersionId = form.courseVersionId.value;
    const deadline = form.deadline.value;

    if (!classId) {
      dialogError.textContent = '请选择班级';
      return;
    }
    if (!courseVersionId) {
      dialogError.textContent = '没有可用的课程版本，无法创建任务';
      return;
    }

    const saveBtn = form.querySelector('.save');
    if (saveBtn.disabled) return;
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中…';

    try {
      await YuzanApi.request(`/schools/${schoolId}/assignments`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          courseVersionId,
          startsAt: new Date(form.startsAt.value).toISOString(),
          dueAt: new Date(deadline).toISOString(),
          offlineRequired: false,
          targets: [{ targetType: 'CLASS', classId }],
        }),
      });
      modal.close();
      YuzanDemo.toast('已保存草稿', 'success');
      await loadAssignments();
    } catch (err) {
      dialogError.textContent = err.message || '创建任务失败';
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '保存草稿';
    }
  });

  const choices = {
    class: ['全部班级', ...classes.map((c) => `${c.grade}${c.name}`)],
    status: ['全部状态', '已发布', '已保存草稿', '已排期（需手动开放）', '已结束', '已取消'],
  };

  // 时间筛选按钮标记为 data-unsupported，由下方统一 UNSUPPORTED 处理拦截点击

  document.querySelectorAll('.filter:not([data-unsupported])').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.filter;
      const list = key === 'class'
        ? ['全部班级', ...classes.map((c) => `${c.grade}${c.name}`)]
        : choices[key];
      const current = btn.textContent.replace(/　⌄/, '');
      const next = list[(list.indexOf(current) + 1) % list.length];
      btn.textContent = `${next}　⌄`;
      applyFilters();
      YuzanDemo.toast(`筛选条件已切换为：${next}`);
    });
  });

  // 关注摘要按 API 统计筛选真实任务行。
  document.querySelectorAll('.attention-card .attention-summary [data-kind]').forEach((el) => {
    el.addEventListener('click', () => {
      attentionFilter = attentionFilter === el.dataset.kind ? '' : el.dataset.kind;
      document.querySelectorAll('.attention-card .attention-summary [data-kind]').forEach((x) => {
        x.classList.toggle('highlight', x.dataset.kind === el.dataset.kind);
      });
      applyFilters();
    });
  });

  // ── UNSUPPORTED: 统一拦截所有 data-unsupported 元素的点击 ──
  document.querySelectorAll('[data-unsupported]').forEach((el) => {
    el.style.opacity = '.55';
    el.style.cursor = 'not-allowed';
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const msg = el.dataset.unsupported || '该功能暂未开通';
      YuzanDemo.toast(msg, 'warning');
    });
  });

  init();
})();
