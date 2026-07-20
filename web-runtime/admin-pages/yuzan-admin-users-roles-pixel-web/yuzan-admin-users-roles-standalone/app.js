(() => {
  const toast = document.getElementById('toast');
  let timer;
  const show = (message) => { toast.textContent = message; toast.classList.add('show'); clearTimeout(timer); timer = setTimeout(() => toast.classList.remove('show'), 1800); };
  const roleNames = { STUDENT: '学生', TEACHER: '教师', VOLUNTEER: '志愿者', RESEARCHER: '研究员', SCHOOL_ADMIN: '学校管理员', PLATFORM_ADMIN: '平台管理员' };
  const statusNames = { ACTIVE: '正常', INVITED: '待激活', SUSPENDED: '已暂停', LEFT: '已离开', DISABLED: '已停用' };
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let users = [];
  let loadError = '';
  const roleFilter = document.getElementById('roleFilter');
  const statusFilter = document.getElementById('statusFilter');
  const searchInput = document.getElementById('searchInput');
  const tbody = document.getElementById('userRows');
  const selectedCount = document.getElementById('selectedCount');
  const all = document.getElementById('selectAll');

  function renderRows() {
    const q = searchInput.value.trim().toLowerCase();
    const role = roleFilter.value;
    const status = statusFilter.value;
    const list = users.filter((item) => {
      const text = `${item.user?.displayName ?? ''} ${item.user?.loginIdentifier ?? ''}`.toLowerCase();
      return (!q || text.includes(q)) && (role === 'all' || item.role === role) && (status === 'all' || item.membershipStatus === status);
    });
    tbody.innerHTML = loadError
      ? `<tr><td colspan="9" style="padding:40px;text-align:center;color:#b33">${esc(loadError)}</td></tr>`
      : list.length ? list.map((item) => {
        const user = item.user || {};
        const school = item.school || {};
        const state = item.membershipStatus || user.status || 'ACTIVE';
        return `<tr data-id="${esc(item.membershipId)}"><td><input type="checkbox" class="row-check"/></td><td><div class="user-cell"><span class="mini-avatar"></span><div><b>${esc(user.displayName || '未命名用户')}</b><small>${esc(user.loginIdentifier || '')}</small></div></div></td><td>${esc(school.name || '—')}<br/><small>${esc(school.code || '')}</small></td><td><span class="role-tag">${esc(roleNames[item.role] || item.role || '—')}</span></td><td><span class="state ${state === 'ACTIVE' ? 'normal' : state === 'DISABLED' || state === 'LEFT' ? 'disabled' : 'pending'}">${esc(statusNames[state] || state)}</span></td><td>${item.joinedAt ? esc(new Date(item.joinedAt).toLocaleString('zh-CN')) : '—'}</td><td><span class="mfa off">未接入</span></td><td>${item.role === 'PLATFORM_ADMIN' ? '全平台' : '本校'}</td><td><div class="row-actions"><button class="edit" data-action="detail">查看</button><button class="danger" data-action="status">${state === 'ACTIVE' ? '禁用' : '启用'}</button><button data-action="more">更多⌄</button></div></td></tr>`;
      }).join('') : '<tr><td colspan="9" style="padding:40px;text-align:center;color:#888">暂无匹配用户</td></tr>';
    bindRowActions();
    bindChecks();
  }

  function bindChecks() {
    const checks = [...document.querySelectorAll('.row-check')];
    checks.forEach((check) => check.addEventListener('change', sync));
    all.checked = checks.length > 0 && checks.every((check) => check.checked);
    sync();
  }
  function sync() { selectedCount.textContent = document.querySelectorAll('.row-check:checked').length; }
  function bindRowActions() { document.querySelectorAll('.row-actions button').forEach((button) => button.addEventListener('click', () => show(`${button.textContent.trim()}：请在用户详情中完成`))); }
  async function loadUsers() {
    loadError = '';
    renderRows();
    try {
      const result = await window.YuzanApi.listAdminUsers({ limit: 100 });
      users = result.items || [];
    } catch (error) {
      loadError = error?.message || '用户列表加载失败，请检查登录状态或服务连接';
    }
    renderRows();
  }

  searchInput.addEventListener('input', renderRows);
  roleFilter.addEventListener('change', renderRows);
  statusFilter.addEventListener('change', renderRows);
  all.addEventListener('change', () => { document.querySelectorAll('.row-check').forEach((check) => { check.checked = all.checked; }); sync(); });
  document.getElementById('clearSelection').addEventListener('click', () => { all.checked = false; document.querySelectorAll('.row-check').forEach((check) => { check.checked = false; }); sync(); });
  document.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => show(`${button.textContent.trim()}：当前操作需后端表单`)));
  const modal = document.getElementById('modalBackdrop');
  const title = document.getElementById('modalTitle');
  document.querySelectorAll('[data-action="add"], [data-action="import"], [data-action="role"]').forEach((button) => button.addEventListener('click', () => { title.textContent = button.textContent.trim(); modal.hidden = false; }));
  ['modalClose', 'cancelModal'].forEach((id) => document.getElementById(id).addEventListener('click', () => { modal.hidden = true; }));
  document.getElementById('confirmModal').addEventListener('click', () => { modal.hidden = true; show(`${title.textContent}表单已打开，提交接口待接入`); });
  document.querySelectorAll('.tree-head,.tree-children button').forEach((button) => button.addEventListener('click', () => { document.querySelectorAll('.tree-children button').forEach((item) => item.classList.remove('selected')); if (button.closest('.tree-children')) button.classList.add('selected'); show(`已切换：${button.textContent.replace(/\s+/g, ' ').trim()}`); }));
  loadUsers();
})();
