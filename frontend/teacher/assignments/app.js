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
  let reviewQueue = [];
  let reviewQueueError = null;
  let attentionFilter = '';
  let pageCursors = [null];
  let pageIndex = 0;
  let pageNextCursor = null;
  let pageHasMore = false;
  let filterTimer = null;

  const PAGE_SIZE = 20;

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
    populateClassFilter();
  }

  async function loadCourseVersions() {
    const data = await YuzanApi.request(`/schools/${schoolId}/course-versions?limit=100`, { method: 'GET' });
    courseVersions = (Array.isArray(data) ? data : (data.items || [])).filter(c => c.status === 'PUBLISHED');
    form.courseVersionId.innerHTML = courseVersions.map(c => `<option value="${escape(c.id)}">${escape(c.title)} · v${c.version}</option>`).join('');
    if (courseVersions.length > 0) {
      form.courseVersionId.value = courseVersions[0].id;
    }
  }

  function dateFilterIso(value, endOfDay = false) {
    if (!value) return undefined;
    const [year, month, day] = value.split('-').map(Number);
    const date = endOfDay
      ? new Date(year, month - 1, day, 23, 59, 59, 999)
      : new Date(year, month - 1, day, 0, 0, 0, 0);
    return date.toISOString();
  }

  function assignmentFilters() {
    return {
      classId: document.getElementById('assignmentClassFilter')?.value || undefined,
      status: document.getElementById('assignmentStatusFilter')?.value || undefined,
      search: document.getElementById('assignmentSearch')?.value.trim() || undefined,
      dueAtFrom: dateFilterIso(document.getElementById('assignmentDueFrom')?.value),
      dueAtTo: dateFilterIso(document.getElementById('assignmentDueTo')?.value, true),
    };
  }

  async function loadAssignments({ deepLink = false } = {}) {
    const listResult = await YuzanApi.listAssignments({
      ...assignmentFilters(),
      limit: PAGE_SIZE,
      cursor: pageCursors[pageIndex] || undefined,
    });
    assignments = Array.isArray(listResult) ? listResult : (listResult.items || []);
    pageNextCursor = listResult.nextCursor || null;
    pageHasMore = Boolean(listResult.hasMore);
    const [statsResults, dashboardResult, reviewResult] = await Promise.all([
      Promise.all(assignments.map(async (assignment) => {
        try {
          return [assignment.id, await YuzanApi.getAssignmentStats(assignment.id)];
        } catch (error) {
          return [assignment.id, { error }];
        }
      })),
      YuzanApi.getDashboard().then((value) => ({ value }), (error) => ({ error })),
      YuzanApi.getAssessmentReviewQueue().then((value) => ({ value }), (error) => ({ error })),
    ]);
    assignmentStats = new Map(statsResults);
    dashboardData = dashboardResult.value || null;
    dashboardError = dashboardResult.error || null;
    const reviewPayload = reviewResult.value;
    reviewQueue = Array.isArray(reviewPayload) ? reviewPayload : (reviewPayload?.items || []);
    reviewQueueError = reviewResult.error || null;
    if (pageHasMore && pageNextCursor) pageCursors[pageIndex + 1] = pageNextCursor;
    renderTable();
    renderAttention();
    if (deepLink) await revealRequestedAssignment();
  }

  async function revealRequestedAssignment() {
    const requestedId = new URLSearchParams(location.search).get('assignmentId');
    if (!requestedId) return;
    let row = [...table.querySelectorAll('.row[data-id]')].find(item => item.dataset.id === requestedId);
    if (!row) {
      try {
        const assignment = await YuzanApi.getAssignment(requestedId);
        assignment.deepLinkOnly = true;
        assignments = [assignment, ...assignments.filter((item) => item.id !== assignment.id)];
        try { assignmentStats.set(assignment.id, await YuzanApi.getAssignmentStats(assignment.id)); }
        catch (error) { assignmentStats.set(assignment.id, { error }); }
        renderTable();
        row = [...table.querySelectorAll('.row[data-id]')].find(item => item.dataset.id === requestedId);
      } catch (error) {
        const message = document.createElement('p');
        message.className = 'assignment-deeplink-error';
        message.setAttribute('role', 'alert');
        message.textContent = `无法打开该任务：${error.message || '检查任务权限后重试'}`;
        table.prepend(message);
        return;
      }
    }
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

  function populateClassFilter() {
    const select = document.getElementById('assignmentClassFilter');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">全部班级</option>' + classes.map((c) =>
      `<option value="${escape(c.id)}">${escape(c.grade)}${escape(c.name)}</option>`,
    ).join('');
    if (classes.some((c) => c.id === current)) select.value = current;
  }

  function renderTable() {
    const thead = table.querySelector('.thead');
    const pager = table.querySelector('.pager');
    table.innerHTML = '';
    table.appendChild(thead);

    if (assignments.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'row empty-row';
      empty.innerHTML = `<span style="grid-column:1 / -1;text-align:center;color:#888;padding:24px 0;">${Object.values(assignmentFilters()).some(Boolean) ? '当前筛选条件下没有教学任务' : '暂无教学任务，可新建任务'}</span>`;
      table.appendChild(empty);
    } else {
      assignments.forEach((a) => {
        const row = document.createElement('div');
        row.className = 'row';
        row.dataset.id = a.id;
        row.dataset.status = a.status;
        if (a.deepLinkOnly) row.dataset.deeplinkOnly = 'true';
        row.dataset.class = classDisplay(a);
        row.innerHTML = `<span>›　<b>${escape(a.title)}</b></span><span>${escape(classDisplay(a))}</span><span>${formatDateTime(a.dueAt)}</span><span>${submissionDisplay(a)}</span><span>${statusDisplay(a.status)}</span><span><span class="action-unavailable" title="暂不支持其他任务操作">暂不支持</span></span>`;
        bindRow(row, a);
        table.appendChild(row);
      });
    }

    if (pager) {
      const pageItems = assignments.filter((item) => !item.deepLinkOnly);
      const start = pageItems.length ? pageIndex * PAGE_SIZE + 1 : 0;
      const end = pageIndex * PAGE_SIZE + pageItems.length;
      pager.querySelector('[data-page-label]').textContent = `当前页 ${start}–${end} 条`;
      pager.querySelector('[data-page-number]').textContent = String(pageIndex + 1);
      pager.querySelector('[data-page-prev]').disabled = pageIndex === 0;
      pager.querySelector('[data-page-next]').disabled = !pageHasMore || !pageNextCursor;
      pager.querySelector('[data-page-more]').textContent = pageHasMore ? '还有更多' : '已到末页';
      table.appendChild(pager);
    }

    applyLocalVisibility();
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
    if (pager) {
      pager.querySelector('[data-page-prev]').disabled = pageIndex === 0;
      pager.querySelector('[data-page-next]').disabled = true;
      table.appendChild(pager);
    }
  }

  function bindRow(row, assignment) {
    row.addEventListener('click', (e) => {
      if (e.target.closest('a,button')) return;

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
      const stats = assignmentStats.get(assignment.id);
      const statsLine = stats && !stats.error
        ? `目标 ${stats.totalStudents} 人 · 已提交 ${stats.submittedCount} · 待提交 ${stats.notSubmittedCount} · 待复核 ${stats.needsReviewCount}`
        : '目标与提交统计暂不可用';
      detail.innerHTML = `<div class="assignment-detail"><div class="assignment-detail-meta"><b>${escape(assignment.title)}</b><span>${escape(formatDateTimeFull(assignment.startsAt))} 至 ${escape(formatDateTimeFull(assignment.dueAt))}</span><span>${statsLine}</span></div><div class="assignment-detail-actions">${assignment.status === 'DRAFT' ? '<button data-transition="schedule">确认排期</button>' : assignment.status === 'SCHEDULED' ? '<button data-transition="open">立即开放</button>' : ''}<p role="status" class="transition-status"></p><small>暂不支持停用、复制和导出；排期后需手动开放。</small></div></div><section class="assignment-roster" data-roster><p role="status">正在读取授权目标学生和真实提交…</p></section>`;
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
      loadAssignmentDetail(assignment, detail.querySelector('[data-roster]'));
    });
  }

  async function loadAssignmentDetail(summary, rosterRoot) {
    if (!rosterRoot) return;
    rosterRoot.innerHTML = '<p role="status">正在读取授权目标学生和真实提交…</p>';
    try {
      const assignment = await YuzanApi.getAssignment(summary.id);
      const targets = Array.isArray(assignment.targets) ? assignment.targets : [];
      const classTargetIds = new Set(targets.filter((target) => target.targetType === 'CLASS' && target.classId).map((target) => target.classId));
      const individualTargetIds = new Set(targets.filter((target) => target.targetType === 'STUDENT' && target.enrollmentId).map((target) => target.enrollmentId));
      const classIds = individualTargetIds.size
        ? new Set(classes.map((item) => item.id))
        : classTargetIds;
      const classRosterResults = await Promise.all([...classIds].map(async (classId) => {
        const data = await YuzanApi.request(`/schools/${schoolId}/classes/${encodeURIComponent(classId)}/student-summaries`);
        return { classId, items: Array.isArray(data) ? data : (data.items || []) };
      }));
      const roster = new Map();
      classRosterResults.forEach(({ classId, items }) => {
        items.forEach((student) => {
          if (student?.enrollmentId && (classTargetIds.has(classId) || individualTargetIds.has(student.enrollmentId))) {
            const classInfo = getClassById(classId);
            roster.set(student.enrollmentId, {
              ...student,
              className: classInfo ? `${classInfo.grade}${classInfo.name}` : '',
            });
          }
        });
      });

      const submissions = [];
      let cursor;
      let submissionListIncomplete = false;
      for (let page = 0; page < 50; page += 1) {
        const response = await YuzanApi.getAssignmentSubmissions(assignment.id, { limit: 100, cursor });
        const items = Array.isArray(response) ? response : (response.items || []);
        submissions.push(...items);
        if (!response.hasMore || !response.nextCursor) break;
        cursor = response.nextCursor;
        if (page === 49) submissionListIncomplete = true;
      }
      const latestSubmission = new Map();
      submissions.forEach((item) => {
        const previous = latestSubmission.get(item.enrollmentId);
        if (!previous || Number(item.attemptNo) > Number(previous.attemptNo)) latestSubmission.set(item.enrollmentId, item);
      });
      const reviewsBySubmission = new Map();
      reviewQueue.filter((item) => item.assignmentId === assignment.id && item.submissionId).forEach((item) => {
        const list = reviewsBySubmission.get(item.submissionId) || [];
        list.push(item);
        reviewsBySubmission.set(item.submissionId, list);
      });
      const statusLabel = {
        IN_PROGRESS: '进行中', PENDING_SYNC: '待同步', SUBMITTED: '已提交', PROCESSING: '处理中',
        NEEDS_REVIEW: '待复核', REVIEWED: '已复核', RETURNED: '已退回', ACCEPTED: '已通过',
      };
      const rows = [...roster.entries()].map(([enrollmentId, student]) => {
        const submission = latestSubmission.get(enrollmentId);
        const label = submission ? (statusLabel[submission.status] || submission.status) : '待提交';
        const links = submission
          ? (reviewsBySubmission.get(submission.id) || []).map((item) => `<a data-nav href="/teacher/reviews/${encodeURIComponent(item.itemId)}">打开题目复核 ${Number(item.sortOrder ?? 0) + 1}</a>`).join('') || `<a data-nav href="/teacher/submissions/${encodeURIComponent(submission.id)}">查看提交</a>`
          : '<span>尚无提交记录</span>';
        return `<div class="roster-row"><b>${escape(student.displayName || '学生')}<small>${escape(student.className || '')}</small></b><span>${escape(label)}</span><span>${escape(formatDateTime(submission?.submittedAt || submission?.createdAt))}</span><span>${links}</span></div>`;
      });
      const reviewNote = reviewQueueError
        ? '<p class="roster-note">题目复核队列暂不可用；提交详情仍可通过真实提交记录打开。</p>'
        : '';
      const incompleteNote = submissionListIncomplete
        ? '<p class="roster-note">提交记录超过当前加载上限；此处只列出已加载范围，完整人数以服务端统计为准。</p>'
        : '';
      rosterRoot.innerHTML = `<div class="roster-heading"><b>授权目标学生</b><span>${roster.size} 人</span></div>${reviewNote}${incompleteNote}${rows.length ? rows.join('') : '<p class="roster-empty">该任务当前没有可见的授权目标学生。</p>'}`;
    } catch (error) {
      rosterRoot.innerHTML = `<p class="roster-error" role="alert">读取任务详情失败：${escape(error.message || '请检查网络或权限后重试')} <button type="button" data-detail-retry>重试</button></p>`;
      rosterRoot.querySelector('[data-detail-retry]')?.addEventListener('click', () => loadAssignmentDetail(summary, rosterRoot));
    }
  }

  function applyLocalVisibility() {
    table.querySelectorAll('.row[data-id]').forEach((row) => {
      let visible = true;
      if (attentionFilter === 'open' && row.dataset.status !== 'OPEN') visible = false;
      if (attentionFilter === 'missing' && (assignmentStats.get(row.dataset.id)?.notSubmittedCount ?? 0) <= 0) visible = false;
      if (attentionFilter === 'review' && (assignmentStats.get(row.dataset.id)?.needsReviewCount ?? 0) <= 0) visible = false;
      row.hidden = !visible;
      if (!visible && row.nextElementSibling?.classList.contains('dynamic-detail')) row.nextElementSibling.hidden = true;
      if (visible && row.nextElementSibling?.classList.contains('dynamic-detail')) row.nextElementSibling.hidden = false;
    });
  }

  async function updateFilters() {
    pageCursors = [null];
    pageIndex = 0;
    attentionFilter = '';
    document.querySelectorAll('.attention-card .attention-summary [data-kind]').forEach((element) => element.classList.remove('highlight'));
    await loadAssignments();
  }

  async function changePage(delta) {
    const nextIndex = pageIndex + delta;
    if (nextIndex < 0 || (delta > 0 && (!pageHasMore || !pageNextCursor))) return;
    pageIndex = nextIndex;
    await loadAssignments();
  }

  async function init() {
    if (!ensureAuth()) return;
    try {
      await Promise.all([loadClasses(), loadCourseVersions()]);
      await loadAssignments({ deepLink: true });
      if (new URLSearchParams(location.search).get('new') === '1') document.querySelector('.new').click();
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
      pageCursors = [null];
      pageIndex = 0;
      await loadAssignments();
    } catch (err) {
      dialogError.textContent = err.message || '创建任务失败';
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '保存草稿';
    }
  });

  function safelyUpdateFilters() {
    const from = document.getElementById('assignmentDueFrom').value;
    const to = document.getElementById('assignmentDueTo').value;
    const toInput = document.getElementById('assignmentDueTo');
    toInput.setCustomValidity(from && to && from > to ? '截止日期范围无效' : '');
    if (!toInput.reportValidity()) return;
    updateFilters().catch((error) => {
      YuzanDemo.toast(error.message || '筛选任务失败', 'error');
      renderLoadError(error);
    });
  }

  document.getElementById('assignmentClassFilter').addEventListener('change', safelyUpdateFilters);
  document.getElementById('assignmentStatusFilter').addEventListener('change', safelyUpdateFilters);
  document.getElementById('assignmentDueFrom').addEventListener('change', safelyUpdateFilters);
  document.getElementById('assignmentDueTo').addEventListener('change', safelyUpdateFilters);
  document.getElementById('assignmentSearch').addEventListener('input', () => {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(safelyUpdateFilters, 250);
  });
  document.getElementById('assignmentSearch').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      clearTimeout(filterTimer);
      safelyUpdateFilters();
    }
  });
  document.querySelector('[data-page-prev]').addEventListener('click', () => {
    changePage(-1).catch((error) => { YuzanDemo.toast(error.message || '加载上一页失败', 'error'); renderLoadError(error); });
  });
  document.querySelector('[data-page-next]').addEventListener('click', () => {
    changePage(1).catch((error) => { YuzanDemo.toast(error.message || '加载下一页失败', 'error'); renderLoadError(error); });
  });

  // 关注摘要按 API 统计筛选真实任务行。
  document.querySelectorAll('.attention-card .attention-summary [data-kind]').forEach((el) => {
    el.addEventListener('click', () => {
      attentionFilter = attentionFilter === el.dataset.kind ? '' : el.dataset.kind;
      document.querySelectorAll('.attention-card .attention-summary [data-kind]').forEach((x) => {
        x.classList.toggle('highlight', x.dataset.kind === el.dataset.kind);
      });
      applyLocalVisibility();
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
