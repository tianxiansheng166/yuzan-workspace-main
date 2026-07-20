(() => {
  'use strict';

  const scoreKeys = ['pronunciation','fluency','emotion','overall'];
  let students = [];
  let selected = 0;
  let dirty = false;
  let schoolId = '';
  let assignmentId = '';

  const title = document.querySelector('.student-title');
  const textarea = document.querySelector('.score textarea');
  const saveBtn = document.querySelector('.actions .save');
  const publishBtn = document.querySelector('.actions .publish');
  const scoreRows = [...document.querySelectorAll('.score-box>div')];
  const studentList = document.querySelector('#studentList');
  const pendingCountEl = document.querySelector('#pendingCount');

  function getAssignmentIdFromPath() {
    const parts = location.pathname.split('/').filter(Boolean);
    // /teacher/reviews/{assignmentId}
    if (parts.length >= 3 && parts[0] === 'teacher' && parts[1] === 'reviews') {
      return parts[2];
    }
    return '';
  }

  function formatStudentName(enrollmentId) {
    if (!enrollmentId) return '学生（未命名）';
    const short = String(enrollmentId).split('-')[0] || String(enrollmentId).slice(0, 8);
    return `学生 ${short}`;
  }

  function mapStatus(status) {
    switch (status) {
      case 'NEEDS_REVIEW': return '待复核';
      case 'REVIEWED': return '已反馈';
      case 'SUBMITTED': return '已提交';
      default: return status || '待复核';
    }
  }

  function stars(value){ return '★ '.repeat(value) + '☆ '.repeat(5-value); }

  function renderStudent(index){
    selected=index;
    const buttons = [...studentList.querySelectorAll('.student')];
    buttons.forEach((b,i)=>b.classList.toggle('active',i===index));
    const s=students[index];
    if (!s) return;
    title.querySelector('h2').textContent=s.name;
    title.querySelector('span').textContent=`提交于 ${s.submittedAtText}`;
    title.querySelector('em').textContent=`● ${s.status}`;
    scoreRows.forEach((row,i)=>{
      const value=s[scoreKeys[i]];
      const button=row.querySelector('button'); button.dataset.score=value; button.textContent=stars(value);
      row.querySelector('em').textContent=`${value}/5`;
    });
    textarea.value=localStorage.getItem(`review-feedback-${s.id}`)||'';
    dirty=false; saveBtn.textContent='保存草稿';
  }

  function renderStudentList(){
    if (students.length === 0) {
      studentList.innerHTML = '<div class="empty" style="padding:24px;color:#888;text-align:center;">暂无学生提交</div>';
      pendingCountEl.textContent = '0';
      return;
    }
    studentList.innerHTML = students.map((s, i) =>
      `<button class="student ${i === 0 ? 'active' : ''}" data-index="${i}"><b>${s.name}</b><small>提交于 ${s.submittedAtText}</small><em>● ${s.status}</em></button>`
    ).join('');
    const pending = students.filter(s => s.status === '待复核').length;
    pendingCountEl.textContent = pending;
    studentList.querySelectorAll('.student').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = Number(btn.dataset.index);
        if(dirty && !confirm('当前反馈尚未保存，仍要切换学生吗？')) return;
        renderStudent(index);
      });
    });
  }

  async function loadSubmissions() {
    if (!assignmentId) {
      YuzanDemo.toast('缺少作业标识，无法加载提交', 'error');
      return;
    }
    try {
      const data = await YuzanApi.request(`/schools/${schoolId}/assignments/${assignmentId}/submissions?limit=100`);
      const items = data?.items || [];
      students = items.map((item, index) => ({
        id: item.id || index,
        enrollmentId: item.enrollmentId,
        name: formatStudentName(item.enrollmentId),
        submittedAtText: item.submittedAt ? new Date(item.submittedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—',
        status: mapStatus(item.status),
        pronunciation: 3, fluency: 3, emotion: 3, overall: 3,
      }));
      renderStudentList();
      if (students.length > 0) renderStudent(0);
    } catch (err) {
      YuzanDemo.toast(err.message || '加载提交失败', 'error');
      studentList.innerHTML = `<div class="empty" style="padding:24px;color:#888;text-align:center;">加载失败：${err.message || '未知错误'}</div>`;
    }
  }

  async function init() {
    if (!YuzanApi.getToken()) {
      YuzanDemo.toast('请先登录', 'warning');
      location.href = '/login';
      return;
    }
    schoolId = YuzanApi.getActiveSchoolId();
    if (!schoolId) {
      YuzanDemo.toast('请先选择学校', 'warning');
      location.href = '/select-school';
      return;
    }
    assignmentId = getAssignmentIdFromPath();
    await loadSubmissions();
  }

  scoreRows.forEach((row,rowIndex)=>{
    const button=row.querySelector('button');
    button.setAttribute('aria-label',`${row.querySelector('span').textContent}评分`);
    button.addEventListener('mousemove',e=>{
      const rect=button.getBoundingClientRect(); const preview=Math.max(1,Math.min(5,Math.ceil((e.clientX-rect.left)/rect.width*5)));
      button.textContent=stars(preview);
    });
    button.addEventListener('mouseleave',()=>{
      const s = students[selected];
      button.textContent = s ? stars(s[scoreKeys[rowIndex]]) : stars(3);
    });
    button.addEventListener('click',e=>{
      const s = students[selected]; if (!s) return;
      const rect=button.getBoundingClientRect(); const value=Math.max(1,Math.min(5,Math.ceil((e.clientX-rect.left)/rect.width*5)));
      s[scoreKeys[rowIndex]]=value; button.dataset.score=value; button.textContent=stars(value); row.querySelector('em').textContent=`${value}/5`; dirty=true;
    });
  });

  textarea.addEventListener('input',()=>{ dirty=true; saveBtn.textContent='保存草稿 *'; });
  saveBtn.addEventListener('click',()=>{
    const s = students[selected]; if (!s) return;
    localStorage.setItem(`review-feedback-${s.id}`,textarea.value);
    YuzanDemo.set('teacher.draftSavedAt',Date.now()); dirty=false; saveBtn.textContent='已保存'; YuzanDemo.toast('反馈草稿已保存在本机','success');
    setTimeout(()=>saveBtn.textContent='保存草稿',1400);
  });

  publishBtn.addEventListener('click', async () => {
    if (!textarea.value.trim()) { textarea.focus(); YuzanDemo.toast('请先填写具体反馈建议', 'warning'); return; }
    saveBtn.click();
    const s = students[selected]; if (!s) return;
    publishBtn.disabled = true; publishBtn.textContent = '发布中…';
    try {
      // Compute score from star ratings (convert 1-5 scale to 1-100)
      const avgStars = (s.pronunciation + s.fluency + s.emotion + s.overall) / 4;
      const score = Math.round(avgStars * 20);
      await YuzanApi.createFeedback(s.id, {
        decision: 'ACCEPT',
        comment: textarea.value.trim(),
        score,
      });
      s.status = '已反馈';
      const buttons = [...studentList.querySelectorAll('.student')];
      if (buttons[selected]) {
        buttons[selected].querySelector('em').textContent = '● 已反馈';
        buttons[selected].classList.add('reviewed');
      }
      title.querySelector('em').textContent = '● 已反馈';
      publishBtn.textContent = '已发布';
      YuzanDemo.toast('反馈已发布，学生端将显示练习建议', 'success');
    } catch (err) {
      publishBtn.disabled = false;
      publishBtn.textContent = '发布反馈';
      YuzanDemo.toast(err.message || '发布失败，请重试', 'error');
    }
  });

  document.querySelectorAll('.text-box p span').forEach((word,index)=>{
    word.setAttribute('role','button'); word.tabIndex=0; word.title='定位到该词发音位置';
    const seek=()=>document.querySelector('[data-evidence-player]')?.__player?.seek(index===0?13:41);
    word.addEventListener('click',seek); word.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')seek()});
  });
  document.querySelectorAll('.machine>div').forEach(row=>row.addEventListener('click',()=>row.classList.toggle('expanded')));
  document.querySelector('.next').addEventListener('click',()=>YuzanDemo.toast('下一份练习预览功能暂未开通','warning'));
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});

  init();
})();