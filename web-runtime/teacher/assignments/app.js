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

  const statusMap = {
    DRAFT: { label: '待开始', cls: 'gold' },
    SCHEDULED: { label: '待开始', cls: 'gold' },
    OPEN: { label: '进行中', cls: 'green' },
    CLOSED: { label: '已结束', cls: 'gray' },
    CANCELLED: { label: '已取消', cls: 'red' },
    ARCHIVED: { label: '已归档', cls: 'gray' },
  };

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
    const classTarget = assignment.targets?.find((t) => t.targetType === 'CLASS');
    const studentTarget = assignment.targets?.find((t) => t.targetType === 'STUDENT');
    const total = classTarget
      ? (getClassById(classTarget.classId)?.studentCount || 0)
      : (studentTarget ? 1 : 0);
    return `— / ${total || '—'} 已提交`;
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
    courseVersions = Array.isArray(data) ? data : (data.items || []);
    if (courseVersions.length > 0) {
      form.courseVersionId.value = courseVersions[0].id;
    }
  }

  async function loadAssignments() {
    const data = await YuzanApi.request(`/schools/${schoolId}/assignments?limit=100`, { method: 'GET' });
    assignments = Array.isArray(data) ? data : (data.items || []);
    renderTable();
  }

  function populateClassSelect() {
    const select = form.querySelector('select[name="classId"]');
    select.innerHTML = classes.length
      ? classes.map((c) => `<option value="${c.id}">${c.grade}${c.name}</option>`).join('')
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
        row.innerHTML = `<span>›　<b>${a.title}</b></span><span>${classDisplay(a)}</span><span>${formatDateTime(a.dueAt)}</span><span>${submissionDisplay(a)}</span><span>${statusDisplay(a.status)}</span><span><button class="row-menu" aria-label="更多操作">•••</button></span>`;
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
          <p>${assignment.title}</p>
          <h3>操作</h3>
          <p>可查看学生提交、发送提醒或进入反馈页面。</p>
          <button data-nav="/teacher/reviews/submission-1/">查看提交</button>
        </div>`;
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
    }
  }

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
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中…';

    try {
      await YuzanApi.request(`/schools/${schoolId}/assignments`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          courseVersionId,
          startsAt: new Date().toISOString(),
          dueAt: new Date(deadline).toISOString(),
          offlineRequired: false,
          targets: [{ targetType: 'CLASS', classId }],
        }),
      });
      modal.close();
      YuzanDemo.toast('教学任务已创建', 'success');
      await loadAssignments();
    } catch (err) {
      dialogError.textContent = err.message || '创建任务失败';
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '保存任务';
    }
  });

  const choices = {
    class: ['全部班级', ...classes.map((c) => `${c.grade}${c.name}`)],
    status: ['全部状态', '进行中', '待开始', '已结束', '已取消'],
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

  // 关注卡片摘要按钮（未完成/等待同步/待反馈）- 保留高亮切换 + 弹出 UNSUPPORTED 提示
  document.querySelectorAll('.attention-card [data-kind]').forEach((el) => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.attention-card [data-kind]').forEach((x) => {
        x.classList.toggle('highlight', x.dataset.kind === el.dataset.kind);
      });
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
