(() => {
  const Api = window.YuzanApi;
  if (!Api) return;

  const byId = id => document.getElementById(id);
  const panel = byId('connectionPanel');
  const name = byId('profileName');
  const profileMeta = byId('profileMeta');
  const connectionStatus = byId('connectionStatus');
  const connectionDescription = byId('connectionDescription');
  const connectionMeta = byId('connectionMeta');
  const classList = byId('classList');
  const bindForm = byId('bindTeacherForm');
  const codeInput = byId('teacherCode');
  const bindButton = byId('bindTeacherBtn');
  const message = byId('bindMessage');
  const retryButton = byId('profileRetry');
  const schoolPicker = byId('schoolPicker');
  const schoolSelect = byId('schoolSelect');
  const todayLink = byId('todayLink');
  const practiceLink = byId('practiceLink');

  let loadVersion = 0;
  let loadedIdentity = '';
  let pendingBinding = null;
  let busy = false;
  let requestedSchoolId = '';
  let identityTimer = 0;

  function storedUser() {
    return Api.getStoredUser?.() || {};
  }

  function currentUserId() {
    const user = storedUser();
    return String(user.id || user.userId || '');
  }

  function activeSchoolId() {
    return String(Api.getActiveSchoolId?.() || '');
  }

  function identityKey() {
    return `${currentUserId()}|${activeSchoolId()}`;
  }

  function studentMembership(user, schoolId) {
    return (user?.memberships || []).some(item => item.role === 'STUDENT' && item.schoolId === schoolId);
  }

  function schoolOptions(user) {
    const bySchool = new Map();
    for (const membership of user?.memberships || []) {
      if (membership.role === 'STUDENT' && membership.schoolId) bySchool.set(membership.schoolId, membership);
    }
    return [...bySchool.values()].sort((left, right) => String(left.schoolName || left.schoolId).localeCompare(String(right.schoolName || right.schoolId), 'zh-CN'));
  }

  function setMessage(value = '', kind = '') {
    message.textContent = value;
    message.className = `form-message${kind ? ` ${kind}` : ''}`;
  }

  function setState(state, title, description) {
    panel.dataset.state = state;
    const pathway = document.querySelector('.pathway');
    if (pathway) pathway.dataset.state = state;
    connectionStatus.textContent = title;
    connectionDescription.textContent = description;
  }

  function setClasses(items, schoolName = '') {
    connectionMeta.replaceChildren();
    if (schoolName) {
      const schoolTag = document.createElement('span');
      schoolTag.className = 'meta-tag school-tag';
      schoolTag.textContent = schoolName;
      connectionMeta.append(schoolTag);
    }
    classList.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('span');
      empty.className = 'empty-state';
      empty.textContent = '当前学校还没有本人有效班级学籍。';
      classList.append(empty);
      const noClass = document.createElement('span');
      noClass.className = 'meta-tag';
      noClass.textContent = '尚未加入班级';
      connectionMeta.append(noClass);
      return;
    }
    for (const item of items) {
      const tag = document.createElement('span');
      tag.className = 'meta-tag class-tag';
      tag.textContent = [item.grade, item.name].filter(Boolean).join(' · ') || '已加入班级';
      tag.dataset.classId = item.id;
      classList.append(tag);
      const metaTag = document.createElement('span');
      metaTag.className = 'meta-tag class-tag';
      metaTag.textContent = tag.textContent;
      connectionMeta.append(metaTag);
    }
  }

  function setSchoolPicker(user, selectedSchoolId) {
    const options = schoolOptions(user);
    schoolSelect.replaceChildren();
    for (const membership of options) {
      const option = document.createElement('option');
      option.value = membership.schoolId;
      option.textContent = membership.schoolName || '已加入学校';
      schoolSelect.append(option);
    }
    schoolPicker.hidden = options.length < 2;
    schoolSelect.disabled = busy || Boolean(pendingBinding);
    if (options.some(item => item.schoolId === selectedSchoolId)) schoolSelect.value = selectedSchoolId;
    else if (requestedSchoolId && options.some(item => item.schoolId === requestedSchoolId)) schoolSelect.value = requestedSchoolId;
  }

  function hideLearningLinks() {
    todayLink.hidden = true;
    practiceLink.hidden = true;
    byId('nextStepDescription').textContent = '核实有效班级后，这里会显示本人可访问的学习入口。';
  }

  function clearProfile({ keepSchoolOptions = false, keepMessage = false } = {}) {
    loadVersion += 1;
    name.textContent = '正在读取个人档案';
    profileMeta.textContent = '请稍候…';
    byId('statCompleted').textContent = '—';
    byId('statTotal').textContent = '—';
    byId('statsNote').textContent = '正在读取当前学籍统计。';
    classList.replaceChildren();
    const loading = document.createElement('span');
    loading.className = 'empty-state';
    loading.textContent = '正在读取本人班级…';
    classList.append(loading);
    connectionMeta.replaceChildren();
    setState('loading', '正在核对班级关系', '正在读取当前学生的学校与班级授权信息。');
    byId('journeyConnection').textContent = '核对中';
    retryButton.hidden = true;
    hideLearningLinks();
    loadedIdentity = '';
    if (!keepSchoolOptions) {
      schoolPicker.hidden = true;
      schoolSelect.replaceChildren();
    }
    if (!keepMessage) setMessage('');
  }

  function renderStats(profile, classes) {
    const completed = profile.completedActivities;
    const total = profile.totalActivities;
    if (!classes.length) {
      byId('statCompleted').textContent = '—';
      byId('statTotal').textContent = '—';
      byId('statsNote').textContent = '暂无统计：当前学校尚无本人有效班级学籍。';
      return;
    }
    const validCompleted = Number.isSafeInteger(completed) && completed >= 0;
    const validTotal = Number.isSafeInteger(total) && total >= 0;
    byId('statCompleted').textContent = validCompleted ? String(completed) : '—';
    byId('statTotal').textContent = validTotal ? String(total) : '—';
    if (!validCompleted && !validTotal) {
      byId('statsNote').textContent = '暂无统计：服务器没有提供当前学籍的活动统计。';
    } else if (!validCompleted || !validTotal) {
      byId('statsNote').textContent = '部分统计暂无数据；“—”表示服务器未提供该项。';
    } else {
      byId('statsNote').textContent = total === 0
        ? '当前学籍尚无学习活动进度记录；服务器明确返回 0。'
        : '以上为服务器返回的当前学生学籍活动进度；0 表示服务端明确返回零条记录。';
    }
  }

  function unwrapProfile(response) {
    return response?.profile || response?.data?.profile || response?.data || response;
  }

  function unwrapClasses(response) {
    const items = response?.items || response?.data?.items || response?.data || [];
    return Array.isArray(items) ? items.filter(item => item && typeof item.id === 'string') : [];
  }

  function apiErrorText(error, fallback) {
    if (error?.status === 401) return '登录已过期，请重新登录后继续。';
    if (error?.status === 403) return '当前账号无权读取所选学校或班级，请检查学生身份。';
    if (error?.status === 404) return error.message || '未找到该邀请码或个人档案。';
    if (error?.status === 409) return error.message || '邀请码已失效，请向教师确认后再试。';
    if (error?.status >= 500 || !error?.status) return '网络暂时不可用或服务未能确认结果，请检查连接后安全重试。';
    return error?.message || fallback;
  }

  function isSameUser(expectedUserId) {
    return Boolean(expectedUserId) && currentUserId() === expectedUserId;
  }

  async function readAuthorizedProfile(version, expectedUserId, schoolId, targetBinding = null) {
    if (version !== loadVersion || !isSameUser(expectedUserId)) return { stale: true };
    if (activeSchoolId() !== schoolId) throw new Error('当前学习学校已变化，请重新读取档案。');
    const userBeforeRead = storedUser();
    if (!studentMembership(userBeforeRead, schoolId)) throw new Error('当前登录身份没有所选学校的学生学籍。');
    const [profileResponse, classResponse] = await Promise.all([
      Api.getStudentProfile(),
      Api.listClasses({ limit: 100 }),
    ]);
    if (version !== loadVersion || !isSameUser(expectedUserId)) return { stale: true };
    if (activeSchoolId() !== schoolId) throw new Error('读取期间学习学校发生变化，请重新核对。');

    const profile = unwrapProfile(profileResponse);
    const classes = unwrapClasses(classResponse);
    if (!profile || profile.userId !== expectedUserId) throw new Error('档案身份与当前登录学生不一致，已停止显示。');
    if (!profile.schoolName) throw new Error('服务器没有返回当前学籍学校，暂不能确认档案。');
    const profileClassName = profile.className;
    if (profileClassName && !classes.some(item => item.name === profileClassName && (!profile.gradeBand || item.grade === profile.gradeBand))) {
      throw new Error('个人档案与本人班级授权列表不一致，暂不能确认入班状态。');
    }

    let targetClass = null;
    if (targetBinding) {
      targetClass = classes.find(item => item.id === targetBinding.classId) || null;
      if (!targetClass || targetClass.name !== targetBinding.className || targetClass.grade !== targetBinding.grade) {
        throw new Error('绑定状态待核实：服务器已返回绑定结果，但本人授权班级列表尚未确认目标班级。请重新核实。');
      }
    }

    name.textContent = profile.displayName || '当前学生';
    profileMeta.textContent = `${profile.schoolName} · ${classes.length ? `${classes.length} 个有效班级` : '尚未加入班级'}`;
    setClasses(classes, profile.schoolName);
    renderStats(profile, classes);
    setSchoolPicker(storedUser(), schoolId);
    if (classes.length) {
      setState('connected', `已核对 ${classes.length} 个班级`, '学校关系和班级列表来自当前登录学生的授权API。');
      byId('journeyConnection').textContent = `${classes.length} 个班级已核对`;
      byId('nextStepDescription').textContent = '这些入口将使用当前学生和所选学校的有效学籍。';
      todayLink.hidden = false;
      practiceLink.hidden = false;
    } else {
      setState('unbound', '当前学校尚无班级学籍', '可输入教师邀请码加入班级；学习入口会在学籍核实后开放。');
      byId('journeyConnection').textContent = '等待教师邀请码';
      hideLearningLinks();
    }
    loadedIdentity = identityKey();
    retryButton.hidden = true;
    return { profile, classes, targetClass };
  }

  function setFormBusy(value) {
    busy = value;
    bindButton.disabled = value;
    bindForm.setAttribute('aria-busy', String(value));
    schoolSelect.disabled = value || Boolean(pendingBinding);
  }

  function setPendingFormState() {
    codeInput.readOnly = Boolean(pendingBinding);
    if (pendingBinding?.kind === 'ambiguous') bindButton.textContent = '安全重试并核对';
    else if (pendingBinding) bindButton.textContent = '重新核实入班状态';
    else bindButton.textContent = document.querySelectorAll('#classList .class-tag').length ? '添加教师班级' : '绑定教师班级';
    schoolSelect.disabled = busy || Boolean(pendingBinding);
  }

  async function verifyPendingBinding() {
    const target = pendingBinding;
    if (!target || busy) return;
    setFormBusy(true);
    clearProfile({ keepSchoolOptions: true, keepMessage: true });
    setState('pending', '绑定状态待核实', '正在切换到目标学校并重新读取本人档案与授权班级列表。');
    setMessage('绑定状态待核实：正在重新读取学校、个人档案和班级授权。', 'pending');
    try {
      if (target.kind === 'ambiguous') {
        pendingBinding = null;
        codeInput.readOnly = false;
        setFormBusy(false);
        await submitInvitation(target.code, true);
        return;
      }
      if (!isSameUser(target.userId)) throw new Error('登录身份已变化，请使用当前账号重新核对。');
      if (activeSchoolId() !== target.schoolId) {
        await Api.selectSchool(target.schoolId);
        if (!isSameUser(target.userId)) return;
      }
      if (activeSchoolId() !== target.schoolId) throw new Error('学校切换没有生效，请重试核实。');
      const version = ++loadVersion;
      const result = await readAuthorizedProfile(version, target.userId, target.schoolId, target);
      if (result.stale) return;
      pendingBinding = null;
      codeInput.value = '';
      codeInput.readOnly = false;
      setPendingFormState();
      const verb = target.alreadyBound ? '已在该班级' : '已加入该班级';
      setMessage(`${verb}：${target.grade} ${target.className}。本人学校和班级学籍已重新核实。`, 'success');
    } catch (error) {
      if (!isSameUser(target.userId)) return;
      if (error?.status === 401) {
        setMessage(apiErrorText(error, '登录已过期。'), 'error');
        location.href = '/login/';
        return;
      }
      setState('pending', '绑定状态待核实', '邀请码提交已经收到服务端确认；学校或个人档案尚未完成复核。');
      setMessage(`绑定状态待核实：${apiErrorText(error, '重新读取失败，请安全重试。')}`, 'pending');
    } finally {
      setFormBusy(false);
      setPendingFormState();
    }
  }

  async function submitInvitation(value, safeRetry = false) {
    if (busy) return;
    const code = String(value || '').trim();
    if (!code) {
      setMessage('请输入教师提供的邀请码。', 'error');
      codeInput.focus();
      return;
    }
    const userId = currentUserId();
    if (!userId) {
      setMessage('登录身份不可用，请重新登录后再试。', 'error');
      return;
    }
    setFormBusy(true);
    retryButton.hidden = true;
    setMessage(safeRetry ? '正在安全重试并核对之前的绑定状态…' : '正在向服务端验证邀请码…');
    try {
      const result = await Api.bindTeacherInvitation(code);
      if (!isSameUser(userId)) return;
      if (!result?.schoolId || !result?.class?.id || !result?.class?.name || !result?.class?.grade) {
        pendingBinding = { kind: 'ambiguous', code, userId };
        throw new Error('服务端确认格式不完整，需要安全重试并核实。');
      }
      pendingBinding = {
        kind: 'confirmed',
        code,
        userId,
        schoolId: result.schoolId,
        classId: result.class.id,
        className: result.class.name,
        grade: result.class.grade,
        alreadyBound: Boolean(result.alreadyBound),
      };
      codeInput.readOnly = true;
      setState('pending', '绑定状态待核实', '服务端已确认邀请码；正在选择目标学校并核对本人班级学籍。');
      setMessage('服务端已确认邀请码，正在切换学校并重新读取本人档案…', 'pending');
      setFormBusy(false);
      await verifyPendingBinding();
    } catch (error) {
      if (!isSameUser(userId)) return;
      if (pendingBinding?.kind === 'confirmed') {
        setState('pending', '绑定状态待核实', '服务端已确认绑定；学校切换或档案复核尚未完成。');
        setMessage(`绑定状态待核实：${apiErrorText(error, '重新读取档案失败，请再次核实。')}`, 'pending');
      } else if (error?.status === 401) {
        setMessage(apiErrorText(error, '登录已过期。'), 'error');
        location.href = '/login/';
      } else if (error?.status === 403 || error?.status === 404 || error?.status === 409 || (error?.status >= 400 && error?.status < 500)) {
        pendingBinding = null;
        setMessage(apiErrorText(error, '请检查邀请码后重试。'), 'error');
      } else {
        pendingBinding = { kind: 'ambiguous', code, userId };
        setState('pending', '绑定状态待核实', '网络没有收到完整确认；可用同一邀请码安全重试，再读取本人班级学籍。');
        setMessage('绑定状态待核实：网络没有收到完整确认。安全重试会由服务端识别已加入状态，不会重复消耗邀请码次数。', 'pending');
      }
    } finally {
      setFormBusy(false);
      setPendingFormState();
    }
  }

  async function switchSchool(schoolId) {
    if (!schoolId || busy) return;
    const userId = currentUserId();
    requestedSchoolId = schoolId;
    pendingBinding = null;
    codeInput.readOnly = false;
    clearProfile({ keepSchoolOptions: true });
    setMessage('正在切换学校并重新读取档案…');
    setFormBusy(true);
    try {
      await Api.selectSchool(schoolId);
      if (!isSameUser(userId)) return;
      if (activeSchoolId() !== schoolId || !studentMembership(storedUser(), schoolId)) throw new Error('学校切换没有得到当前学生学籍确认。');
      const version = ++loadVersion;
      await readAuthorizedProfile(version, userId, schoolId);
      if (!isSameUser(userId)) return;
      requestedSchoolId = '';
      setMessage('学校已切换，个人档案已重新读取。', 'success');
    } catch (error) {
      if (!isSameUser(userId)) return;
      setState('error', '学校或档案暂不可用', '为保护隐私，已清除上一所学校的个人信息。');
      setMessage(apiErrorText(error, '学校切换失败，请重试。'), 'error');
      retryButton.textContent = '重试学校切换与档案读取';
      retryButton.hidden = false;
    } finally {
      setFormBusy(false);
      setSchoolPicker(storedUser(), activeSchoolId());
      setPendingFormState();
    }
  }

  async function enterStudentProfile() {
    pendingBinding = null;
    codeInput.value = '';
    codeInput.readOnly = false;
    clearProfile();
    const version = loadVersion;
    if (!Api.requireAuth?.()) return;
    const user = storedUser();
    const userId = currentUserId();
    if (!userId) {
      setState('error', '登录身份不可用', '请重新登录后读取本人档案。');
      return;
    }
    let schoolId = activeSchoolId();
    if (!schoolId) {
      const memberships = schoolOptions(user);
      if (!memberships.length) {
        profileMeta.textContent = '当前账号没有可用的学生学校学籍';
        setState('unbound', '等待教师邀请码', '你可以输入教师邀请码；服务端会验证并建立学校和班级学籍。');
        byId('journeyConnection').textContent = '待绑定';
        byId('statsNote').textContent = '暂无统计：当前账号没有已选择的学生学校学籍。';
        setClasses([], '');
        setPendingFormState();
        return;
      }
      schoolId = memberships[0].schoolId;
      try {
        await Api.selectSchool(schoolId);
        if (version !== loadVersion || !isSameUser(userId)) return;
      } catch (error) {
        setState('error', '无法选择学生学校', '为保护隐私，当前没有显示其他身份的档案数据。');
        setMessage(apiErrorText(error, '无法恢复学生学校，请重试。'), 'error');
        retryButton.hidden = false;
        return;
      }
    }
    if (!studentMembership(storedUser(), schoolId)) {
      const memberships = schoolOptions(storedUser());
      if (memberships.length) {
        schoolId = memberships[0].schoolId;
        try {
          await Api.selectSchool(schoolId);
          if (version !== loadVersion || !isSameUser(userId)) return;
        } catch (error) {
          setState('error', '无法选择学生学校', '为保护隐私，当前没有显示其他身份的档案数据。');
          setMessage(apiErrorText(error, '无法选择学生学校，请重试。'), 'error');
          retryButton.hidden = false;
          return;
        }
      }
    }
    if (!studentMembership(storedUser(), schoolId)) {
      setState('error', '当前身份不是所选学校的学生', '请切换到本人有效的学生学籍。');
      profileMeta.textContent = '该学校没有当前登录学生的授权关系';
      setMessage('当前账号无权读取该学校的学生档案。', 'error');
      return;
    }
    try {
      const result = await readAuthorizedProfile(version, userId, schoolId);
      if (result.stale) return;
      setPendingFormState();
    } catch (error) {
      if (version !== loadVersion || !isSameUser(userId)) return;
      if (error?.status === 401) {
        location.href = '/login/';
        return;
      }
      name.textContent = '个人档案暂不可用';
      profileMeta.textContent = '请重新读取本人档案';
      setState('error', '暂时无法核对班级关系', '读取失败时不会沿用上一位学生或另一所学校的数据。');
      byId('statsNote').textContent = '读取失败：没有显示缓存的学习统计。';
      setMessage(apiErrorText(error, '加载失败，请检查网络后重试。'), 'error');
      retryButton.textContent = '重新读取档案';
      retryButton.hidden = false;
    }
  }

  bindForm.addEventListener('submit', event => {
    event.preventDefault();
    if (busy) return;
    if (pendingBinding?.kind === 'confirmed') {
      verifyPendingBinding();
      return;
    }
    if (pendingBinding?.kind === 'ambiguous') {
      const code = pendingBinding.code;
      pendingBinding = null;
      codeInput.readOnly = false;
      submitInvitation(code, true);
      return;
    }
    submitInvitation(codeInput.value);
  });

  schoolSelect.addEventListener('change', event => switchSchool(event.target.value));
  retryButton.addEventListener('click', () => {
    if (pendingBinding?.kind === 'confirmed') {
      verifyPendingBinding();
      return;
    }
    if (requestedSchoolId) {
      const schoolId = requestedSchoolId;
      requestedSchoolId = '';
      switchSchool(schoolId);
      return;
    }
    enterStudentProfile();
  });
  byId('logoutBtn').addEventListener('click', async () => {
    if (!confirm('确定退出当前账号吗？')) return;
    pendingBinding = null;
    clearProfile();
    await Api.logout();
    location.href = '/';
  });

  function handleExternalIdentityChange() {
    clearTimeout(identityTimer);
    pendingBinding = null;
    codeInput.value = '';
    codeInput.readOnly = false;
    clearProfile();
    const sharedNav = document.querySelector('.student-topbar');
    if (sharedNav) {
      sharedNav.hidden = true;
      sharedNav.setAttribute('aria-hidden', 'true');
    }
    identityTimer = setTimeout(() => location.reload(), 0);
  }

  window.addEventListener('storage', event => {
    if (event.key === null || ['yuzan-access-token', 'yuzan-current-user', 'yuzan-active-school-id'].includes(event.key)) {
      handleExternalIdentityChange();
    }
  });
  window.addEventListener('focus', () => {
    if (loadedIdentity && identityKey() !== loadedIdentity) handleExternalIdentityChange();
  });

  enterStudentProfile();
})();
