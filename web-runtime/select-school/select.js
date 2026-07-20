(() => {
  const list = document.querySelector('.school-list');
  const continueBtn = document.querySelector('#continueSchool');
  const roleMap = { TEACHER: '教师', VOLUNTEER: '志愿者', STUDENT: '学生', SCHOOL_ADMIN: '管理员', RESEARCHER: '教研员' };
  const roleRoute = { TEACHER: '/teacher', VOLUNTEER: '/volunteer', STUDENT: '/student/courses', SCHOOL_ADMIN: '/admin', RESEARCHER: '/research' };
  const roleClass = { TEACHER: 'red', VOLUNTEER: 'green', STUDENT: 'blue', SCHOOL_ADMIN: 'orange', RESEARCHER: 'purple' };

  let memberships = [];
  let selectedIndex = 0;

  function renderSchools(membershipsData) {
    memberships = membershipsData || [];
    if (memberships.length === 0) {
      list.innerHTML = '<p class="empty-schools">当前账号没有关联学校，请联系管理员。</p>';
      continueBtn.disabled = true;
      return;
    }

    list.innerHTML = memberships.map((m, index) => {
      const roleText = roleMap[m.role] || m.role;
      const cls = roleClass[m.role] || 'blue';
      return `<button class="school-row ${index === 0 ? 'selected' : ''}" data-index="${index}" data-school-id="${m.schoolId}" data-role="${m.role}">
        <strong>${m.schoolName || '学校（已脱敏）'}</strong>
        <span class="role ${cls}"><svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="7" r="3"/><path d="M5.5 20c.5-4.7 2.7-7 6.5-7s6 2.3 6.5 7z"/></svg>${roleText}</span>
        <span>默认班级</span>
        <span class="sync">最近同步：今天 <b>✓</b></span>
        <i class="radio"></i>
      </button>`;
    }).join('');

    bindRows();
    updateContinueLabel();
  }

  function bindRows() {
    const rows = [...document.querySelectorAll('.school-row')];
    rows.forEach((row, index) => row.addEventListener('click', () => {
      selectedIndex = index;
      rows.forEach(x => x.classList.remove('selected'));
      row.classList.add('selected');
      updateContinueLabel();
    }));
  }

  function updateContinueLabel() {
    const membership = memberships[selectedIndex];
    if (!membership) return;
    const roleText = roleMap[membership.role] || membership.role;
    continueBtn.innerHTML = `以${roleText}身份继续 <svg class="icon" viewBox="0 0 24 24"><path d="M5 12h13m-5-5 5 5-5 5"/></svg>`;
  }

  async function init() {
    if (!YuzanApi.getToken()) {
      YuzanDemo.toast('请先登录', 'warning');
      setTimeout(() => location.href = '/login', 400);
      return;
    }

    try {
      const data = await YuzanApi.me();
      const user = data.user || data;
      renderSchools(user.memberships || []);
      YuzanDemo.hydrate({ user: { displayName: user.displayName, role: (user.memberships?.[0]?.role || 'STUDENT').toLowerCase() } }, 'backend');
    } catch (err) {
      YuzanDemo.toast(err.message || '无法获取学校信息', 'error');
      setTimeout(() => location.href = '/login', 800);
    }
  }

  continueBtn.addEventListener('click', async () => {
    const membership = memberships[selectedIndex];
    if (!membership) return;

    continueBtn.disabled = true;
    continueBtn.innerHTML = '正在切换…';

    try {
      await YuzanApi.selectSchool(membership.schoolId);
      YuzanDemo.set('user.role', membership.role.toLowerCase());
      YuzanDemo.set('user.school', membership.schoolName);
      YuzanDemo.toast('学校与权限范围已切换', 'success');
      const next = roleRoute[membership.role] || '/student/courses';
      setTimeout(() => location.href = next, 280);
    } catch (err) {
      continueBtn.disabled = false;
      updateContinueLabel();
      YuzanDemo.toast(err.message || '切换学校失败', 'error');
    }
  });

  // 返回按钮：优先回到来源页（如教师端），而非登录页
  // 使用 history.back() 并记录来源，避免误跳到登录页
  const backBtn = document.getElementById('selectSchoolBack');
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      // 读取来源标记，优先回到对应工作台
      const from = sessionStorage.getItem('yuzan-select-school-from');
      sessionStorage.removeItem('yuzan-select-school-from');
      if (from && from !== '/login' && from !== '/select-school') {
        location.href = from;
        return;
      }
      // 没有明确来源时，按 history 回退一步；若没有历史则回教师端
      if (window.history.length > 1) {
        // 检测 referrer 是否为登录页，避免又跳回登录
        if (document.referrer && !document.referrer.endsWith('/login')) {
          history.back();
        } else {
          location.href = '/teacher';
        }
      } else {
        location.href = '/teacher';
      }
    });
  }

  init();
})();