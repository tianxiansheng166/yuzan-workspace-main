(() => {
  const qaMode = new URLSearchParams(location.search).get('qa') === '1';
  document.body.classList.toggle('qa-mode', qaMode);
  const icons = {
    chevron:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 6 6 6-6 6"/></svg>',
    down:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 9 6 6 6-6"/></svg>',
    bell:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>',
    help:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3 2.3c-.8.3-.8.9-.8 1.7"/><path d="M12 17h.01"/></svg>',
    plus:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
    send:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
    pulse:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>',
    users:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
  };
  const defaultState = {
    viewer:{role:'teacher',name:'次仁拉姆',school:'日喀则市第二小学',className:'五年级一班'},
    permissions:{createCourse:true,publishTask:true,startAssessment:true,approveContent:false},
    filters:{semester:'2024–2025学年 · 春季学期'},
    network:{status:'synced',lastSync:'2 分钟前',aiConnected:true,offlineResources:true},
    ui:{sidebarOpen:false,loading:false,error:false,empty:false,modal:null,activeWorkflow:null},
    priority:{title:'即将截止的朗读任务',detail:'《春天的足迹》朗读任务将在 4 月 27 日 23:59 截止，尚有 8 位学生未完成。',count:8},
    workflow:[
      {id:'course',tone:'red',icon:'▣',count:2,title:'待发布课程',subtitle:'2 个课程草稿'},
      {id:'task',tone:'red',icon:'➤',count:3,title:'即将截止任务',subtitle:'3 个任务将截止'},
      {id:'review',tone:'orange',icon:'⌁',count:8,title:'待复核朗读',subtitle:'8 份朗读待复核'},
      {id:'student',tone:'green',icon:'●',count:5,title:'需干预学生',subtitle:'5 名学生需关注'},
      {id:'report',tone:'green',icon:'▥',count:0,title:'学习报告',subtitle:'查看班级报告'}
    ],
    courses:[
      {title:'高原植物的秘密',tags:['五年级上册','朗读'],date:'4月25日',thumb:'green'},
      {title:'家乡的变化',tags:['五年级口语','口语交际'],date:'4月24日',thumb:'desert'}
    ],
    tasks:[
      {title:'朗读 · 春天的足迹',due:'04-27 23:59',done:8,total:48,tone:'red'},
      {title:'朗读 · 触摸高原的风',due:'04-29 23:59',done:6,total:48,tone:'gold'},
      {title:'朗读 · 家乡的河流',due:'05-01 23:59',done:2,total:48,tone:'green'}
    ],
    reviews:[
      {name:'达瓦扎西',task:'春天的足迹',time:'10:24'},
      {name:'卓玛央宗',task:'春天的足迹',time:'09:18'},
      {name:'索朗旺姆',task:'触摸高原的风',time:'昨天'},
      {name:'格桑次旦',task:'春天的足迹',time:'昨天'}
    ],
    students:[
      {name:'达瓦扎西',issue:'多音节词语停顿问题',trend:'↓ 12%'},
      {name:'卓玛央宗',issue:'前后鼻音混淆',trend:'↓ 9%'},
      {name:'索朗旺姆',issue:'平翘舌音混淆',trend:'↓ 8%'},
      {name:'格桑次旦',issue:'声调起伏不足',trend:'↓ 7%'},
      {name:'尼玛扎西',issue:'语速过快',trend:'↓ 6%'}
    ]
  };
  function deepMerge(target, source){
    if(!source || typeof source !== 'object') return target;
    for(const [k,v] of Object.entries(source)){
      if(v && typeof v === 'object' && !Array.isArray(v)) target[k]=deepMerge({...target[k]},v);
      else target[k]=v;
    }
    return target;
  }
  let state=deepMerge(structuredClone(defaultState),window.__YUZAN_TEACHER_BOOTSTRAP__||{});
  const app=document.getElementById('teacher-app');
  const modalRoot=document.getElementById('teacher-modal-root');
  const toastRoot=document.getElementById('teacher-toast');
  const teacherNav=[
    {id:'course',label:'备课',sub:'课程准备',route:'/teacher',num:'1'},
    {id:'task',label:'发布任务',sub:'布置学习',route:'/teacher/assignments',num:'2'},
    {id:'assessment',label:'学习测评',sub:'学生学习',route:'/teacher/assessments',num:'3'},
    {id:'review',label:'复核朗读',sub:'纠音反馈',route:'/teacher/review',num:'4'},
    {id:'report',label:'报告分析',sub:'改进提升',route:'/teacher/reports',num:'5'}
  ];
  function currentPath(){return location.pathname.replace(/\/$/,'')||'/teacher'}
  function render(){
    app.innerHTML=`<div class="teacher-shell">
      ${renderSidebar()}
      <main class="teacher-main">
        ${renderHeader()}
        <div class="teacher-body">
          <section class="teacher-content">${renderContent()}</section>
          ${renderSupport()}
        </div>
      </main>
    </div>`;
    bindEvents();
    renderModal();
    requestAnimationFrame(drawCharts);
  }
  function renderSidebar(){
    return `<aside class="teacher-sidebar ${state.ui.sidebarOpen?'open':''}" aria-label="教师工作台导航">
      <div class="path-title">我的教学路径 <button id="path-help" aria-label="路径说明">?</button></div>
      <nav class="teacher-path">${teacherNav.map((n,i)=>`<a href="${n.route}" data-route="${n.route}" class="path-step ${i===0?'active':''}"><span class="path-node">${n.num}</span><span class="path-label"><strong>${n.label}</strong><span>${n.sub}</span></span></a>`).join('')}</nav>
      <div class="class-switch"><div class="class-line"><span class="class-icon">${icons.users}</span><span class="class-copy"><strong>${state.viewer.className}</strong><span>学生 48 人</span></span></div><button id="class-switch">切换班级　›</button></div>
    </aside>`;
  }
  function renderHeader(){
    return `<header class="teacher-header">
      <button class="select-like" id="school-select"><span>${state.viewer.school}</span>${icons.down}</button>
      <button class="select-like semester" id="semester-select"><span>${state.filters.semester}</span>${icons.down}</button>
      <div class="sync-status"><span class="sync-dot"></span><span>${state.network.status==='synced'?'同步正常':state.network.status==='offline'?'离线只读':'同步异常'}</span><span class="sync-meta">最后同步：${state.network.lastSync}</span></div>
      <button class="header-icon" id="notifications" aria-label="通知">${icons.bell}<span class="header-badge">3</span></button>
      <button class="header-icon help" id="help">${icons.help}</button>
      <button class="teacher-profile" id="profile"><span class="profile-avatar">次</span><span class="profile-copy"><strong>${state.viewer.name}</strong><span>普通话教师</span></span>${icons.down}</button>
    </header>`;
  }
  function renderContent(){
    if(state.ui.loading) return `<div class="empty-state" style="position:relative;min-height:600px"><div class="loading-mask"><div><div class="spinner"></div><p>正在同步教师工作台…</p></div></div></div>`;
    if(state.ui.error) return `<div class="error-state"><h2>工作台数据暂时不可用</h2><p>本地草稿和离线课程未受影响。</p><button class="btn primary" id="retry">重新加载</button></div>`;
    if(state.ui.empty) return `<div class="empty-state"><h2>尚未关联班级</h2><p>请联系学校管理员分配班级，或切换到已有班级。</p><button class="btn" id="class-switch-empty">切换班级</button></div>`;
    return `${renderGreeting()}${renderPriority()}${renderWorkflow()}${renderTaskGrid()}${renderBottom()}${renderFooter()}`;
  }
  function renderGreeting(){return `<div class="greeting"><span class="sun-icon"></span><div class="greeting-copy"><h1>早上好，${state.viewer.name}老师</h1><p>${qaMode?'4月26日 星期六':'今天是 4 月 26 日，星期六'}。您有 ${state.priority.count} 项需要优先处理。</p></div><div class="main-actions"><button class="btn primary" data-action="create-course">${icons.plus}创建课程</button><button class="btn" data-action="publish-task">${icons.send}发布任务</button><button class="btn" data-action="start-assessment">${icons.pulse}发起测评</button></div></div>`}
  function renderPriority(){return `<section class="priority"><span class="priority-flag">⚑</span><div class="priority-copy"><strong>今日最高优先级：${state.priority.title}</strong><p>${state.priority.detail}</p></div><button class="btn" data-action="handle-priority">去处理（${state.priority.count}）</button><span style="color:var(--red)">→</span></section>`}
  function renderWorkflow(){return `<section class="workflow"><h2 class="section-title">今日工作轨道</h2><div class="workflow-rail">${state.workflow.map(w=>`<button class="workflow-node ${w.tone}" data-workflow="${w.id}" type="button"><span class="workflow-count">${w.count||'✓'}</span><span class="workflow-dot">${w.icon}</span><strong>${w.title}</strong><span>${w.subtitle}</span></button>`).join('')}</div></section>`}
  function renderTaskGrid(){return `<div class="task-grid">
    <section class="task-card"><div class="task-head">待发布课程<button data-action="open-courses">全部（${state.courses.length}）›</button></div><div class="task-body">${state.courses.map(c=>`<button class="course-row" data-course="${c.title}"><span class="course-thumb ${c.thumb==='desert'?'desert':''}"></span><span class="course-info"><strong>${c.title}</strong><span>${c.tags.map(t=>`<i class="tiny-tag">${t}</i>`).join('')}</span><span>最近编辑：${c.date}</span></span></button>`).join('')}</div><button class="task-foot" data-action="open-courses">前往课程库　›</button></section>
    <section class="task-card"><div class="task-head">即将截止任务<button data-action="open-tasks">全部（${state.tasks.length}）›</button></div><div class="task-body">${state.tasks.map((t,i)=>`<button class="deadline-row" data-task="${i}"><span class="row-icon">▧</span><span class="row-copy"><strong>${t.title}</strong><span>截止：${t.due}</span></span><span class="row-stat ${t.tone==='green'?'green':''}">${t.done}/${t.total}</span></button>`).join('')}</div><button class="task-foot" data-action="open-tasks">查看任务中心　›</button></section>
    <section class="task-card"><div class="task-head">待复核朗读<button data-action="open-reviews">全部（${state.reviews.length}）›</button></div><div class="task-body">${state.reviews.map((r,i)=>`<button class="review-row" data-review="${i}"><span class="mini-avatar">${r.name.slice(0,1)}</span><span class="row-copy"><strong>${r.name}</strong><span>朗读 · ${r.task}</span></span><span style="font-size:10px;color:#7a7f7a">${r.time}</span></button>`).join('')}</div><button class="task-foot" data-action="open-reviews">前往复核中心　›</button></section>
    <section class="task-card"><div class="task-head">需关注学生<button data-action="open-students">全部（${state.students.length}）›</button></div><div class="task-body">${state.students.slice(0,5).map((s,i)=>`<button class="student-row" data-student="${i}"><span class="mini-avatar">${s.name.slice(0,1)}</span><span><strong style="display:block;font-size:12px">${s.name}</strong><span class="issue">${s.issue}</span></span><span class="trend">${s.trend}</span></button>`).join('')}</div><button class="task-foot" data-action="open-students">查看学生详情　›</button></section>
  </div>`}
  function renderBottom(){
    const clusters=state.pronunciationClusters||[['前后鼻音混淆 (n/l)',32,72],['平翘舌音混淆',28,61],['声调起伏不足',26,54],['多音节停顿不当',21,43],['卷舌音不到位',18,36]];
    const clusterRows=clusters.map(x=>{
      const label=typeof x==='object'?x.label:x[0];
      const count=typeof x==='object'?x.count:x[1];
      const pct=typeof x==='object'?x.percentage:x[2];
      return `<div class="cluster-row"><span>${label}</span><span class="cluster-bar"><i style="width:${pct}%"></i></span><span>${count} 人</span></div>`
    }).join('');
    return `<div class="bottom-grid"><section class="bottom-card"><div class="bottom-title">班级成长路径<button data-action="growth-report">查看详细报告　›</button></div><div class="growth-chart"><svg id="growth-svg" viewBox="0 0 520 110" preserveAspectRatio="none" aria-label="班级成长路径"></svg></div></section><section class="bottom-card"><div class="bottom-title">薄弱发音聚类 Top 5 <button id="cluster-help">ⓘ</button></div><div class="cluster-layout"><div class="cluster-list">${clusterRows}</div><div class="cluster-cloud" id="cluster-cloud"></div></div></section></div>`
  }
  function renderFooter(){return `<footer class="teacher-footer"><span>语赞心声　·　让每一次发声都被听见</span><i></i></footer>`}

  function renderSupport(){const tools=[['MM','MindMate','备课建议 / 学情问答 / 写作批改'],['MG','MindGraph','生成学科图谱 / 关联资源推荐'],['译','藏汉翻译','藏文 ⇄ 中文互译'],['协','志愿者协作','申请支教 / 远程协作 / 资源共享']];return `<aside class="teacher-support"><h2 class="support-title">智能支持</h2><p class="support-sub">需要时点击使用</p>${tools.map((t,i)=>`<div class="tool-card"><span class="tool-icon">${t[0]}</span><span class="tool-copy"><strong>${t[1]}</strong><span>${t[2]}</span></span><button data-tool="${i}">打开</button></div>`).join('')}<section class="support-section"><h3>教学资源推荐</h3>${['春天主题朗读素材包','高原科普读本合集','口语交际活动设计'].map((r,i)=>`<button class="resource-row" data-resource="${i}"><span class="resource-thumb"></span><span>${r}</span><b>›</b></button>`).join('')}</section><section class="support-section"><h3>平台服务状态</h3>${[['数据服务','正常'],['AI 服务',state.network.aiConnected?'正常':'未接入'],['存储服务','正常']].map(x=>`<div class="service-row"><i></i><span>${x[0]}</span><b>${x[1]}</b></div>`).join('')}</section><div class="support-status">${state.network.status==='synced'?'全部正常':'当前为离线只读'}</div></aside>`}
  function drawCharts(){
    const svg=document.getElementById('growth-svg');if(svg){
      const vals=[92,76,68,54,54],xs=[36,150,265,380,490];
      const y=v=>96-(v-45)*1.35;
      svg.innerHTML=`<path d="${xs.map((x,i)=>`${i?'L':'M'}${x} ${y(vals[i])}`).join(' ')}" fill="none" stroke="#287552" stroke-width="3"/><path d="M36 96 H490" stroke="#ded8ce" stroke-width="1" stroke-dasharray="4 4"/>${vals.map((v,i)=>`<circle cx="${xs[i]}" cy="${y(v)}" r="5" fill="${i===4?'#fff':'#287552'}" stroke="#287552" stroke-width="2"/><text x="${xs[i]}" y="${y(v)-11}" text-anchor="middle" font-size="12" fill="#3f4641">${i===4?'—':v+'%'}</text><text x="${xs[i]}" y="108" text-anchor="middle" font-size="10" fill="#777">${['字词基础','朗读流利度','表达清晰度','情境与语调','综合应用'][i]}</text>`).join('')}`;
    }
    const cloud=document.getElementById('cluster-cloud');if(cloud&&!cloud.children.length){for(let i=0;i<95;i++){const s=document.createElement('span');s.className=i%7===0?'green':i%5===0?'gold':'';const a=i*.67,r=5+((i*17)%60);s.style.left=`${50+Math.cos(a)*r*.72}%`;s.style.top=`${50+Math.sin(a)*r*.58}%`;cloud.append(s)}}
  }
  function bindEvents(){
    document.querySelectorAll('[data-route]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();navigate(el.dataset.route)}));
    document.querySelector('.teacher-header')?.addEventListener('click',e=>{if(innerWidth<=900&&e.offsetX<42){state.ui.sidebarOpen=!state.ui.sidebarOpen;render()}});
    document.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',()=>handleAction(el.dataset.action)));
    document.querySelectorAll('[data-workflow]').forEach(el=>el.addEventListener('click',()=>focusWorkflow(el.dataset.workflow)));
    document.querySelectorAll('[data-course]').forEach(el=>el.addEventListener('click',()=>openCourse(el.dataset.course)));
    document.querySelectorAll('[data-task]').forEach(el=>el.addEventListener('click',()=>openTask(Number(el.dataset.task))));
    document.querySelectorAll('[data-review]').forEach(el=>el.addEventListener('click',()=>openReview(Number(el.dataset.review))));
    document.querySelectorAll('[data-student]').forEach(el=>el.addEventListener('click',()=>openStudent(Number(el.dataset.student))));
    document.querySelectorAll('[data-tool]').forEach(el=>el.addEventListener('click',()=>openTool(Number(el.dataset.tool))));
    document.querySelectorAll('[data-resource]').forEach(el=>el.addEventListener('click',()=>toast('资源预览已打开。','success')));
    document.querySelector('#school-select')?.addEventListener('click',showSchoolModal);
    document.querySelector('#semester-select')?.addEventListener('click',showSemesterModal);
    document.querySelector('#notifications')?.addEventListener('click',showNotifications);
    document.querySelector('#help')?.addEventListener('click',showHelp);
    document.querySelector('#profile')?.addEventListener('click',showProfile);
    document.querySelector('#class-switch')?.addEventListener('click',showClassModal);
    document.querySelector('#class-switch-empty')?.addEventListener('click',showClassModal);
    document.querySelector('#path-help')?.addEventListener('click',()=>openModal('教学路径说明','备课、发布、学习、复核和报告构成连续教学闭环。完成当前节点后，下一节点会沿路径点亮。'));
    document.querySelector('#cluster-help')?.addEventListener('click',()=>openModal('薄弱发音聚类','聚类来自班级最近 30 天朗读记录，只作为教师复核线索，不自动形成诊断结论。'));
    document.querySelector('#retry')?.addEventListener('click',()=>{state.ui.error=false;state.ui.loading=true;render();try{location.reload()}catch(_){state.ui.loading=false;state.ui.error=true;render();toast('刷新失败，请手动按 F5 重载页面。','error')}});
  }
  function navigate(route){
    if(route==='/teacher'){history.pushState({},'',route+(qaMode?'?qa=1':''));state.ui.sidebarOpen=false;render();return}
    toast('该教师子页面已进入后续逐页队列，当前检查点只放行教师首页。');
  }
  function handleAction(action){
    if(action==='create-course') return openCourseCreate();
    if(action==='publish-task') return openTaskPublish();
    if(action==='start-assessment') return openAssessment();
    if(action==='handle-priority') return openReview(0,true);
    const map={
      'open-courses':'课程库','open-tasks':'任务中心','open-reviews':'朗读复核中心','open-students':'学生成长档案','growth-report':'班级成长报告'
    };openModal(map[action]||'教师工作台',`该入口已保留真实路由与状态边界，将在对应参考页逐页实现后接入。`)
  }
  function openCourseCreate(){openFormModal('创建课程',`<div class="field"><label>课程名称</label><input id="course-name" value="春天主题朗读课"></div><div class="field"><label>适用班级</label><select><option>${state.viewer.className}</option></select></div><div class="field"><label>课程说明</label><textarea>围绕朗读节奏、停顿和情感表达设计课程内容。</textarea></div>`,()=>{const name=document.getElementById('course-name').value.trim();if(!name)return toast('请填写课程名称。','error');state.courses.unshift({title:name,tags:['草稿','朗读'],date:'刚刚',thumb:'green'});closeModal();render();toast('课程草稿已创建。教师可发布，但无平台审核批准权限。','success')})}
  function openTaskPublish(){openFormModal('发布学习任务',`<div class="field"><label>任务名称</label><input id="task-name" value="朗读 · 高原的春天"></div><div class="field"><label>截止时间</label><input value="2026-07-18 23:59"></div><div class="field"><label>发布范围</label><select><option>${state.viewer.className}</option></select></div>`,()=>{const name=document.getElementById('task-name').value.trim();if(!name)return toast('请填写任务名称。','error');state.tasks.unshift({title:name,due:'07-18 23:59',done:0,total:48,tone:'red'});closeModal();render();toast('任务已发布。','success')})}
  function openAssessment(){openFormModal('发起测评',`<div class="field"><label>测评名称</label><input value="本周朗读能力测评"></div><div class="field"><label>测评对象</label><select><option>${state.viewer.className}</option></select></div><div class="field"><label>说明</label><textarea>学生完成朗读与书面练习后，教师进行复核。</textarea></div>`,()=>{closeModal();toast('测评任务已发起。','success')})}
  function focusWorkflow(id){state.ui.activeWorkflow=id;const item=state.workflow.find(x=>x.id===id);toast(`已聚焦：${item.title}`,'success')}
  function openCourse(title){openModal(title,'课程处于草稿状态。你可以继续编辑、预览或发布；教师端不提供平台审核批准操作。')}
  function openTask(i){const t=state.tasks[i];openModal(t.title,`完成 ${t.done}/${t.total}，截止时间 ${t.due}。可提醒未完成学生或调整截止时间。`)}
  function openReview(i,priority=false){const r=state.reviews[i]||state.reviews[0];openModal(priority?'优先处理朗读任务':`复核 ${r.name} 的朗读`,`打开真实音频证据、波形、转写和教师反馈区域。当前教师有复核与反馈权限，没有平台内容审核批准权限。`)}
  function openStudent(i){const s=state.students[i];openModal(s.name,`最近需要关注：${s.issue}。教师可以查看学习证据、添加干预建议和安排下一次练习。`)}
  function openTool(i){const names=['MindMate','MindGraph','藏汉翻译','志愿者协作'];if(!state.network.aiConnected&&i<3)return openModal('服务暂不可用','AI 服务尚未接入。课程和本地教学资源仍可正常使用。');openModal(names[i],`${names[i]} 只在教师主动打开时进入，不会自动弹出或直接覆盖教师判断。`)}
  function showSchoolModal(){openFormModal('切换学校',`<div class="field"><label>学校</label><select id="school-choice"><option>日喀则市第二小学</option><option>林芝市第一中学</option><option>那曲市第二中学</option></select></div>`,()=>{state.viewer.school=document.getElementById('school-choice').value;closeModal();render();toast('学校范围已切换。','success')})}
  function showSemesterModal(){openFormModal('切换学期',`<div class="field"><label>学期</label><select id="semester-choice"><option>2024–2025学年 · 春季学期</option><option>2025–2026学年 · 秋季学期</option></select></div>`,()=>{state.filters.semester=document.getElementById('semester-choice').value;closeModal();render();toast('学期已切换。','success')})}
  function showClassModal(){openFormModal('切换班级',`<div class="field"><label>班级</label><select id="class-choice"><option>五年级一班</option><option>五年级二班</option><option>六年级一班</option></select></div>`,()=>{state.viewer.className=document.getElementById('class-choice').value;closeModal();render();toast('班级已切换。','success')})}
  async function showNotifications(){
    try{
      const api=window.YuzanApi;
      if(!api||!api.getNotifications){openModal('通知中心','3 条新通知：朗读任务即将截止、2 名学生离线资源待同步、1 个课程草稿尚未发布。');return}
      const data=await api.getNotifications({limit:10});
      const items=(data.items||[]).map(n=>`<div style="padding:6px 0;border-bottom:1px solid #eee"><strong>${n.title}</strong><br><span style="font-size:12px;color:#666">${n.body}</span></div>`).join('');
      openModal('通知中心',items||'暂无新通知')
    }catch(e){openModal('通知中心','通知服务暂不可用')}
  }
  function showHelp(){openModal('教师工作台帮助','工作台按备课、发布、学习、复核和干预组织。所有智能工具均需教师主动打开。')}
  function showProfile(){openFormModal('工作台状态演示',`<div class="field"><label>页面状态</label><select id="demo-state"><option value="normal">正常繁忙日</option><option value="empty">首次进入无班级</option><option value="offline">弱网离线只读</option><option value="error">服务错误</option><option value="ai-off">AI 服务未接入</option></select></div>`,()=>{const v=document.getElementById('demo-state').value;state.ui.empty=v==='empty';state.ui.error=v==='error';state.network.status=v==='offline'?'offline':'synced';state.network.aiConnected=v!=='ai-off';closeModal();render();toast('页面状态已切换。','success')})}
  function openModal(title,body){state.ui.modal={title,body,form:false};renderModal()}
  function openFormModal(title,body,onConfirm){state.ui.modal={title,body,form:true,onConfirm};renderModal()}
  function renderModal(){if(!state.ui.modal){modalRoot.innerHTML='';return}const m=state.ui.modal;modalRoot.innerHTML=`<div class="teacher-modal-backdrop"><section class="teacher-modal" role="dialog" aria-modal="true" aria-label="${m.title}"><div class="teacher-modal-head"><strong>${m.title}</strong><button id="modal-close" aria-label="关闭">×</button></div><div class="teacher-modal-body">${m.form?m.body:`<p style="line-height:1.8;margin:0">${m.body}</p>`}</div><div class="teacher-modal-actions"><button class="btn" id="modal-cancel">取消</button>${m.form?'<button class="btn primary" id="modal-confirm">确认</button>':'<button class="btn primary" id="modal-confirm">知道了</button>'}</div></section></div>`;document.getElementById('modal-close').onclick=closeModal;document.getElementById('modal-cancel').onclick=closeModal;document.getElementById('modal-confirm').onclick=m.form?m.onConfirm:closeModal;modalRoot.querySelector('.teacher-modal-backdrop').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal()})}
  function closeModal(){state.ui.modal=null;renderModal()}
  function toast(message,type=''){const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=message;toastRoot.append(el);setTimeout(()=>el.remove(),qaMode?600:2600)}
  window.addEventListener('popstate',render);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();if(state.ui.sidebarOpen){state.ui.sidebarOpen=false;render()}}});
  window.YuzanTeacher={
    hydrate(next){state=deepMerge(state,next);render()},
    async loadBackendState(){state.ui.loading=true;render();try{
      const api=window.YuzanApi;
      if(!api||!api.getToken||!api.getToken()){state.ui.loading=false;render();return}
      const [data,clusterData]=await Promise.all([
        api.getDashboard().catch(()=>null),
        api.getPronunciationClusters().catch(()=>null)
      ]);
      if(data)state=deepMerge(state,mapDashboardToState(data));
      if(clusterData&&clusterData.clusters)state.pronunciationClusters=clusterData.clusters;
      state.ui.loading=false;render()
    }catch(e){state.ui.loading=false;state.ui.error=true;render();throw e}},
    getState(){return structuredClone(state)},
    setNetwork(status){state.network.status=status;render()}
  };
  function mapDashboardToState(d){
    const s={};
    if(d.greeting){s.viewer={name:d.greeting.name};s.priority={count:d.greeting.priorityCount||0}}
    if(d.priority)s.priority={...s.priority,...d.priority};
    if(d.workflow)s.workflow=d.workflow;
    if(d.courses)s.courses=d.courses.map(c=>({title:c.title,tags:c.tags||[],date:c.updatedAt||'',thumb:'green',id:c.id}));
    if(d.tasks)s.tasks=d.tasks.map(t=>({title:t.title,due:t.dueAt||'',done:t.done||0,total:t.total||0,tone:t.tone||'green',id:t.id}));
    if(d.reviews)s.reviews=d.reviews.map(r=>({name:r.studentName,task:r.taskTitle,time:r.submittedAt,submissionId:r.submissionId}));
    if(d.students)s.students=d.students.map(st=>({name:st.name,issue:st.issue,trend:st.trend,enrollmentId:st.enrollmentId}));
    return s
  }
  render();
  /* Auto-load from backend if authenticated */
  if(window.YuzanApi&&window.YuzanApi.getToken&&window.YuzanApi.getToken()){
    window.YuzanTeacher.loadBackendState()
  }
})();
