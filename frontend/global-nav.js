(() => {
  'use strict';
  if (document.getElementById('yuzan-global-nav')) return;
  if (new URLSearchParams(location.search).get('embed') === '1') return;

  const rawPath = location.pathname;
  const path = rawPath.replace(/\/$/, '') || '/';

  // 首页与业务壳层使用自己的导航，避免重复导航和浮层遮挡内容。
  if (path === '/' || path === '/teacher' || path.startsWith('/teacher/') || path.startsWith('/teacher-tools') || path === '/research' || path.startsWith('/research/') || path === '/admin' || path.startsWith('/admin/') || path === '/volunteer' || path.startsWith('/volunteer/')) return;
  // 志愿者端使用自己的侧边导航，避免出现两套视觉和交互体系
  if (path === '/volunteer' || path.startsWith('/volunteer/')) return;

  const routes = [
    { label: '公共首页', path: '/', icon: '01' },
    { label: '登录', path: '/login', icon: '02' },
    { label: '选择学校', path: '/select-school', icon: '03' },
    { label: '管理驾驶舱', path: '/admin', icon: '04' },
    { label: '教师工作台', path: '/teacher', icon: '05' },
    { label: '学生课程中心', path: '/student/courses', icon: '06' },
    { label: '志愿者工作台', path: '/volunteer', icon: '07' },
    { label: '教研中心', path: '/research', icon: '08' },
    { label: '产品套餐', path: '/plans', icon: '09' },
    { label: '教师工具箱', path: '/teacher/ai-tools/?tool=mindgraph', icon: '10' }
  ];

  const roleNav = [
    { label: '学生端', path: '/student/courses', icon: '06', match: /^\/student(?:\/|$)/ },
    { label: '教师端', path: '/teacher', icon: '05', match: /^\/teacher(?:\/|$)/ },
    { label: '管理端', path: '/admin', icon: '04', match: /^\/admin(?:\/|$)/ },
    { label: '志愿者端', path: '/volunteer', icon: '07', match: /^\/volunteer(?:\/|$)/ },
    { label: '教研', path: '/research', icon: '08', match: /^\/research(?:\/|$)/ },
    { label: '工具', path: '/teacher/ai-tools/?tool=mindgraph', icon: '10', match: /^\/teacher\/ai-tools(?:\/|$)/ },
    { label: '套餐', path: '/plans', icon: '09', match: /^\/plans(?:\/|$)/ }
  ];

  const nav = document.createElement('div');
  nav.id = 'yuzan-global-nav';
  nav.innerHTML = `
    <style>
      #yuzan-global-nav{position:fixed;z-index:999;right:22px;bottom:22px;font-family:"Microsoft YaHei",sans-serif;}
      #yuzan-global-nav .nav-toggle{width:48px;height:48px;border-radius:50%;border:0;background:#b9342e;color:#fff;font-size:12px;box-shadow:0 6px 18px rgba(0,0,0,.18);cursor:pointer;display:grid;place-items:center;transition:transform .18s ease,box-shadow .18s ease;}
      #yuzan-global-nav .nav-toggle:hover{transform:scale(1.06);box-shadow:0 8px 24px rgba(0,0,0,.28);}
      #yuzan-global-nav .nav-panel{position:absolute;right:0;bottom:64px;width:220px;max-height:70vh;overflow:auto;background:#fff;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.2);padding:10px 0;transform:scale(.92);opacity:0;visibility:hidden;transform-origin:bottom right;transition:all .18s ease;}
      #yuzan-global-nav.open .nav-panel{transform:scale(1);opacity:1;visibility:visible;}
      #yuzan-global-nav .nav-panel a{display:flex;align-items:center;gap:10px;padding:10px 16px;color:#333;text-decoration:none;font-size:14px;transition:background .15s;white-space:nowrap;}
      #yuzan-global-nav .nav-panel a:hover{background:#f5f0e8;color:#c9362a;}
      #yuzan-global-nav .nav-panel a.active{background:#fff3f0;color:#c9362a;font-weight:600;}
      #yuzan-global-nav .nav-panel .nav-divider{height:1px;background:#ece8e2;margin:6px 16px;}
      #yuzan-global-nav .nav-hint{padding:6px 16px 0;font-size:12px;color:#999;}
    </style>
    <button class="nav-toggle" type="button" aria-label="打开全局导航" title="全局导航">导航</button>
    <div class="nav-panel" role="menu">
      <div class="nav-hint">点击可跳转到任意模块</div>
      ${routes.map(r => `<a href="${r.path}" role="menuitem" class="${path === r.path ? 'active' : ''}"><span>${r.icon}</span><span>${r.label}</span></a>`).join('')}
      <div class="nav-divider"></div>
      <a href="javascript:history.back()" role="menuitem"><span>↩</span><span>返回上一页</span></a>
    </div>
  `;
  document.body.appendChild(nav);

  const toggle = nav.querySelector('.nav-toggle');
  const panel = nav.querySelector('.nav-panel');
  toggle.addEventListener('click', () => nav.classList.toggle('open'));
  document.addEventListener('click', (e) => { if (!nav.contains(e.target)) nav.classList.remove('open'); });
  panel.addEventListener('click', () => nav.classList.remove('open'));
})();
