(() => {
  'use strict';

  const toast = document.getElementById("toast");
  const drawerBackdrop = document.getElementById("drawerBackdrop");
  const drawerTitle = document.getElementById("drawerTitle");
  const drawerText = document.getElementById("drawerText");
  const drawerData = document.getElementById("drawerData");
  const invitationDialog = document.getElementById('studentInvitationDialog');
  const invitationRevokeDialog = document.getElementById('invitationRevokeDialog');
  const invitationItemsEl = document.getElementById('invitationItems');
  const invitationStatusEl = document.getElementById('invitationStatus');
  const invitationReadErrorEl = document.getElementById('invitationReadError');
  const invitationReadErrorTextEl = document.getElementById('invitationReadErrorText');
  const invitationEmptyEl = document.getElementById('invitationEmpty');
  const invitationCreateForm = document.getElementById('invitationCreateForm');
  let toastTimer;
  let classId = '';
  let schoolId = '';
  let classDetail = null;
  let studentSummaries = [];
  let publishedCourseVersions = null;
  let pendingRequestKey = '';
  let teacherInvitations = [];
  let invitationReadState = 'idle';
  let invitationCreateInFlight = false;
  let invitationIdentityWatch = null;
  let invitationDialogOpener = null;
  let invitationRevokeOpener = null;
  let invitationRevokeId = '';
  let invitationRevokeInFlight = false;
  const invitationPendingVerification = new Map();
  const requestedStudentId = new URLSearchParams(location.search).get('studentId') || '';
  const requestedSchoolId = new URLSearchParams(location.search).get('schoolId') || '';

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function formatActivityDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function apiErrorLabel(error, fallback) {
    if (error?.status === 401) return '登录已过期，请重新登录后重试。';
    if (error?.status === 403) return '当前账号没有该班级数据的访问权限。';
    if (error?.status === 404) return '班级或目标记录不存在。';
    return `${error?.message || fallback}。请检查网络后重试。`;
  }

  const invitationStatusLabels = {
    ACTIVE: '可使用',
    EXPIRED: '已过期',
    REVOKED: '已撤销',
    EXHAUSTED: '使用次数已满',
    VERIFYING: '等待服务器核实',
  };

  function invitationCurrentIdentityMatches() {
    if (typeof YuzanApi === 'undefined' || !YuzanApi.getToken()) return false;
    return Boolean(schoolId && YuzanApi.getActiveSchoolId() === schoolId);
  }

  function invitationCount(value) {
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : '服务器未返回';
  }

  function invitationExpiry(value) {
    if (typeof value !== 'string' || !value.trim()) return '服务器未返回';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '服务器未返回有效日期' : date.toLocaleString('zh-CN');
  }

  function setInvitationStatus(state, message) {
    invitationReadState = state;
    invitationStatusEl.dataset.state = state;
    invitationStatusEl.textContent = message;
    invitationReadErrorEl.hidden = state !== 'error';
    invitationEmptyEl.hidden = state !== 'loaded' || teacherInvitations.some((item) => item.status === 'ACTIVE') || !invitationCreateForm.hidden;
    const createButton = document.getElementById('invitationCreateButton');
    if (createButton) {
      createButton.disabled = invitationCreateInFlight || state !== 'loaded' || teacherInvitations.some((item) => item.status === 'ACTIVE');
    }
  }

  function renderTeacherInvitations() {
    invitationItemsEl.innerHTML = teacherInvitations.map((item) => {
      const serverStatus = typeof item.status === 'string' ? item.status : '';
      const pendingVerification = invitationPendingVerification.has(item.id);
      const status = pendingVerification ? 'VERIFYING' : serverStatus;
      const statusLabel = invitationStatusLabels[status] || '服务器未返回状态';
      const isUsable = status === 'ACTIVE' && typeof item.code === 'string' && item.code.trim();
      const isRevoked = status === 'REVOKED';
      const safeId = escapeHtml(item.id || '');
      const usedCount = invitationCount(item.usedCount);
      const maxUses = invitationCount(item.maxUses);
      const hasUsage = typeof item.usedCount === 'number' && Number.isFinite(item.usedCount)
        && typeof item.maxUses === 'number' && Number.isFinite(item.maxUses) && item.maxUses > 0;
      const usagePercent = hasUsage ? Math.min(100, Math.max(0, item.usedCount / item.maxUses * 100)) : 0;
      const codeMarkup = isUsable
        ? `<div class="invitation-code-row"><label class="invitation-code-label" for="invitation-code-${safeId}">本班邀请码</label><input id="invitation-code-${safeId}" class="invitation-code-input" type="text" value="${escapeHtml(item.code)}" readonly autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="本班真实邀请码，可选中后手动复制" /><button class="invitation-copy-button" type="button" data-copy-invitation="${safeId}">复制邀请码</button><p class="invitation-copy-feedback" id="invitation-copy-feedback-${safeId}" role="status" aria-live="polite"></p></div>`
        : `<p class="invitation-hidden-code">${pendingVerification ? '撤销结果待服务器核实，凭证暂时隐藏；重新读取不会重复提交撤销。' : status ? '失效凭证已隐藏，不能用于邀请新学生。' : '邀请码状态未确认，已隐藏凭证。'}</p>`;
      const revokeMarkup = isUsable
        ? `<button class="invitation-revoke-button" type="button" data-revoke-invitation="${safeId}" aria-haspopup="dialog" aria-controls="invitationRevokeDialog">撤销邀请码</button>`
        : '';
      return `<article class="invitation-record ${isUsable ? 'is-usable' : 'is-inactive'} ${isRevoked ? 'is-revoked' : ''} ${pendingVerification ? 'is-verifying' : ''}" data-invitation-id="${safeId}">
        <header class="invitation-record-heading"><span>学生入班 · ${status === 'ACTIVE' && !isUsable ? '凭证字段缺失' : status ? escapeHtml(status) : '状态未知'}</span><b class="invitation-state-tag" data-status="${escapeHtml(status || 'UNKNOWN')}">${escapeHtml(statusLabel)}</b></header>
        ${codeMarkup}
        ${revokeMarkup}
        ${isRevoked ? '<span class="invitation-revoke-seal" aria-hidden="true">撤</span>' : ''}
        <div class="invitation-usage"><div><span>使用进度</span><strong>${usedCount} / ${maxUses} 次</strong></div>${hasUsage ? `<div class="invitation-meter" role="img" aria-label="已使用 ${usedCount} 次，共 ${maxUses} 次"><span style="width:${usagePercent}%"></span></div>` : '<div class="invitation-meter invitation-meter-unknown" role="img" aria-label="服务器未返回完整使用次数"></div>'}</div>
        <div class="invitation-expiry"><span>有效期至</span><time>${escapeHtml(invitationExpiry(item.expiresAt))}</time></div>
      </article>`;
    }).join('');
    invitationEmptyEl.hidden = invitationReadState !== 'loaded' || teacherInvitations.some((item) => item.status === 'ACTIVE') || !invitationCreateForm.hidden;
    const createButton = document.getElementById('invitationCreateButton');
    if (createButton) {
      createButton.disabled = invitationCreateInFlight || invitationReadState !== 'loaded' || teacherInvitations.some((item) => item.status === 'ACTIVE');
    }
  }

  function setInvitationScopeLabel(mismatch = false) {
    const classLabel = document.getElementById('invitationClassLabel');
    const scopeDetail = document.getElementById('invitationScopeDetail');
    if (mismatch) {
      classLabel.textContent = '账号或学校已切换';
      scopeDetail.textContent = '当前页面与已选学校不一致，凭证已隐藏';
      return;
    }
    classLabel.textContent = classDetail?.className || classDetail?.name || '当前授权班级';
    scopeDetail.textContent = `学校 ${schoolId} · 班级 ${classId}`;
  }

  function clearTeacherInvitations(message = '邀请码已清除，请重新读取当前班级凭证。') {
    teacherInvitations = [];
    invitationPendingVerification.clear();
    invitationItemsEl.replaceChildren();
    invitationCreateForm.hidden = true;
    document.getElementById('invitationCreateMessage').textContent = '';
    setInvitationStatus('idle', message);
    renderTeacherInvitations();
  }

  async function loadTeacherInvitations() {
    teacherInvitations = [];
    invitationItemsEl.replaceChildren();
    invitationCreateForm.hidden = true;
    document.getElementById('invitationCreateMessage').textContent = '';
    if (typeof YuzanApi === 'undefined' || !YuzanApi.getToken()) {
      setInvitationScopeLabel(true);
      invitationReadErrorTextEl.textContent = '登录状态不可用，请重新登录后查看本人任教班级。';
      setInvitationStatus('error', '服务器读取失败 · 登录状态不可用');
      return [];
    }
    if (!invitationCurrentIdentityMatches()) {
      setInvitationScopeLabel(true);
      invitationReadErrorTextEl.textContent = '当前账号的已选学校与此班级页面不一致。请从当前学校的班级列表重新进入。';
      setInvitationStatus('error', '学校已切换 · 本班邀请码已隐藏');
      return [];
    }
    const tokenAtRequest = YuzanApi.getToken();
    setInvitationScopeLabel(false);
    setInvitationStatus('loading', '正在从服务器读取本班邀请码…');
    try {
      const response = await YuzanApi.listMyTeacherInvitations();
      if (YuzanApi.getToken() !== tokenAtRequest || !invitationCurrentIdentityMatches()) {
        setInvitationScopeLabel(true);
        invitationReadErrorTextEl.textContent = '账号或学校在读取期间发生变化，已丢弃旧页面的凭证。';
        setInvitationStatus('error', '账号或学校已切换 · 本班邀请码已隐藏');
        return [];
      }
      const records = Array.isArray(response) ? response : response?.items;
      if (!Array.isArray(records)) throw new Error('服务器没有返回邀请码列表');
      teacherInvitations = records.filter((item) => item?.class?.id === classId);
      for (const [invitationId, verificationState] of invitationPendingVerification) {
        const current = teacherInvitations.find((item) => item.id === invitationId);
        if (current?.status === 'REVOKED' || (current && verificationState === 'post-unconfirmed')) {
          invitationPendingVerification.delete(invitationId);
        }
      }
      invitationCreateForm.hidden = true;
      renderTeacherInvitations();
      setInvitationStatus('loaded', teacherInvitations.length
        ? `服务器已读取本班 ${teacherInvitations.length} 条邀请记录。`
        : '服务器已读取本班记录 · 当前没有可使用的邀请码');
      if (invitationPendingVerification.size) {
        setInvitationStatus('error', '有邀请码撤销结果尚待核实 · 凭证已隐藏 · 请重新读取');
        invitationReadErrorTextEl.textContent = '服务器列表仍未与撤销响应一致。凭证保持隐藏；重新读取只查询状态，不会再次提交撤销。';
      }
      renderTeacherInvitations();
      return teacherInvitations;
    } catch (error) {
      teacherInvitations = [];
      invitationItemsEl.replaceChildren();
      invitationReadErrorTextEl.textContent = error?.status === 401
        ? '登录已过期，请重新登录后读取本班邀请码。'
        : error?.status === 403
          ? '当前账号无权读取本班邀请码，请确认教师与学校身份。'
          : error?.status === 404
            ? '当前班级不存在或已不可用，请返回本人授权班级列表。'
            : `${error?.message || '读取本班邀请码失败'}。请检查网络后重试。`;
      setInvitationStatus('error', '服务器读取失败');
      return null;
    }
  }

  function openTeacherInvitationDialog() {
    if (typeof YuzanApi === 'undefined' || !YuzanApi.getToken()) {
      showToast('请先登录教师账号');
      return;
    }
    if (!schoolId || !classId) {
      showToast('学校或班级信息不可用，无法读取入班凭证');
      return;
    }
    if (!invitationDialog.open) {
      invitationDialogOpener = document.activeElement;
      invitationDialog.showModal();
    }
    document.getElementById('studentInvitationClose').focus();
    setInvitationScopeLabel(YuzanApi.getActiveSchoolId() !== schoolId);
    void loadTeacherInvitations();
    clearInterval(invitationIdentityWatch);
    const tokenAtOpen = YuzanApi.getToken();
    invitationIdentityWatch = setInterval(() => {
      if (!invitationDialog.open || typeof YuzanApi === 'undefined') return;
      if (YuzanApi.getToken() !== tokenAtOpen || YuzanApi.getActiveSchoolId() !== schoolId) {
        clearTeacherInvitations('账号或学校已切换，旧凭证已清除。');
        setInvitationScopeLabel(true);
        invitationDialog.close();
        showToast('账号或学校已切换，本班邀请码已清除');
      }
    }, 500);
  }

  async function copyTeacherInvitation(invitationId, button) {
    button.disabled = true;
    button.textContent = '正在核验…';
    const records = await loadTeacherInvitations();
    const feedback = document.getElementById(`invitation-copy-feedback-${invitationId}`);
    if (feedback) feedback.textContent = '';
    const invitation = records?.find((item) => item.id === invitationId && item.status === 'ACTIVE'
      && typeof item.code === 'string' && item.code.trim());
    if (!invitation) {
      if (feedback) feedback.textContent = invitationReadState === 'error'
        ? '服务器读取失败，请重新读取后再复制。'
        : '该邀请码已失效或不属于当前班级，无法复制。';
      showToast(invitationReadState === 'error' ? '服务器读取失败，未复制邀请码' : '邀请码已失效，未复制');
      return;
    }
    const currentButton = [...invitationItemsEl.querySelectorAll('[data-copy-invitation]')]
      .find((item) => item.dataset.copyInvitation === invitationId);
    const codeInput = document.getElementById(`invitation-code-${invitationId}`);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(invitation.code);
      if (feedback) feedback.textContent = '邀请码已复制。';
      showToast('邀请码已复制');
    } catch {
      if (codeInput) {
        codeInput.focus();
        codeInput.select();
        codeInput.setSelectionRange(0, codeInput.value.length);
      }
      if (feedback) feedback.textContent = '复制失败。邀请码已选中，请使用键盘或菜单手动复制。';
      showToast('复制失败，请手动复制已选中的邀请码');
    } finally {
      if (currentButton) {
        currentButton.disabled = false;
        currentButton.textContent = '复制邀请码';
      }
    }
  }

  function openInvitationRevokeConfirmation(invitationId, opener) {
    const invitation = teacherInvitations.find((item) => item.id === invitationId
      && item.status === 'ACTIVE' && typeof item.code === 'string' && item.code.trim());
    if (!invitation || invitationPendingVerification.has(invitationId)) {
      showToast('服务器尚未确认此邀请码可撤销，请重新读取');
      void loadTeacherInvitations();
      return;
    }
    if (!invitationCurrentIdentityMatches()) {
      clearTeacherInvitations('账号或学校已切换，旧凭证已清除。');
      setInvitationScopeLabel(true);
      invitationDialog.close();
      return;
    }
    invitationRevokeId = invitationId;
    invitationRevokeOpener = opener;
    const className = invitation.class?.name || classDetail?.className || classDetail?.name || '当前授权班级';
    document.getElementById('invitationRevokeTarget').textContent = `${className} · 已使用 ${invitationCount(invitation.usedCount)} / ${invitationCount(invitation.maxUses)} 次`;
    document.getElementById('invitationRevokeMessage').textContent = '';
    document.getElementById('invitationRevokeConfirm').disabled = false;
    document.getElementById('invitationRevokeCancel').disabled = false;
    if (!invitationRevokeDialog.open) invitationRevokeDialog.showModal();
    document.getElementById('invitationRevokeCancel').focus();
  }

  function handleInvitationRevokeTabKey(event) {
    if (event.key !== 'Tab') return;
    const focusable = [...invitationRevokeDialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function revokeTeacherInvitation() {
    if (invitationRevokeInFlight || !invitationRevokeId) return;
    const invitationId = invitationRevokeId;
    const invitation = teacherInvitations.find((item) => item.id === invitationId && item.status === 'ACTIVE');
    if (!invitation || !invitationCurrentIdentityMatches()) {
      document.getElementById('invitationRevokeMessage').textContent = '当前账号、学校或服务器状态已变化。请关闭后重新读取本班记录。';
      return;
    }

    const tokenAtRequest = YuzanApi.getToken();
    const message = document.getElementById('invitationRevokeMessage');
    const confirmButton = document.getElementById('invitationRevokeConfirm');
    const cancelButton = document.getElementById('invitationRevokeCancel');
    invitationRevokeInFlight = true;
    invitationPendingVerification.set(invitationId, 'requesting');
    confirmButton.disabled = true;
    cancelButton.disabled = true;
    confirmButton.textContent = '正在核对服务器…';
    message.textContent = '只提交一次撤销请求；随后重新读取服务器状态确认结果。';
    renderTeacherInvitations();

    let postAccepted = false;
    let postError = null;
    try {
      const response = await YuzanApi.revokeTeacherInvitation(invitationId);
      const result = response?.data || response;
      if (result?.id !== invitationId || result?.status !== 'REVOKED' || result?.code !== null) {
        throw new Error('撤销接口没有返回完整的服务器 REVOKED 确认');
      }
      postAccepted = true;
    } catch (error) {
      postError = error;
    }

    if (YuzanApi.getToken() !== tokenAtRequest || !invitationCurrentIdentityMatches()) {
      clearTeacherInvitations('账号或学校已切换，旧凭证已清除。');
      setInvitationScopeLabel(true);
      invitationRevokeDialog.close();
      invitationDialog.close();
      invitationRevokeInFlight = false;
      return;
    }

    invitationPendingVerification.set(invitationId, postAccepted ? 'post-confirmed' : 'post-unconfirmed');
    const refreshed = await loadTeacherInvitations();
    if (YuzanApi.getToken() !== tokenAtRequest || !invitationCurrentIdentityMatches()) {
      clearTeacherInvitations('账号或学校已切换，旧凭证已清除。');
      setInvitationScopeLabel(true);
      invitationRevokeDialog.close();
      invitationDialog.close();
      invitationRevokeInFlight = false;
      return;
    }

    const current = refreshed?.find((item) => item.id === invitationId);
    if (current?.status === 'REVOKED') {
      invitationPendingVerification.delete(invitationId);
      renderTeacherInvitations();
      setInvitationStatus('loaded', '服务器已确认邀请码撤销；已经入班的学生不会移除。');
      document.getElementById('invitationRevokeDialog').close();
      showToast('服务器已确认邀请码撤销');
    } else if (refreshed === null) {
      invitationPendingVerification.set(invitationId, postAccepted ? 'post-confirmed' : 'post-unconfirmed');
      message.textContent = postAccepted
        ? '撤销接口已确认，但最新列表读取失败。凭证已隐藏；请重新读取核实，不会重复提交撤销。'
        : '请求结果未知且列表读取失败。凭证已隐藏；请重新读取核实，不会重复提交撤销。';
      invitationReadErrorTextEl.textContent = message.textContent;
      setInvitationStatus('error', '撤销结果尚未核实 · 凭证已隐藏');
      invitationRevokeDialog.close();
    } else if (postAccepted) {
      invitationPendingVerification.set(invitationId, 'post-confirmed');
      renderTeacherInvitations();
      message.textContent = '撤销接口返回成功，但最新列表仍未确认已撤销。凭证保持隐藏；请重新读取核实。';
      invitationReadErrorTextEl.textContent = message.textContent;
      setInvitationStatus('error', '撤销响应与列表不一致 · 凭证已隐藏');
      invitationRevokeDialog.close();
    } else {
      invitationPendingVerification.delete(invitationId);
      renderTeacherInvitations();
      const statusDescription = current?.status === 'ACTIVE'
        ? '服务器仍确认该邀请码有效，尚未撤销。'
        : '服务器确认该邀请码不是可撤销的有效状态。';
      const failure = postError?.status === 403
        ? '当前教师无权撤销此邀请码。'
        : postError?.status === 404
          ? '邀请码不存在。'
          : postError?.status === 409
            ? '邀请码已过期或使用次数已满，不能撤销。'
            : `${postError?.message || '服务器没有确认撤销'}。`;
      message.textContent = `${failure}${statusDescription}列表已重新读取；未显示撤销成功。`;
      invitationReadErrorTextEl.textContent = message.textContent;
      setInvitationStatus('error', '服务器未确认撤销');
      invitationRevokeDialog.close();
    }

    invitationRevokeInFlight = false;
    confirmButton.disabled = false;
    cancelButton.disabled = false;
    confirmButton.textContent = '确认撤销邀请码';
  }

  async function createTeacherInvitation(event) {
    event.preventDefault();
    if (invitationCreateInFlight || invitationReadState !== 'loaded' || teacherInvitations.some((item) => item.status === 'ACTIVE')) return;
    if (!invitationCurrentIdentityMatches()) {
      clearTeacherInvitations('账号或学校已切换，旧凭证已清除。');
      setInvitationScopeLabel(true);
      return;
    }
    const form = invitationCreateForm;
    if (!form.reportValidity()) return;
    const submitButton = document.getElementById('invitationCreateButton');
    const message = document.getElementById('invitationCreateMessage');
    const beforeIds = new Set(teacherInvitations.map((item) => item.id).filter(Boolean));
    const tokenAtSubmit = YuzanApi.getToken();
    invitationCreateInFlight = true;
    submitButton.disabled = true;
    submitButton.textContent = '正在向服务器提交…';
    message.textContent = '正在确认当前班级状态并请求服务器创建凭证…';
    let responseItem = null;
    try {
      const latest = await loadTeacherInvitations();
      if (!latest || YuzanApi.getToken() !== tokenAtSubmit || !invitationCurrentIdentityMatches()) {
        message.textContent = '服务器状态或当前账号未能确认，尚未提交创建请求。请重新读取后再试。';
        return;
      }
      if (latest.some((item) => item.status === 'ACTIVE')) {
        message.textContent = '服务器已存在可使用的邀请码，请使用当前有效凭证。';
        return;
      }
      const result = await YuzanApi.createTeacherInvitation({
        classId,
        maxUses: Number(form.elements.maxUses.value),
        expiresInDays: Number(form.elements.expiresInDays.value),
      });
      if (YuzanApi.getToken() !== tokenAtSubmit || !invitationCurrentIdentityMatches()) {
        clearTeacherInvitations('账号或学校已切换，已丢弃创建响应中的凭证。');
        setInvitationScopeLabel(true);
        invitationDialog.close();
        return;
      }
      responseItem = result?.data || result;
      if (responseItem?.class?.id !== classId || typeof responseItem.code !== 'string' || !responseItem.code.trim()) {
        throw new Error('服务器创建响应缺少本班关联或真实邀请码，无法确认结果');
      }
      message.textContent = '服务器已返回真实凭证，正在重新读取本班记录…';
      const refreshed = await loadTeacherInvitations();
      if (refreshed === null) {
        teacherInvitations = [responseItem];
        invitationItemsEl.innerHTML = '';
        invitationCreateForm.hidden = true;
        renderTeacherInvitations();
        invitationReadErrorTextEl.textContent = '创建接口已成功返回真实邀请码，但最新状态读取失败。请重新读取确认状态后再复制。';
        setInvitationStatus('error', '创建已返回 · 最新服务器状态读取失败');
        message.textContent = '创建响应来自服务器；请先重新读取最新状态，再复制或分享。';
        return;
      }
      const newlyVisible = refreshed.find((item) => item.id === responseItem.id)
        || refreshed.find((item) => !beforeIds.has(item.id) && item.status === 'ACTIVE');
      if (newlyVisible) {
        message.textContent = '邀请码已由服务器创建并重新读取确认。';
        invitationCreateForm.hidden = true;
        showToast('本班邀请码已生成');
      } else {
        teacherInvitations = [responseItem];
        renderTeacherInvitations();
        message.textContent = '创建接口已成功返回，但列表尚未确认新记录。请重新读取后再操作。';
        invitationReadErrorTextEl.textContent = '创建请求已返回成功，但列表暂未显示新记录。请重新读取，避免重复创建。';
        setInvitationStatus('error', '创建已返回 · 列表尚未确认');
      }
    } catch (error) {
      const requestError = error;
      const refreshed = await loadTeacherInvitations();
      const newlyVisible = refreshed?.find((item) => !beforeIds.has(item.id) && item.id)
        || refreshed?.find((item) => item.status === 'ACTIVE');
      if (newlyVisible) {
        message.textContent = '创建请求没有收到确认响应；服务器重新读取到本班凭证，请勿重复生成。';
        invitationCreateForm.hidden = true;
        showToast('已从服务器确认本班邀请码');
      } else if (refreshed === null) {
        invitationReadErrorTextEl.textContent = '创建结果尚未确认。服务器读取恢复前，系统会阻止再次创建，避免重复生成。';
        message.textContent = `${requestError?.message || '网络中断'}；创建结果尚未确认，请重新读取服务器列表。`;
      } else {
        invitationCreateForm.hidden = false;
        invitationEmptyEl.hidden = true;
        renderTeacherInvitations();
        message.textContent = `${requestError?.message || '邀请码创建失败'}。已重新读取服务器列表；本次没有确认到新记录。服务端未承诺创建请求幂等，重试前请再次核对列表。`;
        showToast('服务器未确认创建，请先核对本班邀请码列表');
      }
    } finally {
      invitationCreateInFlight = false;
      submitButton.disabled = invitationReadState !== 'loaded' || teacherInvitations.some((item) => item.status === 'ACTIVE');
      submitButton.textContent = '确认生成邀请码';
    }
  }

  function getClassIdFromPath() {
    // /teacher/classes/:classId — 3rd segment
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length >= 3 && parts[0] === 'teacher' && parts[1] === 'classes') {
      return parts[2];
    }
    return '';
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function openDrawer(key) {
    const name = classDetail?.className || classDetail?.name || '未命名班级';
    const count = classDetail?.studentCount ?? '—';
    const data = {
      settings: ["班级设置", "管理班级基本信息、授课教师与学生可见范围。当前版本仅可查看。", `班级：${name}<br>学生人数：${count} 人<br>当前状态：在学`],
    };
    const item = data[key] || ["操作详情", "该功能暂未开通。", ""];
    drawerTitle.textContent = item[0];
    drawerText.textContent = item[1];
    drawerData.textContent = item[2].replace(/<br>/g, '\n');
    drawerConfirm.textContent = '关闭';
    drawerConfirm.disabled = false;
    drawerBackdrop.hidden = false;
    document.body.style.overflow = "hidden";
    drawerBackdrop.dataset.type = key;
  }

  function localDateTimeValue(value) {
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function selectedTargetSummary(targetIds) {
    if (targetIds === null) {
      return `当前班级全部在读学生（${classDetail?.studentCount ?? studentSummaries.length} 人）`;
    }
    const selected = new Set(targetIds);
    const names = studentSummaries
      .filter((student) => selected.has(student.enrollmentId))
      .map((student) => student.displayName || student.enrollmentId.slice(0, 8));
    return `定向学生：${names.map(escapeHtml).join('、')}（${selected.size} 人）`;
  }

  function openSupplementaryPracticeDrawer(targetEnrollmentIds) {
    if (!schoolId || !classId || typeof YuzanApi === 'undefined' || !YuzanApi.getToken()) {
      showToast('登录或学校信息不可用，无法布置补练');
      return;
    }
    drawerTitle.textContent = '布置真实补充练习';
    drawerText.textContent = '服务端会逐一核验学校、班级、学生学籍和课程版本。';
    drawerData.innerHTML = `<form id="supplementaryPracticeForm" class="supplementary-form">
      <label>练习名称<input name="title" type="text" maxlength="120" value="${targetEnrollmentIds ? '定向补充练习' : '班级补充练习'}" required></label>
      <label>课程版本<select name="courseVersionId" required><option value="">正在读取已发布课程…</option></select></label>
      <label>截止时间<input name="dueAt" type="datetime-local" required></label>
      <p class="supplementary-target-summary">${selectedTargetSummary(targetEnrollmentIds)}</p>
      <p class="supplementary-form-message" id="supplementaryFormMessage" role="status" aria-live="polite"></p>
    </form>`;
    const form = document.getElementById('supplementaryPracticeForm');
    const dueAt = form.elements.dueAt;
    dueAt.value = localDateTimeValue(Date.now() + 7 * 24 * 60 * 60 * 1000);
    dueAt.min = localDateTimeValue(Date.now() + 60 * 1000);
    pendingRequestKey = '';
    drawerConfirm.textContent = '确认布置';
    drawerConfirm.disabled = true;
    drawerBackdrop.hidden = false;
    drawerBackdrop.dataset.type = 'supplementary-practice';
    document.body.style.overflow = 'hidden';

    const loadCourses = publishedCourseVersions
      ? Promise.resolve(publishedCourseVersions)
      : YuzanApi.request(`/schools/${schoolId}/course-versions?status=PUBLISHED&limit=100`)
          .then((result) => {
            publishedCourseVersions = Array.isArray(result)
              ? result
              : Array.isArray(result?.items)
                ? result.items
                : [];
            return publishedCourseVersions;
          });
    loadCourses.then((courses) => {
      if (drawerBackdrop.hidden || drawerBackdrop.dataset.type !== 'supplementary-practice') return;
      const select = form.elements.courseVersionId;
      if (!courses.length) {
        select.innerHTML = '<option value="">当前学校没有可用的已发布课程版本</option>';
        document.getElementById('supplementaryFormMessage').textContent = '请先在课程工作台发布合法课程版本。';
        return;
      }
      select.innerHTML = '<option value="">请选择已发布课程版本</option>' + courses
        .filter((course) => course.status === 'PUBLISHED')
        .map((course) => `<option value="${escapeHtml(course.id)}">${escapeHtml(course.title)} · v${escapeHtml(course.version ?? '—')}</option>`)
        .join('');
      if (classDetail?.currentCourse?.id && courses.some((course) => course.id === classDetail.currentCourse.id && course.status === 'PUBLISHED')) {
        select.value = classDetail.currentCourse.id;
      }
      drawerConfirm.disabled = false;
    }).catch((error) => {
      if (drawerBackdrop.hidden || drawerBackdrop.dataset.type !== 'supplementary-practice') return;
      form.elements.courseVersionId.innerHTML = '<option value="">课程版本暂不可用</option>';
      document.getElementById('supplementaryFormMessage').textContent = `${error.message || '读取课程失败'}。请关闭后重试。`;
      drawerConfirm.disabled = true;
    });
  }

  async function submitSupplementaryPractice() {
    const form = document.getElementById('supplementaryPracticeForm');
    if (!form || !form.reportValidity()) return;
    const targetsText = form.querySelector('.supplementary-target-summary')?.textContent || '';
    const title = form.elements.title.value.trim();
    const courseVersionId = form.elements.courseVersionId.value;
    const dueAt = new Date(form.elements.dueAt.value);
    if (!Number.isFinite(dueAt.getTime()) || dueAt <= new Date()) {
      document.getElementById('supplementaryFormMessage').textContent = '截止时间必须是有效的未来时间。';
      return;
    }
    const selectedIds = [...document.querySelectorAll('.roster-check:checked')]
      .map((checkbox) => checkbox.dataset.enrollmentId)
      .filter(Boolean);
    const classWide = targetsText.startsWith('当前班级全部在读学生');
    const targetEnrollmentIds = classWide ? null : selectedIds;
    if (!classWide && !targetEnrollmentIds.length) {
      document.getElementById('supplementaryFormMessage').textContent = '学生选择已变化，请关闭表单后重新选择。';
      return;
    }
    const body = {
      title,
      courseVersionId,
      dueAt: dueAt.toISOString(),
      ...(targetEnrollmentIds ? { targetEnrollmentIds } : {}),
    };
    if (!pendingRequestKey) {
      pendingRequestKey = globalThis.crypto?.randomUUID?.()
        || `supp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
    drawerConfirm.disabled = true;
    drawerConfirm.textContent = '正在创建…';
    const message = document.getElementById('supplementaryFormMessage');
    message.textContent = '正在向服务器提交并创建 OPEN Assignment…';
    try {
      const result = await YuzanApi.request(`/schools/${schoolId}/classes/${classId}/supplementary-practice`, {
        method: 'POST',
        headers: { 'Idempotency-Key': pendingRequestKey },
        body: JSON.stringify(body),
      });
      const assignmentId = result?.id || result?.data?.id;
      if (!assignmentId || (result?.status && result.status !== 'OPEN')) {
        throw new Error('服务端未返回可打开的 OPEN Assignment ID');
      }
      pendingRequestKey = '';
      const query = new URLSearchParams({ assignmentId });
      location.href = `/teacher/assignments/?${query}`;
    } catch (error) {
      message.textContent = `${error.message || '布置失败'}。任务状态尚未确认，请检查班级任务列表后再重试。`;
      drawerConfirm.disabled = false;
      drawerConfirm.textContent = '重试布置';
      showToast(error.status === 403 ? '当前账号无权布置该班级的补练' : '补练未确认创建');
    }
  }

  function closeDrawer() {
    drawerBackdrop.hidden = true;
    document.body.style.overflow = "";
  }

  // ── data-action 按钮分类 ──
  // LIVE_ROUTE: course → /teacher/courses/
  // LIVE_API: practice actions open a real Assignment creation form.
  // UNSUPPORTED: export, analysis, group, volunteer, report
  const actionUnsupported = {
    export: '导出班级报表功能暂未开通',
    analysis: '问题分析详情功能暂未开通',
    group: '创建小组任务功能暂未开通',
    volunteer: '志愿者协作功能暂未开放',
    'save-plan': '学生学习计划编辑暂未开放',
  };

  document.querySelectorAll("[data-action]").forEach(btn => {
    const action = btn.dataset.action;
    if (action === 'report') {
      btn.addEventListener("click", () => {
        const query = new URLSearchParams({ classId, schoolId });
        location.href = `/teacher/diagnostics/?${query}`;
      });
    } else if (action === 'course') {
      btn.addEventListener("click", () => {
        const courseVersionId = classDetail?.currentCourse?.id;
        if (!courseVersionId) { showToast('该班级暂无已关联课程版本'); return; }
        const query = new URLSearchParams({ schoolId, classId, courseVersionId });
        location.href = `/teacher/courses/?${query}`;
      });
    } else if (action === 'settings') {
      btn.addEventListener("click", () => openDrawer('settings'));
    } else if (action === 'class-invitation') {
      btn.addEventListener('click', openTeacherInvitationDialog);
    } else if (action === 'practice') {
      btn.addEventListener("click", () => openSupplementaryPracticeDrawer(null));
    } else if (action === 'assessment') {
      btn.addEventListener("click", async () => {
        if (!schoolId || !classId || typeof YuzanApi === 'undefined') { showToast('请先登录'); return; }
        btn.disabled = true; btn.textContent = '创建中...';
        try {
          const result = await YuzanApi.request(`/schools/${schoolId}/classes/${classId}/assessments`, {
            method: 'POST', body: JSON.stringify({ type: 'FORMATIVE' }),
          });
          const sessions = Array.isArray(result) ? result : result?.items || result?.data || [];
          if (!sessions.length) throw new Error('服务端没有返回已创建的测评会话');
          location.href = `/teacher/diagnostics/?${new URLSearchParams({ classId })}`;
        } catch (err) { showToast(err.message || '测评创建失败'); }
        finally { btn.disabled = false; btn.textContent = '去测评'; }
      });
    } else if (action === 'assign-selected') {
      btn.addEventListener("click", () => {
        const selected = [...document.querySelectorAll('.roster-check:checked')]
          .map((checkbox) => checkbox.dataset.enrollmentId)
          .filter(Boolean);
        if (!selected.length) { showToast('请先勾选至少一名在读学生'); return; }
        openSupplementaryPracticeDrawer(selected);
      });
    } else if (action === 'pending-reviews') {
      btn.addEventListener("click", () => {
        const query = new URLSearchParams({ classId, schoolId });
        location.href = `/teacher/reviews/?${query}`;
      });
    } else if (action === 'save-plan') {
      btn.disabled = true;
      btn.title = actionUnsupported[action];
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        showToast(actionUnsupported[action]);
      });
    } else if (actionUnsupported[action]) {
      btn.disabled = true;
      btn.title = actionUnsupported[action];
      btn.style.opacity = '.55';
      btn.style.cursor = 'not-allowed';
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        showToast(actionUnsupported[action]);
      });
    }
  });

  // ── LIVE_LOCAL: 阶段卡片选择 ──
  document.querySelectorAll(".stage-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".stage-card").forEach(x => x.classList.remove("selected"));
      card.classList.add("selected");
    });
  });

  // ── LIVE_LOCAL: 问题类型 Tab ──
  let pronunciationRows = [];
  let writingRows = [];

  function renderIssues(rows) {
    const table = document.getElementById("issueTable");
    if (!table) return;
    if (rows.length === 0) {
      table.innerHTML = '<div style="padding:16px;color:#888;text-align:center">数据不足，暂无问题分析</div>';
      return;
    }
    table.innerHTML =
      '<div class="issue-row header"><span></span><b>问题</b><b>出现次数</b><b>涉及学生</b></div>' +
      rows.map(r => `<div class="issue-row"><span>${escapeHtml(r[0])}</span><b>${escapeHtml(r[1])}</b><em>${escapeHtml(r[2])} 次</em><em>${escapeHtml(r[3])} 人</em></div>`).join("");
  }

  document.querySelectorAll("[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-tab]").forEach(x => x.classList.toggle("selected", x === btn));
      renderIssues(btn.dataset.tab === "writing" ? writingRows : pronunciationRows);
    });
  });

  // ── UNSUPPORTED: 侧栏无对应页面的链接 ──
  document.querySelectorAll("[data-unsupported]").forEach(el => {
    el.style.opacity = '.55';
    el.style.cursor = 'not-allowed';
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showToast(el.dataset.unsupported || "该功能暂未开通");
    });
  });

  // ── Drawer 控件 ──
  document.getElementById("drawerClose").addEventListener("click", closeDrawer);
  drawerBackdrop.addEventListener("click", e => { if (e.target === drawerBackdrop) closeDrawer(); });
  document.getElementById("drawerConfirm").addEventListener("click", () => {
    if (drawerBackdrop.dataset.type === 'supplementary-practice') {
      submitSupplementaryPractice();
      return;
    }
    closeDrawer();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !drawerBackdrop.hidden) closeDrawer();
  });

  document.getElementById('studentInvitationClose').addEventListener('click', () => invitationDialog.close());
  invitationDialog.addEventListener('close', () => {
    clearInterval(invitationIdentityWatch);
    invitationIdentityWatch = null;
    if (invitationRevokeDialog.open) invitationRevokeDialog.close();
    clearTeacherInvitations('邀请码已清除。再次打开时将从服务器重新读取。');
    if (invitationDialogOpener?.isConnected) invitationDialogOpener.focus();
    invitationDialogOpener = null;
  });
  document.getElementById('invitationRevokeCancel').addEventListener('click', () => invitationRevokeDialog.close());
  document.getElementById('invitationRevokeConfirm').addEventListener('click', () => { void revokeTeacherInvitation(); });
  invitationRevokeDialog.addEventListener('keydown', handleInvitationRevokeTabKey);
  invitationRevokeDialog.addEventListener('cancel', (event) => {
    if (invitationRevokeInFlight) event.preventDefault();
  });
  invitationRevokeDialog.addEventListener('close', () => {
    invitationRevokeId = '';
    if (invitationRevokeOpener?.isConnected && invitationDialog.open) invitationRevokeOpener.focus();
    else if (invitationDialog.open) {
      if (!invitationReadErrorEl.hidden) document.getElementById('invitationRetry').focus();
      else document.getElementById('studentInvitationClose').focus();
    }
    invitationRevokeOpener = null;
  });
  document.getElementById('invitationRetry').addEventListener('click', () => { void loadTeacherInvitations(); });
  document.getElementById('invitationShowCreate').addEventListener('click', () => {
    if (invitationReadState !== 'loaded' || teacherInvitations.some((item) => item.status === 'ACTIVE')) return;
    invitationCreateForm.hidden = false;
    invitationEmptyEl.hidden = true;
    invitationCreateForm.elements.maxUses.focus();
  });
  document.getElementById('invitationCancelCreate').addEventListener('click', () => {
    invitationCreateForm.hidden = true;
    document.getElementById('invitationCreateMessage').textContent = '';
    renderTeacherInvitations();
  });
  invitationCreateForm.addEventListener('submit', createTeacherInvitation);
  invitationItemsEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-copy-invitation]');
    if (button) void copyTeacherInvitation(button.dataset.copyInvitation, button);
    const revokeButton = event.target.closest('[data-revoke-invitation]');
    if (revokeButton) openInvitationRevokeConfirmation(revokeButton.dataset.revokeInvitation, revokeButton);
  });
  window.addEventListener('storage', (event) => {
    if (!['yuzan-access-token', 'yuzan-active-school-id', 'yuzan-current-user'].includes(event.key)) return;
    clearTeacherInvitations('账号或学校已切换，旧凭证已清除。');
    if (invitationDialog.open) {
      setInvitationScopeLabel(!invitationCurrentIdentityMatches());
      void loadTeacherInvitations();
    }
  });

  // ── API: 加载真实班级详情 ──
  function applyClassDetail(detail) {
    classDetail = detail;
    // 更新页面标题
    const name = detail.className || detail.name || '未命名班级';
    document.title = `${name}｜语赞心声`;

    // 更新侧栏"学生"链接 — 使用真实classId
    const navStudentsLink = document.getElementById('navStudentsLink');
    if (navStudentsLink && classId) {
      navStudentsLink.href = `/teacher/classes/${classId}?schoolId=${encodeURIComponent(schoolId)}#students`;
    }

    // 更新面包屑和标题
    const crumbs = document.querySelector('.crumbs');
    if (crumbs) {
      const classBread = crumbs.querySelector('b');
      if (classBread) classBread.textContent = name;
    }
    const h1 = document.querySelector('.class-title h1');
    if (h1) h1.innerHTML = `${escapeHtml(name)} <span>在学</span>`;

    // 更新班级描述
    const desc = document.querySelector('.class-title p');
    if (desc) desc.innerHTML = `班级编号：${escapeHtml(detail.classId || '—')} <i></i> 学生人数：${detail.studentCount ?? '—'} 人`;

    // 更新当前课程
    const courseH2 = document.querySelector('.course-copy h2');
    if (courseH2) courseH2.innerHTML = detail.currentCourse
      ? `${escapeHtml(detail.currentCourse.title || '—')} <span>进行中</span>`
      : '暂无已关联课程';

    // 更新整体进度（dashboard: completionRate 0-100; classDetail: overallProgress 0-100）
    const completionRate = detail.completionRate ?? detail.overallProgress ?? null;
    const progressStr = completionRate == null ? '—' : `${completionRate}`;
    const progressB = document.querySelector('.metric.progress strong');
    if (progressB) progressB.textContent = completionRate == null ? '—' : `${progressStr}%`;
    const progressBar = document.querySelector('.metric.progress i b');
    if (progressBar) progressBar.style.width = completionRate == null ? '0%' : `${progressStr}%`;

    const courseMetrics = document.querySelectorAll('.course-progress .metric');
    const setCourseMetric = (index, label, value) => {
      const metric = courseMetrics[index];
      if (!metric) return;
      const labelEl = metric.querySelector('small');
      const valueEl = metric.querySelector('strong');
      if (labelEl) labelEl.textContent = label;
      if (valueEl) valueEl.textContent = value;
    };
    setCourseMetric(1, '平均活动进度', detail.averageProgress == null ? '—' : `${detail.averageProgress}%`);
    setCourseMetric(2, '中位活动进度', detail.medianProgress == null ? '—' : `${detail.medianProgress}%`);
    setCourseMetric(3, '零进度学生', detail.zeroProgressCount == null ? '—' : `${detail.zeroProgressCount} 人`);
    document.querySelectorAll('.course-copy p').forEach((paragraph) => { paragraph.hidden = true; });

    // 显示平均/中位数进度和零进度人数（Section IX）
    const progressDetail = document.querySelector('.metric.progress small');
    if (progressDetail) {
      const parts = [];
      if (detail.averageProgress != null) parts.push(`平均${detail.averageProgress}%`);
      if (detail.medianProgress != null) parts.push(`中位数${detail.medianProgress}%`);
      if (detail.zeroProgressCount > 0) parts.push(`${detail.zeroProgressCount}人零进度`);
      if (parts.length > 0) progressDetail.textContent = parts.join(' · ');
    }

    // 数据不足标记
    if (detail.dataSufficient === false) {
      const headEl = document.querySelector('.class-head');
      if (headEl && !headEl.querySelector('.data-insufficient-tip')) {
        const tip = document.createElement('div');
        tip.className = 'data-insufficient-tip';
        tip.textContent = '当前数据不足，以下指标仅供参考';
        tip.style.cssText = 'margin:8px 3px;padding:8px 12px;border:1px solid #f0c89b;border-radius:6px;background:#fff5e9;color:#e96e12;font-size:11px';
        headEl.appendChild(tip);
      }
    }

    // 更新待批改
    const pendingEl = document.querySelector('.class-title [data-pending]');
    if (pendingEl && detail.pendingReviewCount !== undefined) {
      pendingEl.textContent = `待批改：${detail.pendingReviewCount}`;
    }

    // 更新成长路径阶段
    if (detail.stages && detail.stages.length > 0) {
      const stageCards = document.querySelectorAll('.stage-card');
      detail.stages.forEach((stage, i) => {
        if (!stageCards[i]) return;
        const strong = stageCards[i].querySelector('strong');
        if (strong) strong.textContent = stage.title;
        const ps = stageCards[i].querySelectorAll('p');
        if (ps[0]) ps[0].textContent = `完成率 ${stage.completionRate == null ? '—' : `${stage.completionRate}%`}`;
        if (ps[1]) ps[1].textContent = `${stage.participantCount ?? 0} / ${stage.totalCount ?? 0}`;
      });
    }

    // 更新概览指标：任务完成率、测评参与率、风险学生数
    const overviewMetrics = document.querySelectorAll('.overview-card .overview-metric');
    if (overviewMetrics[0]) overviewMetrics[0].querySelector('strong').textContent = String(detail.studentCount ?? '—');
    if (overviewMetrics[1]) overviewMetrics[1].querySelector('strong').textContent = detail.completionRate == null ? '—' : `${detail.completionRate}%`;
    if (overviewMetrics[2]) overviewMetrics[2].querySelector('strong').textContent = detail.lastActivityAt ? formatActivityDate(detail.lastActivityAt) : '暂无记录';
    if (overviewMetrics[3]) overviewMetrics[3].querySelector('strong').textContent = detail.assessmentParticipationRate == null ? '—' : `${detail.assessmentParticipationRate}%`;
    if (detail.atRiskStudentCount !== undefined) {
      const riskEl = document.getElementById('atRiskBadge');
      if (riskEl) riskEl.textContent = `${detail.atRiskStudentCount} 人需关注`;
    }

    // 更新发音问题
    if (detail.pronunciationClusters && detail.pronunciationClusters.length > 0) {
      pronunciationRows = detail.pronunciationClusters.map((item, i) => [
        String(i + 1), item.label || item.type, String(item.occurrenceCount ?? item.affectedCount ?? 0), String(item.affectedStudentCount ?? item.affectedCount ?? 0)
      ]);
      renderIssues(pronunciationRows);
    } else {
      pronunciationRows = [];
      renderIssues([]);
    }
  }

  async function loadClassDetail() {
    if (!classId) {
      showToast('缺少班级标识，无法加载');
      return;
    }
    if (typeof YuzanApi === 'undefined' || !YuzanApi.getToken()) {
      showToast('请先登录');
      location.href = '/login';
      return;
    }
    const activeSchoolId = YuzanApi.getActiveSchoolId();
    if (!activeSchoolId) {
      showToast('请先选择学校');
      location.href = '/select-school';
      return;
    }
    schoolId = requestedSchoolId || activeSchoolId;
    try {
      const detail = await YuzanApi.request(`/schools/${schoolId}/classes/${classId}/dashboard`);
      applyClassDetail(detail);
    } catch (err) {
      const title = document.querySelector('.class-title h1');
      const description = document.querySelector('.class-title p');
      if (title) title.textContent = '班级数据暂不可用';
      if (err.status === 401) {
        description.textContent = '登录已过期，请重新登录后查看本人授权班级。';
        location.href = '/login/';
        return;
      }
      if (description) description.textContent = err.status === 403
        ? '当前账号无权查看此学校或班级。请返回本人授权班级列表。'
        : err.status === 404
          ? '该班级不存在或已不可用。请返回本人授权班级列表。'
          : `${err.message || '班级数据加载失败'}。请检查网络后重试。`;
      showToast(err.message || '加载班级详情失败');
      renderStudentRoster(null, err);
      renderAssignmentList(null, err);
      renderAssessmentList(null, err);
      renderPendingItems(null, null, err);
      return;
    }
    // 并行加载 student-summaries、assignment-summaries、assessment-summaries
    const basePath = `/schools/${schoolId}/classes/${classId}`;
    const [studentRes, assignmentRes, assessmentRes, pendingRes] = await Promise.allSettled([
      YuzanApi.request(`${basePath}/student-summaries`),
      YuzanApi.request(`${basePath}/assignment-summaries`),
      YuzanApi.request(`${basePath}/assessment-summaries`),
      YuzanApi.request(`${basePath}/pending-stats`),
    ]);
    if (studentRes.status === 'fulfilled') renderStudentRoster(studentRes.value);
    else renderStudentRoster(null, studentRes.reason);
    if (assignmentRes.status === 'fulfilled') renderAssignmentList(assignmentRes.value);
    else renderAssignmentList(null, assignmentRes.reason);
    if (assessmentRes.status === 'fulfilled') renderAssessmentList(assessmentRes.value);
    else renderAssessmentList(null, assessmentRes.reason);
    renderPendingItems(
      classDetail,
      pendingRes.status === 'fulfilled' ? pendingRes.value : null,
      pendingRes.status === 'rejected' ? pendingRes.reason : null,
    );
  }

  // ── 渲染：学生名单 ──
  function renderStudentRoster(summaries, error = null) {
    const table = document.getElementById('rosterTable');
    if (!table) return;
    if (error) {
      table.innerHTML = `<div class="empty-hint" role="alert">${escapeHtml(apiErrorLabel(error, '学生名单加载失败'))}</div>`;
      studentSummaries = [];
      return;
    }
    if (!Array.isArray(summaries)) {
      table.innerHTML = '<div class="empty-hint" role="alert">学生名单暂无可用响应，请刷新重试。</div>';
      studentSummaries = [];
      return;
    }
    studentSummaries = summaries;
    if (summaries.length === 0) {
      table.innerHTML = '<div class="empty-hint">该授权班级暂无在读学生。</div>';
      return;
    }
    const header = '<div class="roster-row header"><b><input type="checkbox" id="checkAll" title="全选"></b><b>姓名</b><b>课程进度</b><b>已提交/未交</b><b>最新测评</b><b>得分</b><b>录音数</b><b>主要问题</b><b>最近活跃</b><b>风险状态</b></div>';
    const rows = summaries.map(s => {
      const riskClass = s.riskStatus === 'OK' ? 'risk-ok' : s.riskStatus === 'AT_RISK' ? 'risk-at' : 'risk-inactive';
      const riskLabel = s.riskStatus === 'OK' ? '正常' : s.riskStatus === 'AT_RISK' ? '关注' : s.riskStatus === 'INACTIVE' ? '不活跃' : '—';
      const enrollmentId = escapeHtml(s.enrollmentId || '');
      const selected = requestedStudentId && s.enrollmentId === requestedStudentId;
      const studentQuery = new URLSearchParams({ schoolId, classId });
      return `<div class="roster-row ${selected ? 'selected-student' : ''}" data-enrollment-id="${enrollmentId}" data-risk="${escapeHtml(s.riskStatus || '')}">
        <b><input type="checkbox" class="roster-check" data-enrollment-id="${enrollmentId}" ${selected ? 'checked' : ''} aria-label="选择 ${escapeHtml(s.displayName || '学生')}"></b>
        <b><a class="student-detail-link" href="/teacher/students/${encodeURIComponent(s.enrollmentId)}?${studentQuery}">${escapeHtml(s.displayName || '未命名学生')}</a></b>
        <span>${s.courseProgress != null ? `${Math.round(s.courseProgress)}%` : '—'}</span>
        <span>${s.submittedAssignmentCount ?? '—'} / ${s.missingAssignmentCount ?? '—'}</span>
        <span>${escapeHtml(s.latestAssessmentStatus || '—')}</span>
        <span>${s.latestAssessmentScore != null ? escapeHtml(s.latestAssessmentScore) : '—'}</span>
        <span>${s.recordingCount ?? '—'}</span>
        <span>${escapeHtml(s.topIssue || '—')}</span>
        <span>${escapeHtml(formatActivityDate(s.lastActiveAt))}</span>
        <span class="${riskClass}">${riskLabel}</span>
      </div>`;
    }).join('');
    table.innerHTML = header + rows;
    // 全选
    const checkAll = document.getElementById('checkAll');
    if (checkAll) {
      checkAll.addEventListener('change', () => {
        document.querySelectorAll('.roster-check').forEach(c => { c.checked = checkAll.checked; });
      });
    }
    if (requestedStudentId) {
      const selectedRow = table.querySelector(`.roster-row[data-enrollment-id="${CSS.escape(requestedStudentId)}"]`);
      selectedRow?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  // ── 渲染：任务和答案 ──
  function renderAssignmentList(summaries, error = null) {
    const list = document.getElementById('assignmentList');
    if (!list) return;
    if (error) {
      list.innerHTML = `<div class="empty-hint" role="alert">${escapeHtml(apiErrorLabel(error, '班级任务加载失败'))}</div>`;
      return;
    }
    if (!Array.isArray(summaries)) {
      list.innerHTML = '<div class="empty-hint" role="alert">任务列表暂无可用响应，请刷新重试。</div>';
      return;
    }
    if (summaries.length === 0) {
      list.innerHTML = '<div class="empty-hint">该班级暂无已布置任务。</div>';
      return;
    }
    list.innerHTML = summaries.map(a => {
      const statusLabel = a.status === 'OPEN' ? '已发布' : a.status === 'DRAFT' ? '草稿' : a.status === 'CLOSED' ? '已关闭' : a.status || '—';
      return `<div class="assignment-row" data-assignment-id="${escapeHtml(a.assignmentId || '')}">
        <div class="assignment-info">
          <strong>${escapeHtml(a.title || '—')}</strong>
          <small>${escapeHtml(a.courseTitle || '—')}</small>
        </div>
        <span class="assignment-status">${escapeHtml(statusLabel)}</span>
        <span>${a.submissionCount ?? '—'} 已提交 / ${a.notSubmittedCount ?? '—'} 未提交 / ${a.totalTargetCount ?? '—'} 人</span>
        <span class="pending-count">${a.pendingReviewCount ?? '—'} 待复核</span>
        <button class="view-answers-btn" data-assignment-id="${escapeHtml(a.assignmentId || '')}" data-title="${escapeHtml(a.title || '')}">查看提交</button>
      </div>`;
    }).join('');
  }

  // ── 渲染：测评结果 ──
  function renderAssessmentList(summaries, error = null) {
    const list = document.getElementById('assessmentList');
    if (!list) return;
    if (error) {
      list.innerHTML = `<div class="empty-hint" role="alert">${escapeHtml(apiErrorLabel(error, '班级测评加载失败'))}</div>`;
      return;
    }
    if (!Array.isArray(summaries)) {
      list.innerHTML = '<div class="empty-hint" role="alert">测评列表暂无可用响应，请刷新重试。</div>';
      return;
    }
    if (summaries.length === 0) {
      list.innerHTML = '<div class="empty-hint">该班级暂无测评记录。</div>';
      return;
    }
    list.innerHTML = summaries.map(a => {
      const statusLabel = a.status === 'COMPLETED' ? '已完成' : a.status === 'IN_PROGRESS' ? '进行中' : a.status === 'SCHEDULED' ? '未开始' : a.status || '—';
      const typeLabel = a.type === 'FORMATIVE' ? '形成性' : a.type === 'SUMMATIVE' ? '总结性' : a.type || '—';
      const insufficient = a.dataSufficient === false ? ' <em style="color:#e96e12;font-style:normal;font-size:10px">数据不足</em>' : '';
      const scoreLabel = a.averageScore == null ? '暂无正式结果' : `均分 ${escapeHtml(a.averageScore)}`;
      const zeroInfo = (a.zeroScoreCount ?? 0) > 0 ? ` · 正式零分 ${a.zeroScoreCount} 人` : '';
      return `<div class="assessment-row">
        <div class="assessment-info">
          <strong>${escapeHtml(a.title || '—')}</strong>
          <small>${escapeHtml(typeLabel)}</small>
        </div>
        <span class="assessment-status">${escapeHtml(statusLabel)}${insufficient}</span>
        <span>${Number(a.completedCount) || 0} / ${Number(a.totalTargetCount ?? a.totalCount) || 0}</span>
        <span>${scoreLabel}${zeroInfo}</span>
        <span>${a.medianScore != null ? `正式中位数 ${escapeHtml(a.medianScore)}` : '报告未生成或暂无正式测评分数'}</span>
      </div>`;
    }).join('');
  }

  // ── 渲染：待处理事项 ──
  function renderPendingItems(dashboard, pendingStats, error) {
    const list = document.getElementById('pendingList');
    if (!list) return;
    if (!pendingStats && error) {
      list.innerHTML = `<div class="empty-hint">${escapeHtml(error.message || '待处理统计暂不可用，请刷新后重试。')}</div>`;
      return;
    }
    if (!dashboard && !pendingStats) {
      list.innerHTML = '<div class="empty-hint">待处理统计暂不可用。</div>';
      return;
    }
    const items = [
      { label: '待复核提交', value: pendingStats?.pendingReviewCount ?? dashboard?.pendingReviewCount ?? '—', icon: '📝' },
      { label: '有缺交任务', value: pendingStats?.unsubmittedAssignmentsCount ?? '—', icon: '📋' },
      { label: '超过 7 天无活动', value: pendingStats?.atRiskStudentCount ?? dashboard?.atRiskStudentCount ?? '—', icon: '⚠️' },
      { label: '待开始测评', value: pendingStats?.pendingAssessmentsCount ?? '—', icon: '📊' },
    ];
    list.innerHTML = items.map(item =>
      `<div class="pending-item"><span class="pending-icon">${item.icon}</span><strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span></div>`
    ).join('');
  }

  // 学生行留在当前班级学情页；首页可通过 studentId 查询参数定位具体学生。

  // ── 事件委托：查看答案按钮 ──
  document.addEventListener('click', async e => {
    const btn = e.target.closest('.view-answers-btn');
    if (!btn) return;
    const aid = btn.dataset.assignmentId;
    const title = btn.dataset.title || '任务详情';
    drawerTitle.textContent = title;
    drawerText.textContent = '以下内容来自该 Assignment 的真实提交记录。';
    drawerConfirm.textContent = '关闭';
    drawerConfirm.disabled = false;
    drawerData.textContent = '正在读取提交记录…';
    // 尝试加载该任务的提交列表
    if (schoolId && aid && typeof YuzanApi !== 'undefined') {
      try {
        const response = await YuzanApi.request(`/schools/${schoolId}/assignments/${encodeURIComponent(aid)}/submissions?limit=20`);
        const subs = Array.isArray(response) ? response : response?.items || response?.data?.items || [];
        if (subs.length > 0) {
          drawerData.innerHTML = subs.map(s => {
            const rosterName = studentSummaries.find((student) => student.enrollmentId === s.enrollmentId)?.displayName;
            const studentName = escapeHtml(s.studentName || rosterName || s.enrollmentId?.slice(0, 8) || '—');
            const time = s.submittedAt ? new Date(s.submittedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
            const status = s.status === 'REVIEWED' ? '已复核' : s.status === 'SUBMITTED' ? '待复核' : s.status || '—';
            const score = s.autoScore != null ? s.autoScore : '—';
            const link = s.id ? `<a href="/teacher/submissions/${encodeURIComponent(s.id)}" class="submission-detail-link">查看复核详情 →</a>` : '';
            return `<div class="drawer-row"><b>${studentName}</b><span>${escapeHtml(time)}</span><span>${escapeHtml(status)}</span><span>得分：${escapeHtml(score)} ${link}</span></div>`;
          }).join('');
        } else {
          drawerData.textContent = '该任务暂时没有学生提交。';
        }
      } catch (error) {
        drawerData.textContent = apiErrorLabel(error, '读取 Assignment 提交失败');
      }
    } else {
      drawerData.textContent = '当前会话不可用，无法读取提交详情。';
    }
    drawerBackdrop.hidden = false;
    document.body.style.overflow = 'hidden';
    drawerBackdrop.dataset.type = 'assignment-answers';
  });

  classId = getClassIdFromPath();
  loadClassDetail();
})();
