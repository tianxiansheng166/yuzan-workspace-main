(() => {
  'use strict';
  if (document.body.classList.contains('student-has-nav')) return;

  const svg = (b, s = 23) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${b}</svg>`;
  const icons = {
    home: svg('<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>'),
    book: svg('<path d="M3 5a4 4 0 0 1 4-3h5v18H7a4 4 0 0 0-4 2ZM21 5a4 4 0 0 0-4-3h-5v18h5a4 4 0 0 1 4 2Z"/>'),
    wave: svg('<path d="M3 12h2l2-6 3 12 3-16 3 16 2-6h3"/>'),
    growth: svg('<path d="M12 21V9M8 13c-4 0-5-3-5-6 4 0 6 2 6 5M16 12c4 0 5-3 5-6-4 0-6 2-6 5"/>'),
    user: svg('<circle cx="12" cy="7" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    download: svg('<path d="M12 3v12m0 0 5-5m-5 5-5-5"/><path d="M4 19v2h16v-2"/>'),
    record: svg('<path d="M6 2h9l4 4v16H6Z"/><path d="M14 2v5h5M9 12h7M9 16h5"/>'),
    feedback: svg('<path d="M4 4h16v12H8l-4 4Z"/><path d="M8 9h8M8 12h5"/>'),
    mic: svg('<path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4"/>'),
    pen: svg('<path d="M12 19l7-7 3-3a2.828 2.828 0 1 0-4-4l-10 10V19h4Z"/><path d="M5 21h14"/>'),
    chart: svg('<path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 5-7"/>'),
    file: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>'),
    arrowLeft: svg('<path d="M19 12H5M12 19l-7-7 7-7"/>')
  };

  const viewer = { name: '同学', grade: '', school: '', avatar: '/assets/student-avatar.jpg' };

  // 尝试从 API 数据填充用户信息
  (async () => {
    try {
      if (typeof YuzanApi !== 'undefined' && YuzanApi.getToken()) {
        const stored = YuzanApi.getStoredUser();
        if (stored?.displayName) {
          viewer.name = stored.displayName;
          viewer.grade = stored.gradeBand || '';
          viewer.school = stored.schoolName || '';
        }
        // 尝试从 student/profile 获取更精确的数据
        const schoolId = YuzanApi.getActiveSchoolId();
        if (schoolId) {
          try {
            const data = await YuzanApi.getStudentProfile();
            const p = data.profile || data;
            if (p.displayName) viewer.name = p.displayName;
            if (p.gradeBand) viewer.grade = p.gradeBand;
            if (p.schoolName) viewer.school = p.schoolName;
          } catch {}
        }
        // 更新已渲染的 DOM
        const nameEls = document.querySelectorAll('.sn-user strong, .sn-profile strong');
        nameEls.forEach(el => { if (viewer.name) el.textContent = viewer.name; });
        const gradeEls = document.querySelectorAll('.sn-user small');
        gradeEls.forEach(el => { if (viewer.grade) el.textContent = viewer.grade; });
        const schoolEls = document.querySelectorAll('.sn-profile small');
        schoolEls.forEach(el => { if (viewer.school) el.textContent = viewer.school; });
      }
    } catch {}
  })();
  const rawPath = location.pathname;
  const path = rawPath.replace(/\/$/, '') || '/';
  const qaMode = new URLSearchParams(location.search).get('qa') === '1';
  const qs = qaMode ? '?qa=1' : '';

  // 学生端统一导航：原有页面与新增页面共用同一组入口，避免按页面切换成不同侧栏。
  const topNav = [
    { label: '今日学习', route: '/student/today', icon: 'home', match: /^\/student\/(today|learn)/ },
    { label: '课程', route: '/student/courses', icon: 'book', match: /^\/student\/(courses|course-center|downloads|records|feedback)|^\/student-courses\.html/ },
    { label: '任务', route: '/student/assignments', icon: 'record', match: /^\/student\/assignments/ },
    { label: '测评', route: '/assessment', icon: 'wave', match: /^\/assessment|^\/student\/exercises/ },
    { label: '推荐', route: '/student/recommendations', icon: 'growth', match: /^\/student\/recommendations/ },
    { label: '成长', route: '/student/growth', icon: 'chart', match: /^\/student\/growth/ },
    { label: '社区', route: '/student/community', icon: 'feedback', match: /^\/student\/community/ },
    { label: '我的', route: '/student/profile', icon: 'user', match: /^\/student\/profile/ }
  ];

  const sideNav = [
    { label: '今日学习', route: '/student/today', icon: 'home', match: /^\/student\/(today|learn)/ },
    { label: '课程中心', route: '/student/courses', icon: 'book', match: /^\/student\/(courses|course-center|downloads|records|feedback)|^\/student-courses\.html/ },
    { label: '学习任务', route: '/student/assignments', icon: 'record', match: /^\/student\/assignments/ },
    { label: '课程推荐', route: '/student/recommendations', icon: 'growth', match: /^\/student\/recommendations/ },
    { label: '测评中心', route: '/assessment', icon: 'wave', match: /^\/assessment|^\/student\/exercises/ },
    { label: '成长报告', route: '/student/growth', icon: 'chart', match: /^\/student\/growth/ },
    { label: '公益社区', route: '/student/community', icon: 'feedback', match: /^\/student\/community/ },
    { label: '离线管理', route: '/student/offline', icon: 'download', match: /^\/student\/offline/ },
    { label: '个人中心', route: '/student/profile', icon: 'user', match: /^\/student\/profile/ }
  ];
  const showSidebar = /^\/student\//.test(path) || /^\/student-courses\.html/.test(path);

  const topActiveIndex = (() => {
    let idx = -1;
    topNav.forEach((n, i) => {
      const m = n.match || new RegExp('^' + n.route.replace(/\//g, '\\/') + '$');
      if (m.test(path)) idx = i;
    });
    return idx;
  })();

  const topHtml = topNav.map((n, i) => {
    const active = i === topActiveIndex;
    return `<a href="${n.route}${qs}" class="${active ? 'active' : ''}" data-student-nav>${icons[n.icon]}<span>${n.label}</span></a>`;
  }).join('');

  const sideHtml = sideNav.map(n => {
    const m = n.match || new RegExp('^' + n.route.replace(/\//g, '\\/') + '$');
    const isActive = m.test(path);
    if (isActive) {
      return `<button class="active" aria-current="page">${icons[n.icon]}<span>${n.label}</span></button>`;
    }
    return `<a href="${n.route}${qs}" data-student-nav>${icons[n.icon]}<span>${n.label}</span></a>`;
  }).join('');

  const header = document.createElement('header');
  header.className = 'student-topbar';
  header.innerHTML = `
    <a class="sn-brand" href="/student/courses${qs}"><img src="/assets/brand-mark.png" alt="语赞心声"><span><strong>语赞心声</strong><small>用声音连接心与心</small></span></a>
    <button class="sn-menu-toggle" type="button" aria-label="打开导航" aria-expanded="false">☰</button>
    <nav class="sn-topnav">${topHtml}</nav>
    <div class="sn-account">
      <span class="sn-offline">${icons.download}离线管理</span>
      <span class="sn-state"><i></i>离线可用</span>
      <span class="sn-user"><img src="${viewer.avatar}" alt="学生头像"><span><strong>${viewer.name}</strong><small>${viewer.grade}</small></span></span>
    </div>
  `;

  document.body.classList.add('student-has-nav');
  // 当不需要侧边栏时，添加 no-sidebar class 重置 CSS 变量
  if (!showSidebar) {
    document.body.classList.add('no-sidebar');
  }
  document.body.appendChild(header);

  // 从 localStorage 恢复侧边栏收缩状态，实现跨页面持久化
  const SIDEBAR_STATE_KEY = 'yuzan-sidebar-collapsed';
  let sidebar = null;
  let sidebarCollapsed = showSidebar ? (localStorage.getItem(SIDEBAR_STATE_KEY) === '1') : false;
  if (showSidebar) {
    sidebar = document.createElement('aside');
    sidebar.className = 'student-sidebar';
    // 恢复收缩状态
    if (sidebarCollapsed) {
      sidebar.classList.add('collapsed');
    }
    sidebar.innerHTML = `
      <div class="sn-profile"><img src="${viewer.avatar}" alt="学生头像"><span><strong>${viewer.name}</strong><span>${viewer.grade}学生</span><small>${viewer.school}</small></span></div>
      <nav class="sn-sidenav">${sideHtml}</nav>
      <section class="sn-weekly">
        <div class="sn-weekly-head">本周学习目标 <span>2 / 4</span></div>
        <p>继续学习 2 节课程</p>
        <div class="sn-track"><i style="width:58%;background:var(--student-red)"></i></div>
        <p>完成 1 次朗读测评</p>
        <div class="sn-track"><i style="width:43%;background:var(--student-green)"></i></div>
        <button class="sn-more">查看目标详情 ›</button>
      </section>
      <button class="sn-collapse-btn" type="button" aria-label="${sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}" title="${sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}">${sidebarCollapsed ? '›' : '‹'}</button>
      <span class="sn-collapse-label">展开</span>
    `;
    document.body.appendChild(sidebar);

    // 收回/展开功能 —— 持久化到 localStorage
    const collapseBtn = sidebar.querySelector('.sn-collapse-btn');
    collapseBtn.addEventListener('click', () => {
      sidebarCollapsed = !sidebarCollapsed;
      // 持久化收缩状态
      localStorage.setItem(SIDEBAR_STATE_KEY, sidebarCollapsed ? '1' : '0');
      sidebar.classList.toggle('collapsed', sidebarCollapsed);
      collapseBtn.textContent = sidebarCollapsed ? '›' : '‹';
      collapseBtn.setAttribute('aria-label', sidebarCollapsed ? '展开侧边栏' : '收起侧边栏');
      collapseBtn.setAttribute('title', sidebarCollapsed ? '展开侧边栏' : '收起侧边栏');
      adjustLayout();
      // 触发 fit.js 重新计算
      if (designRoot) {
        designRoot.dispatchEvent(new CustomEvent('studentnav:resize', { bubbles: true }));
      }
    });
  }

  // 移动端汉堡菜单
  const menuToggle = header.querySelector('.sn-menu-toggle');
  menuToggle.addEventListener('click', () => {
    const open = sidebar ? sidebar.classList.toggle('open') : false;
    menuToggle.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => {
    if (window.innerWidth > 900) return;
    if (sidebar && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
      sidebar.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  });

  // 让页面主体自动避开固定导航栏
  const shell = document.querySelector('.sc-shell');
  const design = document.querySelector('.design');
  const viewport = document.querySelector('.viewport');

  const getMetrics = () => {
    const w = window.innerWidth;
    const headerH = w > 900 ? 90 : 78;
    let sidebarW = 0;
    if (showSidebar && w > 900) {
      if (sidebarCollapsed) {
        sidebarW = 54; // collapsed width
      } else {
        sidebarW = w > 1100 ? 210 : 190;
      }
    }
    return { headerH, sidebarW };
  };

  const adjustLayout = () => {
    const { headerH, sidebarW } = getMetrics();
    document.documentElement.style.setProperty('--student-content-top', `${headerH}px`);
    document.documentElement.style.setProperty('--student-content-left', `${sidebarW}px`);

    if (shell) {
      // 课程中心：sc-shell 本身是三栏网格，这里用 padding 让出固定导航空间
      shell.style.paddingTop = `${headerH}px`;
      shell.style.paddingLeft = `${sidebarW}px`;
      // 中间列占满剩余，右侧保持原有宽度
      shell.style.gridTemplateColumns = `${sidebarW ? '0px' : '0px'} minmax(0, 1fr) var(--right, 340px)`;
    } else if (design) {
      // fit.js 全屏设计页：通过 margin 让出空间
      design.style.marginTop = `${headerH}px`;
      design.style.marginLeft = `${sidebarW}px`;
      design.style.width = `calc(100vw - ${sidebarW}px)`;
      design.style.height = `calc(100vh - ${headerH}px)`;
      design.style.left = '0';
      design.style.top = '0';
      design.style.transform = 'none';
      // 触发 fit.js 重新计算
      design.dispatchEvent(new CustomEvent('studentnav:resize', { bubbles: true }));
    } else if (viewport) {
      viewport.style.paddingTop = `${headerH}px`;
      viewport.style.paddingLeft = `${sidebarW}px`;
      viewport.style.minHeight = '100vh';
    } else {
      document.body.style.paddingTop = `${headerH}px`;
      // 确保无侧边栏时清除残留的 paddingLeft
      document.body.style.paddingLeft = sidebarW ? `${sidebarW}px` : '0';
    }
  };

  // 拦截 fit.js 的缩放：默认左上角对齐、完整可见；卡片类可加 data-fit="center" 保持居中
  const designRoot = document.querySelector('.design');
  if (designRoot && typeof window.__yuzanFitOverride === 'undefined') {
    window.__yuzanFitOverride = true;
    const reFit = () => {
      const { headerH, sidebarW } = getMetrics();
      const dw = Number(designRoot.dataset.width || designRoot.offsetWidth);
      const dh = Number(designRoot.dataset.height || designRoot.offsetHeight);
      designRoot.style.width = `${dw}px`;
      designRoot.style.height = `${dh}px`;
      const availableW = window.innerWidth - sidebarW;
      const availableH = window.innerHeight - headerH;
      // 屏蔽 fit.js/旧布局的 margin/定位，避免与 transform 叠加
      designRoot.style.marginTop = '0';
      designRoot.style.marginLeft = '0';
      designRoot.style.left = '0';
      designRoot.style.top = '0';

      let scale = 1;
      if (designRoot.dataset.fit === 'center') {
        scale = Math.min(availableW / dw, availableH / dh);
        const offsetX = sidebarW + (availableW - dw * scale) / 2;
        const offsetY = headerH + (availableH - dh * scale) / 2;
        designRoot.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
      } else {
        // 普通页：保证完整显示在可视区内，左上角对齐；若内容过高则纵向滚动
        scale = Math.min(availableW / dw, availableH / dh);
        // 成长报告页减少左侧留白，同时避免折叠/移动端时内容被裁切
        const reduceGap = designRoot.classList.contains('growth') ? 80 : 0;
        const offsetX = Math.max(0, sidebarW - reduceGap);
        const offsetY = headerH;
        designRoot.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
      }
      designRoot.style.transformOrigin = 'left top';
      designRoot.style.setProperty('--viewport-scale', scale);

      // 允许内容高度超出时纵向滚动，但禁止横向滚动条
      const viewport = document.querySelector('.viewport');
      if (viewport) {
        viewport.style.overflowX = 'hidden';
        viewport.style.overflowY = 'auto';
      } else {
        document.body.style.overflowX = 'hidden';
        document.body.style.overflowY = 'auto';
      }
    };
    addEventListener('resize', reFit, { passive: true });
    designRoot.addEventListener('studentnav:resize', reFit);
    // 延迟覆盖 fit.js 的初始设置
    requestAnimationFrame(() => { adjustLayout(); reFit(); });
    // 再延迟一次，确保 MutationObserver 等不会回退
    setTimeout(reFit, 50);
  }

  addEventListener('resize', adjustLayout, { passive: true });
  adjustLayout();
})();
