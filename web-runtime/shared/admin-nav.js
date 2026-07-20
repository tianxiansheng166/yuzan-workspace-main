(() => {
  'use strict';
  if (document.body.classList.contains('admin-has-nav')) return;

  const path = (location.pathname.replace(/\/$/, '') || '/');
  const routes = [
    { label:'概览', route:'/admin', icon:'⌂', match:/^\/admin$/ },
    { label:'学校管理', route:'/admin/schools', icon:'▦', match:/^\/admin\/schools(?:\/|$)/ },
    { label:'用户与角色', route:'/admin/users-roles', icon:'◌', match:/^\/admin\/users-roles/ },
    { label:'课程管理', route:'/admin/curriculum', icon:'▤', match:/^\/admin\/curriculum/ },
    { label:'测评管理', route:'/admin/assessment-content', icon:'⟡', match:/^\/admin\/assessment(?:-content|-links)/ },
    { label:'内容审核', route:'/admin/content-review', icon:'✎', match:/^\/admin\/content-review/ },
    { label:'套餐管理', route:'/admin/product-plans', icon:'▣', match:/^\/admin\/product-plans/ },
    { label:'隐私与合规', route:'/admin/privacy', icon:'🛡', match:/^\/admin\/privacy/ },
    { label:'系统运维', route:'/admin/system-providers', icon:'⚙', match:/^\/admin\/system-providers/ },
    { label:'学校运营详情', route:'/admin/school-operation', icon:'◫', match:/^\/admin\/school-operation/ }
  ];
  const active = routes.findIndex(item => item.match.test(path));
  const nav = routes.map((item, index) => `<a href="${item.route}" class="${index === active ? 'active' : ''}" data-admin-nav><span class="admin-nav-icon">${item.icon}</span><span>${item.label}</span>${item.label === '内容审核' ? '<em>5</em>' : ''}</a>`).join('');

  const header = document.createElement('header');
  header.className = 'admin-topbar';
  header.innerHTML = `
    <a class="admin-brand" href="/admin"><img src="/assets/brand-mark.png" alt="语赞心声"><span><strong>语赞心声</strong><small>平台管理中心</small></span></a>
    <div class="admin-top-title">管理驾驶舱</div>
    <div class="admin-top-actions"><span class="admin-school-label">当前学校：学校一（已脱敏）</span><button class="admin-nav-toggle" type="button" aria-label="收起导航" aria-expanded="true">‹</button><span class="admin-top-user"><i>管</i>管理员</span></div>
  `;
  document.body.classList.add('admin-has-nav');
  document.body.appendChild(header);

  const sidebar = document.createElement('aside');
  sidebar.className = 'admin-sidebar';
  sidebar.innerHTML = `<nav class="admin-sidebar-nav" aria-label="管理端导航">${nav}</nav><div class="admin-sidebar-footer"><button type="button" data-admin-logout>退出登录</button></div>`;
  document.body.appendChild(sidebar);
  const backdrop = document.createElement('div');
  backdrop.className = 'admin-mobile-backdrop';
  document.body.appendChild(backdrop);

  const toggle = header.querySelector('.admin-nav-toggle');
  const updateToggle = () => {
    const collapsed = document.body.classList.contains('admin-collapsed');
    toggle.textContent = collapsed ? '›' : '‹';
    toggle.setAttribute('aria-label', collapsed ? '展开导航' : '收起导航');
    toggle.setAttribute('aria-expanded', String(!collapsed));
  };
  toggle.addEventListener('click', () => {
    if (window.innerWidth <= 900) document.body.classList.toggle('admin-nav-open');
    else document.body.classList.toggle('admin-collapsed');
    updateToggle();
  });
  backdrop.addEventListener('click', () => document.body.classList.remove('admin-nav-open'));
  sidebar.addEventListener('click', event => {
    const link = event.target.closest('[data-admin-nav]');
    if (link && window.innerWidth <= 900) document.body.classList.remove('admin-nav-open');
  });
  const logout = sidebar.querySelector('[data-admin-logout]');
  logout.addEventListener('click', () => {
    try { window.YuzanApi?.clearSession?.(); } catch (_) {}
    location.href = '/login';
  });
  updateToggle();
})();
