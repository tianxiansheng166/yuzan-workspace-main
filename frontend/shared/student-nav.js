(() => {
  'use strict';

  // The outer integration shell owns navigation when a student page is embedded.
  if (window.self !== window.top) return;
  if (document.body.classList.contains('student-has-nav')) return;

  const icon = (paths) => '<svg class="sn-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
  const icons = {
    today: icon('<path d="M3.5 19.5h17"/><path d="M5.5 19.5v-4.2a6.5 6.5 0 0 1 13 0v4.2"/><path d="M9 10.5a3 3 0 1 1 6 0"/><path d="M12 3v2M4.8 7.2l1.5 1.5M19.2 7.2l-1.5 1.5"/>'),
    courses: icon('<path d="M4.2 5.2c2.7-1 5.3-.6 7.8 1.1v13c-2.5-1.7-5.1-2.1-7.8-1.1z"/><path d="M19.8 5.2c-2.7-1-5.3-.6-7.8 1.1v13c2.5-1.7 5.1-2.1 7.8-1.1z"/><path d="M6.7 8.4c1.2-.2 2.5 0 3.7.6M6.7 11.4c1.2-.2 2.5 0 3.7.6M17.3 8.4c-1.2-.2-2.5 0-3.7.6M17.3 11.4c-1.2-.2-2.5 0-3.7.6"/>'),
    practice: icon('<path d="M4 16.5V7.5l5.2 9 5.6-10v10"/><path d="M17.2 9.1a4 4 0 0 1 0 5.8"/><path d="M19.5 6.8a7.2 7.2 0 0 1 0 10.4"/><path d="M3.5 20.5h17"/>'),
    history: icon('<path d="M5.3 8.2A8 8 0 1 1 4 13"/><path d="M4.2 4.8v4.7h4.7"/><path d="M12 7.8v4.6l3.1 1.9"/><path d="M8.3 19.4h7.4"/>'),
    growth: icon('<path d="M4 20h16"/><path d="M6.2 19.5c.4-3.6 2.7-5.8 6.2-6.2 3.4-.4 5.3-2.3 5.8-6.8"/><path d="M7.6 15.2c-2.7-.2-4.1-1.9-4.1-4.8 2.9-.1 4.8 1.2 5.2 3.8"/><path d="M13.1 12.9c-.1-2.8 1.5-4.4 4.7-4.8.2 3-1.1 4.8-3.9 5.2"/><path d="M18 6V3.5M17.9 4h2.6"/>'),
    profile: icon('<path d="M12 12.1a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2z"/><path d="M4.3 20.2c.5-3.7 3.4-6 7.7-6s7.2 2.3 7.7 6"/><path d="M7.3 18.4c1.2-.8 2.8-1.2 4.7-1.2s3.5.4 4.7 1.2"/>')
  };

  const path = location.pathname.replace(/\/+$/, '') || '/';
  const qa = new URLSearchParams(location.search).get('qa') === '1' ? '?qa=1' : '';
  const navItems = [
    { label: '今日学习', route: '/student/today/', icon: 'today', match: /^\/student\/(?:today|learn)(?:\/|$)|^\/student\/?$/ },
    { label: '课程中心', route: '/student/courses/', icon: 'courses', match: /^\/student\/courses(?:\/|$)/ },
    { label: '练习中心', route: '/student/practices/', icon: 'practice', match: /^\/student\/practices(?:\/|$)|^\/assessment(?:\/|$)/ },
    { label: '学习历史', route: '/student/practices/history/', icon: 'history', match: /^\/student\/practices\/history(?:\/|$)|^\/assessment\/history(?:\/|$)/ },
    { label: '我的成长', route: '/student/progress/', icon: 'growth', match: /^\/student\/(?:progress|growth)(?:\/|$)|^\/assessment\/progress(?:\/|$)/ },
    { label: '个人中心', route: '/student/profile/', icon: 'profile', match: /^\/student\/profile(?:\/|$)/ }
  ];
  const activeItem = navItems.slice().reverse().find((item) => item.match.test(path));
  const linkMarkup = navItems.map((item) => {
    const active = item === activeItem;
    return '<a href="' + item.route + qa + '" class="sn-link' + (active ? ' is-current' : '') + '" data-student-nav' +
      (active ? ' aria-current="page"' : '') + '>' + icons[item.icon] + '<span>' + item.label + '</span></a>';
  }).join('');

  const header = document.createElement('header');
  header.className = 'student-topbar';
  header.innerHTML =
    '<a class="sn-brand" href="/student/today/' + qa + '">' +
      '<img src="/assets/brand-mark.png" alt="语赞心声">' +
      '<span><strong>语赞心声</strong><small>用声音连接心与心</small></span>' +
    '</a>' +
    '<button class="sn-menu-toggle" type="button" aria-label="打开学生导航" aria-expanded="false" aria-controls="student-navigation">' +
      '<svg class="sn-menu-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path class="sn-menu-line sn-menu-line-top" d="M4 7.5h16"/>' +
        '<path class="sn-menu-line sn-menu-line-mid" d="M4 12h16"/>' +
        '<path class="sn-menu-line sn-menu-line-bottom" d="M4 16.5h16"/>' +
      '</svg>' +
    '</button>' +
    '<div class="sn-menu-panel" id="student-navigation" aria-hidden="false">' +
      '<nav class="sn-topnav" aria-label="学生功能">' + linkMarkup + '</nav>' +
      '<div class="sn-account">' +
        '<span class="sn-state" role="status" aria-live="polite"><i aria-hidden="true"></i><span class="sn-state-copy"></span></span>' +
        '<span class="sn-user" aria-live="polite">' +
          '<span class="sn-avatar" aria-hidden="true">' + icons.profile + '</span>' +
          '<span class="sn-user-copy"><strong class="sn-name"></strong><small class="sn-detail"></small></span>' +
        '</span>' +
      '</div>' +
    '</div>';

  document.body.classList.add('student-has-nav');
  document.body.appendChild(header);

  const menuToggle = header.querySelector('.sn-menu-toggle');
  const menuPanel = header.querySelector('.sn-menu-panel');
  const menuLinks = Array.from(header.querySelectorAll('[data-student-nav]'));
  const compactMenu = window.matchMedia('(max-width: 1080px)');
  let menuOpen = false;
  let closeTimer = 0;
  let identityContext = { token: '', schoolId: '' };
  let identityRequest = 0;

  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setMenu(open, restoreFocus) {
    if (!compactMenu.matches) {
      menuOpen = false;
      header.classList.remove('menu-open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', '打开学生导航');
      menuPanel.hidden = false;
      menuPanel.inert = false;
      menuPanel.setAttribute('aria-hidden', 'false');
      return;
    }

    menuOpen = Boolean(open);
    window.clearTimeout(closeTimer);
    menuToggle.setAttribute('aria-expanded', String(menuOpen));
    menuToggle.setAttribute('aria-label', menuOpen ? '关闭学生导航' : '打开学生导航');

    if (menuOpen) {
      menuPanel.hidden = false;
      menuPanel.inert = false;
      menuPanel.setAttribute('aria-hidden', 'false');
      window.requestAnimationFrame(() => {
        if (menuOpen && compactMenu.matches) header.classList.add('menu-open');
      });
      return;
    }

    header.classList.remove('menu-open');
    menuPanel.inert = true;
    menuPanel.setAttribute('aria-hidden', 'true');
    if (restoreFocus) menuToggle.focus({ preventScroll: true });
    closeTimer = window.setTimeout(() => {
      if (!menuOpen && compactMenu.matches) menuPanel.hidden = true;
    }, prefersReducedMotion() ? 0 : 190);
  }

  function syncMenuForViewport(previouslyCompact) {
    const compact = compactMenu.matches;
    const activeElement = document.activeElement;
    menuOpen = false;
    window.clearTimeout(closeTimer);
    header.classList.remove('menu-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', '打开学生导航');
    menuPanel.inert = compact;
    menuPanel.setAttribute('aria-hidden', String(compact));
    menuPanel.hidden = compact;

    if (compact && !previouslyCompact && menuPanel.contains(activeElement)) {
      menuToggle.focus({ preventScroll: true });
    } else if (!compact && previouslyCompact && activeElement === menuToggle) {
      const currentLink = header.querySelector('[aria-current="page"]');
      (currentLink || menuLinks[0] || header.querySelector('.sn-brand')).focus({ preventScroll: true });
    }
  }

  menuToggle.addEventListener('click', () => setMenu(!menuOpen, !menuOpen));
  menuLinks.forEach((link) => link.addEventListener('click', () => setMenu(false, false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuOpen) {
      event.preventDefault();
      setMenu(false, true);
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (menuOpen && !header.contains(event.target)) setMenu(false, false);
  });
  compactMenu.addEventListener('change', (event) => {
    syncMenuForViewport(!event.matches);
    adjustLayout();
  });
  syncMenuForViewport(compactMenu.matches);

  function readIdentityContext() {
    const api = window.YuzanApi;
    if (!api || typeof api.getToken !== 'function') return { token: '', schoolId: '' };
    try {
      const token = api.getToken() || '';
      const schoolId = token && typeof api.getActiveSchoolId === 'function' ? (api.getActiveSchoolId() || '') : '';
      return { token, schoolId };
    } catch {
      return { token: '', schoolId: '' };
    }
  }

  function sameIdentity(left, right) {
    return left.token === right.token && left.schoolId === right.schoolId;
  }

  function setIdentity(state, name, detail) {
    const user = header.querySelector('.sn-user');
    const avatar = header.querySelector('.sn-avatar');
    const nameNode = header.querySelector('.sn-name');
    const detailNode = header.querySelector('.sn-detail');
    user.classList.toggle('is-confirmed', state === 'confirmed');
    avatar.textContent = '';
    if (state === 'confirmed') avatar.textContent = name ? Array.from(name)[0] : '语';
    else avatar.innerHTML = icons.profile;
    nameNode.textContent = name || '';
    detailNode.textContent = detail || '';
  }

  function identityDetail(profile) {
    const bits = [profile.schoolName, profile.gradeBand, profile.className].filter((value) => typeof value === 'string' && value.trim());
    return bits.length ? bits.join(' · ') : '当前授权学生档案';
  }

  async function loadAuthorizedProfile(expectedContext, requestId) {
    const api = window.YuzanApi;
    if (!api || typeof api.getStudentProfile !== 'function') {
      setIdentity('unconfirmed', '身份未确认', '登录后读取当前学生档案');
      return;
    }
    try {
      const result = await api.getStudentProfile();
      if (requestId !== identityRequest) return;
      if (!sameIdentity(expectedContext, readIdentityContext())) {
        reconcileIdentity(true);
        return;
      }
      const profile = result && result.profile && typeof result.profile === 'object' ? result.profile : result;
      if (!profile || typeof profile !== 'object') throw new Error('学生档案响应暂不可用');
      const name = typeof profile.displayName === 'string' ? profile.displayName.trim() : '';
      setIdentity('confirmed', name || '学生', identityDetail(profile));
    } catch (error) {
      if (requestId !== identityRequest) return;
      if (!sameIdentity(expectedContext, readIdentityContext())) {
        reconcileIdentity(true);
        return;
      }
      const latest = readIdentityContext();
      if (!latest.token) {
        reconcileIdentity(true);
        return;
      }
      const message = error && error.status === 403
        ? '当前学校暂无学生档案权限'
        : error && error.status === 401
          ? '登录已过期，请重新登录'
          : '学生档案暂不可用';
      setIdentity('unconfirmed', '身份未确认', message);
    }
  }

  function reconcileIdentity(force) {
    const next = readIdentityContext();
    if (!force && sameIdentity(identityContext, next)) return;
    identityContext = next;
    identityRequest += 1;
    if (!next.token) {
      setIdentity('unconfirmed', '未登录', '登录后显示当前学生身份');
      return;
    }
    if (!next.schoolId) {
      setIdentity('unconfirmed', '身份未确认', '选择学校后读取学生档案');
      return;
    }
    setIdentity('unconfirmed', '正在确认身份', '正在读取当前学生档案');
    void loadAuthorizedProfile(next, identityRequest);
  }

  function refreshIdentity() {
    const next = readIdentityContext();
    if (!sameIdentity(identityContext, next)) {
      reconcileIdentity(true);
      return;
    }
    if (next.token && next.schoolId) {
      identityRequest += 1;
      setIdentity('unconfirmed', '正在确认身份', '正在读取当前学生档案');
      void loadAuthorizedProfile(next, identityRequest);
    }
  }

  function updateNetworkState() {
    const copy = header.querySelector('.sn-state-copy');
    const online = navigator.onLine;
    const state = header.querySelector('.sn-state');
    copy.textContent = online ? '网络状态 · 在线' : '网络状态 · 离线';
    state.classList.toggle('is-offline', !online);
  }

  reconcileIdentity(true);
  updateNetworkState();
  window.addEventListener('online', () => { updateNetworkState(); refreshIdentity(); });
  window.addEventListener('offline', updateNetworkState);
  window.addEventListener('focus', refreshIdentity);
  window.addEventListener('pageshow', refreshIdentity);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshIdentity();
  });
  window.addEventListener('storage', (event) => {
    if (!event.key || ['yuzan-access-token', 'yuzan-active-school-id', 'yuzan-current-user'].includes(event.key)) refreshIdentity();
  });
  // The API client writes local identity changes in the current tab without firing a storage event.
  window.setInterval(() => reconcileIdentity(false), 1000);

  // Keep the legacy fitted learning activities below the fixed shared header.
  const courseShell = document.querySelector('.sc-shell');
  const design = document.querySelector('.design');
  const viewport = document.querySelector('.viewport');
  const getMetrics = () => ({ headerH: window.innerWidth > 1080 ? 90 : 74 });

  function adjustLayout() {
    const metrics = getMetrics();
    document.documentElement.style.setProperty('--student-content-top', metrics.headerH + 'px');

    if (courseShell) {
      courseShell.style.paddingTop = metrics.headerH + 'px';
    } else if (design) {
      design.style.marginTop = metrics.headerH + 'px';
      design.style.width = '100vw';
      design.style.height = 'calc(100vh - ' + metrics.headerH + 'px)';
      design.style.left = '0';
      design.style.top = '0';
      design.style.transform = 'none';
      design.dispatchEvent(new CustomEvent('studentnav:resize', { bubbles: true }));
    } else if (viewport) {
      viewport.style.paddingTop = metrics.headerH + 'px';
      viewport.style.minHeight = '100vh';
    } else {
      document.body.style.paddingTop = metrics.headerH + 'px';
    }
  }

  const designRoot = document.querySelector('.design');
  if (designRoot && typeof window.__yuzanFitOverride === 'undefined') {
    window.__yuzanFitOverride = true;
    const reFit = () => {
      const metrics = getMetrics();
      const width = Number(designRoot.dataset.width || designRoot.offsetWidth);
      const height = Number(designRoot.dataset.height || designRoot.offsetHeight);
      designRoot.style.width = width + 'px';
      designRoot.style.height = height + 'px';
      const availableWidth = window.innerWidth;
      const availableHeight = window.innerHeight - metrics.headerH;
      designRoot.style.marginTop = '0';
      designRoot.style.marginLeft = '0';
      designRoot.style.left = '0';
      designRoot.style.top = '0';

      let scale = 1;
      if (designRoot.dataset.fit === 'center') {
        scale = Math.min(availableWidth / width, availableHeight / height);
        const offsetX = (availableWidth - width * scale) / 2;
        const offsetY = metrics.headerH + (availableHeight - height * scale) / 2;
        designRoot.style.transform = 'translate(' + offsetX + 'px, ' + offsetY + 'px) scale(' + scale + ')';
      } else {
        scale = Math.min(availableWidth / width, availableHeight / height);
        designRoot.style.transform = 'translate(0px, ' + metrics.headerH + 'px) scale(' + scale + ')';
      }
      designRoot.style.transformOrigin = 'left top';
      designRoot.style.setProperty('--viewport-scale', scale);

      const fittedViewport = document.querySelector('.viewport');
      if (fittedViewport) {
        fittedViewport.style.overflowX = 'clip';
        fittedViewport.style.overflowY = 'auto';
      } else {
        document.body.style.overflowX = 'clip';
        document.body.style.overflowY = 'auto';
      }
    };
    window.addEventListener('resize', reFit, { passive: true });
    designRoot.addEventListener('studentnav:resize', reFit);
    window.requestAnimationFrame(() => { adjustLayout(); reFit(); });
    window.setTimeout(reFit, 50);
  }

  window.addEventListener('resize', adjustLayout, { passive: true });
  adjustLayout();
})();
