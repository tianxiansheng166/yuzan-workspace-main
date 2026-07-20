(() => {
  const qaMode=new URLSearchParams(location.search).get('qa')==='1';
  document.body.classList.toggle('qa-mode',qaMode);
  const icons={
    home:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></svg>',
    book:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5a3 3 0 0 1 3-3h13v17H7a3 3 0 0 0-3 3Z"/><path d="M4 5v17M8 6h8M8 10h6"/></svg>',
    clipboard:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4"/></svg>',
    file:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2h8l4 4v16H6Z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></svg>',
    bag:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a4 4 0 0 1 8 0v2M3 12h18"/></svg>',
    community:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16v12H7l-3 3Z"/><path d="M8 10h8M8 13h5"/></svg>',
    bell:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>',
    help:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3 2.3c-.8.3-.8.9-.8 1.7M12 17h.01"/></svg>',
    globe:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>',
    down:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 9 6 6 6-6"/></svg>'
  };
  const defaultState={
    viewer:{name:'李明',role:'volunteer',level:'V2',avatar:'/assets/volunteer-avatar.jpg'},
    permissions:{enterService:true,reportRisk:true,viewMinorData:false},
    qualification:{status:'qualified',validUntil:'2026-07-10',scope:'小学 · 阅读陪伴'},
    training:{progress:80,completed:16,total:20,examStatus:'pending'},
    journey:[
      {id:'training',label:'培训学习',sub:'已完成 80%',status:'done'},
      {id:'exam',label:'考核评估',sub:'待考核',status:'done'},
      {id:'qualified',label:'服务资格',sub:'已获资格',status:'current'},
      {id:'task',label:'服务任务',sub:'进行中',status:'pending'},
      {id:'record',label:'服务记录',sub:'累计 32 小时',status:'pending'},
      {id:'review',label:'复盘成长',sub:'持续精进',status:'pending'}
    ],
    task:{id:null,status:'active',category:'阅读陪伴',title:'高原上的春天 · 第 3 次阅读陪伴',students:3,grade:'小学三年级',mode:'线上',duration:60,start:'今天 15:30',end:'16:30'},
    serviceHours:32,
    teacher:{name:'次仁老师',role:'项目教师',avatar:'/assets/teacher-contact-avatar.jpg',available:true},
    courses:[
      {id:1,title:'高原儿童阅读发展特点与支持策略',duration:40,progress:75,cover:'/assets/volunteer-course-1.jpg'},
      {id:2,title:'未成年人保护与风险识别实务',duration:35,progress:40,cover:'/assets/volunteer-course-2.jpg'}
    ],
    network:{online:true,synced:true},
    ui:{sidebarOpen:false,sidebarCollapsed:false,modal:null,pageState:'normal'}
  };
  function deepMerge(target,source){if(!source||typeof source!=='object')return target;for(const[k,v]of Object.entries(source)){if(v&&typeof v==='object'&&!Array.isArray(v))target[k]=deepMerge({...target[k]},v);else target[k]=v}return target}
  let state=deepMerge(structuredClone(defaultState),window.__YUZAN_VOLUNTEER_BOOTSTRAP__||{});
  const app=document.getElementById('volunteer-app'),modalRoot=document.getElementById('volunteer-modal-root'),toastRoot=document.getElementById('volunteer-toast');
  const nav=[
    ['workbench','工作台','/volunteer','home'],['training','学习与培训','/volunteer/training','book'],['tasks','服务任务','/volunteer/tasks','clipboard'],['records','服务记录','/volunteer/records','file'],['certificate','成长与证书','/volunteer/certificate','file'],['resources','资源中心','/volunteer/resources','bag'],['community','公益社区','/volunteer/community','community'],['messages','消息中心','/volunteer/messages','bell'],['help','帮助与支持','/volunteer/help','help']
  ];
  function currentRoute(){return location.pathname.replace(/\/$/,'')||'/'}
  function render(){app.innerHTML=`<div class="vol-shell">${renderSidebar()}<main class="vol-main">${renderHeader()}<section class="vol-content">${renderContent()}</section></main></div>`;bindEvents();renderModal()}
  function renderSidebar(){const route=currentRoute();const collapsed=state.ui.sidebarCollapsed;return `<aside class="vol-sidebar ${state.ui.sidebarOpen?'open':''} ${collapsed?'collapsed':''}"><button class="vol-collapse-btn" type="button" aria-label="${collapsed?'展开侧边栏':'收起侧边栏'}" title="${collapsed?'展开侧边栏':'收起侧边栏'}">${collapsed?'›':'‹'}</button><nav class="vol-nav">${nav.map(n=>`<a class="vol-nav-link ${route===n[2]?'active':''}" href="${n[2]}" data-route="${n[2]}"><span class="vol-nav-icon">${icons[n[3]]}</span><span>${n[1]}</span>${n[0]==='messages'?'<span class="vol-nav-badge">3</span>':''}</a>`).join('')}</nav><button class="switch-role" id="switch-role">${icons.community}<span>切换身份</span></button></aside>`}
  function renderHeader(){const route=currentRoute(), label=(nav.find(n=>n[2]===route)||nav[0])[1];const subtitle=route==='/volunteer'?'用知识与陪伴，陪孩子看见更广阔的世界':`志愿者服务中心 · ${label}`;return `<header class="vol-header"><div class="header-copy"><h1>${label}</h1><p>${subtitle}</p></div><div class="header-actions"><button class="round-action globe" id="language">${icons.globe}</button><button class="round-action" id="notifications">${icons.bell}<span class="action-badge">3</span></button><button class="header-profile" id="profile"><img src="${state.viewer.avatar}" alt="志愿者头像"><strong>${state.viewer.name}</strong>${icons.down}</button></div></header>`}
  function renderContent(){
    const route=currentRoute();
    if(route!=='/volunteer') return renderSubpage(route);
    if(state.ui.pageState==='loading')return `<div class="state-placeholder"><div><div style="font-size:34px">◌</div><h2>正在加载志愿服务数据</h2><p>本地培训进度不会丢失。</p></div></div>`;
    if(state.ui.pageState==='error')return `<div class="state-placeholder"><div><h2>服务数据暂时不可用</h2><p>你仍可以查看已下载培训课程和保护守则。</p><button class="primary-btn" id="retry">重新加载</button></div></div>`;
    if(state.ui.pageState==='no-task')return `${renderProfile()}${renderJourney()}${renderTraining()}<section class="v-panel today-panel"><div class="panel-head"><h2 class="panel-title">今日任务</h2></div><div style="padding:55px 20px;text-align:center;color:#747974"><strong style="display:block;font-size:17px;color:#333">今天暂无服务任务</strong><p>完成待学课程后，可在任务中心查看新的陪伴机会。</p></div></section>${renderHoursAndTeacher()}${renderQualification()}${renderCourses()}${renderRightStack()}`;
    return `${renderProfile()}${renderJourney()}${renderTraining()}${renderToday()}${renderHoursAndTeacher()}${renderQualification()}${renderCourses()}${renderRightStack()}`
  }
  function renderSubpage(route){
    const integrated={
      '/volunteer/training':'/volunteer-pages/yuzan-volunteer-training-ui/yuzan-volunteer-training-ui/index.html',
      '/volunteer/tasks':'/volunteer-pages/yuzan-volunteer-service-tasks-pixel-web-1-/yuzan-volunteer-service-tasks-standalone/index.html',
      '/volunteer/records':'/volunteer-pages/yuzan-one-to-one-support-standalone-v3/yuzan-one-to-one-support-standalone-v3/index.html',
      '/volunteer/certificate':'/volunteer-pages/yuzan-volunteer-training-completion-standalone-v1/yuzan-volunteer-training-completion-standalone-v1/index.html',
      '/volunteer/resources':'/volunteer-pages/yuzan-volunteer-assessment-pixel-web/yuzan-volunteer-assessment-standalone/index.html',
      '/volunteer/community':'/volunteer-pages/yuzan-volunteer-pairings-pixel-web-v2/yuzan-volunteer-pairings-standalone/index.html',
      '/volunteer/messages':'/volunteer-pages/yuzan-volunteer-emergency-report-standalone-v2/yuzan-volunteer-emergency-report-standalone-v2/index.html',
      '/volunteer/help':'/volunteer-pages/yuzan-volunteer-recruitment-pixel-web/yuzan-volunteer-recruitment-standalone/index.html'
    };
    if(integrated[route]) return `<section class="integrated-page"><iframe title="志愿者服务页面" src="${integrated[route]}" loading="eager"></iframe></section>`;
    const pages={
      '/volunteer/training':['学习与培训','按阶段完成课程、保护守则与在线考核。',['培训进度','课程目录','在线考核']],
      '/volunteer/tasks':['服务任务','浏览适合你的陪伴任务并确认服务时间。',['待开始任务','进行中任务','历史任务']],
      '/volunteer/records':['服务记录','查看服务时长、陪伴对象与教师反馈。',['累计 32 小时','本月 8 小时','待补充记录']],
      '/volunteer/certificate':['成长与证书','管理服务资格、培训证书与成长里程碑。',['服务资格证书','培训完成证书','成长里程碑']],
      '/volunteer/resources':['资源中心','获取课程资料、活动模板与保护守则。',['推荐资料','常用模板','保护守则']],
      '/volunteer/community':['公益社区','与其他志愿者交流经验，分享温暖时刻。',['经验分享','活动公告','我的关注']],
      '/volunteer/messages':['消息中心','集中查看平台通知与项目教师消息。',['未读消息 3 条','服务提醒','系统通知']],
      '/volunteer/help':['帮助与支持','遇到服务问题时，快速找到解决方案与人工支持。',['常见问题','联系项目教师','隐私与安全']]
    };
    const p=pages[route]||pages['/volunteer'];
    return `<section class="v-panel subpage-hero"><span class="eyebrow">志愿者服务中心</span><h2>${p[0]}</h2><p>${p[1]}</p></section><section class="subpage-grid">${p[2].map((x,i)=>`<button class="v-panel subpage-card" data-sub-action="${x}"><span class="subpage-index">0${i+1}</span><strong>${x}</strong><span>${i===0?'查看详情':'打开功能'}　›</span></button>`).join('')}</section><section class="v-panel subpage-note"><strong>温馨提示</strong><p>当前页面已完成前端交互，数据接入后端后会自动替换为真实内容。点击卡片可查看反馈。</p></section>`;
  }
  function renderProfile(){return `<section class="v-panel profile-panel"><div class="profile-line"><img src="${state.viewer.avatar}" alt="志愿者头像"><span class="profile-copy"><strong>${state.viewer.name}</strong><span>志愿者 · ${state.viewer.level}</span></span></div><p class="profile-quote">用声音传递温暖，以陪伴点亮成长</p></section>`}
  function renderJourney(){return `<section class="v-panel journey-panel"><h2 class="panel-title">服务旅程</h2><div class="journey">${state.journey.map((j,i)=>`<button class="journey-step ${j.status}" data-journey="${j.id}"><span class="journey-node">${j.status==='done'?'✓':j.status==='current'?'●':i+1}</span><strong>${j.label}</strong><span>${j.sub}</span></button>`).join('')}</div></section>`}
  function renderTraining(){const disabled=state.training.examStatus!=='pending';return `<section class="v-panel training-panel"><h2 class="panel-title">培训与考核</h2><div class="mini-info">培训完成度</div><div class="progress-big">${state.training.progress}<span style="font-size:16px">%</span></div><div class="progress-track"><i style="width:${state.training.progress}%"></i></div><div class="progress-caption">已学 ${state.training.completed} / ${state.training.total} 课时</div><div class="separator"></div><div>考核状态</div><div class="exam-state"><span class="exam-icon">◷</span><span class="exam-copy"><strong>${state.training.examStatus==='passed'?'已通过':'待考核'}</strong><span>${state.training.examStatus==='passed'?'资格已生效':'需完成在线考试'}</span></span></div><button class="outline-btn red ${disabled?'disabled':''}" id="enter-exam" ${disabled?'disabled':''}>${state.training.examStatus==='passed'?'查看考核结果':'进入考核'}</button></section>`}
  function renderToday(){const inProgress=state.task.status==='in-progress';const canEnter=state.qualification.status==='qualified'&&['active','in-progress'].includes(state.task.status);return `<section class="v-panel today-panel"><div class="panel-head"><h2 class="panel-title">今日任务　ⓘ</h2><button data-route="/volunteer/tasks">全部任务　›</button></div><div class="today-task"><div class="task-top"><span class="task-tag">${state.task.category}</span><span class="task-status">◉ ${inProgress?'服务中':state.task.status==='active'?'待开始':'暂不可用'}</span></div><h2>${state.task.title}</h2><div class="task-meta"><span>♙ 服务对象 ${state.task.students} 人</span><span>▣ 学段 ${state.task.grade}</span><span>▧ 方式 ${state.task.mode}</span><span>◷ 预计时长 ${state.task.duration} 分钟</span></div><div class="task-bottom"><span>◷ ${state.task.start} – ${state.task.end}</span><button class="primary-btn ${canEnter?'':'disabled'}" id="enter-service" ${canEnter?'':'disabled'}>${inProgress?'完成服务':canEnter?'进入服务':'暂不可进入'}</button></div></div></section>`}
  function renderHoursAndTeacher(){return `<section class="v-panel hours-panel"><div style="font-size:13px">累计服务时长</div><div class="hours-line"><span class="clock-icon">◷</span><span class="hours-value"><strong>${state.serviceHours}</strong> <span>小时</span><small>自 2024-12-01 加入以来</small></span></div></section><section class="v-panel teacher-panel"><div class="teacher-title">教师联系人</div><div class="teacher-line"><img src="${state.teacher.avatar}" alt="教师联系人头像"><span class="teacher-info"><strong>${state.teacher.name}</strong><span>${state.teacher.role}</span></span><span class="contact-state">${state.teacher.available?'可联系':'暂离线'}</span></div><div class="teacher-actions"><button id="teacher-chat">◯ 在线沟通</button><button id="teacher-message">▣ 发消息</button></div></section>`}
  function renderQualification(){const active=state.qualification.status==='qualified';return `<section class="v-panel qualification-panel"><h2 class="panel-title">服务资格</h2><div class="qual-state"><span class="qual-check">${active?'✓':'!'}</span><span><strong>${active?'已获资格':'资格暂停'}</strong><span>${active?'有效期至 '+state.qualification.validUntil:'请联系项目教师'}</span></span></div><div class="qual-scope">服务范围：${state.qualification.scope}</div><button class="outline-btn" id="view-certificate">查看资格证书</button></section>`}
  function renderCourses(){return `<section class="v-panel courses-panel"><div class="panel-head"><h2 class="panel-title">待学课程</h2><button data-route="/volunteer/training">继续学习　›</button></div><div class="course-list">${state.courses.map(c=>`<article class="course-row"><img src="${c.cover}" alt="课程封面"><div class="course-info"><strong>${c.title}</strong><span>课程 · ${c.duration} 分钟</span><div class="course-progress"><span class="progress-track"><i style="width:${c.progress}%"></i></span><span>${c.progress}%</span></div></div><button class="outline-btn" data-course="${c.id}">继续学习</button></article>`).join('')}</div></section>`}
  function renderRightStack(){return `<div class="right-stack"><section class="v-panel rules-panel"><div class="rules-title"><span class="shield">⬟</span>隐私与未成年人保护提醒</div><ul class="rule-list"><li>不泄露学生个人信息</li><li>不添加学生私人联系方式</li><li>不进行线下单独接触</li><li>发现问题，及时上报</li></ul><button class="outline-btn" id="view-rules">查看完整守则</button></section><section class="v-panel risk-panel"><div class="risk-line"><span class="risk-icon">⚠</span><span class="risk-copy"><strong>风险上报</strong><span>如发现疑似风险或不当行为</span></span></div><button class="primary-btn" id="report-risk">立即上报</button></section></div>`}
  function bindEvents(){
    document.querySelectorAll('[data-route]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();navigate(el.dataset.route)}));
    // 侧边栏收回/展开
    const volCollapseBtn=document.querySelector('.vol-collapse-btn');
    volCollapseBtn?.addEventListener('click',()=>{
      state.ui.sidebarCollapsed=!state.ui.sidebarCollapsed;
      render();
      // 触发 iframe 与外部布局重新计算
      window.dispatchEvent(new Event('resize'));
      // 重新适配集成的 iframe 高度
      setTimeout(()=>{const f=document.querySelector('.integrated-page iframe');if(f&&f.contentDocument&&f.contentDocument.readyState==='complete'){f.dispatchEvent(new Event('load'))}},260);
    });
    document.querySelector('.vol-header')?.addEventListener('click',e=>{if(innerWidth<=900&&e.offsetX<44){state.ui.sidebarOpen=!state.ui.sidebarOpen;render()}});
    document.querySelectorAll('[data-journey]').forEach(el=>el.addEventListener('click',()=>openJourney(el.dataset.journey)));
    document.querySelectorAll('[data-course]').forEach(el=>el.addEventListener('click',()=>openCourse(Number(el.dataset.course))));
    document.querySelector('#enter-exam')?.addEventListener('click',startExam);
    document.querySelector('#enter-service')?.addEventListener('click',enterService);
    document.querySelector('#view-certificate')?.addEventListener('click',viewCertificate);
    document.querySelector('#teacher-chat')?.addEventListener('click',()=>openModal('在线沟通','将通过平台内受保护的沟通通道联系项目教师，不展示私人联系方式。'));
    document.querySelector('#teacher-message')?.addEventListener('click',messageTeacher);
    document.querySelector('#view-rules')?.addEventListener('click',viewRules);
    document.querySelector('#report-risk')?.addEventListener('click',reportRisk);
    document.querySelector('#switch-role')?.addEventListener('click',showRoleModal);
    document.querySelector('#notifications')?.addEventListener('click',openNotifications);
    document.querySelector('#language')?.addEventListener('click',()=>toast('当前演示使用简体中文。'));
    document.querySelector('#profile')?.addEventListener('click',showStateModal);
    document.querySelector('#retry')?.addEventListener('click',()=>{state.ui.pageState='loading';render();try{location.reload()}catch(_){state.ui.pageState='error';render();toast('刷新失败，请手动按 F5 重载页面。','error')}});
    document.querySelectorAll('[data-sub-action]').forEach(el=>el.addEventListener('click',()=>toast(`${el.dataset.subAction}已打开，等待后端数据接入。`,'success')));
    const integratedFrame=document.querySelector('.integrated-page iframe');
    const resetIntegratedFrame=()=>{try{const doc=integratedFrame.contentDocument;if(!doc||!doc.head)return;let style=doc.getElementById('yuzan-integrated-nav-reset');if(!style){style=doc.createElement('style');style.id='yuzan-integrated-nav-reset';style.textContent=`html,body{width:100%!important;min-width:0!important;overflow-x:hidden!important}.sidebar,.topbar,.page-header{display:none!important}.app-shell,.app{display:block!important;grid-template-columns:1fr!important;width:100%!important;min-width:0!important;max-width:none!important;margin:0!important;border:0!important;border-radius:0!important}.main,.main-area,.content,.page{width:100%!important;min-width:0!important;max-width:none!important;margin-left:0!important;grid-column:1!important;box-sizing:border-box!important}.content{height:auto!important;min-height:0!important}.action-bar{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:24px!important;padding:20px!important}.option{grid-template-columns:22px 26px minmax(0,1fr)!important}.option span:last-child{min-width:0!important;white-space:normal!important;word-break:normal!important;writing-mode:horizontal-tb!important;line-height:1.55!important}`;doc.head.appendChild(style)}requestAnimationFrame(()=>{const height=Math.max(doc.documentElement.scrollHeight,doc.body.scrollHeight,760);integratedFrame.style.height=`${height}px`;integratedFrame.parentElement.style.minHeight=`${height}px`})}catch(_){}};
    integratedFrame?.addEventListener('load',resetIntegratedFrame);if(integratedFrame?.contentDocument?.readyState==='complete')resetIntegratedFrame();
  }
  function navigate(route){history.pushState({},'',route+(qaMode?'?qa=1':''));state.ui.sidebarOpen=false;render();}
  function openJourney(id){const j=state.journey.find(x=>x.id===id);openModal(j.label,`${j.label}当前状态：${j.sub}。旅程节点会根据真实培训、资格、任务和记录数据更新。`)}
  function openCourse(id){const c=state.courses.find(x=>x.id===id);openModal(c.title,`已完成 ${c.progress}%。继续学习会从上次进度恢复，并保存到本地后同步服务器。`)}
  function startExam(){if(state.training.examStatus!=='pending')return;openModal('进入志愿者考核','考核开始前将再次确认诚信要求、摄像与网络状态。当前页面不会伪造通过结果。')}
  async function enterService(){if(state.qualification.status!=='qualified'||!state.task.id)return toast('当前资格或任务状态不可用，无法进入服务。','error');if(typeof YuzanApi==='undefined')return toast('服务接口暂不可用，请稍后重试。','error');try{const schoolId=YuzanApi.getActiveSchoolId();const action=state.task.status==='in-progress'?'complete':'start';await YuzanApi.request(`/schools/${schoolId}/volunteers/service-tasks/${state.task.id}/${action}`,{method:'POST'});state.task.status=action==='start'?'in-progress':'completed';render();toast(action==='start'?'服务已开始，请使用平台内沟通和课程资源。':'服务已结束，已提交教师核验。','success')}catch(error){toast(error?.status===403?'你没有操作此任务的权限。':'服务状态同步失败，请检查网络后重试。','error')}}
  function viewCertificate(){openModal('志愿服务资格证书',state.qualification.status==='qualified'?`资格有效至 ${state.qualification.validUntil}，服务范围为 ${state.qualification.scope}。`:'资格当前暂停，请联系项目教师。')}
  function messageTeacher(){openFormModal('给项目教师发消息',`<div class="field"><label>消息内容</label><textarea id="teacher-message-text">您好，我想确认今天阅读陪伴的材料安排。</textarea></div>`,()=>{const v=document.getElementById('teacher-message-text').value.trim();if(!v)return toast('请填写消息。','error');closeModal();toast('消息已通过平台发送。','success')})}
  async function openNotifications(){
    if(typeof YuzanApi==='undefined'||!YuzanApi.getActiveSchoolId?.())return openModal('消息中心','当前未连接到学校账户，登录后可查看真实通知。');
    try{const data=await YuzanApi.request(`/schools/${YuzanApi.getActiveSchoolId()}/notifications?limit=20`);const items=Array.isArray(data)?data:(data?.items||[]);if(!items.length)return openModal('消息中心','暂无新消息。');openModal('消息中心',items.map((item)=>`${item.readAt?'':'【未读】'}${item.title}：${item.body}`).join('\n\n'));}catch(error){openModal('消息中心',error?.status===403?'当前账号没有查看通知的权限。':'通知暂时无法加载，请稍后重试。')}}
  function viewRules(){openModal('未成年人保护守则','仅使用平台内沟通；不交换私人联系方式；不单独线下接触；不保存或传播学生资料；出现异常时立即终止服务并上报。')}
  function reportRisk(){if(!state.permissions.reportRisk)return toast('当前账号没有风险上报权限。','error');openFormModal('风险上报',`<div class="field"><label>风险类型</label><select id="risk-type"><option>疑似不当沟通</option><option>个人信息泄露</option><option>服务过程异常</option><option>其他</option></select></div><div class="field"><label>情况说明</label><textarea id="risk-detail" placeholder="请只描述必要事实，不填写无关个人信息"></textarea></div><div class="field"><label><input id="risk-urgent" type="checkbox"> 紧急情况，需要立即联系项目负责人</label></div>`,async()=>{const detail=document.getElementById('risk-detail').value.trim();if(detail.length<5)return toast('请填写必要的情况说明。','error');if(typeof YuzanApi==='undefined')return toast('风险上报接口暂不可用。','error');try{const schoolId=YuzanApi.getActiveSchoolId();await YuzanApi.request(`/schools/${schoolId}/volunteers/incidents`,{method:'POST',body:JSON.stringify({type:document.getElementById('risk-type').value,severity:document.getElementById('risk-urgent').checked?'HIGH':'MEDIUM',description:detail,immediateAction:document.getElementById('risk-urgent').checked?'立即联系项目负责人':undefined})});closeModal();toast('风险报告已提交，平台将按权限处理。','success')}catch(error){toast(error?.status===403?'当前账号没有风险上报权限。':'风险报告提交失败，请稍后重试。','error')}})}
  function showRoleModal(){openModal('切换身份','可切换到你已获授权的教师、志愿者或学生身份。不同身份使用独立权限和数据范围。')}
  function showStateModal(){openFormModal('工作台状态演示',`<div class="field"><label>页面状态</label><select id="state-choice"><option value="normal">已获资格 · 有任务</option><option value="no-task">已获资格 · 暂无任务</option><option value="training">培训中</option><option value="suspended">资格暂停</option><option value="error">服务错误</option></select></div>`,()=>{const v=document.getElementById('state-choice').value;state.ui.pageState=v==='no-task'?'no-task':v==='error'?'error':'normal';if(v==='training'){state.training.progress=45;state.training.completed=9;state.training.examStatus='locked';state.qualification.status='pending'}else if(v==='suspended'){state.qualification.status='suspended'}else if(v==='normal'||v==='no-task'){state.training.progress=80;state.training.completed=16;state.training.examStatus='pending';state.qualification.status='qualified'}closeModal();render();toast('页面状态已切换。','success')})}
  function openModal(title,body){state.ui.modal={title,body,form:false};renderModal()}
  function openFormModal(title,body,onConfirm){state.ui.modal={title,body,form:true,onConfirm};renderModal()}
  function renderModal(){if(!state.ui.modal){modalRoot.innerHTML='';return}const m=state.ui.modal;modalRoot.innerHTML=`<div class="v-modal-backdrop"><section class="v-modal" role="dialog" aria-modal="true" aria-label="${m.title}"><div class="v-modal-head"><strong>${m.title}</strong><button id="v-modal-close">×</button></div><div class="v-modal-body">${m.form?m.body:`<p style="line-height:1.8;margin:0">${m.body}</p>`}</div><div class="v-modal-actions"><button class="outline-btn" id="v-modal-cancel" style="padding:0 18px">取消</button><button class="primary-btn" id="v-modal-confirm">${m.form?'提交':'知道了'}</button></div></section></div>`;document.getElementById('v-modal-close').onclick=closeModal;document.getElementById('v-modal-cancel').onclick=closeModal;document.getElementById('v-modal-confirm').onclick=m.form?m.onConfirm:closeModal;modalRoot.querySelector('.v-modal-backdrop').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal()})}
  function closeModal(){state.ui.modal=null;renderModal()}
  function toast(msg,type=''){const el=document.createElement('div');el.className=`v-toast ${type}`;el.textContent=msg;toastRoot.append(el);setTimeout(()=>el.remove(),qaMode?650:2600)}
  async function hydrateFromApi(){
    if(typeof YuzanApi==='undefined'||!YuzanApi.getToken?.()||!YuzanApi.getActiveSchoolId?.()) return;
    const schoolId=YuzanApi.getActiveSchoolId();
    state.ui.pageState='loading';render();
    try{
      const profile=await YuzanApi.request(`/schools/${schoolId}/volunteers/me`);
      const [tasks,training,programs]=await Promise.all([
        YuzanApi.request(`/schools/${schoolId}/volunteers/${profile.id}/service-tasks?limit=20`),
        YuzanApi.request(`/schools/${schoolId}/training/enrollments/me?limit=20`).catch(()=>({items:[]})),
        YuzanApi.request(`/schools/${schoolId}/training?status=PUBLISHED&limit=20`).catch(()=>({items:[]})),
      ]);
      const items=Array.isArray(tasks)?tasks:(tasks?.items||[]);
      const task=items[0];
      state.viewer.name=profile.displayName||state.viewer.name;
      state.qualification.status=String(profile.status||'').toLowerCase()==='qualified'?'qualified':'pending';
      state.journey=state.journey.map(step=>step.id==='qualified'?{...step,status:state.qualification.status==='qualified'?'current':'pending',sub:state.qualification.status==='qualified'?'已获资格':'待审核'}:step);
      const enrollments=Array.isArray(training)?training:(training?.items||[]);
      const availablePrograms=Array.isArray(programs)?programs:(programs?.items||[]);
      if(enrollments.length){
        state.training.completed=enrollments.filter((item)=>item.status==='COMPLETED').length;
        state.training.total=Math.max(enrollments.length,state.training.total);
        state.training.progress=Math.round((state.training.completed/state.training.total)*100);
        state.training.examStatus=enrollments.some((item)=>item.examReady)?'pending':'locked';
        state.courses=availablePrograms.slice(0,3).map((item)=>({id:item.id,title:item.title,duration:item.modules?.length?item.modules.length*15:30,progress:0,cover:state.courses[0]?.cover}))||state.courses;
      }
      if(task){
        state.task={...state.task,id:task.id,title:task.title||state.task.title,category:task.serviceType||state.task.category,status:['ASSIGNED','CONFIRMED','IN_PROGRESS'].includes(task.status)?(task.status==='IN_PROGRESS'?'in-progress':'active'):'pending'};
        state.ui.pageState='normal';
      }else state.ui.pageState='no-task';
      render();
    }catch(error){
      // 未登录或接口不可用时保留明确的演示数据，但不要把它显示成已同步的真实结果。
      state.ui.pageState=error?.status===403?'error':'normal';
      render();
      if(error?.status!==401) toast('志愿者数据暂时无法同步，当前展示本地缓存。','error');
    }
  }
  window.addEventListener('popstate',render);document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();if(state.ui.sidebarOpen){state.ui.sidebarOpen=false;render()}}});
  window.YuzanVolunteer={hydrate(next){state=deepMerge(state,next);render()},getState(){return structuredClone(state)},async loadBackendState(url){state.ui.pageState='loading';render();try{const r=await fetch(url);if(!r.ok)throw new Error('HTTP '+r.status);state=deepMerge(state,await r.json());state.ui.pageState='normal';render()}catch(e){state.ui.pageState='error';render();throw e}},sync:hydrateFromApi};
  render();
  if(!qaMode) hydrateFromApi();
})();
