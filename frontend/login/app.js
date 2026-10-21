(() => {
  'use strict';

  const body = document.body;
  const intro = document.getElementById('intro');
  const world = document.getElementById('world');
  const tabs = document.querySelector('.tabs');
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  const loginPanel = document.getElementById('loginPanel');
  const registerPanel = document.getElementById('registerPanel');
  const gateTitle = document.getElementById('gateTitle');
  const gateSubtitle = document.getElementById('gateSubtitle');
  const storyRed = document.getElementById('storyRed');
  const storyTitle = document.getElementById('storyTitle');
  const storyLead = document.getElementById('storyLead');
  const storySignal = document.getElementById('storySignal');
  const transition = document.getElementById('transition');
  const transitionTitle = document.getElementById('transitionTitle');
  const transitionDetail = document.getElementById('transitionDetail');
  const soundSwitch = document.getElementById('soundSwitch');
  const motionToggle = document.getElementById('motionToggle');
  const roleStatus = document.getElementById('roleStatus');
  const loginMessage = document.getElementById('loginMessage');
  const registerMessage = document.getElementById('registerMessage');
  const loginButton = loginPanel.querySelector('[data-action="login"]');
  const registerButton = registerPanel.querySelector('[data-action="register"]');

  const storySets = [
    ['进入语赞心声', '继续你的高原学习旅程', '从声音出发，连接课程、教师支持、练习反馈与持续复测，让每一次发声都在雪山与山谷之间被认真听见。', '今天，第 <strong>12,842</strong> 次发声正在穿越雪山。'],
    ['让每一次发声', '沿着高原的学习路径被听见', '这里不仅记录一次登录，也连接一段真实的成长路径。每一次学习、教学与陪伴，都会成为高原教育网络中的一个光点。', '来自高原学校的一次朗读，正在抵达远方。'],
    ['连接声音与远方', '让知识沿着山谷持续生长', '学生、教师、志愿者与学校在同一条路径上相遇。技术退到背景，真实的人与声音成为页面中心。', '新的声音坐标已加入高原学习网络。']
  ];
  let storyIndex = 0;
  let storyTimer = null;
  let audioContext = null;
  let analyser = null;
  let audioFrame = null;

  function reveal() {
    window.setTimeout(() => intro.classList.add('is-hidden'), 1050);
  }

  function rotateStory() {
    storyIndex = (storyIndex + 1) % storySets.length;
    const [red, title, lead, signal] = storySets[storyIndex];
    document.querySelector('.story__copy').animate([
      { opacity: 1, transform: 'translateY(0)' },
      { opacity: 0, transform: 'translateY(-10px)' },
      { opacity: 0, transform: 'translateY(10px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 800, easing: 'cubic-bezier(.2,.8,.2,1)' });
    window.setTimeout(() => {
      storyRed.textContent = red;
      storyTitle.textContent = title;
      storyLead.textContent = lead;
      storySignal.innerHTML = signal;
    }, 380);
  }

  function startStoryRotation() {
    if (storyTimer) window.clearInterval(storyTimer);
    storyTimer = window.setInterval(rotateStory, 6800);
  }

  function switchMode(mode) {
    const isLogin = mode === 'login';
    clearAuthMessage('login');
    clearAuthMessage('register');
    loginTab.classList.toggle('is-active', isLogin);
    registerTab.classList.toggle('is-active', !isLogin);
    loginTab.setAttribute('aria-selected', String(isLogin));
    registerTab.setAttribute('aria-selected', String(!isLogin));
    loginPanel.hidden = !isLogin;
    registerPanel.hidden = isLogin;
    loginPanel.classList.toggle('is-active', isLogin);
    registerPanel.classList.toggle('is-active', !isLogin);
    tabs.dataset.active = isLogin ? 'login' : 'register';
    gateTitle.textContent = isLogin ? '欢迎回来' : '欢迎加入';
    gateSubtitle.textContent = isLogin ? '连接你的声音旅程' : '开启你的高原学习或教学之旅';
    storyIndex = isLogin ? 0 : 1;
    const [red, title, lead, signal] = storySets[storyIndex];
    storyRed.textContent = red;
    storyTitle.textContent = title;
    storyLead.textContent = lead;
    storySignal.innerHTML = signal;
  }

  function onPointerMove(event) {
    if (body.classList.contains('reduced-motion')) return;
    const x = (event.clientX / window.innerWidth - 0.5) * 28;
    const y = (event.clientY / window.innerHeight - 0.5) * 20;
    world.style.setProperty('--pointer-x', `${x}px`);
    world.style.setProperty('--pointer-y', `${y}px`);
    world.style.setProperty('--p06x', `${x * 0.6}px`);
    world.style.setProperty('--p06y', `${y * 0.6}px`);
    world.style.setProperty('--p025x', `${x * 0.25}px`);
    world.style.setProperty('--p025y', `${y * 0.25}px`);
    world.style.setProperty('--p085x', `${x * 0.85}px`);
    world.style.setProperty('--p085y', `${y * 0.85}px`);
  }

  function togglePassword(button) {
    const input = document.getElementById(button.dataset.passwordTarget);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    button.setAttribute('aria-label', input.type === 'password' ? '显示密码' : '隐藏密码');
  }

  function selectRole(card) {
    document.querySelectorAll('.identity-card').forEach(item => item.classList.remove('is-selected'));
    card.classList.add('is-selected');
    const input = card.querySelector('input');
    input.checked = true;
    const roleName = card.querySelector('strong').textContent;
    roleStatus.textContent = `${roleName}坐标已选定`;
    const accents = { student: '#315f48', teacher: '#b23c22', volunteer: '#c88a20', admin: '#3c6279' };
    document.documentElement.style.setProperty('--role-accent', accents[input.value]);
  }

  function validate(form) {
    let valid = true;
    form.querySelectorAll('input[required]').forEach(input => {
      const field = input.closest('.field');
      field?.classList.remove('is-invalid');
      if (!input.checkValidity()) {
        field?.classList.add('is-invalid');
        valid = false;
      }
    });
    const first = form.querySelector('.field.is-invalid input');
    first?.focus();
    return valid;
  }

  const ROLE_MAP = {
    student: 'STUDENT',
    teacher: 'TEACHER',
    volunteer: 'VOLUNTEER',
    admin: 'SCHOOL_ADMIN'
  };

  function finishRedirect(url) {
    window.setTimeout(() => {
      transition.classList.remove('is-active');
      transition.setAttribute('aria-hidden', 'true');
      body.classList.remove('is-transitioning');
      window.location.href = url;
    }, 2350);
  }

  function clearAuthMessage(action) {
    const message = action === 'login' ? loginMessage : registerMessage;
    if (!message) return;
    message.textContent = '';
    message.hidden = true;
    message.style.display = 'none';
  }

  function showAuthMessage(action, text) {
    const message = action === 'login' ? loginMessage : registerMessage;
    if (!message) return;
    message.textContent = text;
    message.hidden = !text;
    message.style.display = text ? 'flex' : 'none';
    if (text) message.focus();
  }

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
    if (error?.code === 'INVALID_ROLE') return '请选择有效的注册身份后重试。';

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

  async function callEndpoint(action, payload) {
    const api = window.YuzanApi;
    const method = action === 'login' ? 'login' : action === 'register' ? 'register' : null;
    if (!api || !method || typeof api[method] !== 'function' || typeof api.getHomeUrlByRole !== 'function') {
      const error = new Error();
      error.code = 'API_CLIENT_UNAVAILABLE';
      throw error;
    }

    let data;
    if (action === 'login') {
      data = await api.login(payload.account, payload.password);
    } else {
      const role = ROLE_MAP[payload.role];
      if (!role) {
        const error = new Error();
        error.code = 'INVALID_ROLE';
        throw error;
      }
      data = await api.register(payload.phone, payload.password, role);
    }

    if (!data?.user || typeof data.user !== 'object') {
      const error = new Error();
      error.code = 'AUTH_RESPONSE_INVALID';
      throw error;
    }
    const redirect = api.getHomeUrlByRole(data.user);
    if (typeof redirect !== 'string' || !redirect) {
      const error = new Error();
      error.code = 'AUTH_RESPONSE_INVALID';
      throw error;
    }
    return { user: data.user, redirect };
  }

  async function bindUatDefaultStudentClass(user) {
    const isStudent = (user?.memberships || []).some(membership => membership.role === 'STUDENT');
    const api = window.YuzanApi;
    const code = api?.getUatDefaultTeacherInvitationCode?.();
    if (!isStudent || !code || typeof api.bindTeacherInvitation !== 'function') return;

    try {
      const binding = await api.bindTeacherInvitation(code);
      if (binding?.schoolId && typeof api.selectSchool === 'function') {
        await api.selectSchool(binding.schoolId);
      }
    } catch {
      showToast('默认测试班级暂未绑定，仍会继续登录。', 'warning');
    }
  }

  async function submitAuth(form, action) {
    if (!validate(form)) return;
    clearAuthMessage(action);
    const data = Object.fromEntries(new FormData(form).entries());
    if (navigator.onLine === false) {
      showAuthMessage(action, authFailureMessage({ code: 'OFFLINE' }, action));
      return;
    }

    const submitButton = action === 'login' ? loginButton : registerButton;
    if (submitButton) submitButton.disabled = true;
    transitionTitle.textContent = action === 'login' ? '正在点亮高原学习路径' : '正在建立你的声音坐标';
    transitionDetail.textContent = action === 'login' ? '声音坐标正在与学习网络建立连接' : '身份坐标正在写入高原学习网络';
    transition.classList.add('is-active');
    transition.setAttribute('aria-hidden', 'false');
    body.classList.add('is-transitioning');

    try {
      const result = await callEndpoint(action, data);
      await bindUatDefaultStudentClass(result.user);
      finishRedirect(result.redirect);
    } catch (error) {
      if (submitButton) submitButton.disabled = false;
      transition.classList.remove('is-active');
      transition.setAttribute('aria-hidden', 'true');
      body.classList.remove('is-transitioning');
      showAuthMessage(action, authFailureMessage(error, action));
    }
  }

  async function startSoundField() {
    const active = soundSwitch.getAttribute('aria-pressed') === 'true';
    if (active) {
      stopSoundField();
      return;
    }
    soundSwitch.setAttribute('aria-pressed', 'true');
    soundSwitch.querySelector('span:last-child').textContent = '声场已唤醒';
    body.classList.add('sound-active');
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const animate = () => {
        analyser.getByteFrequencyData(data);
        const level = data.reduce((sum, value) => sum + value, 0) / data.length / 255;
        document.documentElement.style.setProperty('--audio-level', level.toFixed(3));
        world.style.filter = `saturate(${1 + level * .16}) brightness(${1 + level * .06})`;
        audioFrame = requestAnimationFrame(animate);
      };
      animate();
    } catch (_) {
      // Permission is optional; keep the synthetic sound-field animation.
    }
  }

  function stopSoundField() {
    soundSwitch.setAttribute('aria-pressed', 'false');
    soundSwitch.querySelector('span:last-child').textContent = '唤醒声场';
    body.classList.remove('sound-active');
    world.style.filter = '';
    if (audioFrame) cancelAnimationFrame(audioFrame);
    if (audioContext) audioContext.close();
    audioContext = null;
    analyser = null;
  }

  function toggleMotion() {
    const reduced = body.classList.toggle('reduced-motion');
    motionToggle.textContent = reduced ? '恢复动态' : '减少动态';
    localStorage.setItem('yuzan-reduced-motion', String(reduced));
  }

  loginTab.addEventListener('click', () => switchMode('login'));
  registerTab.addEventListener('click', () => switchMode('register'));
  document.addEventListener('pointermove', onPointerMove, { passive: true });
  document.querySelectorAll('[data-password-target]').forEach(button => button.addEventListener('click', () => togglePassword(button)));
  document.querySelectorAll('.identity-card').forEach(card => card.addEventListener('click', () => selectRole(card)));
  loginPanel.addEventListener('submit', event => { event.preventDefault(); submitAuth(loginPanel, 'login'); });
  registerPanel.addEventListener('submit', event => { event.preventDefault(); submitAuth(registerPanel, 'register'); });
  loginPanel.addEventListener('input', () => clearAuthMessage('login'));
  registerPanel.addEventListener('input', () => clearAuthMessage('register'));
  soundSwitch.addEventListener('click', startSoundField);
  motionToggle.addEventListener('click', toggleMotion);
  document.getElementById('forgotButton').addEventListener('click', () => window.alert('请接入现有项目的找回密码流程。'));
  document.querySelectorAll('.field input').forEach(input => input.addEventListener('input', () => input.closest('.field')?.classList.remove('is-invalid')));

  if (localStorage.getItem('yuzan-reduced-motion') === 'true' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    body.classList.add('reduced-motion');
    motionToggle.textContent = '恢复动态';
  }

  reveal();
  startStoryRotation();
})();
