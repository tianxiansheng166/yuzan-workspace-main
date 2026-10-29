(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const status = {DRAFT:'草稿', IN_REVIEW:'审核中', APPROVED:'已审核', PUBLISHED:'已发布', CHANGES_REQUESTED:'需修改', RETIRED:'已归档'};
  const types = {AUDIO:'听力',VIDEO:'视频',TEXT:'阅读',CHOICE:'选择',FILL_BLANK:'填空',SPEECH:'口语',RECORDING:'录音',QUIZ:'练习',WORKSHEET:'书面练习',ORAL:'口语',DISCUSSION:'讨论'};
  let courses = [], schoolId = '';
  const activities = course => (course.units || []).flatMap(unit => (unit.lessons || []).flatMap(lesson => lesson.activities || []));
  const cover = course => typeof course.coverAsset === 'string' && /^\/assets\/[\w./-]+$/.test(course.coverAsset) ? course.coverAsset : '';
  function render() {
    const q = $('#course-search').value.trim().toLocaleLowerCase(), selected = $('#course-status').value;
    const visible = courses.filter(c => c.title.toLocaleLowerCase().includes(q) && (selected === 'all' || c.status === selected));
    $('#course-count').textContent = `共 ${courses.length} 门课程 · 当前显示 ${visible.length} 门`;
    $('#total-count').textContent = courses.length; $('#published-count').textContent = courses.filter(c=>c.status==='PUBLISHED').length; $('#readable-count').textContent = courses.filter(c=>c.detail).length;
    $('#course-list').innerHTML = visible.length ? visible.map((course,index) => {
      const d=course.detail, acts=d?activities(d):[], url=d?cover(d):'', category=d?.capabilityTheme || course.gradeBand || '课程学习';
      return `<article class="course-card" style="--card-order:${index}"><div class="course-cover ${url?'has-cover':''}" ${url?`style="background-image:linear-gradient(0deg,#162f2299,transparent 75%),url('${esc(url)}')"`:''}><span class="cover-index">${String(index+1).padStart(2,'0')} / YUZAN</span><span class="cover-category">${esc(category)}</span><span class="course-status">${esc(status[course.status]||course.status)}</span><strong>${esc(course.title)}</strong></div><div class="course-body"><div class="course-meta"><span>${esc(course.gradeBand||'年级未设置')}</span><span>${d?.estimatedMinutes?`${esc(d.estimatedMinutes)} 分钟`:'版本 '+esc(course.version)}</span><span>${d?`${acts.length} 个活动`:'课程信息受限'}</span></div><p>${esc(d?.description || (d?'尚未填写课程介绍。':'该课程可以用于布置任务，详细内容需要课程权限。'))}</p><div class="course-tags">${d?Array.from(new Set(acts.map(a=>types[a.type]||a.type))).slice(0,4).map(t=>`<span>${esc(t)}</span>`).join(''):'<span>课程内容</span>'}</div><div class="course-actions"><button class="detail-link" data-detail="${esc(course.id)}">查看课程 <span>↗</span></button>${course.status==='PUBLISHED'?`<a href="/teacher/assignments/?courseVersionId=${encodeURIComponent(course.id)}">布置任务 <span>→</span></a>`:''}</div></div></article>`;
    }).join('') : '<div class="empty">没有找到符合条件的课程，请调整筛选条件。</div>';
  }
  function showDetail(id) {
    const c=courses.find(item=>item.id===id); if(!c)return; const d=c.detail;
    let content='';
    if(d){const units=(d.units||[]).map(unit=>`<div class="unit"><strong>${esc(unit.title)}</strong>${(unit.lessons||[]).map(lesson=>`<div class="lesson"><b>${esc(lesson.title)}</b>${(lesson.activities||[]).map(a=>`<div class="activity-row"><span class="activity-type">${esc(types[a.type]||a.type)}</span><div><strong>${esc(a.title)}</strong>${a.instruction?.text?`<small>${esc(a.instruction.text)}</small>`:''}${a.practiceReference?.title?`<small>关联练习 · ${esc(a.practiceReference.title)}</small>`:''}</div><span>${a.required?'必修':'选修'}</span></div>`).join('')}</div>`).join('')}</div>`).join('');
      content=`<p class="detail-description">${esc(d.description||'尚未填写课程介绍。')}</p><div class="detail-facts"><span>${esc(d.gradeBand||'年级未设置')}</span>${d.estimatedMinutes?`<span>${esc(d.estimatedMinutes)} 分钟</span>`:''}<span>${activities(d).length} 个活动</span></div><h3>教学目标</h3><ul>${(d.objectives||[]).map(o=>`<li>${esc(o)}</li>`).join('')||'<li>暂无教学目标</li>'}</ul><h3>课程内容与练习</h3>${units||'<p>暂无课程活动</p>'}`;
    } else content='<div class="restricted"><strong>课程详情暂不可查看</strong><p>当前账号没有该课程的内容权限。已发布课程仍可用于创建班级任务。</p></div>';
    $('#course-detail').innerHTML=`<span class="detail-kicker">课程详情 / ${esc(status[c.status]||c.status)}</span><h2>${esc(c.title)}</h2>${content}<div class="detail-actions">${c.status==='PUBLISHED'?`<a class="primary" href="/teacher/assignments/?courseVersionId=${encodeURIComponent(c.id)}">布置课程任务 →</a>`:''}</div>`;
    $('#course-dialog').showModal();
  }
  function init() { courses = window.YuzanShowcase.courses; render(); const id = new URLSearchParams(location.search).get('courseId'); if (id) showDetail(id); }
  $('#course-search').addEventListener('input',render);$('#course-status').addEventListener('change',render);
  $('#course-list').addEventListener('click',e=>{const button=e.target.closest('[data-detail]');if(button)showDetail(button.dataset.detail);});$('#close-course').addEventListener('click',()=>$('#course-dialog').close());init();
})();
