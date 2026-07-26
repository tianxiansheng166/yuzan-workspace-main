(() => {
  'use strict';

  function initTeacherShell() {
    if (document.body.classList.contains('ts-has-shell')) return;
    document.body.classList.add('ts-has-shell');

    const rawPath = location.pathname;
    const path = rawPath.replace(/\/$/, '') || '/';

    const navItems = [
      { id: 'home', label: '首页', route: '/teacher', icon: '<svg viewBox="0 0 24 24"><path d="M3 10 12 3l9 7M5 9v11h14V9M9 20v-6h6v6"/></svg>' },
      { id: 'course', label: '课程', route: '/teacher/courses/spring/studio', icon: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5M7 3v4M17 3v4"/></svg>' },
      { id: 'task', label: '任务', route: '/teacher/assignments', icon: '<svg viewBox="0 0 24 24"><path d="M6 5h12l2 4v10H4V9zM8 5V3h8v2M8 11h8M8 15h5"/></svg>' },
      { id: 'research', label: '教研', route: '/research', icon: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/></svg>' },
      { id: 'review', label: '复核', route: '/teacher/reviews/', icon: '<svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM7 15l3-3 2 2 3-4 2 3"/></svg>' },
      { id: 'classes', label: '班级', route: '/teacher/classes', icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="3"/><path d="M5 21v-3a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v3"/></svg>' },
      { id: 'student', label: '学生', route: '/teacher/students/demo', icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/></svg>' },
      { id: 'ai-tools', label: 'AI 工具', route: '/teacher/ai-tools', icon: '<svg viewBox="0 0 24 24"><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg>' },
      { id: 'translation', label: '翻译台', route: '/teacher/translation', icon: '<svg viewBox="0 0 24 24"><path d="M4 6h16v12H4zM7 8l3 4-3 4M12 8h5M12 12h4M12 16h3"/></svg>' }
    ];

    const bottomItems = [
      { id: 'switch-school', label: '切换学校', route: '/select-school', icon: '<svg viewBox="0 0 24 24"><path d="M3 10 12 3l9 7M5 9v11h14V9M9 20v-6h6v6"/></svg>' }
    ];

    const activeId = (() => {
      if (path === '/teacher') return 'home';
      if (path.startsWith('/teacher/courses')) return 'course';
      if (path.startsWith('/teacher/assignments')) return 'task';
      if (path.startsWith('/teacher/reviews')) return 'review';
      if (path.startsWith('/teacher/submissions')) return 'review';
      if (path === '/research' || path.startsWith('/research/')) return 'research';
      if (path.startsWith('/teacher/classes')) return 'classes';
      if (path.startsWith('/teacher/students')) return 'student';
      if (path.startsWith('/teacher/ai-tools')) return 'ai-tools';
      if (path === '/teacher-tools' || path.startsWith('/teacher-tools/')) return 'ai-tools';
      if (path.startsWith('/teacher/translation')) return 'translation';
      if (path === '/select-school' || path.startsWith('/select-school/')) return 'switch-school';
      return 'home';
    })();

    const navHtml = navItems.map(n => {
      const active = n.id === activeId ? 'active' : '';
      return `<a class="ts-nav-item ${active}" href="${n.route}" data-ts-route="${n.route}">${n.icon}<span>${n.label}</span></a>`;
    }).join('');

    const bottomHtml = bottomItems.map(n => {
      const active = n.id === activeId ? 'active' : '';
      const badge = n.badge ? `<span class="ts-badge">${n.badge}</span>` : '';
      return `<a class="ts-footer-link ${active}" href="${n.route}" data-ts-route="${n.route}">${n.icon}<span>${n.label}</span>${badge}</a>`;
    }).join('');

    const shell = document.createElement('div');
    shell.className = 'ts-app-shell';
    shell.innerHTML = `
      <aside class="ts-sidebar" aria-label="教师端主导航">
        <button class="ts-collapse-btn" type="button" aria-label="收起侧边栏" title="收起侧边栏">‹</button>
        <a class="ts-brand" href="/teacher">
          <img src="/assets/brand-mark.png" alt="语赞心声">
          <div class="ts-brand-copy"><strong>语赞心声</strong><span>智慧教育公益平台</span></div>
        </a>
        <nav class="ts-nav" aria-label="教师功能导航">${navHtml}</nav>
        <div class="ts-sidebar-footer">
          ${bottomHtml}
          <div class="ts-sidebar-art"><img src="/assets/teacher-sidebar-landscape.png" alt=""></div>
        </div>
      </aside>
      <div class="ts-main">
        <header class="ts-topbar">
          <div class="ts-context">
            <button class="ts-context-btn" id="ts-school-select"><svg viewBox="0 0 24 24"><path d="M3 10 12 3l9 7M5 9v11h14V9M9 20v-6h6v6"/></svg><span>林芝市第一中学</span><b>⌄</b></button>
            <button class="ts-context-btn" id="ts-semester-select"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5M7 3v4M17 3v4"/></svg><span>2024-2025 学年下学期</span><b>⌄</b></button>
            <span class="ts-sync-pill"><i></i>已同步 2 分钟前</span>
          </div>
          <div class="ts-top-actions">
            <button class="ts-icon-btn" id="ts-notifications" aria-label="通知"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7M10 20h4"/></svg><span class="ts-badge">3</span></button>
            <button class="ts-help-btn" id="ts-help"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3 2.3c-.8.3-.8.9-.8 1.7M12 17h.01"/></svg>帮助</button>
            <button class="ts-profile-btn" id="ts-profile"><span class="ts-seal">师</span><span><strong>扎西卓玛</strong><small>普通话教师</small></span><b>⌄</b></button>
          </div>
        </header>
        <div id="ts-page-root"></div>
      </div>
    `;

    // 迁移策略：找到页面真正的工作区，把整块迁移到统一 shell 的 #ts-page-root 中，
    // 保留页面原有的 class 与样式，从而 page-specific CSS 继续生效。
    const contentRootSelectors = [
      '.app-shell > .main-wrap',
      '.app-shell > main.content',
      '.app-shell > .main',
      '.app-shell > .workspace',
      '.app-shell > .content-shell',
      '.teacher-shell > .teacher-main',
      '.layout > .main',
      '.layout > section.main',
      '.viewport > main.design',
      '.viewport > main'
    ];

    let contentRoot = null;
    for (const sel of contentRootSelectors) {
      contentRoot = document.querySelector(sel);
      if (contentRoot) break;
    }

    if (contentRoot) {
      const pageRoot = shell.querySelector('#ts-page-root');
      pageRoot.appendChild(contentRoot);

      // 清理内容区内部的旧 header / sidebar / topbar，避免与统一导航重复或遮挡内容
      // 但需保留其中的 data-bind 锚点（例如 studio 的 crumb-title），迁移到统一 shell 的 .ts-topbar 中
      const tsTopbarForCrumb = shell.querySelector('.ts-topbar');
      contentRoot.querySelectorAll('header.topbar, header.teacher-header, aside.sidebar, aside.teacher-sidebar, aside.nav, nav.sidebar').forEach(el => {
        const dataBindEls = el.querySelectorAll('[data-bind]');
        if (dataBindEls.length > 0 && tsTopbarForCrumb && !tsTopbarForCrumb.querySelector('.ts-page-crumb')) {
          const crumbHost = document.createElement('div');
          crumbHost.className = 'ts-page-crumb';
          // 尝试读取原 topbar 中 .crumb 容器的纯文本前缀作为面包屑前导
          const originalCrumb = el.querySelector('.crumb');
          if (originalCrumb) {
            const prefixText = (originalCrumb.textContent || '').trim().split('›')[0].trim();
            if (prefixText) {
              const prefixSpan = document.createElement('span');
              prefixSpan.className = 'ts-page-crumb-prefix';
              prefixSpan.textContent = prefixText + ' ›';
              crumbHost.appendChild(prefixSpan);
            }
          }
          dataBindEls.forEach(b => crumbHost.appendChild(b));
          // 插入到 ts-topbar 最左侧（context 之前）
          const firstChild = tsTopbarForCrumb.firstChild;
          if (firstChild) {
            tsTopbarForCrumb.insertBefore(crumbHost, firstChild);
          } else {
            tsTopbarForCrumb.appendChild(crumbHost);
          }
        }
        el.remove();
      });

      // 对 .design 等比布局的画布做自适应缩放，避免被 shell 的 width:auto 撑坏
      let designRoot = contentRoot.classList.contains('design') ? contentRoot : contentRoot.querySelector('main.design');
      let fitDesign = null;
      if (designRoot) {
        designRoot.dataset.fit = 'managed';
        const host = document.createElement('div');
        host.className = 'ts-design-host';
        pageRoot.appendChild(host);
        host.appendChild(designRoot);
        fitDesign = () => {
          const dw = Number(designRoot.dataset.width || designRoot.offsetWidth);
          const dh = Number(designRoot.dataset.height || designRoot.offsetHeight);
          designRoot.style.width = `${dw}px`;
          designRoot.style.height = `${dh}px`;
          const rect = host.getBoundingClientRect();
          const scale = Math.min(rect.width / dw, rect.height / dh);
          designRoot.style.transform = `translate(-50%, -50%) scale(${scale})`;
        };
        addEventListener('resize', fitDesign, {passive:true});
      }

      // 移除旧的外层容器，避免残留 sidebar/topbar 造成遮挡或重复 logo
      const oldContainers = document.querySelectorAll('.app-shell, .teacher-shell, .layout, .viewport');
      oldContainers.forEach(el => {
        if (!el.contains(shell) && el.parentNode) {
          el.remove();
        }
      });

      // 移除可能残留的独立 header/sidebar（保留统一 shell）
      document.querySelectorAll('body > header, body > aside.sidebar, body > .topbar, body > .teacher-shell').forEach(el => el.remove());

      document.body.appendChild(shell);

      // shell 进入 DOM 后再计算缩放，否则 host 尺寸为 0
      if (fitDesign) fitDesign();
    } else {
      // 未识别到标准结构：把 body 下所有直接子元素（除 script/style/portal）迁入 shell
      const pageRoot = shell.querySelector('#ts-page-root');
      const children = Array.from(document.body.childNodes);
      children.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE && !['script', 'style', 'link'].includes(node.tagName.toLowerCase())) {
          pageRoot.appendChild(node);
        }
      });
      document.body.appendChild(shell);
    }

    // 为统一导航链接绑定点击反馈：同域内链正常跳转，不拦截，保证浏览器原生行为
    shell.querySelectorAll('a[data-ts-route]').forEach(a => {
      a.addEventListener('click', () => {
        const route = a.dataset.tsRoute;
        // 跳转到切换学校页前，记录来源页，便于返回
        if (route === '/select-school') {
          sessionStorage.setItem('yuzan-select-school-from', location.pathname);
        }
        shell.querySelectorAll('a[data-ts-route]').forEach(x => x.classList.remove('active'));
        a.classList.add('active');
      });
    });

    // 侧边栏收回/展开功能
    const collapseBtn = shell.querySelector('.ts-collapse-btn');
    const sidebarEl = shell.querySelector('.ts-sidebar');
    let tsCollapsed = false;
    collapseBtn?.addEventListener('click', () => {
      tsCollapsed = !tsCollapsed;
      sidebarEl.classList.toggle('collapsed', tsCollapsed);
      collapseBtn.textContent = tsCollapsed ? '›' : '‹';
      collapseBtn.setAttribute('aria-label', tsCollapsed ? '展开侧边栏' : '收起侧边栏');
      // 触发 design 自适应重算
      window.dispatchEvent(new Event('resize'));
      // 兼容页内其他 resize 监听
      document.dispatchEvent(new CustomEvent('teacher-shell:resize', { detail: { collapsed: tsCollapsed } }));
    });

    // 移除旧布局遗留的 body class，避免固定 topbar 样式造成内容遮挡
    document.body.classList.remove('yuzan-has-role-topbar');

    // 分发一个事件，方便页面脚本感知 shell 已就绪
    document.dispatchEvent(new CustomEvent('teacher-shell:ready', { detail: { shell } }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTeacherShell);
  } else {
    initTeacherShell();
  }
})();
