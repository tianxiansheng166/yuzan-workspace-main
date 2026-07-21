(() => {
  const routes = {
    '/student/assignments': '/student-pages/yuzan-student-assignments-ui-1-/yuzan-student-assignments-ui/index.html',
    '/student/community': '/student-pages/yuzan-student-community-ui/yuzan-student-community-ui/index.html',
    '/student/course-center': '/student-pages/yuzan-student-course-center/yuzan-student-course-center/index.html',
    '/student/exercises': '/student-pages/yuzan-student-exercise-ui/yuzan-student-exercise-ui/index.html',
    '/student/offline': '/student-pages/yuzan-student-offline-ui/yuzan-student-offline-ui/index.html',
    '/student/recommendations': '/student-pages/yuzan-student-recommendations-pixel/yuzan-student-recommendations-pixel/index.html'
  };
  const frame = document.getElementById('student-integrated-frame');
  frame.src = routes[location.pathname] || routes['/student/course-center'];

  // 整合壳自己提供统一导航栏，iframe 内页面不需要左侧边栏占位
  document.documentElement.style.setProperty('--student-content-left', '0px');

  function fit() {
    try {
      const doc = frame.contentDocument;
      if (!doc?.head) return;
      let style = doc.getElementById('yuzan-student-integration-reset');
      if (!style) {
        style = doc.createElement('style');
        style.id = 'yuzan-student-integration-reset';
        style.textContent = `
          html, body { width:100%!important; min-width:0!important; overflow-x:hidden!important; margin:0!important; padding:0!important; }
          /* 隐藏原页面自己的导航栏和侧边栏，统一使用外层整合壳导航 */
          .sidebar, .sidebar-decoration, .topbar, header.topbar, .leftbar, .rightbar,
          .left-sidebar, .left-rail, .side-nav, .sidenav, .nav-list,
          .student-topbar, body.student-has-nav .student-topbar { display:none!important; }
          .app-shell, .app, .page-shell, .content-shell, .workspace,
          .page, .page-grid, .dashboard-grid {
            display:block!important; width:100%!important; min-width:0!important; max-width:none!important;
            margin:0!important; padding:0!important; border:0!important; border-radius:0!important; box-shadow:none!important;
          }
          .workspace { display:block!important; }
          .workspace > * { width:100%!important; min-width:0!important; margin:0!important; padding:0!important; }
          .main, .main-column, .main-content, .main-shell {
            width:100%!important; min-width:0!important; max-width:none!important;
            margin:0!important; padding:12px 16px!important; grid-column:auto!important; box-sizing:border-box!important;
          }
          .content, .page-content { width:100%!important; min-width:0!important; box-sizing:border-box!important; }
          .hero-panel, .basis-section, .path-area, .course-stack { max-width:100%!important; }
          /* 确保卡片类布局不会溢出 */
          .course-card, .theme-card, .resource-card, .download-card, .community-card {
            max-width:100%!important; min-width:0!important; box-sizing:border-box!important;
          }
        `;
        doc.head.appendChild(style);
      }

      // 如果 iframe 内容宽度超过容器，通过缩放保证完整显示，避免左侧被截断
      const shell = frame.parentElement;
      const shellW = shell ? shell.clientWidth : window.innerWidth;
      const contentW = doc.documentElement.scrollWidth;
      if (contentW > shellW && shellW > 0) {
        const scale = shellW / contentW;
        frame.style.transform = `scale(${scale})`;
        frame.style.transformOrigin = 'left top';
        frame.style.width = `${contentW}px`;
      } else {
        frame.style.transform = 'none';
        frame.style.width = '100%';
      }

      requestAnimationFrame(() => {
        const scaledH = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight, 760);
        frame.style.height = (contentW > shellW ? scaledH * (shellW / contentW) : scaledH) + 'px';
      });
    } catch (_) {}
  }

  frame.addEventListener('load', fit);
  setTimeout(fit, 0);
  setTimeout(fit, 500);
  window.addEventListener('resize', fit, { passive: true });

  // 监听侧边栏折叠/展开事件，重新适配 iframe
  document.addEventListener('studentnav:resize', () => { setTimeout(fit, 50); });
  document.addEventListener('transitionend', (e) => {
    if (e.target.classList?.contains('student-sidebar')) setTimeout(fit, 50);
  });
})();
