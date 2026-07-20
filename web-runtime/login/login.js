(() => {
  'use strict';

  // ── 登录/注册 Tab 切换 ──
  const tabs = document.querySelectorAll('.auth-tab');
  const loginSection = document.querySelector('#loginSection');
  const registerSection = document.querySelector('#registerSection');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isRegister = tab.dataset.tab === 'register';
      loginSection.style.display = isRegister ? 'none' : '';
      registerSection.style.display = isRegister ? '' : 'none';
      // 清除错误
      document.querySelectorAll('#loginError, #registerError').forEach(error => {
        error.textContent = '';
        error.classList.remove('success');
      });
      document.querySelectorAll('.field').forEach(f => f.classList.remove('invalid'));
    });
  });

  // ── 登录表单 ──
  const loginForm = document.querySelector('#loginForm');
  const account = document.querySelector('#account');
  const pass = document.querySelector('#password');
  const toggle = document.querySelector('#toggle');
  const loginSubmit = loginForm.querySelector('.submit');
  const loginError = document.querySelector('#loginError');
  const setMessage = (el, message, type = 'error') => {
    el.textContent = message;
    el.classList.toggle('success', type === 'success');
  };
  const clearMessage = (el) => {
    el.textContent = '';
    el.classList.remove('success');
  };

  toggle.addEventListener('click', () => {
    const visible = pass.type === 'text';
    pass.type = visible ? 'password' : 'text';
    toggle.setAttribute('aria-label', visible ? '显示密码' : '隐藏密码');
  });

  [account, pass].forEach(input => input.addEventListener('input', () => {
    clearMessage(loginError);
    input.classList.remove('invalid');
  }));

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = account.value.trim();
    const password = pass.value;

    if (!identifier) {
      account.classList.add('invalid');
      account.focus();
      setMessage(loginError, '请输入账号');
      return;
    }
    if (password.length < 6) {
      pass.classList.add('invalid');
      pass.focus();
      setMessage(loginError, '密码至少需要 6 位');
      return;
    }

    loginSubmit.disabled = true;
    loginSubmit.textContent = navigator.onLine ? '正在验证…' : '正在验证本机凭据…';

    if (!navigator.onLine) {
      localStorage.setItem('yuzan-demo-session', JSON.stringify({ account: identifier, loggedInAt: Date.now(), offline: true }));
      YuzanDemo.toast('已使用本机凭据登录', 'warning');
      setTimeout(() => location.href = '/select-school', 260);
      return;
    }

    try {
      const data = await YuzanApi.login(identifier, password);
      localStorage.setItem('yuzan-demo-session', JSON.stringify({ account: identifier, loggedInAt: Date.now(), offline: false }));
      YuzanDemo.toast('登录成功', 'success');
      const homeUrl = YuzanApi.getHomeUrlByRole(data.user);
      setTimeout(() => location.href = homeUrl, 260);
    } catch (err) {
      // 演示环境兜底
      const demoAccounts = ['student.test', 'teacher.test', 'volunteer.test', 'admin.test', 'researcher.test'];
      const demoPassword = 'YuzanTest!2026';
      if (demoAccounts.includes(identifier) && password === demoPassword) {
        localStorage.setItem('yuzan-access-token', 'demo-token-' + identifier);
        localStorage.setItem('yuzan-active-school-id', '11111111-1111-4111-8111-111111111111');
        localStorage.setItem('yuzan-demo-session', JSON.stringify({ account: identifier, loggedInAt: Date.now(), offline: true }));
        YuzanDemo.toast('演示模式登录成功', 'warning');
        const roleMap = { 'student.test': 'STUDENT', 'teacher.test': 'TEACHER', 'volunteer.test': 'VOLUNTEER', 'admin.test': 'SCHOOL_ADMIN', 'researcher.test': 'RESEARCHER' };
        const homeUrl = YuzanApi.getHomeUrlByRole({ memberships: [{ role: roleMap[identifier] || 'STUDENT' }] });
        setTimeout(() => location.href = homeUrl, 260);
        return;
      }
      loginSubmit.disabled = false;
      loginSubmit.textContent = '登录';
      pass.classList.add('invalid');
      if (err.status === 401) {
        setMessage(loginError, '账号或密码不正确。已注册账号请使用注册时设置的原密码登录。');
      } else if (err.status === 400) {
        setMessage(loginError, '登录信息格式不符合服务端要求。若你曾用 6 位密码注册，请在服务更新后再试。');
      } else {
        setMessage(loginError, err.message || '登录失败，请稍后重试');
      }
    }
  });

  document.querySelector('#forgotPassword').addEventListener('click', () => {
    YuzanDemo.toast(navigator.onLine ? '重置链接已发送到绑定联系方式' : '当前离线，请联网后重置密码', navigator.onLine ? 'success' : 'warning');
  });

  // ── 注册表单 ──
  const registerForm = document.querySelector('#registerForm');
  const regPhone = document.querySelector('#regPhone');
  const regPassword = document.querySelector('#regPassword');
  const regToggle = document.querySelector('#regToggle');
  const regSubmit = registerForm.querySelector('.submit');
  const registerError = document.querySelector('#registerError');
  let selectedRole = '';

  // 密码显隐
  regToggle.addEventListener('click', () => {
    const visible = regPassword.type === 'text';
    regPassword.type = visible ? 'password' : 'text';
    regToggle.setAttribute('aria-label', visible ? '显示密码' : '隐藏密码');
  });

  // 角色选择
  document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRole = btn.dataset.role;
      clearMessage(registerError);
    });
  });

  // 输入时清除错误
  [regPhone, regPassword].forEach(input => input.addEventListener('input', () => {
    clearMessage(registerError);
    input.classList.remove('invalid');
  }));

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = regPhone.value.trim();
    const password = regPassword.value;

    // 前端验证
    if (!phone) {
      regPhone.classList.add('invalid');
      regPhone.focus();
      setMessage(registerError, '请输入手机号');
      return;
    }
    if (!/^1\d{10}$/.test(phone) && phone.length < 4) {
      regPhone.classList.add('invalid');
      regPhone.focus();
      setMessage(registerError, '请输入有效的手机号');
      return;
    }
    if (password.length < 6) {
      regPassword.classList.add('invalid');
      regPassword.focus();
      setMessage(registerError, '密码至少需要 6 位');
      return;
    }
    if (!selectedRole) {
      setMessage(registerError, '请选择角色');
      return;
    }

    regSubmit.disabled = true;
    regSubmit.textContent = '正在注册…';

    try {
      const data = await YuzanApi.register(phone, password, selectedRole);
      localStorage.setItem('yuzan-demo-session', JSON.stringify({ account: phone, loggedInAt: Date.now(), newlyRegistered: true }));
      YuzanDemo.toast('注册成功，正在进入工作台', 'success');
      const homeUrl = YuzanApi.getHomeUrlByRole(data.user);
      setTimeout(() => location.href = homeUrl, 260);
    } catch (err) {
      regSubmit.disabled = false;
      regSubmit.textContent = '注册';
      if (err.status === 409 || err.message?.includes('已注册')) {
        regPhone.classList.add('invalid');
        // 自动切换到登录 Tab 并预填手机号；不复制注册密码，避免误导用户把新密码当作旧密码。
        const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
        if (loginTab) loginTab.click();
        account.value = phone;
        pass.value = '';
        setMessage(loginError, '该手机号已注册，请输入注册时设置的原密码登录；忘记密码请使用“忘记密码”。');
        pass.focus();
      } else {
        setMessage(registerError, err.message || '注册失败，请稍后重试');
      }
    }
  });
})();
