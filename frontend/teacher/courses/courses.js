(() => {
  'use strict';
  const list = document.querySelector('#course-list');
  const count = document.querySelector('#course-count');
  const search = document.querySelector('#course-search');
  const status = {DRAFT:'草稿', IN_REVIEW:'审核中', APPROVED:'已审核', PUBLISHED:'已发布', CHANGES_REQUESTED:'需修改', RETIRED:'已归档'};
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let courses = [];
  function render() {
    const query = search.value.trim().toLocaleLowerCase();
    const filtered = courses.filter(course => course.title.toLocaleLowerCase().includes(query));
    count.textContent = `共 ${courses.length} 门课程${query ? ` · 找到 ${filtered.length} 门` : ''}`;
    list.innerHTML = filtered.length ? filtered.map(course => {
      const id = encodeURIComponent(course.id);
      const published = course.status === 'PUBLISHED';
      return `<article class="course-card"><div class="card-top"><span class="course-symbol" aria-hidden="true">课</span><span class="status ${published ? 'published' : ''}">${escape(status[course.status] || course.status)}</span></div><h3>${escape(course.title)}</h3><p class="meta">${escape(course.gradeBand || '年级未设置')} <span>·</span> 版本 ${escape(course.version)}</p><p class="card-note">${published ? '课程已发布，可布置给任教班级；编辑需课程权限。' : '课程尚未发布，暂不能布置给学生。'}</p><div class="card-actions"><a class="text-link" href="/teacher/courses/spring/studio/?courseVersionId=${id}">打开课程工作台 <span>↗</span></a>${published ? `<a class="assign-link" href="/teacher/assignments/?courseVersionId=${id}">布置任务 <span>→</span></a>` : ''}</div></article>`;
    }).join('') : '<div class="empty">没有找到课程。可换个关键词再试。</div>';
  }
  async function init() {
    if (!YuzanApi.getToken()) { location.href = '/login/'; return; }
    try {
      const schoolId = YuzanApi.getActiveSchoolId();
      if (!schoolId) throw new Error('请先选择已加入的学校。');
      const result = await YuzanApi.request(`/schools/${encodeURIComponent(schoolId)}/course-versions?limit=100`);
      courses = Array.isArray(result) ? result : (result.items || []);
      render();
    } catch (error) {
      count.textContent = '课程暂时无法加载';
      list.innerHTML = `<div class="empty">${escape(error.message || '请稍后重试')}<br><button type="button" id="retry-courses">重新加载</button></div>`;
      document.querySelector('#retry-courses').addEventListener('click', init);
    }
  }
  search.addEventListener('input', render);
  init();
})();
