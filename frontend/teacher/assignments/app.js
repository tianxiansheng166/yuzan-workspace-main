(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const labels = {DRAFT:'草稿',SCHEDULED:'已排期',OPEN:'进行中',CLOSED:'已结束',CANCELLED:'已取消',ARCHIVED:'已归档'};
  const form = $('#task-form'), dialog = $('#task-dialog'), results = $('#task-results');
  let schoolId = '', classes = [], courses = [], assignments = [];
  const className = item => !item ? '班级不可用' : (item.name.startsWith(item.grade || '') ? item.name : `${item.grade || ''}${item.name}`);
  const date = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? '未设置' : d.toLocaleString('zh-CN', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}); };
  function classLabel(task) {
    const target = task.targets?.find(t => t.targetType === 'CLASS');
    return target ? className(classes.find(c => c.id === target.classId)) : '学生个人';
  }
  function render() {
    $('#total').textContent = assignments.length;
    $('#drafts').textContent = assignments.filter(a => a.status === 'DRAFT' || a.status === 'SCHEDULED').length;
    $('#open').textContent = assignments.filter(a => a.status === 'OPEN').length;
    const visible = assignments.filter(a => (!$('#status-filter').value || a.status === $('#status-filter').value) && (!$('#class-filter').value || a.targets?.some(t => t.classId === $('#class-filter').value)));
    results.innerHTML = visible.length ? visible.map(task => `<article class="task-row"><div class="task-mark" aria-hidden="true">课</div><div class="task-info"><div class="task-title"><h3>${esc(task.title)}</h3><span class="status ${task.status === 'OPEN' ? 'active' : ''}">${esc(labels[task.status] || task.status)}</span></div><p>${esc(classLabel(task))} <span>·</span> 截止 ${esc(date(task.dueAt))}</p><small>${task.status === 'DRAFT' ? '草稿尚未发布，学生不可见。' : task.status === 'SCHEDULED' ? '已排期，需手动发布后学生才能看到。' : task.status === 'OPEN' ? '已发布，可在学生端查看。' : '查看当前任务状态。'}</small></div><div class="task-actions">${['DRAFT','SCHEDULED'].includes(task.status) ? `<button class="publish" data-id="${esc(task.id)}">发布任务</button>` : '<span>已保存</span>'}</div></article>`).join('') : '<div class="empty">没有符合条件的任务。可以调整筛选条件，或新建任务。</div>';
  }
  async function load() {
    const [classData, courseData, taskData] = await Promise.all([
      YuzanApi.request(`/schools/${schoolId}/classes/teachers/me`),
      YuzanApi.request(`/schools/${schoolId}/course-versions?limit=100`),
      YuzanApi.request(`/schools/${schoolId}/assignments?limit=100`),
    ]);
    classes = Array.isArray(classData) ? classData : classData.items || [];
    courses = (Array.isArray(courseData) ? courseData : courseData.items || []).filter(c => c.status === 'PUBLISHED');
    assignments = taskData.items || (Array.isArray(taskData) ? taskData : []);
    const classFilter = $('#class-filter'), classSelect = form.querySelector('[name=classId]'), courseSelect = form.querySelector('[name=courseVersionId]');
    const selectedClass = classFilter.value;
    classFilter.replaceChildren(new Option('全部班级', '')); classSelect.replaceChildren(new Option('请选择任教班级', ''));
    classes.forEach(c => { classFilter.add(new Option(className(c), c.id)); classSelect.add(new Option(className(c), c.id)); });
    if (classes.length === 1) classSelect.value = classes[0].id;
    classFilter.value = selectedClass;
    courseSelect.replaceChildren(new Option('请选择已发布课程', ''));
    courses.forEach(c => courseSelect.add(new Option(c.title, c.id)));
    render();
  }
  function showDialog() {
    $('#form-error').textContent = '';
    const preferred = new URLSearchParams(location.search).get('courseVersionId');
    if (courses.some(c => c.id === preferred)) form.querySelector('[name=courseVersionId]').value = preferred;
    if (!form.querySelector('[name=deadline]').value) {
      const d = new Date(Date.now() + 7 * 86400000); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      form.querySelector('[name=deadline]').value = d.toISOString().slice(0, 16);
    }
    dialog.showModal();
  }
  $('#new-task').addEventListener('click', showDialog);
  $('#close-dialog').addEventListener('click', () => dialog.close());
  $('#cancel-dialog').addEventListener('click', () => dialog.close());
  $('#class-filter').addEventListener('change', render); $('#status-filter').addEventListener('change', render);
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (!form.reportValidity()) return;
    const values = new FormData(form), due = new Date(values.get('deadline'));
    if (!String(values.get('title')).trim()) { $('#form-error').textContent = '请输入任务名称。'; return; }
    if (due <= new Date()) { $('#form-error').textContent = '截止时间需晚于当前时间。'; return; }
    const button = form.querySelector('[type=submit]'); button.disabled = true; button.textContent = '保存中…';
    try {
      await YuzanApi.request(`/schools/${schoolId}/assignments`, {method:'POST',body:JSON.stringify({title:String(values.get('title')).trim(),courseVersionId:values.get('courseVersionId'),startsAt:new Date().toISOString(),dueAt:due.toISOString(),offlineRequired:false,targets:[{targetType:'CLASS',classId:values.get('classId')}]})});
      dialog.close(); history.replaceState(null, '', '/teacher/assignments/');
      try { await load(); }
      catch { $('#list-message').textContent = '草稿已保存，但列表刷新失败，请刷新页面查看。'; }
    } catch (error) { $('#form-error').textContent = error.message || '保存失败，请重试。'; }
    finally { button.disabled = false; button.textContent = '保存草稿'; }
  });
  results.addEventListener('click', async event => {
    const button = event.target.closest('.publish'); if (!button) return;
    const task = assignments.find(a => a.id === button.dataset.id); if (!task) return;
    button.disabled = true; button.textContent = '发布中…';
    try {
      let revision = task.revision;
      if (task.status === 'DRAFT') {
        const scheduled = await YuzanApi.request(`/schools/${schoolId}/assignments/${encodeURIComponent(task.id)}/schedule`, {method:'POST',body:JSON.stringify({expectedRevision:revision})});
        revision = scheduled.revision;
      }
      await YuzanApi.request(`/schools/${schoolId}/assignments/${encodeURIComponent(task.id)}/open`, {method:'POST',body:JSON.stringify({expectedRevision:revision})});
      $('#list-message').textContent = '';
      await load();
    } catch (error) {
      await load().catch(() => {});
      $('#list-message').textContent = error.message || '发布失败，请刷新后重试。';
    }
  });
  async function init() {
    if (!YuzanApi.getToken()) { location.href = '/login/'; return; }
    schoolId = YuzanApi.getActiveSchoolId();
    if (!schoolId) { results.textContent = '请先选择已加入的学校。'; return; }
    try { await load(); if (new URLSearchParams(location.search).has('courseVersionId')) showDialog(); }
    catch (error) { results.textContent = error.message || '加载失败，请刷新页面重试。'; }
  }
  const message = document.createElement('p'); message.id = 'list-message'; message.className = 'form-error'; message.setAttribute('role','alert'); results.before(message);
  init();
})();
