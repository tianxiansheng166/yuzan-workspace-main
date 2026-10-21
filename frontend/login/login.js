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

  [loginError, document.querySelector('#registerError')].forEach((message) => {
    message.setAttribute('role', 'alert');
    message.setAttribute('aria-live', 'assertive');
    message.setAttribute('aria-atomic', 'true');
  });

  function authFailureMessage(error, action) {
    if (navigator.onLine === false || error?.code === 'OFFLINE') {
      return '当前无法连接网络，请恢复连接后重试。';
    }
    if (error?.code === 'API_CLIENT_UNAVAILABLE') {
      return '认证服务暂不可用，请刷新页面或稍后重试。';
    }
    if (error?.code === 'AUTH_RESPONSE_INVALID') {
      return '服务端未返回可确认的身份，请稍后重试。';
    }

    const status = Number(error?.status);
    if (status === 401) {
      return action === 'login'
        ? '身份验证未通过（账号或密码错误，或会话已失效），请核对后重试。'
        : '注册验证未通过，请核对信息后重试。';
    }
    if (status === 403) return '服务端拒绝了此操作，请确认账号权限后重试。';
    if (status === 409 && action === 'register') return '该账号已注册，请切换到登录并使用原密码。';
    if (status === 429) return '请求过于频繁，请稍后再试。';
    if (status >= 500) return '认证服务暂时不可用，请稍后重试。';
    if (status >= 400) return `认证请求失败（HTTP ${status}），请核对信息后重试。`;
    return '无法连接认证服务，请检查网络后重试。';
  }

  function requireAuthApi(action) {
    const api = typeof YuzanApi === 'undefined' ? null : YuzanApi;
    if (!api || typeof api[action] !== 'function' || typeof api.getHomeUrlByRole !== 'function') {
      const error = new Error();
      error.code = 'API_CLIENT_UNAVAILABLE';
      throw error;
    }
    return api;
  }

  function getAuthenticatedHomeUrl(api, data) {
    if (!data?.user || typeof data.user !== 'object') {
      const error = new Error();
      error.code = 'AUTH_RESPONSE_INVALID';
      throw error;
    }
    const homeUrl = api.getHomeUrlByRole(data.user);
    if (typeof homeUrl !== 'string' || !homeUrl) {
      const error = new Error();
      error.code = 'AUTH_RESPONSE_INVALID';
      throw error;
    }
    return homeUrl;
  }

  function showToast(message, type) {
    if (typeof YuzanDemo !== 'undefined' && typeof YuzanDemo.toast === 'function') {
      YuzanDemo.toast(message, type);
    }
  }

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
    loginSubmit.textContent = '正在验证…';

    if (!navigator.onLine) {
      loginSubmit.disabled = false;
      loginSubmit.textContent = '登录';
      setMessage(loginError, authFailureMessage({ code: 'OFFLINE' }, 'login'));
      return;
    }

    try {
      const api = requireAuthApi('login');
      const data = await api.login(identifier, password);
      const homeUrl = getAuthenticatedHomeUrl(api, data);
      showToast('登录成功', 'success');
      setTimeout(() => location.href = homeUrl, 260);
    } catch (err) {
      loginSubmit.disabled = false;
      loginSubmit.textContent = '登录';
      pass.classList.add('invalid');
      setMessage(loginError, authFailureMessage(err, 'login'));
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

    if (!navigator.onLine) {
      regSubmit.disabled = false;
      regSubmit.textContent = '注册';
      setMessage(registerError, authFailureMessage({ code: 'OFFLINE' }, 'register'));
      return;
    }

    try {
      const api = requireAuthApi('register');
      const data = await api.register(phone, password, selectedRole);
      const homeUrl = getAuthenticatedHomeUrl(api, data);
      showToast('注册成功，正在进入工作台', 'success');
      setTimeout(() => location.href = homeUrl, 260);
    } catch (err) {
      regSubmit.disabled = false;
      regSubmit.textContent = '注册';
      if (err.status === 409) {
        regPhone.classList.add('invalid');
        // 自动切换到登录 Tab 并预填手机号；不复制注册密码，避免误导用户把新密码当作旧密码。
        const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
        if (loginTab) loginTab.click();
        account.value = phone;
        pass.value = '';
        setMessage(loginError, '该手机号已注册，请输入注册时设置的原密码登录；忘记密码请使用“忘记密码”。');
        pass.focus();
      } else {
        setMessage(registerError, authFailureMessage(err, 'register'));
      }
    }
  });
})();
