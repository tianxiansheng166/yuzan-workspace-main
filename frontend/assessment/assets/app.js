(() => {
  'use strict';

  // ── API 集成层 ──
  const Api = (typeof YuzanApi !== 'undefined') ? YuzanApi : null;
  const apiEnabled = !!(Api && Api.getToken && Api.getToken());

  // ── 从 location.pathname 解析 sessionId / itemId / 页面类型 ──
  // 路由约定（由 server.mjs 提供 shell）：
  //   /assessment                                    → center
  //   /assessment/history                            → history
  //   /assessment/recordings                         → recordings
  //   /assessment/sessions/:sessionId                → prep
  //   /assessment/sessions/:sessionId/reading/:itemId → reading
  //   /assessment/sessions/:sessionId/written/:itemId → written
  //   /assessment/sessions/:sessionId/submit         → submit
  //   /assessment/sessions/:sessionId/processing     → processing
  //   /assessment/sessions/:sessionId/report         → report
  const pathParts = location.pathname.replace(/^\/+|\/+$/g, '').split('/').map(decodeURIComponent);
  let SESSION_ID = '';
  let READING_ITEM_ID = '';
  let WRITTEN_ITEM_ID = '';
  const isPracticeRoute = pathParts[0] === 'student' && pathParts[1] === 'practices';
  const isPracticeAttempt = isPracticeRoute && pathParts[2] === 'attempts';
  if (pathParts[0] === 'assessment' && pathParts[1] === 'sessions' && pathParts[2]) {
    SESSION_ID = pathParts[2];
    if (pathParts[3] === 'reading' && pathParts[4]) READING_ITEM_ID = pathParts[4];
    if (pathParts[3] === 'written' && pathParts[4]) WRITTEN_ITEM_ID = pathParts[4];
  }
  if (isPracticeAttempt && pathParts[3]) {
    SESSION_ID = pathParts[3];
    if (pathParts[4] === 'reading' && pathParts[5]) READING_ITEM_ID = pathParts[5];
    if (pathParts[4] === 'written' && pathParts[5]) WRITTEN_ITEM_ID = pathParts[5];
  }

  const isListeningItem = (item) => item?.itemType === 'LISTEN_ONLY';
  const isOralItem = (item) => ['READING','SPEECH','LISTEN_REPEAT','READ_ALOUD'].includes(item?.itemType);
  const isWrittenItem = (item) => ['WRITTEN','CHOICE','FILL_BLANK','SINGLE_CHOICE','MULTIPLE_CHOICE','SHORT_ANSWER','LISTEN_RETELL'].includes(item?.itemType);

  // ── 演示模式：仅显式 ?demo=1 时启用，并始终显示"演示模式"标识 ──
  const query = new URLSearchParams(location.search);
  const demoMode = query.get('demo') === '1';

  // 兼容旧 query 参数（仅用于历史跳转，不作正式模式默认）
  const urlEnrollmentId = query.get('enrollmentId') || '';

  const base = '/assessment';
  const attemptBase = isPracticeAttempt && SESSION_ID ? `/student/practices/attempts/${SESSION_ID}` : `${base}/sessions/${SESSION_ID}`;
  const routes = {
    center: isPracticeRoute ? '/student/practices/' : `${base}/`,
    prep: SESSION_ID ? (isPracticeAttempt ? `${attemptBase}/prepare/` : `${attemptBase}/`) : `${base}/`,
    reading: SESSION_ID && READING_ITEM_ID ? `${attemptBase}/reading/${READING_ITEM_ID}/` : `${base}/`,
    written: SESSION_ID && WRITTEN_ITEM_ID ? `${attemptBase}/written/${WRITTEN_ITEM_ID}/` : (SESSION_ID ? (isPracticeAttempt ? `${attemptBase}/prepare/` : `${attemptBase}/`) : `${base}/`),
    submit: SESSION_ID ? `${attemptBase}/submit/` : `${base}/`,
    processing: SESSION_ID ? `${attemptBase}/processing/` : `${base}/`,
    report: SESSION_ID ? `${attemptBase}/report/` : `${base}/`,
    recordings: isPracticeRoute ? '/student/practices/recordings/' : `${base}/recordings/`,
    history: isPracticeRoute ? '/student/practices/history/' : `${base}/history/`
  };

  // ── 本地草稿存储（仅用于断网草稿，不用于伪造成功） ──
  const stateKey = `yuzan-assessment-v5-${SESSION_ID || 'nosession'}`;
  const memoryStorage = {};
  const storage = {
    getItem(key){ try { return localStorage.getItem(key); } catch { return memoryStorage[key] ?? null; } },
    setItem(key,value){ try { localStorage.setItem(key,value); } catch { memoryStorage[key]=String(value); } },
    removeItem(key){ try { localStorage.removeItem(key); } catch { delete memoryStorage[key]; } }
  };
  if (query.get('reset') === '1') storage.removeItem(stateKey);
  const defaultState = {
    sessionId: SESSION_ID,
    currentReadingState: 'PLAYING_PROMPT',
    readingElapsed: 0,
    promptPlayCount: 0,
    uploadProgress: 0,
    writtenIndex: 0,
    writtenAnswers: {}, // 本地草稿：{ [itemId]: number }
    submitted: false,
    // ── 真实 API 数据缓存 ──
    apiSession: null,
    apiItems: [],
    apiReadingItem: null,
    apiWrittenItems: [],
    apiReport: null,
    apiSpeechJob: null,
    apiSpeechJobs: [],
    apiRecordings: [],
    apiRecordingId: null,
    apiSpeechJobId: null,
    // ── 真实录音 Blob（仅本机临时） ──
    _recordingBlob: null,
    _recordingUrl: null,
    // ── 错误状态 ──
    lastError: null,
    // ── 同步状态标识 ──
    writtenSyncStatus: {}, // { [itemId]: 'LOCAL' | 'SYNCED' | 'FINALIZED' | 'FAILED' }
    completedListenItems: {}
  };
  const loadState = () => {
    try { return { ...defaultState, ...JSON.parse(storage.getItem(stateKey) || '{}') }; }
    catch { return { ...defaultState }; }
  };
  let appState = loadState();
  // Blob/URL 不可序列化，每次从内存恢复时清空
  appState._recordingBlob = null;
  appState._recordingUrl = null;
  const saveState = () => {
    // 不持久化 Blob
    const { _recordingBlob, _recordingUrl, ...persistable } = appState;
    storage.setItem(stateKey, JSON.stringify(persistable));
  };

  function orderedItems() {
    return [...(appState.apiItems || [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }
  function executionRoute(item) {
    if (isWrittenItem(item)) return `${attemptBase}/written/${item.id}/`;
    return `${attemptBase}/reading/${item.id}/`;
  }
  function nextExecutionRoute(currentItemId) {
    const items = orderedItems();
    const currentIndex = items.findIndex((item) => item.id === currentItemId);
    const nextItem = currentIndex >= 0 ? items[currentIndex + 1] : null;
    return nextItem ? executionRoute(nextItem) : routes.submit;
  }
  function firstPendingRoute(items) {
    const next = [...items].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).find((item) => {
      if (isListeningItem(item)) return !appState.completedListenItems[item.id];
      if (isOralItem(item)) return !item.recordingId;
      return appState.writtenSyncStatus[item.id] !== 'FINALIZED';
    });
    return next ? executionRoute(next) : routes.submit;
  }
  function hydrateWrittenAnswers(items) {
    for (const writtenItem of items || []) {
      const answer = writtenItem.answer;
      if (!answer) continue;
      const content = answer.content || {};
      appState.writtenAnswers[writtenItem.id] = typeof content.optionIndex === 'number' ? content.optionIndex : (content.text ?? '');
      appState.writtenSyncStatus[writtenItem.id] = answer.finalSubmittedAt ? 'FINALIZED' : 'SYNCED';
    }
  }

  // ── 图标库 ──
  const iconPaths = {
    home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M9 20v-6h6v6"/>',
    layers:'<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/>',
    assessment:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/><path d="M7 5v-2h10v2"/>',
    book:'<path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22V5.5Z"/><path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22V5.5Z"/>',
    teacher:'<circle cx="12" cy="7" r="4"/><path d="M4 22c.7-5 3.4-8 8-8s7.3 3 8 8"/><path d="M2 12h4M18 12h4"/>',
    file:'<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 13h6M9 17h6"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    mic:'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/>',
    wave:'<path d="M3 12h2M7 8v8M11 4v16M15 7v10M19 10v4M22 12h-1"/>',
    chart:'<path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/><path d="M2 21h22"/>',
    star:'<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.4l6.1-.9L12 3Z"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
    users:'<circle cx="9" cy="8" r="4"/><path d="M2 21c.8-5 3-8 7-8s6.2 3 7 8"/><path d="M16 4a4 4 0 0 1 0 8M17 13c3 .4 4.5 3.2 5 8"/>',
    upload:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 15v5h16v-5"/>',
    cloud:'<path d="M7 18H5a4 4 0 0 1 0-8 7 7 0 0 1 13.5-2A5 5 0 0 1 19 18h-2"/><path d="M12 12v8M9 15l3-3 3 3"/>',
    play:'<path d="m9 6 9 6-9 6V6Z"/>',
    pause:'<path d="M8 5v14M16 5v14"/>',
    stop:'<rect x="6" y="6" width="12" height="12" rx="1"/>',
    refresh:'<path d="M20 6v6h-6"/><path d="M4 18v-6h6"/><path d="M18 9a7 7 0 0 0-12-3l-2 3M6 15a7 7 0 0 0 12 3l2-3"/>',
    eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    arrow:'<path d="M5 12h14M14 7l5 5-5 5"/>',
    left:'<path d="M19 12H5M10 7l-5 5 5 5"/>',
    wifi:'<path d="M3 9a14 14 0 0 1 18 0M6 13a9 9 0 0 1 12 0M9 17a4 4 0 0 1 6 0"/><circle cx="12" cy="20" r="1"/>',
    speaker:'<path d="M5 10H2v4h3l5 4V6L5 10Z"/><path d="M14 9a5 5 0 0 1 0 6M17 6a9 9 0 0 1 0 12"/>',
    browser:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18M7 6h.01M10 6h.01"/>',
    shield:'<path d="M12 3 20 6v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
    alert:'<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5M12 18h.01"/>',
    headphones:'<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h3v6H4zM17 14h3v6h-3z"/>',
    save:'<path d="M5 3h12l2 2v16H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
    trend:'<path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
    filter:'<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    copy:'<rect x="8" y="8" width="11" height="12" rx="2"/><path d="M5 16H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"/>',
    download:'<path d="M12 3v13M7 11l5 5 5-5"/><path d="M4 21h16"/>',
    logout:'<path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h7v18h-7"/>',
    spinner:'<path d="M12 3a9 9 0 1 0 9 9" stroke-linecap="round"/>'
  };
  const icon = (name, cls='') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.info}</svg>`;

  function shell(content, opts={}) {
    const pageClass = opts.pageClass || '';
    const demoBanner = demoMode ? `<div class="demo-banner" style="background:#fff0cf;color:#a56608;padding:8px 16px;font-size:13px;border-bottom:1px solid #d89b25;text-align:center">⚠ 演示模式 · 当前使用本地示例数据，不会写入后端</div>` : '';
    const practiceActions = isPracticeAttempt ? `<nav class="practice-attempt-actions" aria-label="练习档案"><a href="${routes.report}">${icon('file')} 本次报告</a><a href="${routes.history}">${icon('chart')} 历史记录</a></nav>` : '';
    return `${demoBanner}<div class="shell ${pageClass}">${practiceActions}${content}</div>`;
  }

  const statChip = (iconName,label,value,sub,color='') => `<div class="stat"><div class="icon ${color}">${icon(iconName)}</div><b>${value}</b><span>${label} · ${sub}</span></div>`;
  const statusChip = (text, type='gray') => `<span class="chip ${type}">${text}</span>`;
  const metaCell = (label,value) => label === 'Session ID' ? '' : `<div><small class="muted">${label}</small><b>${value}</b></div>`;

  function waveBars(count=65) {
    let html='';
    for(let i=0;i<count;i++){
      const h=12 + Math.round((Math.sin(i*.68)+1)*11 + (i%7)*2.2);
      html += `<i style="height:${h}px"></i>`;
    }
    return html;
  }

  // ── 加载/错误占位 ──
  function renderLoading(msg='正在加载…') {
    return shell(`<main class="page" style="padding:80px 20px;text-align:center"><div class="loading-spinner" style="margin:0 auto 16px"></div><p class="muted">${msg}</p></main>`);
  }
  function renderError(msg, opts={}) {
    const back = opts.back || routes.center;
    return shell(`<main class="page" style="padding:80px 20px;text-align:center"><div style="max-width:520px;margin:0 auto"><div class="icon red" style="margin:0 auto 16px;width:56px;height:56px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#fde8e6">${icon('alert')}</div><h2 style="margin:0 0 8px">${msg}</h2>${opts.detail?`<p class="muted">${opts.detail}</p>`:''}<div style="margin-top:24px;display:flex;gap:8px;justify-content:center"><a class="btn" href="${back}">${icon('left')} 返回</a>${opts.retry?`<button class="btn primary" data-retry>${icon('refresh')} 重试</button>`:''}</div></div></main>`);
  }
  function renderApiDisabled(msg) {
    return shell(`<main class="page" style="padding:80px 20px;text-align:center"><div style="max-width:520px;margin:0 auto"><div class="icon" style="margin:0 auto 16px;width:56px;height:56px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#eef0ec">${icon('lock')}</div><h2 style="margin:0 0 8px">当前版本暂不支持</h2><p class="muted">${msg || '此功能需要登录并连接后端服务。请先登录后再试。'}</p><div style="margin-top:24px"><a class="btn primary" href="/login">${icon('logout')} 前往登录</a></div></div></main>`);
  }

  // ── 测评中心：列出真实 sessions ──
  function renderCenter() {
    if (!apiEnabled && !demoMode) return renderApiDisabled('测评中心需要登录后端服务。');
    if (appState._loadingCenter) return renderLoading('正在加载测评列表…');
    if (appState._centerError) return renderError('加载测评列表失败', { detail: appState._centerError, retry: true });

    const sessions = appState._centerSessions || [];
    const empty = sessions.length === 0;

    // 优先进行中的 session
    const inProgress = sessions.find(s => s.status === 'IN_PROGRESS');
    const priority = inProgress || sessions.find(s => s.status === 'CREATED');

    const taskCard = (s) => {
      const label = s.type === 'READING' ? '朗读测评' : s.type === 'WRITTEN' ? '书面表达' : s.type === 'MIXED' ? '综合测评' : '阶段测评';
      const ic = s.type === 'READING' ? 'book' : s.type === 'WRITTEN' ? 'file' : 'mic';
      const btn = s.status === 'CREATED' ? '开始测评' : s.status === 'IN_PROGRESS' ? '继续测评' : s.status === 'SUBMITTED' || s.status === 'PROCESSING' ? '查看处理状态' : s.status === 'COMPLETED' ? '查看报告' : '已取消';
      const chipType = s.status === 'CREATED' ? 'red' : s.status === 'IN_PROGRESS' ? 'gold' : s.status === 'COMPLETED' ? 'green' : 'gray';
      const target = s.status === 'COMPLETED' ? `${base}/sessions/${s.id}/report/` : s.status === 'SUBMITTED' || s.status === 'PROCESSING' ? `${base}/sessions/${s.id}/processing/` : `${base}/sessions/${s.id}/`;
      return `<a class="task-card" href="${target}">
        <div class="icon ${chipType}">${icon(ic)}</div><h4>${label}</h4><p>${s.type || ''} · ${new Date(s.createdAt).toLocaleDateString()}</p>
        ${statusChip(btn, chipType)}<p>状态：${s.status}</p><div class="soft-divider"></div><p>创建于 ${new Date(s.createdAt).toLocaleDateString()}</p>
      </a>`;
    };

    const content = `
      <main class="page">
        <div class="hero-landscape"></div>
        <section class="hero-head">
          <h1 class="page-title">测评中心</h1>
          <p class="page-subtitle">科学测评，精准反馈，见证每一次进步</p>
        </section>
        ${priority ? `<section class="center-hero">
          <article class="card priority">
            <div class="mic-orbit">${icon('mic')}</div>
            <div>
              <div class="card-kicker">当前进度 · 优先完成</div>
              <h2>继续完成「${priority.type === 'READING' ? '朗读测评' : priority.type === 'WRITTEN' ? '书面表达' : '综合测评'}」</h2>
              <div class="muted">状态：<strong style="color:var(--red)">${priority.status}</strong></div>
              <div class="priority-actions">
                <a class="btn primary" href="${base}/sessions/${priority.id}/">${priority.status === 'CREATED' ? '开始测评' : '继续测评'} ${icon('arrow')}</a>
                <a class="btn" href="${base}/sessions/${priority.id}/">查看详情</a>
              </div>
              <div class="meta-row" style="margin-top:12px"><span>创建：${new Date(priority.createdAt).toLocaleString()}</span></div>
            </div>
          </article>
        </section>` : ''}
        <section class="center-board">
          <article class="card board-panel">
            <div class="section-title"><h2>我的测评</h2>${sessions.length ? `<a href="${base}/history">查看历史 ${icon('arrow')}</a>` : ''}</div>
            ${empty ? `<div style="padding:40px 20px;text-align:center"><div class="icon" style="margin:0 auto 12px;width:48px;height:48px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#eef0ec">${icon('info')}</div><p class="muted">暂无测评任务。教师发布测评后，将在这里显示。</p></div>` : `<div class="task-cards">${sessions.map(taskCard).join('')}</div>`}
          </article>
        </section>
        <section class="lower-board">
          <article class="card"><div class="section-title"><h2>历史测评</h2><a href="${base}/history">查看全部历史</a></div><p class="muted">查看历次测评成绩与成长趋势。</p></article>
          <article class="card"><div class="section-title"><h2>我的录音</h2><a href="${base}/recordings">管理录音库</a></div><p class="muted">查看录音上传与处理状态。</p></article>
        </section>
      </main>`;
    return shell(content);
  }

  // ── 测评准备页：从后端加载 session 与 items ──
  function renderPrep() {
    if (!SESSION_ID) return renderError('无法确认本次测评', { detail: '请从测评中心进入。' });
    if (!apiEnabled && !demoMode) return renderApiDisabled('测评准备需要登录后端服务。');
    if (appState._loadingPrep) return renderLoading('正在加载测评详情…');
    if (appState._prepError) return renderError('加载测评详情失败', { detail: appState._prepError, retry: true });

    const session = appState.apiSession;
    if (!session) return renderLoading('正在加载测评详情…');

    const items = appState.apiItems || [];
    const readingItems = items.filter(isOralItem);
    const writtenItems = items.filter(isWrittenItem);

    // 开始按钮：根据 session 状态决定行为
    let startLabel = '开始本次测评';
    let startDisabled = false;
    if (session.status === 'IN_PROGRESS') startLabel = '继续测评';
    else if (session.status === 'SUBMITTED' || session.status === 'PROCESSING') { startLabel = '已提交，查看处理状态'; }
    else if (session.status === 'COMPLETED') { startLabel = '已完成，查看报告'; }
    else if (session.status === 'CANCELLED') { startLabel = '已取消'; startDisabled = true; }

    const content = `
      <main class="page">
        <div class="hero-landscape"></div>
        <section class="hero-head"><h1 class="page-title">测评准备</h1><p class="page-subtitle">${session.type === 'READING' ? '朗读测评' : session.type === 'WRITTEN' ? '书面表达' : '综合测评'}</p><p class="page-subtitle" style="font-size:15px">科学测评，精准反馈，见证每一次进步</p></section>
        <section class="prep-layout">
          <article class="card prep-card">
            <div class="section-title"><h2>${isPracticeAttempt ? '设备检查' : '本次测评概览'}</h2>${statusChip(isPracticeAttempt ? '练习准备中' : session.status, session.status === 'IN_PROGRESS' ? 'gold' : 'green')}</div>
            <div class="assessment-summary">
              <div class="mic-orbit" style="width:112px;height:112px">${icon('wave')}</div>
              <div><h2>${session.type === 'READING' ? '朗读测评' : session.type === 'WRITTEN' ? '书面表达' : '综合测评'} ${statusChip(session.type, 'gold')}</h2><div class="summary-metrics">
                <div class="summary-metric"><div class="icon">${icon('assessment')}</div><div><small>题型数量</small><b>${items.length} 项</b></div></div>
                <div class="summary-metric"><div class="icon blue">${icon('clock')}</div><div><small>创建时间</small><b>${new Date(session.createdAt).toLocaleString()}</b></div></div>
                <div class="summary-metric"><div class="icon green">${icon('refresh')}</div><div><small>是否允许重录</small><b>允许</b></div></div>
              </div></div>
            </div>
            <div class="privacy-box"><div><strong>隐私说明</strong><p class="muted">录音仅用于本次测评、自动评分和教师复核；服务端证据仅对本人和授权教师可见。</p></div></div>
            ${isPracticeAttempt ? '' : `<div class="session-strip">${metaCell('状态', session.status)}${metaCell('题型', session.type)}${metaCell('已开始', session.startedAt ? new Date(session.startedAt).toLocaleString() : '未开始')}</div>`}
          </article>
          <article class="card prep-card">
            <div class="section-title"><h2>设备检测</h2><button class="btn" data-recheck>${icon('refresh')} 重新检测</button></div>
            <div class="device-list" data-device-list>
              ${deviceRow('browser','浏览器环境','等待检测','pending')}
              ${deviceRow('mic','麦克风输入','等待检测','pending')}
              ${deviceRow('speaker','扬声器播放','等待检测','pending')}
              ${deviceRow('wifi','网络状态','等待检测','pending')}
            </div>
            <p class="muted small" style="margin-top:14px">检测结果将写入 DeviceCheckLog；未通过时不会显示"已就绪"。</p>
          </article>
          <article class="card prep-card">
            <div class="section-title"><h2>${isPracticeAttempt ? '检查完成后进入练习' : '测评项'}</h2></div>
            ${isPracticeAttempt ? '<p class="muted">本页仅检查设备。通过后将自动进入第一个真实练习环节。</p>' : (items.length === 0 ? '<p class="muted">本次测评暂无测评项。请联系教师确认。</p>' : `<div class="task-cards">${items.map(it => `<a class="task-card" href="${isOralItem(it) ? `${base}/sessions/${SESSION_ID}/reading/${it.id}/` : `${base}/sessions/${SESSION_ID}/written/${it.id}/`}"><div class="icon">${icon(isOralItem(it) ? 'book' : 'file')}</div><h4>${isOralItem(it) ? '朗读' : '书面'}</h4><p>${it.status || ''}</p>${statusChip(it.recordingId ? '已录音' : '未录音', it.recordingId ? 'green' : 'red')}</a>`).join('')}</div>`)}
          </article>
          <article class="card prep-action">
            <div><strong class="serif" style="font-size:20px">测评环境状态：<span data-ready-label>待检测</span></strong><p class="muted">建议佩戴耳机、关闭其他音频应用，并保持网络稳定。</p></div>
            <button class="btn primary" data-start-session ${startDisabled ? 'disabled' : ''}>${startLabel} ${icon('arrow')}</button>
          </article>
        </section>
      </main>`;
    return shell(content);
  }
  function deviceRow(ic,title,sub,status){
    return `<div class="device-row" data-device="${title}"><div class="icon ${ic==='wifi'?'green':'blue'}">${icon(ic)}</div><div><strong>${title}</strong><small>${sub}</small></div><div class="device-status ${status==='pending'?'pending':''}">${status==='pending'?'待检测':'正常'} ${status==='pending'?'':icon('check')}</div></div>`;
  }

  const readingStateLabels = {
    LOADING_ITEM:'加载题目',PLAYING_PROMPT:'播放示范音频',PREPARING:'准备倒计时',RECORDING:'正式录音',PAUSED:'录音暂停',REVIEWING:'试听确认',UPLOADING:'上传录音',UPLOAD_FAILED:'上传失败',UPLOADED:'上传完成',PROCESSING:'进入评分',REJECTED_AUDIO:'音频不合格',READY:'准备就绪'
  };
  function renderReading() {
    if (!SESSION_ID || !READING_ITEM_ID) return renderError('无法确认当前朗读题', { detail: '请从测评准备页进入。' });
    if (!apiEnabled && !demoMode) return renderApiDisabled('朗读测评需要登录后端服务。');
    if (appState._loadingReading) return renderLoading('正在加载朗读题目…');
    if (appState._readingError) return renderError('加载朗读题目失败', { detail: appState._readingError, retry: true });

    const state = appState.currentReadingState || 'PLAYING_PROMPT';
    const item = appState.apiReadingItem;
    const session = appState.apiSession;

    // 从真实 item 中提取朗读文本
    let promptText = '请朗读以下内容';
    if (item) {
      if (item.prompt?.text) promptText = item.prompt.text;
      else if (item.prompt?.sentence) promptText = item.prompt.sentence;
      else if (typeof item.prompt === 'string') promptText = item.prompt;
      else if (item.prompt?.targetText) promptText = item.prompt.targetText;
      else if (item.prompt?.stimulus) promptText = item.prompt.stimulus;
      else if (item.questionPrompt?.text) promptText = item.questionPrompt.text;
      else if (item.questionPrompt?.sentence) promptText = item.questionPrompt.sentence;
    }

    if (isListeningItem(item)) {
      return shell(`<main class="page"><section class="reading-head"><div><h1 class="page-title" style="font-size:29px">听读练习</h1><p class="page-subtitle">完整听完示范材料后，系统将自动进入下一环节。</p></div></section><section class="reading-layout"><article class="card reading-main" style="grid-column:span 2"><h2>请认真聆听</h2><div class="reading-sentence"><mark>${promptText}</mark></div><div class="audio-prompt" style="margin:26px 0"><button class="play-circle" data-listen-play>${icon('play')}</button><div class="wave-mini" style="flex:1">${waveBars(44)}</div></div><p class="muted" data-listen-note>播放完成后将自动进入下一题。</p><div class="reading-actions"><button class="btn primary" data-listen-complete>我已听完，进入下一题 ${icon('arrow')}</button></div></article><aside class="grid"><article class="card requirements"><h3 class="card-title">聆听提示</h3><div class="req-list" style="margin-top:16px"><span><i>✓</i>注意停顿和语气</span><span><i>✓</i>可按需要回放一次</span></div></article></aside></section></main>`);
    }

    const stages = [
      ['PLAYING_PROMPT','wave','示范音频'],['PREPARING','clock','准备倒计时'],['RECORDING','mic','正式录音'],['REVIEWING','headphones','试听确认'],['UPLOADING','cloud','上传录音']
    ];
    const order = ['PLAYING_PROMPT','PREPARING','RECORDING','PAUSED','REVIEWING','UPLOADING','UPLOAD_FAILED','UPLOADED','PROCESSING'];
    const currentIdx = order.indexOf(state);
    const stageHtml = stages.map(([key,ic,label],idx)=>{
      const keyIdx=order.indexOf(key); const done=currentIdx>keyIdx || (state==='PAUSED'&&key==='RECORDING'); const active=(key===state)||(state==='PAUSED'&&key==='RECORDING')||(state==='UPLOAD_FAILED'&&key==='UPLOADING')||(state==='UPLOADED'&&key==='UPLOADING');
      return `<div class="stage ${done?'done':''} ${active?'active':''}"><div class="icon">${done?icon('check'):icon(ic)}</div><div><strong>${label}</strong><small>${done?'已完成':active?'当前阶段':'待开始'}</small></div></div>`;
    }).join('');

    const content = `
      <main class="page">
        <section class="reading-head"><div><h1 class="page-title" style="font-size:29px">${session ? (session.type === 'READING' ? '朗读测评' : '综合测评') : '朗读测评'} ${statusChip(session?.status || 'IN_PROGRESS','gold')}</h1><p class="page-subtitle">跟随示范完成朗读，上传后系统将自动分析并继续下一题。</p></div><div class="identity-chips"><div class="identity-chip">当前环节<b>${readingStateLabels[state]}</b></div></div></section>
        <section class="card stage-stepper" data-stage-stepper>${stageHtml}</section>
        <section class="reading-layout">
          <aside class="grid">
            <article class="card prompt-card"><h3 class="card-title">示范音频 ${Math.max(1,appState.promptPlayCount)} / 2</h3><div class="audio-prompt"><button class="play-circle" data-prompt-play ${appState.promptPlayCount>=2?'disabled':''}>${icon(state==='PLAYING_PROMPT'?'play':'refresh')}</button><div class="wave-mini" style="flex:1">${waveBars(44)}</div></div><p class="small muted">播放期间禁止开始录音；每题最多播放 2 次。${item?.demoAudioUrl ? '示范音频来自后端。' : '本题未提供示范音频，可直接开始录音。'}</p></article>
            <article class="card requirements"><h3 class="card-title">作答要求</h3><div class="req-list" style="margin-top:16px"><span><i>✓</i>准确朗读高亮部分</span><span><i>✓</i>语速适中，发音清晰</span><span><i>✓</i>感情自然，表达完整</span><span><i>✓</i>最短有效时长 15 秒</span></div></article>
          </aside>
          <article class="card reading-main">
            <h2>请朗读以下内容</h2><div class="reading-sentence"><mark>${promptText}</mark></div>
            <div class="recorder" data-recorder>
              <div class="recorder-top"><span class="chip gold" data-recorder-state>${readingStateLabels[state]}</span><span>录音时长 · <b data-elapsed>${formatTime(appState.readingElapsed)}</b></span></div>
              <canvas class="wave-canvas" data-wave></canvas>
              <div class="recorder-timer"><span data-main-timer>${formatTime(appState.readingElapsed)}</span> <small style="font-size:16px;color:#aaa">/ 00:30</small></div>
              <div class="quality-strip"><div><span>有效时长</span><b data-effective>${formatTime(appState.readingElapsed)}</b></div><div><span>最短时长阈值</span><b>00:15</b></div><div><span>环境噪声</span><b>${appState._noiseDb ?? '—'} dB</b></div><div><span>静音检测</span><b>0.6 s</b></div></div>
              <div class="notice" style="margin-top:10px;background:rgba(216,155,37,.08);color:#dcb55c" data-record-note>${appState.promptPlayCount === 0 ? '可先播放示范音频，或直接开始录音。' : '示范音频结束后，将进入 3 秒准备倒计时。'}</div>
              ${state==='PREPARING'?'<div class="countdown-overlay"><b data-countdown>3</b></div>':''}
              ${appState._uploadError ? `<div class="notice danger" style="margin-top:10px">${icon('alert')} 上传失败：${appState._uploadError}。可重试上传或重新录制。</div>` : ''}
            </div>
            <div class="reading-actions" data-reading-actions>${readingActions(state)}</div>
            <p class="small muted" style="text-align:center">上传进度来自真实 XMLHttpRequest.upload.onprogress；未连接后端时按钮会禁用。</p>
          </article>
          <aside class="grid">
            <article class="card side-status"><h3>当前状态</h3><div class="state-display"><div class="icon">${icon(stateIcon(state))}</div><div><strong data-current-state>${readingStateLabels[state]}</strong><small class="muted" data-current-copy>${stateCopy(state)}</small></div></div></article>
            <article class="card side-status"><h3>接下来会发生什么</h3><div class="flow-list"><div class="flow-item"><div class="icon blue">${icon('cloud')}</div><div><strong>上传录音</strong><small>录音会安全上传到学习档案。</small></div></div><div class="flow-item"><div class="icon green">${icon('wave')}</div><div><strong>音频质检</strong><small>检测噪声、时长、静音和完整性。</small></div></div><div class="flow-item"><div class="icon">${icon('file')}</div><div><strong>保存本题作答</strong><small>录音会与当前题目自动关联。</small></div></div><div class="flow-item"><div class="icon red">${icon('star')}</div><div><strong>语音评分</strong><small>评分完成后进入教师复核或报告生成。</small></div></div></div></article>
          </aside>
        </section>
      </main>`;
    return shell(content);
  }
  function stateIcon(state){return ({PLAYING_PROMPT:'play',PREPARING:'clock',RECORDING:'mic',PAUSED:'pause',REVIEWING:'headphones',UPLOADING:'cloud',UPLOAD_FAILED:'alert',UPLOADED:'check',PROCESSING:'wave'})[state]||'info'}
  function stateCopy(state){return ({PLAYING_PROMPT:'可先播放示范音频，或直接开始录音。',PREPARING:'请调整坐姿与呼吸，倒计时结束后自动录音。',RECORDING:'正在采集本机麦克风输入。',PAUSED:'录音已暂停，可继续或结束。',REVIEWING:'请试听录音，确认效果满意后上传。',UPLOADING:'正在通过预签名 URL 上传到对象存储。',UPLOAD_FAILED:'上传失败，不会显示已同步，可重试。',UPLOADED:'录音已完成上传，准备进入下一题。',PROCESSING:'SpeechJob 已创建，可继续书面题。'})[state]||''}
  function readingActions(state){
    if(state==='PLAYING_PROMPT') return `<button class="btn ghost" data-prompt-play ${appState.promptPlayCount>=2?'disabled':''}>${icon('play')} 播放示范音频</button><button class="btn primary" data-skip-prompt>跳过示范直接录音 ${icon('arrow')}</button>`;
    if(state==='PREPARING') return `<button class="btn" disabled>准备中，请等待</button>`;
    if(state==='RECORDING') return `<button class="btn ghost" data-pause>${icon('pause')} 暂停</button><button class="btn primary" data-stop>${icon('stop')} 结束录音</button>`;
    if(state==='PAUSED') return `<button class="btn ghost" data-resume>${icon('play')} 继续录音</button><button class="btn primary" data-stop>${icon('stop')} 结束录音</button>`;
    if(state==='REVIEWING') return `<button class="btn ghost" data-rerecord>${icon('refresh')} 重新录制</button><button class="btn" data-play-recording>${icon('play')} 播放录音</button><button class="btn primary" data-upload ${!apiEnabled?'disabled':''}>${icon('cloud')} 确认并上传</button>`;
    if(state==='UPLOADING') return `<button class="btn" disabled>上传中 ${appState.uploadProgress}%</button>`;
    if(state==='UPLOAD_FAILED') return `<button class="btn ghost" data-rerecord>${icon('refresh')} 重新录制</button><button class="btn primary" data-upload ${!apiEnabled?'disabled':''}>${icon('upload')} 重新上传</button>`;
    if(state==='UPLOADED'||state==='PROCESSING') return `<button class="btn primary" data-continue-next>进入下一题 ${icon('arrow')}</button>`;
    return `<button class="btn primary" data-skip-prompt>开始 ${icon('arrow')}</button>`;
  }
  function formatTime(seconds){const s=Math.max(0,Math.round(Number(seconds)||0));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}

  // ── 书面题：从后端获取 items，调用真实保存接口 ──
  function renderWritten(){
    if (!SESSION_ID || !WRITTEN_ITEM_ID) return renderError('无法确认当前书面题', { detail: '请从测评准备页进入。' });
    if (!apiEnabled && !demoMode) return renderApiDisabled('书面题需要登录后端服务。');
    if (appState._loadingWritten) return renderLoading('正在加载书面题…');
    if (appState._writtenError) return renderError('加载书面题失败', { detail: appState._writtenError, retry: true });

    const items = appState.apiWrittenItems || [];
    if (items.length === 0) return renderError('暂无书面题', { detail: '本次测评未配置书面题。', back: routes.prep });

    // 找到当前 item
    const idx = Math.max(0, items.findIndex(i => i.id === WRITTEN_ITEM_ID));
    const currentItem = items[idx] || items[0];
    if (!currentItem) return renderError('未找到该书面题');

    // 从 item.prompt 提取题干与选项
    let qText = '请回答以下问题';
    let qOptions = [];
    if (currentItem.prompt) {
      if (typeof currentItem.prompt === 'string') qText = currentItem.prompt;
      else {
        if (currentItem.prompt.text) qText = currentItem.prompt.text;
        else if (currentItem.prompt.question) qText = currentItem.prompt.question;
        else if (currentItem.prompt.prompt) qText = currentItem.prompt.prompt;
        if (Array.isArray(currentItem.prompt.options)) qOptions = currentItem.prompt.options;
      }
    }
    if (currentItem.questionPrompt) {
      if (currentItem.questionPrompt.text) qText = currentItem.questionPrompt.text;
      if (Array.isArray(currentItem.questionPrompt.options)) qOptions = currentItem.questionPrompt.options;
    }

    const answer = appState.writtenAnswers[currentItem.id];
    const syncStatus = appState.writtenSyncStatus[currentItem.id] || 'LOCAL';
    const syncLabel = syncStatus === 'SYNCED' ? '已同步到平台' : syncStatus === 'FINALIZED' ? '已正式提交' : syncStatus === 'FAILED' ? '同步失败' : '已保存到本机';

    const content=`<main class="page"><div class="written-layout"><section class="written-main"><div class="written-top"><div><h1 class="question-title">书面练习</h1><p><b style="color:var(--red)">第 ${idx+1} 题</b>　/　共 ${items.length} 题</p></div><div class="meta-row"><span>${statusChip(syncLabel, syncStatus === 'SYNCED' || syncStatus === 'FINALIZED' ? 'green' : syncStatus === 'FAILED' ? 'red' : 'blue')}</span></div></div><p class="muted">${currentItem.itemType || 'WRITTEN'}</p><h2 class="question-copy">${qText}</h2><div class="answer-list">${qOptions.length > 0 ? qOptions.map((opt,i)=>`<label class="answer-option ${answer===i?'selected':''}"><input type="radio" name="answer" value="${i}" ${answer===i?'checked':''}><strong>${String.fromCharCode(65+i)}.</strong><span>${opt}</span></label>`).join('') : `<textarea class="written-textarea" data-written-textarea placeholder="请在此作答…" style="width:100%;min-height:200px;padding:12px;border:1px solid #d4cfc1;border-radius:8px;font-size:15px">${typeof answer === 'string' ? answer : ''}</textarea>`}</div><div class="written-footer"><button class="btn ghost" data-written-prev ${idx===0?'disabled':''}>${icon('left')} 上一题</button>${qOptions.length > 0 ? `<button class="btn" data-written-save ${answer===undefined?'disabled':''}>${icon('save')} 保存到平台</button>` : `<button class="btn" data-written-save>${icon('save')} 保存到平台</button>`}<button class="btn primary" data-written-next>${idx>=items.length-1?'完成书面题':'保存并下一题'} ${icon('arrow')}</button></div></section><aside class="written-side"><div class="directory-head"><h2>题目目录</h2><p>✓ 已同步　● 待检查　◎ 当前题</p></div><div class="directory">${items.map((it,i)=>{const ans=appState.writtenAnswers[it.id];const syn=appState.writtenSyncStatus[it.id];const isCur=it.id===currentItem.id;return `<button class="dir-item ${isCur?'active':''} ${ans!==undefined?'done':''}" data-jump-item="${it.id}" style="width:100%;border:0;background:${isCur?'#fff0cf':'transparent'};text-align:left;padding:10px;cursor:pointer"><span class="dir-dot">${syn==='SYNCED'||syn==='FINALIZED'?'✓':ans!==undefined?'●':'◎'}</span><strong>第 ${i+1} 题</strong><span>${isCur?'当前题':syn==='SYNCED'||syn==='FINALIZED'?'已同步':ans!==undefined?'本机草稿':'待检查'}</span></button>`}).join('')}<div class="directory-art"></div></div><div style="margin-top:16px;padding:12px;background:#f6f1e6;border-radius:8px"><p class="small muted"><b>状态说明</b></p><p class="small muted">已保存到本机：仅本地草稿，刷新后保留</p><p class="small muted">已同步到平台：答案已保存</p><p class="small muted">已正式提交：答案已锁定</p></div></aside></div></main>`;
    return shell(content,{pageClass:'written-shell'});
  }

  function renderSubmit(){
    if (!SESSION_ID) return renderError('缺少 sessionId');
    if (!apiEnabled && !demoMode) return renderApiDisabled('提交测评需要登录后端服务。');
    if (appState._loadingSubmit) return renderLoading('正在加载提交检查…');

    const session = appState.apiSession;
    const items = appState.apiItems || [];
    const readingItems = items.filter(isOralItem);
    const writtenItems = items.filter(isWrittenItem);

    const readingComplete = readingItems.length > 0 ? readingItems.every(i => i.recordingId) : true;
    const answeredWritten = writtenItems.filter(i => appState.writtenAnswers[i.id] !== undefined).length;
    const allWrittenAnswered = writtenItems.length === 0 || answeredWritten === writtenItems.length;
    const allWrittenSynced = writtenItems.every(i => appState.writtenSyncStatus[i.id] === 'SYNCED' || appState.writtenSyncStatus[i.id] === 'FINALIZED');

    const blockers = [];
    if (!readingComplete) blockers.push(`仍有 ${readingItems.filter(i => !i.recordingId).length} 个朗读题未完成录音`);
    if (!allWrittenAnswered) blockers.push(`仍有 ${writtenItems.length - answeredWritten} 道书面题未作答`);
    if (!allWrittenSynced && allWrittenAnswered && writtenItems.length > 0) blockers.push('部分书面题尚未同步到平台');

    const canSubmit = blockers.length === 0 && session && (session.status === 'IN_PROGRESS' || session.status === 'CREATED');
    const alreadySubmitted = session && (session.status === 'SUBMITTED' || session.status === 'PROCESSING' || session.status === 'COMPLETED');
    const courseContext = isPracticeAttempt && Api?.getCoursePracticeContext ? Api.getCoursePracticeContext(SESSION_ID) : null;
    const courseSyncPending = !!(alreadySubmitted && courseContext);
    const courseSyncNotice = courseSyncPending
      ? `<article class="card blocking"><div class="notice danger">${icon('alert')} 练习已经提交，但课程完成状态尚未同步。可以安全重试；不会重复提交练习或创建第二条课程进度。</div></article>`
      : '';
    const submitAction = courseSyncPending
      ? `<button class="btn primary" data-retry-course-sync>重试同步课程进度 ${icon('refresh')}</button>`
      : alreadySubmitted
        ? `<a class="btn primary" href="${routes.processing}">${session.status === 'COMPLETED' ? '查看报告' : '查看处理状态'} ${icon('arrow')}</a>`
        : `<button class="btn primary" data-submit-session ${canSubmit?'':'disabled'}>提交整次测评 ${icon('arrow')}</button>`;

    const content=`<main class="page"><div class="hero-landscape" style="height:300px;opacity:.88"></div><section class="submit-head"><div><h1 class="page-title">提交前检查</h1><p class="page-subtitle">请仔细检查本次测评的完成情况，确认无误后提交。</p></div><div class="submit-stepper"><div class="submit-step"><b>01</b><small>朗读测评</small></div><div class="submit-step"><b>02</b><small>书面练习</small></div><div class="submit-step active"><b>03</b><small>提交前检查</small></div><div class="submit-step"><b>04</b><small>提交完成</small></div></div></section><section class="submit-layout"><div><article class="card summary-state"><h2 class="card-title">本次测评总体状态</h2><div class="state-cards" style="margin-top:16px"><div class="state-card"><div class="icon red">${icon('mic')}</div><div><small>朗读题</small><b>${readingItems.filter(i => i.recordingId).length} / ${readingItems.length}</b><div>${statusChip(readingComplete?'已完成':'未完成',readingComplete?'green':'red')}</div></div></div><div class="state-card"><div class="icon green">${icon('book')}</div><div><small>书面题</small><b>${answeredWritten} / ${writtenItems.length}</b><div>${statusChip(allWrittenAnswered?'已完成':'未完成',allWrittenAnswered?'green':'red')}</div></div></div><div class="state-card"><div class="icon blue">${icon('cloud')}</div><div><small>Session 状态</small><b>${session?.status || '—'}</b><div>${statusChip(session?.status || 'UNKNOWN', session?.status === 'IN_PROGRESS' ? 'gold' : 'green')}</div></div></div><div class="state-card"><div class="icon">${icon('alert')}</div><div><small>问题项</small><b>${blockers.length}</b><div>${statusChip(blockers.length?'阻止提交':'无阻塞',blockers.length?'red':'green')}</div></div></div></div></article>${readingItems.length > 0 ? `<article class="card items-panel"><div class="section-title"><h2>朗读题（${readingItems.filter(i => i.recordingId).length} / ${readingItems.length} 已完成）</h2></div><div class="item-grid">${readingItems.map((it,i)=>`<div class="item-card"><h4>朗读题 ${i+1} ${statusChip(it.recordingId?'COMPLETE':'INCOMPLETE',it.recordingId?'green':'red')}</h4><p>Item ID　${it.id}</p><p>Recording ID　${it.recordingId || '未绑定'}</p><p>状态　${it.status || '—'}</p></div>`).join('')}</div></article>`:''}${writtenItems.length > 0 ? `<article class="card items-panel"><div class="section-title"><h2>书面题（${answeredWritten} / ${writtenItems.length} 已完成）</h2></div><div class="item-grid">${writtenItems.map((it,i)=>{const ans=appState.writtenAnswers[it.id];const syn=appState.writtenSyncStatus[it.id];return `<div class="item-card"><h4>书面题 ${i+1} ${statusChip(ans!==undefined?'COMPLETE':'INCOMPLETE',ans!==undefined?'green':'red')}</h4><p>Item ID　${it.id}</p><p>同步状态　${syn || '本机草稿'}</p></div>`}).join('')}</div></article>`:''}</div><aside class="submit-side"><article class="card blocking"><h2 class="card-title">${blockers.length?`发现 ${blockers.length} 个阻止提交的问题`:'已满足提交条件'}</h2><div style="margin-top:14px">${blockers.length?blockers.map(b=>`<div class="notice danger" style="margin-bottom:10px">${icon('alert')} ${b}</div>`).join(''):`<div class="notice">朗读、书面与录音状态均已通过校验。</div>`}</div></article>${courseSyncNotice}<article class="card rules"><h2 class="card-title">提交规则</h2><div class="rule"><div class="icon red">${icon('alert')}</div><div><strong>未完成的题目无法提交</strong><p class="muted small">所有朗读题和书面题必须完成。</p></div></div><div class="rule"><div class="icon">${icon('cloud')}</div><div><strong>录音未上传无法提交</strong><p class="muted small">Recording 必须绑定到 AssessmentItem。</p></div></div><div class="rule"><div class="icon green">${icon('check')}</div><div><strong>提交后不可修改</strong><p class="muted small">AssessmentSession 提交后进入处理状态。</p></div></div></article><div class="submit-actions"><a class="btn ghost" href="${routes.prep}">${icon('left')} 返回检查</a>${submitAction}</div></aside></section></main>`;
    return shell(content.replace(/<p>Item ID[^<]*<\/p>/g, '').replace(/<p>Recording ID[^<]*<\/p>/g, ''));
  }

  function renderProcessing(){
    if (!SESSION_ID) return renderError('缺少 sessionId');
    if (!apiEnabled && !demoMode) return renderApiDisabled('处理状态需要登录后端服务。');
    if (appState._loadingProcessing) return renderLoading('正在加载处理状态…');

    const session = appState.apiSession;
    const speechJobs = appState.apiSpeechJobs?.length ? appState.apiSpeechJobs : (appState.apiSpeechJob ? [appState.apiSpeechJob] : []);
    const speechJob = speechJobs[0] || null;
    const items = appState.apiItems || [];
    const readingItems = items.filter(isOralItem);

    // 真实 SpeechJob 状态映射
    const jobStatus = speechJobs.some(job => job.status === 'FAILED') ? 'FAILED' : speechJobs.some(job => job.status === 'NEEDS_REVIEW') ? 'NEEDS_REVIEW' : speechJob?.status;
    const reportReady = session?.status === 'COMPLETED';
    const stageStatus = (stageName) => {
      if (!jobStatus) return '';
      const order = ['CREATED','QUEUED','PROCESSING','AUTO_RESULT','NEEDS_REVIEW','FINALIZED','FAILED'];
      const stageMap = {
        '录音已上传': 'CREATED',
        '音频质量检查': 'QUEUED',
        '语音识别': 'PROCESSING',
        '文本对齐': 'PROCESSING',
        '发音评分': 'AUTO_RESULT',
        '等待教师复核': 'NEEDS_REVIEW',
        '报告生成': 'FINALIZED'
      };
      const stageOrder = order.indexOf(stageMap[stageName]);
      const currentOrder = order.indexOf(jobStatus);
      if (jobStatus === 'FAILED') return stageName === '发音评分' ? 'active' : '';
      if (currentOrder > stageOrder) return 'done';
      if (currentOrder === stageOrder) return 'active';
      return '';
    };
    const stages=[['录音已上传', session?.submittedAt ? new Date(session.submittedAt).toLocaleTimeString() : '—', stageStatus('录音已上传'),'cloud'],['音频质量检查','—', stageStatus('音频质量检查'),'check'],['语音识别','—', stageStatus('语音识别'),'wave'],['文本对齐','—', stageStatus('文本对齐'),'file'],['发音评分', jobStatus === 'PROCESSING' ? '进行中' : '—', stageStatus('发音评分'),'mic'],['等待教师复核', jobStatus === 'NEEDS_REVIEW' ? '进行中' : '—', stageStatus('等待教师复核'),'users'],['报告生成', jobStatus === 'FINALIZED' ? '已完成' : '—', stageStatus('报告生成'),'file']];

    const content=`<main class="page"><div class="hero-landscape" style="height:300px"></div><section class="processing-head"><h1 class="page-title">${reportReady ? '测评报告已生成' : '语音评分处理中'}</h1><p class="page-subtitle">${reportReady ? '本次结果已保存到你的练习档案。' : '系统正在对录音进行真实分析与评分，请耐心等待。'}</p><div class="processing-meta">${metaCell('练习状态', session?.status || '—')}${metaCell('评分状态', jobStatus || '等待创建')}${metaCell('提交时间', session?.submittedAt ? new Date(session.submittedAt).toLocaleString() : '—')}</div></section><article class="card leave-banner"><div><strong class="serif" style="font-size:20px">${reportReady ? '报告已生成，可随时回看。' : '你可以离开页面，评分完成后结果会保存在练习档案中。'}</strong><p class="muted">不会因为离开页面而重复提交或丢失录音。</p></div><a class="btn" href="${routes.history}">查看历史记录 ${icon('arrow')}</a></article><article class="card pipeline"><div class="pipeline-row">${stages.map(s=>`<div class="pipe-stage ${reportReady && s[0] === '报告生成' ? 'done' : s[2]}"><div class="pipe-icon">${(reportReady && s[0] === '报告生成') || s[2]==='done'?icon('check'):icon(s[3])}</div><div><strong>${s[0]}</strong><small>${s[1]}</small></div></div>`).join('')}</div><div class="notice" style="margin-top:20px">${jobStatus === 'FAILED' ? `${icon('alert')} 评分服务当前不可用，录音已保存，未生成虚假分数。请稍后重试或联系教师。` : reportReady ? (jobStatus === 'NEEDS_REVIEW' ? '真实模型结果已汇总为报告，等待教师复核。' : '评分结果已汇总为真实报告。') : jobStatus === 'NEEDS_REVIEW' ? '当前阶段：等待教师复核后生成报告。' : jobStatus === 'PROCESSING' ? '当前阶段：系统正在从准确性、流利度、完整性、声调等维度进行评分。' : '正在等待评分任务进入处理。'}</div>${jobStatus === 'FAILED' ? `<div style="margin-top:16px"><a class="btn" href="${routes.recordings}">${icon('wave')} 查看已保存录音</a></div>` : ''}${reportReady ? `<div style="margin-top:16px"><a class="btn primary" href="${routes.report}">${icon('arrow')} 查看报告</a></div>` : ''}</article><section class="processing-lower"><article class="card record-list"><div class="section-title"><h2>已上传录音</h2>${statusChip(`${readingItems.filter(i=>i.recordingId).length} 段录音`,'gray')}</div>${readingItems.length === 0 ? '<p class="muted">本次测评无朗读题。</p>' : readingItems.map((it,i)=>`<div class="record-row"><div class="play-circle">${icon('mic')}</div><div><strong>口语练习 ${i+1}</strong><p class="muted small">录音已${it.recordingId ? '保存到练习档案' : '等待上传'}</p></div><div><small>作答状态</small><b>${it.status || '—'}</b></div><div>${statusChip(it.recordingId ? (speechJobs.find(job => job.assessmentItemId === it.id)?.status || '已上传') : '未上传', it.recordingId ? 'green' : 'red')}</div></div>`).join('')}</article><aside class="card tips"><h2 class="card-title">温馨提示</h2><div class="rule"><div class="icon">${icon('clock')}</div><div><strong>预计完成时间</strong><p class="muted small">取决于评分服务与队列状态。</p></div></div><div class="rule"><div class="icon green">${icon('shield')}</div><div><strong>数据安全</strong><p class="muted small">录音与结果按学生和学校权限边界保存。</p></div></div><a class="btn" href="${routes.recordings}" style="width:100%;margin-top:16px">我的录音 ${icon('arrow')}</a></aside></section></main>`;
    return shell(content);
  }

  function renderReport(){
    if (!SESSION_ID) return renderError('缺少 sessionId');
    if (!apiEnabled && !demoMode) return renderApiDisabled('测评报告需要登录后端服务。');
    if (appState._loadingReport) return renderLoading('正在加载测评报告…');
    if (appState._reportError) return renderError('加载报告失败', { detail: appState._reportError, retry: true });

    const report = appState.apiReport;
    const session = appState.apiSession;
    if (!report) {
      const content = `<main class="page"><div class="hero-landscape" style="height:220px"></div><section class="report-head"><a class="muted small" href="${routes.center}">‹ 返回测评列表</a><h1 class="page-title" style="margin-top:16px">${session ? (session.type === 'READING' ? '朗读测评' : '综合测评') : '测评'} ${statusChip(session?.status || '—', session?.status === 'COMPLETED' ? 'green' : 'gold')}</h1><p class="page-subtitle">报告尚未生成</p></section><article class="card" style="padding:40px;text-align:center"><div class="icon" style="margin:0 auto 16px;width:56px;height:56px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#eef0ec">${icon('file')}</div><h2>当前测评尚未生成报告</h2><p class="muted">报告在教师复核或系统自动评分完成后生成。请稍后刷新查看。</p>${session && (session.status === 'SUBMITTED' || session.status === 'PROCESSING') ? `<div style="margin-top:24px"><a class="btn primary" href="${routes.processing}">${icon('arrow')} 查看处理状态</a></div>` : ''}<div style="margin-top:12px"><button class="btn" data-retry>${icon('refresh')} 刷新报告</button></div></article></main>`;
      return shell(content);
    }

    const needsReview = report.summary?.requiresTeacherReview === true || report.summary?.scoringState === 'NEEDS_REVIEW';
    const content=`<main class="page"><div class="hero-landscape" style="height:220px"></div><section class="report-head"><a class="muted small" href="${routes.center}">‹ 返回练习中心</a><h1 class="page-title" style="margin-top:16px">${session?.type === 'READING' ? '朗读练习' : '综合练习'} ${statusChip(needsReview ? '待教师复核' : '已完成',needsReview ? 'gold' : 'green')}</h1><p class="page-subtitle">科学测评，精准反馈，见证每一次进步</p></section>${needsReview ? `<article class="card notice" style="margin-bottom:13px">${icon('info')} 本报告已展示本次真实模型评分；其中至少一段录音建议由教师复核，复核意见会另行保存。</article>` : ''}<article class="card report-info"><div class="icon red">${icon('mic')}</div><div class="info-cell">数据完整度<b>${report.dataCompleteness != null ? Math.round(report.dataCompleteness) + '%' : '—'}</b></div><div class="info-cell">生成时间<b>${report.generatedAt ? new Date(report.generatedAt).toLocaleString() : '—'}</b></div><div class="info-cell">结果状态<b>${needsReview ? '待教师复核' : '已保存'}</b></div></article><section class="report-grid"><article class="card score-card"><h3 class="card-title" style="color:var(--red)">总体得分</h3><div class="score-number">${report.overallScore != null ? report.overallScore : '—'} <small style="font-size:17px;color:#777">/100</small></div>${statusChip(report.overallScore != null ? (report.overallScore >= 80 ? '良好' : report.overallScore >= 60 ? '中等' : '需提升') : '等待复核', 'green')}<p class="muted small">${report.summary?.text || (report.recommendations?.text || '基于本次已完成评分的真实结果。')}</p></article>${report.readingScore != null ? metricCard('wave','朗读得分',report.readingScore,'基于本次朗读录音的实际评分','green') : ''}${report.writtenScore != null ? metricCard('book','书面得分',report.writtenScore,'基于已完成评分的书面作答','green') : ''}</section>${report.recommendations ? `<section class="report-bottom"><article class="card"><h2 class="card-title">推荐练习</h2>${Array.isArray(report.recommendations) ? report.recommendations.map(r => `<div class="recommend-item"><div><strong>${typeof r === 'string' ? r : (r.title || r.text || JSON.stringify(r))}</strong><p class="muted small">基于本次报告的个性化建议</p></div></div>`).join('') : `<p class="muted">${typeof report.recommendations === 'string' ? report.recommendations : JSON.stringify(report.recommendations)}</p>`}</article></section>` : ''}<section class="report-bottom"><article class="card"><h2 class="card-title">练习档案</h2><p class="muted">录音、报告与历史记录已按本次练习保存。</p><div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn" href="${routes.recordings}">${icon('wave')} 我的录音</a><a class="btn primary" href="${routes.history}">${icon('chart')} 历史记录</a></div></article></section></main>`;
    return shell(content);
  }
  function metricCard(ic,title,value,detail,color='green'){return `<article class="card metric-card"><div style="display:flex;gap:10px;align-items:center"><div class="icon ${color}">${icon(ic)}</div><h3>${title}</h3></div><div class="metric-value" style="color:${color==='red'?'var(--red)':'var(--green)'}">${value}<small style="font-size:14px;color:#777"> /100</small></div><div class="metric-rail"><i style="width:${value}%;background:${color==='red'?'var(--red)':'var(--green)'}"></i><b style="left:${value}%;background:${color==='red'?'var(--red)':'var(--green)'}"></b></div><p class="muted small">${detail}</p></article>`}

  function renderRecordings(){
    if (!apiEnabled && !demoMode) return renderApiDisabled('录音库需要登录后端服务。');
    if (appState._loadingRecordings) return renderLoading('正在加载我的录音…');
    if (appState._recordingsError) return renderError('加载录音失败', { detail: appState._recordingsError, retry: true });
    const recordings = appState.apiRecordings || [];
    return shell(`<main class="page"><div class="hero-landscape" style="height:220px"></div><section class="hero-head" style="min-height:130px"><h1 class="page-title">我的录音</h1><p class="page-subtitle">这里保存你本人完成的练习录音和真实处理状态。</p></section><section class="history-layout"><div>${recordings.length ? `<article class="card record-list"><div class="section-title"><h2>已保存录音</h2>${statusChip(`${recordings.length} 段`,'gray')}</div>${recordings.map((recording,index)=>`<div class="record-row"><button class="play-circle" data-play-recording="${recording.recordingId}">${icon('play')}</button><div><strong>${recording.label || `练习录音 ${index + 1}`}</strong><p class="muted small">${recording.createdAt ? new Date(recording.createdAt).toLocaleString() : ''}${recording.durationMs ? ` · ${Math.ceil(recording.durationMs / 1000)} 秒` : ''}</p></div><div><small>同步状态</small><b>${recording.recordingStatus}</b></div><div>${statusChip(recording.speechStatus === 'FAILED' ? '评分服务不可用' : (recording.speechStatus || '已保存'), recording.speechStatus === 'FAILED' ? 'red' : 'green')}</div></div>`).join('')}</article>` : `<article class="card" style="padding:40px;text-align:center"><div class="icon" style="margin:0 auto 16px;width:56px;height:56px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#eef0ec">${icon('info')}</div><h2>还没有保存的录音</h2><p class="muted">完成需要录音的练习后，录音会自动出现在这里。</p><a class="btn primary" href="${routes.center}">${icon('arrow')} 前往练习中心</a></article>`}</div><aside class="history-side"><article class="card retest"><h2 class="card-title">练习档案</h2><p class="muted">只显示当前登录学生在当前学校的录音。</p><a class="btn" href="${routes.history}" style="margin-top:12px">${icon('chart')} 查看历史记录</a></article></aside></section></main>`);
  }

  function renderHistory(){
    if (!apiEnabled && !demoMode) return renderApiDisabled('历史测评需要登录后端服务。');
    if (appState._loadingHistory) return renderLoading('正在加载历史测评…');
    if (appState._historyError) return renderError('加载历史失败', { detail: appState._historyError, retry: true });

    const history = appState.apiHistory || { sessions: [], totalSessions: 0 };
    const sessions = history.sessions || [];

    const content=`<main class="page"><div class="hero-landscape" style="height:220px"></div><section class="hero-head" style="min-height:130px"><h1 class="page-title">历史测评</h1><p class="page-subtitle">回顾成长轨迹，发现进步亮点，持续精进表达能力</p></section><section class="history-layout"><div><div class="history-summary"><article class="card"><div class="icon red">${icon('assessment')}</div><small>总测评次数</small><b style="display:block;font-size:32px">${history.totalSessions || sessions.length}</b><span class="muted small">${sessions.length > 0 ? `最近一次：${new Date(sessions[0].completedAt).toLocaleDateString()}` : '暂无记录'}</span></article><article class="card"><div class="icon">${icon('refresh')}</div><small>最近一次成绩</small><b style="display:block;font-size:32px">${sessions[0]?.metrics?.overall ?? '—'}</b><span class="muted small">${sessions[0]?.completedAt ? new Date(sessions[0].completedAt).toLocaleDateString() : ''}</span></article></div>${sessions.length === 0 ? `<article class="card" style="padding:40px;text-align:center"><div class="icon" style="margin:0 auto 16px;width:48px;height:48px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#eef0ec">${icon('info')}</div><p class="muted">暂无已完成的测评。完成测评后这里会显示历史记录与成长趋势。</p></article>` : `<article class="card table-card history-list"><div class="card-pad"><h2 class="card-title">测评历史记录</h2></div><table class="data-table"><thead><tr><th>完成日期</th><th>测评类型</th><th>朗读分</th><th>书面分</th><th>总分</th><th>操作</th></tr></thead><tbody>${sessions.map(s => `<tr><td>${s.completedAt ? new Date(s.completedAt).toLocaleDateString() : '—'}</td><td><b>${s.type === 'READING' ? '朗读测评' : s.type === 'WRITTEN' ? '书面测评' : '综合测评'}</b></td><td>${s.metrics?.reading ?? '—'}</td><td>${s.metrics?.written ?? '—'}</td><td><b>${s.metrics?.overall ?? '—'}</b></td><td><a class="btn ghost" href="${isPracticeRoute ? `/student/practices/attempts/${s.sessionId}/report/` : `${base}/sessions/${s.sessionId}/report/`}">查看报告</a></td></tr>`).join('')}</tbody></table></article>`}</div><aside class="history-side"><article class="card retest"><div class="section-title"><h2>安排复测</h2><div class="icon">${icon('calendar')}</div></div><p class="muted">复测由教师在学校端发起，学生端仅可查看安排结果。</p><p class="muted small">如需复测，请联系教师。</p></article></aside></section></main>`;
    return shell(content);
  }

  function bindCommon(){
    document.querySelectorAll('[data-play-mini], .play-circle').forEach(btn=>btn.addEventListener('click',()=>{
      btn.classList.toggle('is-playing');
      btn.innerHTML = btn.classList.contains('is-playing') ? icon('pause') : icon('play');
    }));
  }

  // ── 设备检测：使用真实 getUserMedia + 后端 DeviceCheckLog ──
  async function bindPrep(){
    const recheck=document.querySelector('[data-recheck]'); const start=document.querySelector('[data-start-session]'); const label=document.querySelector('[data-ready-label]');
    let checking = appState._deviceCheckStatus?.checking || false;

    async function runDeviceCheck() {
      if(checking) return;
      checking = true;
      if(start) start.disabled = true;
      if(label) label.textContent = '检测中';
      const rows=[...document.querySelectorAll('.device-row')];

      // 浏览器环境
      const browserRow = rows.find(r => r.dataset.device === '浏览器环境');
      if (browserRow) {
        browserRow.querySelector('small').textContent = navigator.userAgent.includes('Chrome') ? 'Chrome / Chromium 环境正常' : '当前浏览器环境';
        browserRow.querySelector('.device-status').classList.remove('pending');
        browserRow.querySelector('.device-status').innerHTML = `正常 ${icon('check')}`;
      }

      // 麦克风：真实 getUserMedia
      const micRow = rows.find(r => r.dataset.device === '麦克风输入');
      let micOk = false;
      if (micRow) {
        if (navigator.mediaDevices?.getUserMedia) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop());
            micOk = true;
            micRow.querySelector('small').textContent = '已检测到麦克风输入';
            micRow.querySelector('.device-status').classList.remove('pending');
            micRow.querySelector('.device-status').innerHTML = `正常 ${icon('check')}`;
          } catch (err) {
            micRow.querySelector('small').textContent = `麦克风不可用：${err.name || err.message}`;
            micRow.querySelector('.device-status').classList.remove('pending');
            micRow.querySelector('.device-status').innerHTML = `失败 ${icon('alert')}`;
          }
        } else {
          micRow.querySelector('small').textContent = '浏览器不支持 getUserMedia';
          micRow.querySelector('.device-status').classList.remove('pending');
          micRow.querySelector('.device-status').innerHTML = `不支持 ${icon('alert')}`;
        }
      }

      // 扬声器：仅检查 AudioContext 是否可用
      const speakerRow = rows.find(r => r.dataset.device === '扬声器播放');
      if (speakerRow) {
        const hasAudio = typeof Audio !== 'undefined' || typeof AudioContext !== 'undefined';
        speakerRow.querySelector('small').textContent = hasAudio ? '扬声器输出可用' : '浏览器不支持音频播放';
        speakerRow.querySelector('.device-status').classList.remove('pending');
        speakerRow.querySelector('.device-status').innerHTML = `${hasAudio ? '正常' : '不支持'} ${hasAudio ? icon('check') : icon('alert')}`;
      }

      // 网络：真实 fetch 探测
      const wifiRow = rows.find(r => r.dataset.device === '网络状态');
      if (wifiRow) {
        try {
          const t0 = performance.now();
          await fetch('/api/v1/health/ready', { method: 'GET', cache: 'no-store' }).catch(() => {});
          const latency = Math.round(performance.now() - t0);
          wifiRow.querySelector('small').textContent = `延迟 ${latency} ms`;
          wifiRow.querySelector('.device-status').classList.remove('pending');
          wifiRow.querySelector('.device-status').innerHTML = `正常 ${icon('check')}`;
        } catch {
          wifiRow.querySelector('small').textContent = '网络不可用';
          wifiRow.querySelector('.device-status').classList.remove('pending');
          wifiRow.querySelector('.device-status').innerHTML = `失败 ${icon('alert')}`;
        }
      }

      // 写入后端 DeviceCheckLog
      if (apiEnabled && Api.logAssessmentDeviceCheck) {
        try {
          await Api.logAssessmentDeviceCheck({
            checkResult: {
              browser: 'ok',
              microphone: micOk ? 'ok' : 'failed',
              speaker: 'ok',
              network: 'ok',
              timestamp: new Date().toISOString()
            },
            userAgent: navigator.userAgent
          });
        } catch (err) {
          console.warn('[assessment] DeviceCheckLog 写入失败:', err);
        }
      }

      checking = false;
      const allOk = micOk;
      if(label) label.textContent = allOk ? '已就绪' : '设备检测未通过';
      if(start) start.disabled = !allOk || (appState.apiSession && appState.apiSession.status === 'CANCELLED');
    }

    recheck?.addEventListener('click', runDeviceCheck);

    start?.addEventListener('click', async () => {
      if (!apiEnabled) return;
      start.disabled = true;
      start.innerHTML = `${icon('spinner')} 正在启动…`;
      try {
        // 如果 session 还是 CREATED，调用 startAssessmentSession 转为 IN_PROGRESS
        if (appState.apiSession?.status === 'CREATED') {
          await Api.startAssessmentSession(SESSION_ID);
        }
        // 依照 Attempt 的真实快照顺序继续；绝不回到准备页让学生选题。
        const items = appState.apiItems && appState.apiItems.length ? appState.apiItems : (isPracticeAttempt ? await Api.getPracticeAttemptItems(SESSION_ID) : await Api.listAssessmentItems(SESSION_ID));
        appState.apiItems = Array.isArray(items) ? items : (items?.items || []);
        saveState();
        location.href = firstPendingRoute(appState.apiItems);
      } catch (err) {
        console.error('[assessment] 启动测评失败:', err);
        start.disabled = false;
        start.innerHTML = `开始本次测评 ${icon('arrow')}`;
        alert(`启动测评失败：${err.message || err}`);
      }
    });

    // 自动运行设备检测
    runDeviceCheck();
  }

  let recordInterval=null, waveAnim=null;
  function bindReading(){
    const currentItem = appState.apiReadingItem;
    if (isListeningItem(currentItem)) {
      const completeListening = () => {
        appState.completedListenItems[READING_ITEM_ID] = true;
        saveState();
        location.href = nextExecutionRoute(READING_ITEM_ID);
      };
      document.querySelector('[data-listen-complete]')?.addEventListener('click', completeListening);
      document.querySelector('[data-listen-play]')?.addEventListener('click', async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        button.innerHTML = icon('pause');
        const note = document.querySelector('[data-listen-note]');
        const audioUrl = currentItem?.demoAudioUrl;
        if (audioUrl) {
          try {
            const audio = new Audio(audioUrl);
            audio.onended = completeListening;
            await audio.play();
            return;
          } catch (error) {
            console.warn('[assessment] 听读音频播放失败:', error);
          }
        }
        if (note) note.textContent = '示范音频暂不可播放，请确认已听读后继续。';
        button.disabled = false;
        button.innerHTML = icon('play');
      });
      return;
    }
    drawWave();
    const setState=(s)=>{appState.currentReadingState=s;saveState();renderCurrent();};

    document.querySelectorAll('[data-prompt-play]').forEach(btn=>btn.addEventListener('click',async()=>{
      if(appState.promptPlayCount>=2){alert('示范音频本题最多播放 2 次。');return;}
      appState.promptPlayCount+=1; saveState();
      const note=document.querySelector('[data-record-note]'); if(note)note.textContent='正在播放示范音频，录音入口已锁定。';
      btn.disabled=true; btn.innerHTML=`${icon('pause')} 正在播放示范音频`;
      // 如果有真实示范音频，播放它；否则等待 2.6 秒后进入准备
      const item = appState.apiReadingItem;
      if (item?.demoAudioUrl) {
        try {
          const audio = new Audio(item.demoAudioUrl);
          audio.onended = () => { appState.currentReadingState='PREPARING';saveState();renderCurrent(); };
          await audio.play();
          return;
        } catch (err) {
          console.warn('[assessment] 示范音频播放失败，使用计时器:', err);
        }
      }
      // 没有真实示范音频，用固定时长占位（不假装播放真实音频，只是给学生准备时间）
      setTimeout(()=>{appState.currentReadingState='PREPARING';saveState();renderCurrent();},2600);
    }));

    document.querySelector('[data-skip-prompt]')?.addEventListener('click',()=>{
      appState.currentReadingState='PREPARING';saveState();renderCurrent();
    });

    document.querySelector('[data-pause]')?.addEventListener('click',()=>{clearInterval(recordInterval);RecorderManager.pause();setState('PAUSED')});
    document.querySelector('[data-resume]')?.addEventListener('click',()=>{RecorderManager.resume();setState('RECORDING')});
    document.querySelector('[data-stop]')?.addEventListener('click',async()=>{
      clearInterval(recordInterval);
      await RecorderManager.stop();
      // 真实录音时长由 MediaRecorder 决定，不再硬编码 18 秒
      setState('REVIEWING');
    });
    document.querySelector('[data-rerecord]')?.addEventListener('click',async()=>{
      appState.readingElapsed=0;appState.uploadProgress=0;appState._recordingBlob=null;
      if(appState._recordingUrl){URL.revokeObjectURL(appState._recordingUrl);appState._recordingUrl=null;}
      appState._uploadError=null;
      // 重置录音器
      RecorderManager.release();
      setState('PREPARING');
    });
    document.querySelector('[data-play-recording]')?.addEventListener('click',e=>{
      if(appState._recordingUrl){
        const audio = new Audio(appState._recordingUrl);
        audio.play();
        e.currentTarget.innerHTML=`${icon('pause')} 正在回听`;
        audio.addEventListener('ended',()=>e.currentTarget.innerHTML=`${icon('play')} 播放录音`);
      }else{
        // 没有真实录音可播放
        e.currentTarget.innerHTML=`${icon('alert')} 无录音可播放`;
        setTimeout(()=>e.currentTarget.innerHTML=`${icon('play')} 播放录音`,1500);
      }
    });
    document.querySelector('[data-upload]')?.addEventListener('click',()=>startRealUpload());
    document.querySelector('[data-continue-next]')?.addEventListener('click',()=>{
      location.href = nextExecutionRoute(READING_ITEM_ID);
    });
    if(appState.currentReadingState==='PREPARING')startCountdown();
    if(appState.currentReadingState==='RECORDING')startRecordingTimer();
  }
  function startCountdown(){
    let n=3; const el=document.querySelector('[data-countdown]'); if(!el)return; el.textContent=n;
    const timer=setInterval(async()=>{
      n--;
      if(n<=0){
        clearInterval(timer);
        appState.currentReadingState='RECORDING';saveState();renderCurrent();
        // 启动真实录音
        const granted = await RecorderManager.requestPermission();
        if(!granted){
          alert('麦克风权限被拒绝，无法开始录音。请允许麦克风权限后重试。');
          appState.currentReadingState='PLAYING_PROMPT';saveState();renderCurrent();
          return;
        }
        RecorderManager.start();
        startRecordingTimer();
      }else el.textContent=n;
    },900);
  }
  function startRecordingTimer(){
    clearInterval(recordInterval);
    recordInterval=setInterval(()=>{
      appState.readingElapsed=Math.min(300,(appState.readingElapsed||0)+1);
      saveState();
      document.querySelectorAll('[data-elapsed],[data-main-timer],[data-effective]').forEach(el=>el.textContent=formatTime(appState.readingElapsed));
    },1000);
  }

  // ── 真实上传：Blob → 预签名 PUT → completeRecording → attachAssessmentRecording → 查询 SpeechJob ──
  async function startRealUpload(){
    if (!apiEnabled) { alert('未登录后端，无法上传。'); return; }
    if (!appState._recordingBlob) { alert('没有可上传的录音。请先录制。'); return; }

    const uploadBtn = document.querySelector('[data-upload]');
    if (uploadBtn) { uploadBtn.disabled = true; uploadBtn.innerHTML = `${icon('spinner')} 初始化录音…`; }

    appState.currentReadingState='UPLOADING';appState.uploadProgress=0;appState._uploadError=null;saveState();renderCurrent();

    try {
      // 1. 获取 enrollmentId
      const session = appState.apiSession;
      if (!session?.enrollmentId) throw new Error('Session 缺少 enrollmentId');
      const enrollmentId = session.enrollmentId;

      // 2. 初始化简单录音
      const initResp = await Api.initSimpleRecording({
        enrollmentId,
        mimeType: appState._recordingBlob.type || 'audio/webm',
        idempotencyKey: `assessment-${SESSION_ID}-${READING_ITEM_ID}`
      });
      const recordingId = initResp.id;
      const uploadUrl = initResp.uploadUrl?.url;
      const objectKey = initResp.uploadUrl?.objectKey;
      if (!uploadUrl) throw new Error('后端未返回预签名上传 URL');
      appState.apiRecordingId = recordingId;
      saveState();

      // 3. 真实 XHR 上传 Blob 到预签名 URL
      const uploadBtn2 = document.querySelector('[data-reading-actions] button');
      await Api.uploadBlobToPresignedUrl(uploadUrl, appState._recordingBlob, {
        mimeType: appState._recordingBlob.type || 'audio/webm',
        onProgress: (pct) => {
          appState.uploadProgress = pct;
          saveState();
          const btn = document.querySelector('[data-reading-actions] button');
          if (btn) btn.textContent = `上传中 ${pct}%`;
        }
      });

      // 4. completeRecording，传入 assessmentItemId 与 targetText 触发 SpeechJob
      appState.uploadProgress = 100;
      saveState();
      const item = appState.apiReadingItem;
      let targetText = '';
      if (item?.prompt?.text) targetText = item.prompt.text;
      else if (item?.prompt?.sentence) targetText = item.prompt.sentence;
      else if (typeof item?.prompt === 'string') targetText = item.prompt;

      const completeResp = await Api.completeSimpleRecording(recordingId, {
        durationMs: appState.readingElapsed * 1000,
        objectKey,
        assessmentItemId: READING_ITEM_ID,
        targetText
      });

      // 5. 绑定录音到 AssessmentItem（如果 completeRecording 没有自动绑定）
      await Api.attachAssessmentRecording(SESSION_ID, READING_ITEM_ID, recordingId);

      // 6. 查询 SpeechJob 状态
      if (completeResp?.speechJobId || completeResp?.speechJob?.id) {
        const jobId = completeResp.speechJobId || completeResp.speechJob.id;
        appState.apiSpeechJobId = jobId;
        saveState();
        // 轮询 SpeechJob
        pollSpeechJob(jobId);
      } else {
        // completeRecording 可能不会自动创建 SpeechJob，尝试通过 by-item 查询
        try {
          const jobs = await Api.getSpeechJobByItem(READING_ITEM_ID);
          const latestJob = Array.isArray(jobs) ? jobs[jobs.length - 1] : jobs;
          if (latestJob?.id) {
            appState.apiSpeechJobId = latestJob.id;
            saveState();
            pollSpeechJob(latestJob.id);
          }
        } catch (err) {
          console.warn('[assessment] 查询 SpeechJob 失败:', err);
        }
      }

      appState.currentReadingState = 'UPLOADED';
      saveState();
      renderCurrent();
      // 上传与题目绑定都已成功后，连续进入 Attempt 快照中的下一题。
      window.setTimeout(() => { location.href = nextExecutionRoute(READING_ITEM_ID); }, 450);
    } catch (err) {
      console.error('[assessment] 真实上传失败:', err);
      appState.uploadProgress = 0;
      appState.currentReadingState = 'UPLOAD_FAILED';
      appState._uploadError = err.message || String(err);
      saveState();
      renderCurrent();
    }
  }

  // ── SpeechJob 轮询：真实状态，禁止定时器自动切换 ──
  let speechJobPollTimer = null;
  function pollSpeechJob(jobId) {
    if (speechJobPollTimer) clearInterval(speechJobPollTimer);
    const poll = async () => {
      try {
        const job = await Api.getSpeechJob(jobId);
        appState.apiSpeechJob = job;
        saveState();
        // 如果当前在处理页，重新渲染
        const page = document.body.dataset.page;
        if (page === 'processing') renderCurrent();
        // 终态停止轮询
        if (['FINALIZED', 'FAILED'].includes(job.status)) {
          if (speechJobPollTimer) { clearInterval(speechJobPollTimer); speechJobPollTimer = null; }
        }
      } catch (err) {
        console.warn('[assessment] SpeechJob 轮询失败:', err);
      }
    };
    poll();
    speechJobPollTimer = setInterval(poll, 5000);
  }

  // ── MediaRecorder 真实录音管理器 ──
  const RecorderManager = {
    stream: null, mediaRecorder: null, chunks: [], isRecording: false,
    async requestPermission(){
      if(!navigator.mediaDevices?.getUserMedia) return false;
      try{
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return true;
      } catch(e){
        console.warn('[assessment] 麦克风权限被拒绝:', e);
        return false;
      }
    },
    start(){
      if(!this.stream || this.isRecording) return;
      this.chunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      this.mediaRecorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
      this.mediaRecorder.ondataavailable = (e) => { if(e.data.size > 0) this.chunks.push(e.data); };
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: mimeType || 'audio/webm' });
        appState._recordingBlob = blob;
        appState._recordingUrl = URL.createObjectURL(blob);
        // 不持久化 Blob，但保存时长
        saveState();
      };
      this.mediaRecorder.start(1000);
      this.isRecording = true;
    },
    async stop(){
      if(this.mediaRecorder && this.isRecording){
        return new Promise((resolve) => {
          this.mediaRecorder.onstop = () => {
            const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType || 'audio/webm' });
            appState._recordingBlob = blob;
            appState._recordingUrl = URL.createObjectURL(blob);
            // 实际录音时长 = chunks 时间，但 readingElapsed 是显示计时
            saveState();
            this.isRecording = false;
            resolve();
          };
          this.mediaRecorder.stop();
        });
      }
    },
    pause(){ if(this.mediaRecorder && this.isRecording && this.mediaRecorder.state === 'recording') this.mediaRecorder.pause(); },
    resume(){ if(this.mediaRecorder && this.mediaRecorder.state === 'paused') this.mediaRecorder.resume(); },
    release(){ if(this.stream){ this.stream.getTracks().forEach(t => t.stop()); this.stream = null; } }
  };
  function drawWave(){
    const canvas=document.querySelector('[data-wave]'); if(!canvas)return; const ctx=canvas.getContext('2d');
    const resize=()=>{const dpr=Math.min(devicePixelRatio||1,2);canvas.width=canvas.clientWidth*dpr;canvas.height=canvas.clientHeight*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)};resize();
    let t=0; const frame=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);ctx.lineWidth=1.5;for(let layer=0;layer<9;layer++){ctx.beginPath();for(let x=0;x<w;x+=3){const amp=12+layer*2+Math.sin((x+t)/50)*6;const y=h/2+Math.sin(x/18+t/12+layer*.55)*amp*(.35+layer/11);if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}const p=layer/8;ctx.strokeStyle=p<.32?`rgba(205,53,38,${.55-p*.2})`:p<.65?`rgba(218,155,37,${.55-p*.15})`:`rgba(66,132,91,${.56-p*.15})`;ctx.stroke();}t+=1.2;waveAnim=requestAnimationFrame(frame)};frame();
    window.addEventListener('resize',resize,{once:true});
  }

  // ── 书面题：真实保存与定稿 ──
  function bindWritten(){
    const currentItem = (appState.apiWrittenItems || []).find(i => i.id === WRITTEN_ITEM_ID);
    if (!currentItem) return;

    // 单选
    document.querySelectorAll('input[name="answer"]').forEach(input=>input.addEventListener('change',()=>{
      appState.writtenAnswers[currentItem.id] = Number(input.value);
      appState.writtenSyncStatus[currentItem.id] = 'LOCAL';
      saveState();
      renderCurrent();
    }));
    // 文本作答
    const textarea = document.querySelector('[data-written-textarea]');
    if (textarea) {
      textarea.addEventListener('input', () => {
        appState.writtenAnswers[currentItem.id] = textarea.value;
        appState.writtenSyncStatus[currentItem.id] = 'LOCAL';
        // 不重新渲染，避免输入光标丢失
      });
      textarea.addEventListener('blur', saveState);
    }

    document.querySelector('[data-written-prev]')?.addEventListener('click',async()=>{
      const items = orderedItems();
      const idx = items.findIndex(i => i.id === WRITTEN_ITEM_ID);
      if (idx > 0) location.href = executionRoute(items[idx - 1]);
    });
    document.querySelector('[data-written-next]')?.addEventListener('click',async()=>{
      const btn = document.querySelector('[data-written-next]');
      if (btn) { btn.disabled = true; btn.innerHTML = `${icon('spinner')} 同步中…`; }
      try {
        await finalizeCurrentWrittenAnswer(currentItem);
        location.href = nextExecutionRoute(WRITTEN_ITEM_ID);
      } catch (err) {
        console.error('[assessment] 保存书面题失败:', err);
        if (btn) { btn.disabled = false; btn.innerHTML = `保存并下一题 ${icon('arrow')}`; }
        alert(`保存失败：${err.message || err}`);
      }
    });
    document.querySelector('[data-written-save]')?.addEventListener('click', async () => {
      const btn = document.querySelector('[data-written-save]');
      if (btn) { btn.disabled = true; btn.innerHTML = `${icon('spinner')} 同步中…`; }
      try {
        await saveCurrentWrittenAnswer(currentItem);
        if (btn) { btn.disabled = false; btn.innerHTML = `${icon('save')} 保存到平台`; }
      } catch (err) {
        console.error('[assessment] 保存书面题失败:', err);
        if (btn) { btn.disabled = false; btn.innerHTML = `${icon('save')} 保存到平台`; }
        alert(`保存失败：${err.message || err}`);
      }
    });
    document.querySelectorAll('[data-jump-item]').forEach(b=>b.addEventListener('click',()=>{
      const itemId = b.dataset.jumpItem;
      const item = orderedItems().find((candidate) => candidate.id === itemId);
      if (item) location.href = executionRoute(item);
    }));
  }

  async function saveCurrentWrittenAnswer(item) {
    if (!apiEnabled) return;
    const answer = appState.writtenAnswers[item.id];
    if (answer === undefined || (typeof answer === 'string' && !answer.trim())) throw new Error('请先完成本题作答');
    // 构造 content payload
    const content = typeof answer === 'number'
      ? { optionIndex: answer, optionLabel: String.fromCharCode(65 + answer) }
      : { text: String(answer) };
    const wordCount = typeof answer === 'string' ? answer.trim().split(/\s+/).filter(Boolean).length : 1;
    const charCount = typeof answer === 'string' ? answer.length : 1;
    await Api.saveWrittenAnswer(SESSION_ID, item.id, { content, wordCount, charCount });
    appState.writtenSyncStatus[item.id] = 'SYNCED';
    saveState();
  }

  async function finalizeCurrentWrittenAnswer(item) {
    await saveCurrentWrittenAnswer(item);
    await Api.finalizeWrittenAnswer(SESSION_ID, item.id);
    appState.writtenSyncStatus[item.id] = 'FINALIZED';
    saveState();
  }

  function bindSubmit(){
    document.querySelector('[data-retry-course-sync]')?.addEventListener('click', async () => {
      const btn = document.querySelector('[data-retry-course-sync]');
      if (btn) { btn.disabled = true; btn.innerHTML = `${icon('spinner')} 同步中…`; }
      try {
        await Api.retryCoursePracticeCompletion(SESSION_ID);
      } catch (err) {
        console.error('[assessment] 课程进度同步失败:', err);
        if (btn) { btn.disabled = false; btn.innerHTML = `重试同步课程进度 ${icon('refresh')}`; }
        alert(err?.message || '课程进度仍未同步，请稍后重试。');
      }
    });
    document.querySelector('[data-submit-session]')?.addEventListener('click',async()=>{
      const btn = document.querySelector('[data-submit-session]');
      if (btn) { btn.disabled = true; btn.innerHTML = `${icon('spinner')} 提交中…`; }
      try {
        // 先把所有未定稿的书面题定稿
        const items = appState.apiItems || [];
        const writtenItems = items.filter(isWrittenItem);
        for (const it of writtenItems) {
          if (appState.writtenAnswers[it.id] !== undefined && appState.writtenSyncStatus[it.id] !== 'FINALIZED') {
            // 确保已同步
            if (appState.writtenSyncStatus[it.id] !== 'SYNCED') {
              await saveCurrentWrittenAnswer(it);
            }
            await Api.finalizeWrittenAnswer(SESSION_ID, it.id);
            appState.writtenSyncStatus[it.id] = 'FINALIZED';
          }
        }
        saveState();
        // 调用真实 submitAssessmentSession
        const submitResult = await Api.submitAssessmentSession(SESSION_ID);
        if (submitResult?.courseSync?.linked) return;
        // 提交成功后才跳转
        location.href = routes.processing;
      } catch (err) {
        console.error('[assessment] 提交测评失败:', err);
        if (btn) { btn.disabled = false; btn.innerHTML = `提交整次测评 ${icon('arrow')}`; }
        if (err?.code === 'COURSE_PROGRESS_SYNC_PENDING') {
          alert(err.message);
          await loadSubmitData();
        } else {
          alert(`提交失败：${err.message || err}。请稍后重试。`);
        }
      }
    });
  }

  function bindReport(){
    document.querySelector('[data-schedule-retest]')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (btn.disabled) return;
      btn.disabled = true;
      btn.innerHTML = `${icon('spinner')} 安排中…`;
      try {
        await Api.scheduleRetest(SESSION_ID);
        alert('复测已安排。新测评 Session 已创建，请前往测评中心查看。');
        location.href = routes.center;
      } catch (err) {
        console.error('[assessment] 安排复测失败:', err);
        btn.disabled = false;
        btn.innerHTML = `${icon('calendar')} 安排复测`;
        alert(`安排复测失败：${err.message || err}`);
      }
    });
    document.querySelector('[data-retry]')?.addEventListener('click', () => {
      loadReport();
    });
  }

  function bindHistory(){}

  function bindRecordings(){
    document.querySelector('[data-retry]')?.addEventListener('click', loadRecordings);
    document.querySelectorAll('[data-play-recording]').forEach((button) => button.addEventListener('click', async () => {
      if (button.dataset.loading === 'true') return;
      button.dataset.loading = 'true';
      button.innerHTML = icon('spinner');
      try {
        const evidence = await Api.getRecordingEvidence(button.dataset.playRecording);
        const player = new Audio(evidence.downloadUrl);
        await player.play();
        button.innerHTML = icon('pause');
        player.addEventListener('ended', () => { button.innerHTML = icon('play'); button.dataset.loading = ''; }, { once: true });
      } catch (err) {
        button.innerHTML = icon('play');
        button.dataset.loading = '';
        alert(`暂时无法播放录音：${err.message || err}`);
      }
    }));
  }

  // ── 后端数据加载 ──
  async function loadCenter() {
    if (!apiEnabled) return;
    appState._loadingCenter = true;
    renderCurrent();
    try {
      const result = await Api.listAssessmentSessions({ limit: 20 });
      appState._centerSessions = result.items || result || [];
      appState._centerError = null;
    } catch (err) {
      console.error('[assessment] 加载测评列表失败:', err);
      appState._centerError = err.message || String(err);
    } finally {
      appState._loadingCenter = false;
      saveState();
      renderCurrent();
    }
  }

  async function loadSessionDetail() {
    if (!apiEnabled || !SESSION_ID) return;
    appState._loadingPrep = true;
    renderCurrent();
    try {
      const [session, items, writtenItems] = await Promise.all([
        (isPracticeAttempt ? Api.getPracticeAttempt(SESSION_ID) : Api.getAssessmentSession(SESSION_ID)),
        (isPracticeAttempt ? Api.getPracticeAttemptItems(SESSION_ID) : Api.listAssessmentItems(SESSION_ID)).catch(err => {
          console.warn('[assessment] 加载 items 失败:', err);
          return [];
        }),
        Api.getWrittenItems(SESSION_ID).catch(() => [])
      ]);
      appState.apiSession = session;
      appState.apiItems = Array.isArray(items) ? items : (items?.items || []);
      hydrateWrittenAnswers(Array.isArray(writtenItems) ? writtenItems : (writtenItems?.items || []));
      appState._prepError = null;
    } catch (err) {
      console.error('[assessment] 加载 session 详情失败:', err);
      appState._prepError = err.message || String(err);
    } finally {
      appState._loadingPrep = false;
      saveState();
      renderCurrent();
    }
  }

  async function loadReadingItem() {
    if (!apiEnabled || !SESSION_ID || !READING_ITEM_ID) return;
    appState._loadingReading = true;
    renderCurrent();
    try {
      // 并行加载 session 详情、items、当前 reading item
      const [session, items, readingItem] = await Promise.all([
        Api.getAssessmentSession(SESSION_ID).catch(() => appState.apiSession),
        appState.apiItems.length ? Promise.resolve(appState.apiItems) : (isPracticeAttempt ? Api.getPracticeAttemptItems(SESSION_ID) : Api.listAssessmentItems(SESSION_ID)).catch(() => []),
        Api.getReadingItem(SESSION_ID, READING_ITEM_ID)
      ]);
      appState.apiSession = session;
      appState.apiItems = Array.isArray(items) ? items : (items?.items || []);
      appState.apiReadingItem = readingItem;
      if (appState._activeReadingItemId !== READING_ITEM_ID) {
        appState._activeReadingItemId = READING_ITEM_ID;
        appState.currentReadingState = readingItem?.recordingId ? 'UPLOADED' : 'PLAYING_PROMPT';
        appState.readingElapsed = 0;
        appState.promptPlayCount = 0;
        appState.uploadProgress = 0;
        appState._uploadError = null;
      }
      appState._readingError = null;
      // 如果该 item 已有 recordingId，恢复状态
      if (readingItem?.recordingId && !appState.apiRecordingId) {
        appState.apiRecordingId = readingItem.recordingId;
        if (appState.currentReadingState === 'PLAYING_PROMPT') {
          appState.currentReadingState = 'UPLOADED';
        }
      }
    } catch (err) {
      console.error('[assessment] 加载朗读题失败:', err);
      appState._readingError = err.message || String(err);
    } finally {
      appState._loadingReading = false;
      saveState();
      renderCurrent();
    }
  }

  async function loadWrittenItems() {
    if (!apiEnabled || !SESSION_ID) return;
    appState._loadingWritten = true;
    renderCurrent();
    try {
      const [session, allItems, items] = await Promise.all([
        Api.getAssessmentSession(SESSION_ID).catch(() => appState.apiSession),
        isPracticeAttempt ? Api.getPracticeAttemptItems(SESSION_ID) : Api.listAssessmentItems(SESSION_ID),
        Api.getWrittenItems(SESSION_ID)
      ]);
      appState.apiSession = session;
      const writtenItems = Array.isArray(items) ? items : (items?.items || []);
      appState.apiWrittenItems = writtenItems;
      appState.apiItems = Array.isArray(allItems) ? allItems : (allItems?.items || []);
      hydrateWrittenAnswers(writtenItems);
      appState._writtenError = null;
    } catch (err) {
      console.error('[assessment] 加载书面题失败:', err);
      appState._writtenError = err.message || String(err);
    } finally {
      appState._loadingWritten = false;
      saveState();
      renderCurrent();
    }
  }

  async function loadSubmitData() {
    if (!apiEnabled || !SESSION_ID) return;
    appState._loadingSubmit = true;
    renderCurrent();
    try {
      const [session, items, writtenItems] = await Promise.all([
        Api.getAssessmentSession(SESSION_ID),
        (isPracticeAttempt ? Api.getPracticeAttemptItems(SESSION_ID) : Api.listAssessmentItems(SESSION_ID)).catch(() => appState.apiItems || []),
        Api.getWrittenItems(SESSION_ID).catch(() => [])
      ]);
      appState.apiSession = session;
      appState.apiItems = Array.isArray(items) ? items : (items?.items || []);
      hydrateWrittenAnswers(Array.isArray(writtenItems) ? writtenItems : (writtenItems?.items || []));
    } catch (err) {
      console.error('[assessment] 加载提交数据失败:', err);
    } finally {
      appState._loadingSubmit = false;
      saveState();
      renderCurrent();
    }
  }

  async function loadProcessingData() {
    if (!apiEnabled || !SESSION_ID) return;
    appState._loadingProcessing = true;
    renderCurrent();
    try {
      const session = await (isPracticeAttempt ? Api.getPracticeAttempt(SESSION_ID) : Api.getAssessmentSession(SESSION_ID));
      appState.apiSession = session;
      // 加载 items 以便显示录音列表
      if (!appState.apiItems.length) {
        try {
          const items = await (isPracticeAttempt ? Api.getPracticeAttemptItems(SESSION_ID) : Api.listAssessmentItems(SESSION_ID));
          appState.apiItems = Array.isArray(items) ? items : (items?.items || []);
        } catch {}
      }
      // 每个真实口语题都可能有自己的评分任务；不能只读取旧题型的第一条任务。
      const oralItems = appState.apiItems.filter(isOralItem).filter(item => item.recordingId);
      const jobLists = await Promise.all(oralItems.map(item => Api.getSpeechJobByItem(item.id).catch(() => [])));
      appState.apiSpeechJobs = jobLists.flatMap((jobs) => Array.isArray(jobs) ? (jobs[0] ? [jobs[0]] : []) : (jobs ? [jobs] : []));
      appState.apiSpeechJob = appState.apiSpeechJobs[0] || null;
      appState.apiSpeechJobId = appState.apiSpeechJob?.id || null;
      if (appState.apiSpeechJobId && !['AUTO_RESULT', 'NEEDS_REVIEW', 'FINALIZED', 'FAILED'].includes(appState.apiSpeechJob.status)) {
        pollSpeechJob(appState.apiSpeechJobId);
      }
    } catch (err) {
      console.error('[assessment] 加载处理状态失败:', err);
    } finally {
      appState._loadingProcessing = false;
      saveState();
      renderCurrent();
    }
  }

  async function loadReport() {
    if (!apiEnabled || !SESSION_ID) return;
    appState._loadingReport = true;
    appState._reportError = null;
    renderCurrent();
    try {
      const [session, report] = await Promise.all([
        Api.getAssessmentSession(SESSION_ID),
        Api.getAssessmentReport(SESSION_ID)
      ]);
      appState.apiSession = session;
      appState.apiReport = report;
    } catch (err) {
      console.error('[assessment] 加载报告失败:', err);
      appState._reportError = err.message || String(err);
    } finally {
      appState._loadingReport = false;
      saveState();
      renderCurrent();
    }
  }

  async function loadHistory() {
    if (!apiEnabled) return;
    appState._loadingHistory = true;
    renderCurrent();
    try {
      const history = await Api.getAssessmentHistory({ range: 'all' });
      appState.apiHistory = history;
    } catch (err) {
      console.error('[assessment] 加载历史失败:', err);
      appState._historyError = err.message || String(err);
    } finally {
      appState._loadingHistory = false;
      saveState();
      renderCurrent();
    }
  }

  async function loadRecordings() {
    if (!apiEnabled) return;
    appState._loadingRecordings = true;
    appState._recordingsError = null;
    renderCurrent();
    try {
      appState.apiRecordings = await Api.listMyAssessmentRecordings();
    } catch (err) {
      console.error('[assessment] 加载我的录音失败:', err);
      appState._recordingsError = err.message || String(err);
    } finally {
      appState._loadingRecordings = false;
      saveState();
      renderCurrent();
    }
  }

  const renderers={
    center:renderCenter,
    prep:renderPrep,
    reading:renderReading,
    written:renderWritten,
    submit:renderSubmit,
    processing:renderProcessing,
    report:renderReport,
    recordings:renderRecordings,
    history:renderHistory
  };
  function renderCurrent(){
    if(waveAnim)cancelAnimationFrame(waveAnim);
    const page=document.body.dataset.page;
    if(page==='home'){location.replace(routes.center);return;}
    const renderer=renderers[page]||renderCenter;
    document.getElementById('app').innerHTML=renderer();
    bindCommon();
    ({prep:bindPrep,reading:bindReading,written:bindWritten,submit:bindSubmit,report:bindReport,recordings:bindRecordings,history:bindHistory}[page]||(()=>{}))();
  }

  // ── 入口：首次渲染 + 触发对应数据加载 ──
  renderCurrent();
  const page=document.body.dataset.page;
  if (apiEnabled) {
    if (page === 'center') loadCenter();
    else if (page === 'prep') loadSessionDetail();
    else if (page === 'reading') loadReadingItem();
    else if (page === 'written') loadWrittenItems();
    else if (page === 'submit') loadSubmitData();
    else if (page === 'processing') loadProcessingData();
    else if (page === 'report') loadReport();
    else if (page === 'recordings') loadRecordings();
    else if (page === 'history') loadHistory();
  }
})();
