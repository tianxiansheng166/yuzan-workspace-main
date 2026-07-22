(() => {
  const qaMode=new URLSearchParams(location.search).get('qa')==='1';
  document.body.classList.toggle('qa-mode',qaMode);
  const svg=(body,size=22)=>`<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const icons={
    ai:svg('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 16V8l4 8V8M16 8v8"/>'),
    course:svg('<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4M8 9h8M8 13h5"/>'),
    class:svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),
    resource:svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a4 4 0 0 1 8 0v2M3 12h18"/>'),
    chart:svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 16v-4M12 16V8M17 16v-7"/>'),
    student:svg('<circle cx="12" cy="7" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    task:svg('<path d="M6 5h12l2 4v10H4V9zM8 5V3h8v2M8 11h8M8 15h5"/>'),
    test:svg('<circle cx="12" cy="12" r="8"/><path d="m8 12 3 3 5-7"/>'),
    review:svg('<path d="M4 5h16v14H4zM7 15l3-3 2 2 3-4 2 3"/>'),
    public:svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>'),
    bell:svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>'),
    settings:svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9v-.1A1.7 1.7 0 0 0 8 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 3.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2V9h.1A1.7 1.7 0 0 0 3.6 8a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8 3.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2H14v.1A1.7 1.7 0 0 0 15 3.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 8a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.1V14h-.1a1.7 1.7 0 0 0-1.7 1Z"/>'),
    help:svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.7 2.7 0 1 1 3.1 2.7c-.7.2-.7.8-.7 1.5M12 17h.01"/>'),
    shield:svg('<path d="M12 2 20 5v6c0 5-3.4 8.4-8 11-4.6-2.6-8-6-8-11V5Z"/><path d="m9 12 2 2 4-5"/>'),
    spark:svg('<path d="m12 3 1.1 3.9L17 8l-3.9 1.1L12 13l-1.1-3.9L7 8l3.9-1.1Z"/><path d="m18 14 .7 2.3L21 17l-2.3.7L18 20l-.7-2.3L15 17l2.3-.7ZM5 14l.6 1.8L7.5 16l-1.9.6L5 18.5l-.6-1.9L2.5 16l1.9-.2Z"/>'),
    mind:svg('<path d="M4 14c-2-3 0-6 3-6 0-3 4-5 6-2 3-1 6 2 5 5 3 2 1 7-2 7H7c-2 0-4-2-3-4Z"/><path d="M9 11h6M9 14h4"/>',46),
    graph:svg('<circle cx="5" cy="17" r="2.5"/><circle cx="12" cy="6" r="2.5"/><circle cx="19" cy="17" r="2.5"/><path d="m7 15 3.5-6M13.5 8l4 7M7.5 17h9"/>',46),
    translate:svg('<path d="M4 5h8M8 3v2M6 5c.7 4 2.8 6.5 6 8M11 7c-1 3-3 5-6 7M14 19l3-8 3 8M15 16h4"/>',46),
    sheet:svg('<path d="M6 2h9l4 4v16H6Z"/><path d="M14 2v5h5M9 12h7M9 16h5"/>',46),
    book:svg('<path d="M3 5a4 4 0 0 1 4-3h5v18H7a4 4 0 0 0-4 2ZM21 5a4 4 0 0 0-4-3h-5v18h5a4 4 0 0 1 4 2Z"/>',46),
    info:svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',18),
    copy:svg('<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',17)
  };
  const defaultState={
    viewer:{name:'李老师',school:'拉萨市第一小学',avatar:'/assets/tools-teacher-avatar.jpg'},
    permissions:{useTools:true,configureExternal:false,viewCrossSchool:false},
    goal:'',courseId:'',mode:'recommended',currentStage:1,
    invite:{code:'TCH-7Q1A-B9K2',enabled:true},
    stages:[
      {id:'understand',number:1,title:'理解教材',desc:'梳理课文结构与核心内容',color:'#ce322b',tool:'MindMate',subtitle:'智能备课助手',action:'进入 MindMate',status:'available'},
      {id:'plan',number:2,title:'构建思路',desc:'拆解目标，设计教学思路',color:'#df941e',tool:null,subtitle:'尚未创建思路',action:'选择或新建思路',status:'empty'},
      {id:'graph',number:3,title:'生成图示',desc:'生成思维导图与课堂图示',color:'#4b8058',tool:'MindGraph',subtitle:'图示与学习单',action:'创建思维导图',status:'available'},
      {id:'translate',number:4,title:'翻译术语',desc:'藏汉互译，理解关键术语',color:'#df941e',tool:'藏汉翻译',subtitle:'术语翻译工具',action:'打开翻译工具',status:'available'},
      {id:'sheet',number:5,title:'形成学习单',desc:'生成练习与学习单',color:'#4b8058',tool:'学习单工具',subtitle:'练习与活动设计',action:'生成学习单',status:'available'}
    ],
    recent:[
      {title:'高原上的春天',detail:'朗读与表达 · 三年级下册',tool:'MindMate',time:'今天 10:32',kind:'edit'},
      {title:'第3章 朗读与表达思路',detail:'教学思路草稿',tool:'MindGraph',time:'昨天 16:45',kind:'graph'},
      {title:'春天相关术语翻译',detail:'藏汉对照表',tool:'藏汉翻译',time:'昨天 11:20',kind:'translate'},
      {title:'春天主题学习单',detail:'课堂活动设计',tool:'学习单工具',time:'05-12',kind:'sheet'}
    ],
    drafts:[
      {title:'未命名思路草稿',tool:'MindGraph',date:'05-13'},
      {title:'三年级下册备课计划',tool:'MindMate',date:'05-11'},
      {title:'词语积累学习单',tool:'学习单工具',date:'05-10'}
    ],
    services:[
      {id:'mindmate',name:'MindMate 服务',status:'connected'},
      {id:'mindgraph',name:'MindGraph 服务',status:'connected'},
      {id:'translation',name:'藏汉翻译服务',status:'connected'},
      {id:'resources',name:'资源库服务',status:'needs-config'},
      {id:'ai',name:'AI 能力服务',status:'unavailable'}
    ],
    resources:[
      {id:'textbook',title:'课文资源',sub:'课文朗读、文本解析',color:'#ef7264'},
      {id:'courseware',title:'教学课件',sub:'PPT、教案模板',color:'#e8952a'},
      {id:'activity',title:'活动素材',sub:'课堂活动与游戏',color:'#5684db'},
      {id:'media',title:'图片视频',sub:'多媒体素材库',color:'#567fda'},
      {id:'questions',title:'试题库',sub:'分层练习与试题',color:'#8057bc'},
      {id:'all',title:'进入资源库',sub:'更多优质资源',color:'#293846'}
    ],
    ui:{sidebarOpen:false,modal:null,pageState:'normal',tipVisible:true}
  };
  function deepMerge(target,source){if(!source||typeof source!=='object')return target;for(const[k,v]of Object.entries(source)){if(v&&typeof v==='object'&&!Array.isArray(v))target[k]=deepMerge({...target[k]},v);else target[k]=v}return target}
  let state=deepMerge(structuredClone(defaultState),window.__YUZAN_TOOLS_BOOTSTRAP__||{});
  const app=document.getElementById('tools-app'),modalRoot=document.getElementById('tools-modal-root'),toastRoot=document.getElementById('tools-toast-root');
  const embeddedShell=document.body.dataset.useTeacherShell==='true';
  const nav=[
    {label:'工具中心',route:'/teacher-tools',icon:'ai',id:'ai-tools'},
    {label:'课程工作台',route:'/teacher',icon:'course',id:'course'},
    {label:'班级管理',route:'/teacher/classes',icon:'class',id:'classes'},
    {label:'教学任务',route:'/teacher/assignments',icon:'task',id:'task'},
    {label:'智能测评',route:'/teacher/assessments',icon:'test',id:'assessment'},
    {label:'提交复核',route:'/teacher/reviews/submission-1',icon:'review',id:'review'},
    {label:'学生成长',route:'/teacher/students/demo',icon:'student',id:'student'},
    {label:'翻译台',route:'/teacher/translation',icon:'translate',id:'translation'},
    {label:'消息中心',route:'/teacher/messages',icon:'bell',id:'messages',badge:'3'},
    {label:'设置中心',route:'/teacher/settings',icon:'settings',id:'settings'}
  ];
  const stageIcons={understand:icons.book,plan:svg('<path d="M9 18h6M10 22h4M8 14c-2-1-3-3-3-5a7 7 0 1 1 14 0c0 2-1 4-3 5-1 1-1 2-1 3H9c0-1 0-2-1-3Z"/>',46),graph:icons.graph,translate:icons.translate,sheet:icons.sheet};
  function render(){const shellClass=embeddedShell?'tools-shell ts-embedded':'tools-shell';const side=embeddedShell?'':sidebar();app.innerHTML=`<div class="${shellClass}">${side}<main class="tools-main">${header()}${security()}<section class="tools-content">${content()}</section></main></div>`;bind();renderModal()}
  function sidebar(){
    const current = location.pathname.replace(/\/$/, '') || '/';
    return `<aside class="tools-sidebar ${state.ui.sidebarOpen?'open':''}"><button class="tools-collapse" id="collapse-sidebar" aria-label="收起导航">‹‹</button><nav class="tools-nav">${nav.map(n=>{
      const active = n.route === current || (n.route !== '/' && current.startsWith(n.route)) ? 'active' : '';
      const badge = n.badge ? `<span class="badge">${n.badge}</span>` : '';
      return `<a href="${n.route}" data-route="${n.route}" class="${active}"><span class="icon">${icons[n.icon]}</span><span>${n.label}</span>${badge}</a>`;
    }).join('')}</nav><section class="invite-card"><div class="side-card-head">教师邀请码 <span>${icons.info}</span></div><p>邀请同事加入，共建优质课堂</p><div class="invite-code">${state.invite.code} <button id="copy-code" aria-label="复制邀请码">${icons.copy}</button></div><button class="copy-btn" id="copy-invite">复制邀请码</button></section><section class="guide-card"><div class="side-card-head">新手引导 <span>${icons.info}</span></div><p>3 分钟了解工具中心</p><div class="guide-progress"><i></i></div><span class="guide-count">2/4</span><button class="continue-btn" id="continue-guide">继续引导</button></section></aside>`}
  function header(){return embeddedShell?`<header class="tools-header ts-embedded-header"><h1>教师 AI 工具中心</h1><p>智能备课 · 精准教学 · 共育成长</p></header>`:`<header class="tools-header"><h1>教师 AI 工具中心</h1><p>智能备课 · 精准教学 · 共育成长</p><div class="header-actions"><button class="help-link" id="help-center">${icons.help}帮助中心</button><button class="header-bell" id="tools-notifications">${icons.bell}<span class="badge">3</span></button><button class="header-user" id="tools-profile"><img src="${state.viewer.avatar}" alt="教师头像"><span><strong>${state.viewer.name}</strong><small>${state.viewer.school}</small></span>${svg('<path d="m6 9 6 6 6-6"/>',16)}</button></div></header>`}
  function security(){return `<section class="security-banner">${icons.shield}<span><strong>数据安全与隐私保护：</strong>本平台遵循最小必要原则，AI 处理内容仅用于教学辅助，结果需教师人工确认后使用。</span><button id="security-more">了解更多 ›</button></section>`}
  function content(){if(state.ui.pageState==='loading')return `<div class="state-screen"><div><h2>正在加载工具与外部服务状态</h2><p>本地草稿不会丢失。</p></div></div>`;if(state.ui.pageState==='error')return `<div class="state-screen"><div><h2>工具中心暂时不可用</h2><p>可继续访问本地草稿与已下载资源。</p><button class="btn-primary" id="tools-retry">重新加载</button></div></div>`;return `${goalPanel()}${workflow()}${resources()}${rightColumn()}${state.ui.tipVisible?tipBar():''}`}
  function goalPanel(){return `<section class="goal-panel"><div><div class="field-label">本次备课目标 <small>（可选）</small></div><div class="goal-field"><textarea id="goal-input" maxlength="100" placeholder="例如：理解《高原上的春天》朗读与表达目标">${state.goal}</textarea><span class="count" id="goal-count">${state.goal.length}/100</span></div></div><div><div class="field-label">关联课程 <small>（可选）</small></div><button class="course-select" id="course-select"><span>${state.courseId?state.courseId:'选择课程或单元'}</span>${svg('<path d="m6 9 6 6 6-6"/>',17)}</button></div><button class="generate-btn" id="generate-path">${icons.spark}生成备课路径</button></section>`}
  function workflow(){return `<section class="workflow-panel"><div class="workflow-head"><div><h2>备课工作流地图</h2><p>根据目标智能推荐备课步骤与工具，点击节点进入相应工具</p></div><div class="workflow-mode"><button id="workflow-help">${icons.help} 路径说明</button><button class="${state.mode==='recommended'?'active':''}" data-mode="recommended">推荐路径</button><button class="${state.mode==='custom'?'active':''}" data-mode="custom">自定义路径</button></div></div><div class="workflow-path">${pathSvg()}${state.stages.map(stageCard).join('')}</div><div class="workflow-legend"><span>状态说明：</span><span><i class="legend-dot" style="background:#4b8058"></i>已完成</span><span><i class="legend-dot" style="background:#df941e"></i>当前推荐</span><span><i class="legend-dot" style="border:1px solid #bfc2bf;background:#fff"></i>可进行</span><span><i class="legend-dot" style="background:#b6b7b4"></i>未解锁</span><span><i class="legend-dot" style="border:1px solid #df941e;background:#fff"></i>受限</span><span class="manual-warning">${icons.info} AI 结果需人工确认后使用</span></div></section>`}
  function pathSvg(){return `<svg class="workflow-line" viewBox="0 0 1000 80" preserveAspectRatio="none" aria-hidden="true"><path d="M0 42 C60 5 125 5 200 42 S340 5 400 42 S540 5 600 42 S740 5 800 42 S940 5 1000 42" fill="none" stroke="#d79a42" stroke-width="3"/><path d="M0 42 C60 5 125 5 200 42" fill="none" stroke="#ce382e" stroke-width="4"/><path d="M400 42 C470 6 535 6 600 42" fill="none" stroke="#4f805a" stroke-width="4"/><path d="M800 42 C875 8 940 8 1000 42" fill="none" stroke="#4f805a" stroke-width="4"/></svg>`}
  function stageCard(s){const empty=s.status==='empty';return `<article class="tool-stage" style="--stage:${s.color}"><button class="stage-number" data-stage="${s.id}">${s.number}</button><div class="stage-icon">${stageIcons[s.id]}</div><h3>${s.title}</h3><p>${s.desc}</p>${empty?`<button class="stage-empty" data-tool="${s.id}">${svg('<path d="M12 5v14M5 12h14"/>',22)}<span>${s.action}</span></button><div style="height:31px;margin-top:8px;color:#888;font-size:11px">${s.subtitle}<br>建议优先完成步骤 1</div>`:`<div class="tool-card"><div class="tool-card-head"><span class="tool-mark">${stageIcons[s.id].replace(/width="46" height="46"/, 'width="22" height="22"')}</span><span><strong>${s.tool}</strong><small>${s.subtitle}</small></span></div><button class="tool-action" data-tool="${s.id}" ${s.status==='unavailable'?'disabled':''}>${s.action}</button></div><button class="stage-secondary" data-secondary="${s.id}">${s.id==='understand'?'查看教材解析':s.id==='graph'?'从思路生成图示':s.id==='translate'?'术语对照表':'预览与编辑'}</button>`}</article>`}
  function resources(){return `<section class="resources-panel"><div class="resources-head"><h2>教学资源库</h2><span>精选资源，为备课提供丰富素材</span></div><div class="resource-grid">${state.resources.map(r=>`<button class="resource-item" data-resource="${r.id}"><span class="resource-icon" style="background:${r.color}18;color:${r.color}">${r.id==='all'?icons.public:icons.resource}</span><span><strong>${r.title}</strong><small>${r.sub}</small></span></button>`).join('')}</div></section>`}
  function rightColumn(){return `<aside class="right-column"><section class="side-panel"><div class="side-head">最近使用<button data-list="recent">全部 ›</button></div>${state.recent.map((x,i)=>`<button class="recent-row" data-recent="${i}"><span class="list-icon" style="background:${i===0?'#fdebea':i===1?'#eaf4ea':i===2?'#fff2dd':'#eaf0ff'};color:${i===0?'#d74238':i===1?'#568361':i===2?'#d7861d':'#527bd4'}">${i===0?icons.ai:i===1?icons.graph:i===2?icons.translate:icons.sheet}</span><span class="recent-copy"><strong>${x.title}</strong><small>${x.detail}<span class="tag">${x.tool}</span></small></span><span class="time">${x.time}</span></button>`).join('')}</section><section class="side-panel"><div class="side-head">我的草稿<button data-list="drafts">全部 ›</button></div>${state.drafts.map((x,i)=>`<button class="draft-row" data-draft="${i}"><span class="list-icon" style="background:${i===2?'#eaf0ff':'#fdebea'};color:${i===2?'#527bd4':'#d74238'}">${i===2?icons.sheet:icons.ai}</span><span class="draft-copy"><strong>${x.title}</strong><small><span class="tag">${x.tool}</span>　草稿 · ${x.date}</small></span>${svg('<path d="m9 18 6-6-6-6"/>',14)}</button>`).join('')}</section><section class="side-panel"><div class="side-head">外部服务状态<button id="manage-services">管理 ›</button></div>${state.services.map(s=>`<div class="service-row"><span style="color:${s.status==='connected'?'#43805a':s.status==='needs-config'?'#da8b1d':'#777'}">${s.id==='mindgraph'?icons.graph:s.id==='translation'?icons.translate:s.id==='resources'?icons.resource:icons.ai}</span><span class="service-name">${s.name}</span><button class="${s.status==='connected'?'status-ok':s.status==='needs-config'?'status-warn':'status-off'}" data-service="${s.id}">${s.status==='connected'?'✓ 已连接':s.status==='needs-config'?'需配置　去配置':'不可用　查看说明'}</button></div>`).join('')}<div class="service-note">部分服务由第三方提供，使用前需完成授权配置。</div></section></aside>`}
  function tipBar(){return `<section class="tip-bar">${icons.info}<span>提示：根据“高原上的春天”目标，建议按上方路径依次完成备课。如需调整路径或工具，可切换至“自定义路径”模式。</span><button id="dismiss-tip">不再提示　›</button></section>`}
  function bind(){
    document.querySelectorAll('[data-route]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();navigate(el.dataset.route)}));
    document.querySelector('#collapse-sidebar')?.addEventListener('click',()=>{state.ui.sidebarOpen=!state.ui.sidebarOpen;document.querySelector('.tools-sidebar')?.classList.toggle('open',state.ui.sidebarOpen)});
    document.querySelector('.tools-header')?.addEventListener('click',e=>{if(innerWidth<=900&&e.clientX<52){state.ui.sidebarOpen=!state.ui.sidebarOpen;render()}});
    const goal=document.querySelector('#goal-input');goal?.addEventListener('input',()=>{state.goal=goal.value;document.querySelector('#goal-count').textContent=`${state.goal.length}/100`});
    document.querySelector('#course-select')?.addEventListener('click',selectCourse);
    document.querySelector('#generate-path')?.addEventListener('click',generatePath);
    document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{state.mode=b.dataset.mode;render();toast(state.mode==='custom'?'已进入自定义路径。':'已恢复智能推荐路径。','success')}));
    document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>openTool(b.dataset.tool)));
    document.querySelectorAll('[data-stage]').forEach(b=>b.addEventListener('click',()=>{state.currentStage=Number(state.stages.find(x=>x.id===b.dataset.stage)?.number||1);openStage(b.dataset.stage)}));
    document.querySelectorAll('[data-secondary]').forEach(b=>b.addEventListener('click',()=>openStage(b.dataset.secondary)));
    document.querySelectorAll('[data-resource]').forEach(b=>b.addEventListener('click',()=>openResource(b.dataset.resource)));
    document.querySelectorAll('[data-recent]').forEach(b=>b.addEventListener('click',()=>openRecent(Number(b.dataset.recent))));
    document.querySelectorAll('[data-draft]').forEach(b=>b.addEventListener('click',()=>openDraft(Number(b.dataset.draft))));
    document.querySelectorAll('[data-service]').forEach(b=>b.addEventListener('click',()=>serviceAction(b.dataset.service)));
    document.querySelector('#copy-code')?.addEventListener('click',copyInvite);document.querySelector('#copy-invite')?.addEventListener('click',copyInvite);
    document.querySelector('#continue-guide')?.addEventListener('click',()=>openModal('新手引导','下一步：填写备课目标并关联课程，平台会根据目标推荐工具顺序。'));
    document.querySelector('#workflow-help')?.addEventListener('click',()=>openModal('备课路径说明','推荐路径只提供工作流建议。AI 生成内容必须由教师核对，教师可以切换自定义路径。'));
    document.querySelector('#security-more')?.addEventListener('click',()=>openModal('数据安全与隐私','平台采用最小必要数据原则。外部工具打开前会说明发送的数据范围，并要求教师确认。'));
    document.querySelector('#manage-services')?.addEventListener('click',manageServices);document.querySelector('#help-center')?.addEventListener('click',()=>openModal('帮助中心','可查看工具配置、数据范围、教学使用建议和常见问题。'));
    document.querySelector('#tools-notifications')?.addEventListener('click',()=>openModal('消息中心','3 条新消息：服务配置提醒、草稿同步和资源更新。'));
    document.querySelector('#tools-profile')?.addEventListener('click',stateDemo);document.querySelector('#dismiss-tip')?.addEventListener('click',()=>{state.ui.tipVisible=false;render()});
    document.querySelector('#tools-retry')?.addEventListener('click',()=>{state.ui.pageState='loading';render();try{location.reload()}catch(_){state.ui.pageState='error';render();toast('刷新失败，请手动按 F5 重载页面。','error')}});
  }
  function navigate(route){
    if(route==='/teacher-tools'){history.pushState({},'',route+(qaMode?'?qa=1':''));render();return}
    // 教师系统其他页面为独立 HTML，直接跳转
    if(route.startsWith('/teacher')){location.href=route+(qaMode?'?qa=1':'');return}
    toast('该功能页已进入后续逐页队列，当前检查点只放行教师 AI 工具中心。')}
  function selectCourse(){openForm('关联课程',`<div class="modal-field"><label>课程或单元</label><select id="course-choice"><option>高原上的春天 · 三年级下册</option><option>家乡的变化 · 五年级</option><option>朗读与表达 · 单元三</option></select></div>`,()=>{state.courseId=document.querySelector('#course-choice').value;closeModal();render();toast('已关联课程。','success')})}
  function generatePath(){if(!state.permissions.useTools)return toast('当前账号没有工具使用权限。','error');if(!state.goal.trim())return toast('请先填写本次备课目标。','error');state.currentStage=1;state.stages=state.stages.map((s,i)=>({...s,status:i===0?'available':s.status}));render();toast('已按目标生成推荐备课路径。','success')}
  function openTool(id){const s=state.stages.find(x=>x.id===id);if(!s)return;if(!state.permissions.useTools)return toast('当前账号没有使用该工具的权限。','error');if(s.status==='unavailable')return toast('该服务当前不可用。','error');if(id==='plan')return openForm('新建教学思路',`<div class="modal-field"><label>思路名称</label><input id="plan-name" value="高原上的春天教学思路"></div><div class="modal-field"><label>教学重点</label><textarea id="plan-detail">梳理朗读节奏、重点词语与表达目标。</textarea></div>`,()=>{s.status='available';s.tool='教学思路';s.subtitle='已保存草稿';s.action='继续编辑';closeModal();render();toast('教学思路已保存为草稿。','success')});
    const external=['graph','translate'].includes(id);const range=external?'课程标题、所选片段与教师输入':'当前课程目标与教师输入';const destinations={understand:'/teacher/ai-tools/?tool=mindmate',graph:'/teacher/ai-tools/?tool=mindgraph',translate:'/teacher/translation',sheet:'/teacher/ai-tools/?tool=worksheet'};openConfirm(`打开 ${s.tool}`,external?`该工具由外部服务提供。将发送：${range}。不会发送学生姓名、成绩或私人信息。是否继续？`:`将使用${range}生成辅助内容，结果必须由教师人工确认。`,()=>{closeModal();location.href=destinations[id]||'/teacher/ai-tools/?tool=mindgraph'})}
  function openStage(id){const s=state.stages.find(x=>x.id===id);openModal(s.title,`${s.desc}。当前状态：${s.status==='empty'?'尚未创建':s.status==='unavailable'?'服务不可用':'可以开始'}。`) }
  function openResource(id){const r=state.resources.find(x=>x.id===id);openModal(r.title,`${r.sub}。资源列表和权限将由真实接口返回，不使用参考图中的假数据。`)}
  function openRecent(i){const x=state.recent[i];openModal(x.title,`最近使用：${x.tool}，${x.time}。打开后从后端保存的工作状态继续。`)}
  function openDraft(i){const x=state.drafts[i];openModal(x.title,`草稿工具：${x.tool}，保存日期 ${x.date}。草稿内容由当前教师账号和学校租户隔离。`)}
  function serviceAction(id){const s=state.services.find(x=>x.id===id);if(s.status==='connected')return openModal(s.name,'服务已连接。打开工具前仍会显示数据范围和离开平台提示。');if(!state.permissions.configureExternal)return toast('当前账号没有外部服务配置权限，请联系学校管理员。','error');openModal(`配置 ${s.name}`,'配置页面将验证服务地址、授权范围和租户隔离，不在前端保存密钥。')}
  async function copyInvite(){if(!state.invite.enabled)return toast('当前邀请码不可用。','error');try{await navigator.clipboard.writeText(state.invite.code)}catch{}toast('邀请码已复制。','success')}
  function manageServices(){if(!state.permissions.configureExternal)return toast('只有学校管理员可管理外部服务配置。','error');openModal('外部服务管理','可配置服务地址、授权范围和可用学校。敏感密钥只保存在服务端。')}
  function stateDemo(){openForm('工具中心状态演示',`<div class="modal-field"><label>页面状态</label><select id="tools-state"><option value="normal">正常工作状态</option><option value="first">首次使用</option><option value="unconfigured">外部服务未配置</option><option value="permission">权限不足</option><option value="error">服务不可用</option></select></div>`,()=>{const v=document.querySelector('#tools-state').value;state.ui.pageState=v==='error'?'error':'normal';if(v==='first'){state.goal='';state.courseId='';state.recent=[];state.drafts=[]}else if(v==='unconfigured'){state.services=state.services.map(x=>({...x,status:'needs-config'}))}else if(v==='permission'){state.permissions.useTools=false;state.permissions.configureExternal=false}else{state.permissions.useTools=true}closeModal();render();toast('页面状态已切换。','success')})}
  function openModal(title,body){state.ui.modal={title,body,type:'info'};renderModal()}
  function openConfirm(title,body,onConfirm){state.ui.modal={title,body,type:'confirm',onConfirm};renderModal()}
  function openForm(title,html,onConfirm){state.ui.modal={title,body:html,type:'form',onConfirm};renderModal()}
  function renderModal(){const m=state.ui.modal;if(!m){modalRoot.innerHTML='';return}modalRoot.innerHTML=`<div class="tools-modal-backdrop"><section class="tools-modal" role="dialog" aria-modal="true" aria-label="${m.title}"><div class="tools-modal-head"><strong>${m.title}</strong><button id="tools-modal-close" aria-label="关闭">×</button></div><div class="tools-modal-body">${m.type==='form'?m.body:`<p style="margin:0;line-height:1.8">${m.body}</p>`}</div><div class="tools-modal-actions"><button class="btn-secondary" id="tools-modal-cancel">取消</button><button class="btn-primary" id="tools-modal-confirm">${m.type==='info'?'知道了':m.type==='form'?'保存':'确认继续'}</button></div></section></div>`;document.querySelector('#tools-modal-close').onclick=closeModal;document.querySelector('#tools-modal-cancel').onclick=closeModal;document.querySelector('#tools-modal-confirm').onclick=m.type==='info'?closeModal:m.onConfirm;document.querySelector('.tools-modal-backdrop').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal()})}
  function closeModal(){state.ui.modal=null;renderModal()}
  function toast(text,type=''){const el=document.createElement('div');el.className=`tools-toast ${type}`;el.textContent=text;toastRoot.append(el);setTimeout(()=>el.remove(),qaMode?700:2600)}
  window.addEventListener('popstate',render);document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();if(state.ui.sidebarOpen){state.ui.sidebarOpen=false;render()}}});
  window.YuzanTools={hydrate(next){state=deepMerge(state,next);render()},getState(){return structuredClone(state)},async loadBackendState(url){state.ui.pageState='loading';render();try{const r=await fetch(url);if(!r.ok)throw new Error('HTTP '+r.status);state=deepMerge(state,await r.json());state.ui.pageState='normal';render()}catch(e){state.ui.pageState='error';render();throw e}}};
  render();
})();
