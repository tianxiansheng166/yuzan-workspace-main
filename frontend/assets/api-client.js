(() => {
  'use strict';

  const TOKEN_KEY = 'yuzan-access-token';
  const USER_KEY = 'yuzan-current-user';
  const SCHOOL_KEY = 'yuzan-active-school-id';
  const PROTECTED_ROLE_PATH = /^\/(?:teacher(?:\/|$)|teacher-home(?:\/|$)|student(?:\/|$)|admin(?:\/|$)|volunteer(?:\/|$)|research(?:\/|$)|assessment(?:\/|$)|select-school(?:\/|$))/;
  const REQUIRED_ROLES_BY_PATH = [
    [/^\/(?:teacher|teacher-home)(?:\/|$)/, ['TEACHER']],
    [/^\/student(?:\/|$)/, ['STUDENT']],
    [/^\/assessment(?:\/|$)/, ['STUDENT']],
    [/^\/admin(?:\/|$)/, ['SCHOOL_ADMIN', 'PLATFORM_ADMIN']],
    [/^\/volunteer(?:\/|$)/, ['VOLUNTEER']],
    [/^\/research(?:\/|$)/, ['RESEARCHER']],
  ];
  let protectedEntryValidationPromise = null;

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  function getStoredUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setStoredUser(user) {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }

  function getActiveSchoolId() {
    const activeSchoolId = localStorage.getItem(SCHOOL_KEY) || '';
    if (activeSchoolId) return activeSchoolId;
    const studentMemberships = (getStoredUser()?.memberships || [])
      .filter((membership) => membership?.role === 'STUDENT' && membership?.schoolId)
      .sort((left, right) => String(left.schoolId).localeCompare(String(right.schoolId)));
    if (studentMemberships.length > 0) {
      const schoolId = studentMemberships[0].schoolId;
      localStorage.setItem(SCHOOL_KEY, schoolId);
      return schoolId;
    }
    return '';
  }

  function setActiveSchoolId(schoolId) {
    if (schoolId) localStorage.setItem(SCHOOL_KEY, schoolId);
    else localStorage.removeItem(SCHOOL_KEY);
  }

  function normalizeApiPath(path) {
    if (path.startsWith('http')) return path;
    const p = path.startsWith('/') ? path : `/${path}`;
    if (p.startsWith('/api/v1/')) return p;
    if (p.startsWith('/api/')) return `/api/v1/${p.slice(5)}`;
    return `/api/v1${p}`;
  }

  async function request(path, options = {}) {
    const { skipSessionValidation = false, ...fetchOptions } = options;
    if (!skipSessionValidation && protectedEntryValidationPromise) {
      const valid = await protectedEntryValidationPromise;
      if (!valid) {
        const error = new Error('登录已过期，请重新登录');
        error.status = 401;
        error.code = 'UNAUTHORIZED';
        throw error;
      }
    }
    const url = path.startsWith('http') ? path : normalizeApiPath(path);
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(url, {
      credentials: 'include',
      ...fetchOptions,
      headers,
    });

    if (!response.ok) {
      let message = `请求失败 (${response.status})`;
      let code = '';
      try {
        const body = await response.json();
        const error = body?.error && typeof body.error === 'object' ? body.error : body;
        message = error?.message || body?.message || (typeof body?.error === 'string' ? body.error : message);
        code = error?.code || body?.code || '';
      } catch {}
      if (response.status === 401) {
        clearSession();
        message = message || '登录已过期，请重新登录';
        code = code || 'UNAUTHORIZED';
      }
      const err = new Error(message);
      err.status = response.status;
      err.code = code;
      throw err;
    }

    if (response.status === 204) return null;
    if (fetchOptions.responseType === 'text') return response.text();
    const payload = await response.json();
    return payload && payload.data !== undefined ? payload.data : payload;
  }

  async function login(identifier, password) {
    clearSession();
    try {
      const result = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      return installAuthenticatedSession(result);
    } catch (error) {
      clearSession();
      throw error;
    }
  }

  async function register(identifier, password, role) {
    clearSession();
    try {
      const result = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ identifier, password, role }),
      });
      return installAuthenticatedSession(result);
    } catch (error) {
      clearSession();
      throw error;
    }
  }

  function installAuthenticatedSession(result) {
    const data = result?.data || result;
    if (!data || typeof data.accessToken !== 'string' || !data.accessToken.trim() || !data.user || typeof data.user !== 'object') {
      const error = new Error('认证服务未返回有效会话');
      error.code = 'AUTH_SESSION_INVALID';
      throw error;
    }
    setToken(data.accessToken);
    setStoredUser(data.user);
    setActiveSchoolId(data.activeSchoolId || '');
    return data;
  }
  async function redeemInvitation(payload) {
    return request('/auth/invitations/redeem', { method: 'POST', body: JSON.stringify(payload) });
  }

  /**
   * 根据用户角色返回默认跳转页面
   */
  function getActiveMembership(user, activeSchoolId = getActiveSchoolId()) {
    const memberships = user?.memberships || [];
    if (!activeSchoolId) return null;
    return memberships.find((membership) => membership?.schoolId === activeSchoolId) || null;
  }

  function getHomeUrlByRole(user, activeSchoolId = getActiveSchoolId()) {
    const role = getActiveMembership(user, activeSchoolId)?.role;
    if (role === 'STUDENT') return '/student/today';
    if (role === 'TEACHER') return '/teacher';
    if (role === 'SCHOOL_ADMIN' || role === 'PLATFORM_ADMIN') return '/admin';
    if (role === 'VOLUNTEER') return '/volunteer';
    if (role === 'RESEARCHER') return '/research';
    return '/select-school';
  }

  function isAuthorizedForProtectedPath(pathname, user, activeSchoolId) {
    const routeRequirement = REQUIRED_ROLES_BY_PATH.find(([pattern]) => pattern.test(pathname));
    if (!routeRequirement) return true;
    const activeRole = getActiveMembership(user, activeSchoolId)?.role;
    return routeRequirement[1].includes(activeRole);
  }

  async function me(options = {}) {
    const result = await request('/me', { method: 'GET', ...options });
    const data = result.data || result;
    if (data.user) setStoredUser(data.user);
    setActiveSchoolId(data.activeSchoolId || '');
    return data;
  }

  async function selectSchool(schoolId) {
    const result = await request('/auth/select-school', {
      method: 'POST',
      body: JSON.stringify({ schoolId }),
    });
    const data = result.data || result;
    if (data.accessToken) setToken(data.accessToken);
    if (data.user) setStoredUser(data.user);
    if (data.activeSchoolId) setActiveSchoolId(data.activeSchoolId);
    return data;
  }

  async function requireActiveSchoolId() {
    let schoolId = getActiveSchoolId();
    if (schoolId) return schoolId;
    if (!getToken()) {
      const error = new Error('登录已过期，请重新登录');
      error.status = 401;
      throw error;
    }
    await me();
    schoolId = getActiveSchoolId();
    if (schoolId) return schoolId;
    const error = new Error('当前账号尚未绑定学校，请使用老师提供的邀请码完成绑定');
    error.status = 403;
    error.code = 'STUDENT_SCHOOL_NOT_BOUND';
    throw error;
  }

  async function logout() {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch {}
    clearSession();
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SCHOOL_KEY);
    localStorage.removeItem('yuzan-demo-session');
  }

  function navigateToLogin(fallback = '/login') {
    if (typeof location.replace === 'function') location.replace(fallback);
    else location.href = fallback;
  }

  function concealProtectedPage() {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.style.visibility = 'hidden';
    }
  }

  function revealProtectedPage() {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.style.visibility = '';
    }
  }

  async function validateProtectedEntry(fallback = '/login') {
    if (!getToken() || !getStoredUser()) {
      clearSession();
      navigateToLogin(fallback);
      return false;
    }
    try {
      const session = await me({ skipSessionValidation: true });
      const pathname = location.pathname || '';
      if (!isAuthorizedForProtectedPath(pathname, session.user, session.activeSchoolId)) {
        navigateToLogin(getHomeUrlByRole(session.user, session.activeSchoolId));
        return false;
      }
      revealProtectedPage();
      return true;
    } catch (error) {
      if (error?.status === 401 || error?.code === 'UNAUTHORIZED') clearSession();
      navigateToLogin(fallback);
      return false;
    }
  }

  function requireAuth(fallback = '/login') {
    if (!getToken()) {
      clearSession();
      navigateToLogin(fallback);
      return false;
    }
    return true;
  }

  if (PROTECTED_ROLE_PATH.test(location.pathname || '')) {
    concealProtectedPage();
    protectedEntryValidationPromise = validateProtectedEntry();
  }

  /* ── Teacher Dashboard ── */
  async function getDashboard() {
    return request(`/schools/${getActiveSchoolId()}/teacher/dashboard`);
  }
  async function getAdminDashboard() {
    return request('/admin/dashboard');
  }
  async function getAdminAssessmentOverview() {
    return request('/admin/assessment/overview');
  }
  async function getAdminCurriculum(options = {}) {
    const params = new URLSearchParams();
    if (options.search) params.set('search', options.search);
    if (options.status) params.set('status', options.status);
    if (options.limit) params.set('limit', String(options.limit));
    const qs = params.toString();
    return request(`/admin/curriculum${qs ? '?' + qs : ''}`);
  }
  async function getAdminCurriculumDetail(courseVersionId) {
    return request(`/admin/curriculum/${encodeURIComponent(courseVersionId)}`);
  }
  async function updateAdminCurriculum(courseVersionId, payload) {
    return request(`/admin/curriculum/${encodeURIComponent(courseVersionId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }
  async function publishAdminCurriculum(courseVersionId) {
    return request(`/admin/curriculum/${encodeURIComponent(courseVersionId)}/publish`, { method: 'POST' });
  }
  async function createAdminCurriculumAssignment(courseVersionId, payload) {
    return request(`/admin/curriculum/${encodeURIComponent(courseVersionId)}/assignments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  async function exportAdminAuditLogs(options = {}) {
    const params = new URLSearchParams();
    ['action', 'resourceType', 'actorUserId', 'from', 'to', 'limit'].forEach((key) => {
      if (options[key] != null && options[key] !== '') params.set(key, String(options[key]));
    });
    return request(`/audit/logs/export?${params.toString()}`, { responseType: 'text', headers: { Accept: 'text/csv' } });
  }
  async function listAdminAuditLogs(options = {}) {
    const params = new URLSearchParams();
    ['action', 'resourceType', 'actorUserId', 'from', 'to', 'limit', 'cursor'].forEach((key) => {
      if (options[key] != null && options[key] !== '') params.set(key, String(options[key]));
    });
    return request(`/audit/logs?${params.toString()}`);
  }
  async function updateAdminCurriculumActivity(versionId, activityId, payload) {
    return request(`/admin/curriculum/${encodeURIComponent(versionId)}/activities/${encodeURIComponent(activityId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }
  async function updateAdminCurriculumQuestion(versionId, questionId, payload) {
    return request(`/admin/curriculum/${encodeURIComponent(versionId)}/questions/${encodeURIComponent(questionId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }
  async function createAdminCurriculumActivity(versionId, payload) {
    return request(`/admin/curriculum/${encodeURIComponent(versionId)}/activities`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  async function createAdminCurriculumQuestion(versionId, activityId, payload) {
    return request(`/admin/curriculum/${encodeURIComponent(versionId)}/activities/${encodeURIComponent(activityId)}/questions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  async function reorderAdminCurriculumActivity(versionId, activityId, sortOrder) {
    return request(`/admin/curriculum/${encodeURIComponent(versionId)}/activities/${encodeURIComponent(activityId)}/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ sortOrder }),
    });
  }
  async function reorderAdminCurriculumQuestion(versionId, questionId, sortOrder) {
    return request(`/admin/curriculum/${encodeURIComponent(versionId)}/questions/${encodeURIComponent(questionId)}/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ sortOrder }),
    });
  }
  async function deleteAdminCurriculumActivity(versionId, activityId) {
    return request(`/admin/curriculum/${encodeURIComponent(versionId)}/activities/${encodeURIComponent(activityId)}`, { method: 'DELETE' });
  }
  async function deleteAdminCurriculumQuestion(versionId, questionId) {
    return request(`/admin/curriculum/${encodeURIComponent(versionId)}/questions/${encodeURIComponent(questionId)}`, { method: 'DELETE' });
  }
  async function batchUpdateAdminCurriculumActivities(versionId, updates) {
    return request(`/admin/curriculum/${encodeURIComponent(versionId)}/activities/batch`, { method: 'PATCH', body: JSON.stringify({ updates }) });
  }
  async function batchUpdateAdminCurriculumQuestions(versionId, updates) {
    return request(`/admin/curriculum/${encodeURIComponent(versionId)}/questions/batch`, { method: 'PATCH', body: JSON.stringify({ updates }) });
  }
  async function exportAdminUserPrivacy(userId) {
    return request(`/admin/users/${encodeURIComponent(userId)}/privacy-export`);
  }
  async function listAdminPrivacyRequests(options = {}) {
    const params = new URLSearchParams();
    if (options.type) params.set('type', options.type);
    if (options.status) params.set('status', options.status);
    if (options.limit) params.set('limit', String(options.limit));
    const qs = params.toString();
    return request(`/admin/privacy/requests${qs ? '?' + qs : ''}`);
  }
  async function createAdminPrivacyRequest(payload) {
    return request('/admin/privacy/requests', { method: 'POST', body: JSON.stringify(payload) });
  }
  async function decideAdminPrivacyRequest(requestId, payload) {
    return request(`/admin/privacy/requests/${encodeURIComponent(requestId)}/decision`, { method: 'POST', body: JSON.stringify(payload) });
  }
  async function executeAdminPrivacyRequest(requestId) {
    return request(`/admin/privacy/requests/${encodeURIComponent(requestId)}/execute`, { method: 'POST' });
  }
  async function revokeAdminPrivacyFreeze(requestId) {
    return request(`/admin/privacy/requests/${encodeURIComponent(requestId)}/revoke`, { method: 'POST' });
  }
  async function listAdminProviders(options = {}) {
    const params = new URLSearchParams();
    if (options.category) params.set('category', options.category);
    if (options.status) params.set('status', options.status);
    if (options.limit) params.set('limit', String(options.limit));
    const qs = params.toString();
    return request(`/audit/providers${qs ? '?' + qs : ''}`);
  }
  async function createAdminProvider(payload) {
    return request('/audit/providers', { method: 'POST', body: JSON.stringify(payload) });
  }
  async function updateAdminProvider(providerId, payload) {
    return request(`/audit/providers/${encodeURIComponent(providerId)}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }
  async function checkAdminProviderHealth(providerId) {
    return request(`/audit/providers/${encodeURIComponent(providerId)}/health`);
  }
  async function listAdminProductPlans(options = {}) {
    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status);
    if (options.limit) params.set('limit', String(options.limit));
    const qs = params.toString();
    return request(`/admin/product-plans${qs ? '?' + qs : ''}`);
  }
  async function listAdminSchools(options = {}) {
    const params = new URLSearchParams();
    if (options.search) params.set('search', options.search);
    if (options.regionCode) params.set('regionCode', options.regionCode);
    if (options.isActive !== undefined && options.isActive !== '') params.set('isActive', String(options.isActive));
    if (options.limit) params.set('limit', String(options.limit));
    const qs = params.toString();
    return request(`/admin/schools${qs ? '?' + qs : ''}`);
  }
  async function getAdminSchool(schoolId) {
    return request(`/admin/schools/${encodeURIComponent(schoolId)}`);
  }
  async function createAdminSchool(payload) {
    return request('/admin/schools', { method: 'POST', body: JSON.stringify(payload) });
  }
  async function updateAdminSchool(schoolId, payload) {
    return request(`/admin/schools/${encodeURIComponent(schoolId)}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }
  async function listAdminUsers(options = {}) {
    const params = new URLSearchParams();
    if (options.search) params.set('search', options.search);
    if (options.role) params.set('role', options.role);
    if (options.status) params.set('status', options.status);
    if (options.limit) params.set('limit', String(options.limit));
    const qs = params.toString();
    return request(`/admin/users${qs ? '?' + qs : ''}`);
  }
  async function listAdminContentReviewQueue(options = {}) {
    const params = new URLSearchParams();
    if (options.search) params.set('search', options.search);
    if (options.status) params.set('status', options.status);
    if (options.limit) params.set('limit', String(options.limit));
    const qs = params.toString();
    return request(`/admin/content-review/queue${qs ? '?' + qs : ''}`);
  }
  async function getAdminContentReview(versionId) {
    return request(`/admin/content-review/${encodeURIComponent(versionId)}`);
  }
  async function decideAdminContentReview(versionId, payload) {
    return request(`/admin/content-review/${encodeURIComponent(versionId)}/decision`, { method: 'POST', body: JSON.stringify(payload) });
  }
  async function createAdminProductPlan(payload) {
    return request('/admin/product-plans', { method: 'POST', body: JSON.stringify(payload) });
  }
  async function updateAdminProductPlan(planId, payload) {
    return request(`/admin/product-plans/${encodeURIComponent(planId)}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }
  async function getAdminSchoolSubscription(schoolId) {
    return request(`/admin/schools/${encodeURIComponent(schoolId)}/subscription`);
  }
  async function getAdminSchoolQuotaUsage(schoolId) {
    return request(`/admin/schools/${encodeURIComponent(schoolId)}/quota-usage`);
  }
  async function recordAdminQuotaUsageEvent(schoolId, payload) {
    return request(`/admin/schools/${encodeURIComponent(schoolId)}/quota-usage/events`, { method: 'POST', body: JSON.stringify(payload) });
  }
  async function listAdminInvitations() {
    return request('/admin/users/invitations');
  }
  async function revokeAdminInvitation(invitationId) {
    return request(`/admin/users/invitations/${encodeURIComponent(invitationId)}/revoke`, { method: 'POST' });
  }
  async function createAdminSchoolSubscription(schoolId, payload) {
    return request(`/admin/schools/${encodeURIComponent(schoolId)}/subscription`, { method: 'POST', body: JSON.stringify(payload) });
  }
  async function updateAdminSubscription(subscriptionId, payload) {
    return request(`/admin/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }
  async function renewAdminSubscription(subscriptionId, payload) {
    return request(`/admin/subscriptions/${encodeURIComponent(subscriptionId)}/renew`, { method: 'POST', body: JSON.stringify(payload) });
  }
  async function listAdminDataPolicies(options = {}) {
    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status);
    if (options.limit) params.set('limit', String(options.limit));
    const qs = params.toString();
    return request(`/admin/privacy/policies${qs ? '?' + qs : ''}`);
  }
  async function createAdminDataPolicy(payload) {
    return request('/admin/privacy/policies', { method: 'POST', body: JSON.stringify(payload) });
  }
  async function activateAdminDataPolicy(policyId) {
    return request(`/admin/privacy/policies/${encodeURIComponent(policyId)}/activate`, { method: 'POST' });
  }
  async function listAdminRetentionJobs() {
    return request('/admin/privacy/retention-jobs');
  }
  async function createAdminRetentionJob(payload) {
    return request('/admin/privacy/retention-jobs', { method: 'POST', body: JSON.stringify(payload) });
  }
  async function runAdminRetentionJob(jobId) {
    return request(`/admin/privacy/retention-jobs/${encodeURIComponent(jobId)}/run`, { method: 'POST' });
  }
  async function listAdminSchoolImportJobs(options = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    const qs = params.toString();
    return request(`/admin/schools/import-jobs${qs ? '?' + qs : ''}`);
  }
  async function importAdminSchools(payload) {
    return request('/admin/schools/import', { method: 'POST', body: JSON.stringify(payload) });
  }
  async function runAdminSchoolImportJob(jobId) {
    return request(`/admin/schools/import-jobs/${encodeURIComponent(jobId)}/run`, { method: 'POST' });
  }
  async function listAdminAssessmentLinks() {
    return request('/admin/assessment-links');
  }
  async function createAdminAssessmentLink(payload) {
    return request('/admin/assessment-links', { method: 'POST', body: JSON.stringify(payload) });
  }
  async function revokeAdminAssessmentLink(linkId) {
    return request(`/admin/assessment-links/${encodeURIComponent(linkId)}/revoke`, { method: 'POST' });
  }
  async function listAdminAssessmentLinkAccesses(linkId) {
    return request(`/admin/assessment-links/${encodeURIComponent(linkId)}/accesses`);
  }
  async function resolveAssessmentLink(token) {
    return request('/assessment-links/resolve', { method: 'POST', body: JSON.stringify({ token }) });
  }
  async function getAtRiskStudents() {
    return request(`/schools/${getActiveSchoolId()}/teacher/students/at-risk`);
  }
  async function getPronunciationClusters(classId) {
    const qs = classId ? `?classId=${encodeURIComponent(classId)}` : '';
    return request(`/schools/${getActiveSchoolId()}/teacher/class/pronunciation-clusters${qs}`);
  }

  /* ── Notifications ── */
  async function getNotifications(options = {}) {
    const params = new URLSearchParams();
    if (options.type) params.set('type', options.type);
    if (options.unreadOnly) params.set('unreadOnly', 'true');
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);
    const qs = params.toString();
    return request(`/schools/${getActiveSchoolId()}/notifications${qs ? '?' + qs : ''}`);
  }
  async function markNotificationRead(notificationId) {
    return request(`/schools/${getActiveSchoolId()}/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
  }

  /* ── Curriculum (Course Versions) ── */
  async function listCourseVersions(options = {}) {
    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status);
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);
    const qs = params.toString();
    return request(`/schools/${getActiveSchoolId()}/course-versions${qs ? '?' + qs : ''}`);
  }
  async function getCourseVersionDetail(courseVersionId) {
    return request(`/schools/${getActiveSchoolId()}/course-versions/${encodeURIComponent(courseVersionId)}`);
  }
  async function createCourseDraft(payload) {
    return request(`/schools/${getActiveSchoolId()}/course-versions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  async function updateCourseDraft(courseVersionId, payload) {
    return request(`/schools/${getActiveSchoolId()}/course-versions/${encodeURIComponent(courseVersionId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }
  async function publishCourseVersion(courseVersionId) {
    return request(`/schools/${getActiveSchoolId()}/course-versions/${encodeURIComponent(courseVersionId)}/publish`, { method: 'POST' });
  }
  async function submitForReview(courseVersionId, expectedUpdatedAt) {
    return request(`/schools/${getActiveSchoolId()}/course-versions/${courseVersionId}/submit-review`, {
      method: 'POST',
      body: JSON.stringify({ expectedUpdatedAt }),
    });
  }
  async function attachResource(courseVersionId, resourceId, purpose, meta) {
    return request(`/schools/${getActiveSchoolId()}/course-versions/${courseVersionId}/resources`, {
      method: 'POST',
      body: JSON.stringify({ resourceId, purpose, ...(meta ? { meta } : {}) }),
    });
  }
  async function listResources(courseVersionId) {
    return request(`/schools/${getActiveSchoolId()}/course-versions/${courseVersionId}/resources`);
  }
  async function attachOfflinePackage(courseVersionId, offlinePackageId) {
    return request(`/schools/${getActiveSchoolId()}/course-versions/${courseVersionId}/offline-packages`, {
      method: 'POST',
      body: JSON.stringify({ offlinePackageId }),
    });
  }

  /* ── Resources (Presigned Upload) ── */
  async function presignUpload(payload) {
    return request(`/schools/${getActiveSchoolId()}/resources/presign-upload`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  async function confirmUpload(resourceId, payload) {
    return request(`/schools/${getActiveSchoolId()}/resources/${encodeURIComponent(resourceId)}/confirm-upload`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }
  async function getResourcePlaybackUrl(resourceId) {
    return request(`/schools/${getActiveSchoolId()}/resources/${encodeURIComponent(resourceId)}/playback-url`);
  }
  async function getResourceInfo(resourceId) {
    return request(`/schools/${getActiveSchoolId()}/resources/${encodeURIComponent(resourceId)}`);
  }

  /* ── Assignments ── */
  async function createAssignment(payload) {
    return request(`/schools/${getActiveSchoolId()}/assignments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  async function listAssignments(options = {}) {
    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status);
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);
    const qs = params.toString();
    return request(`/schools/${getActiveSchoolId()}/assignments${qs ? '?' + qs : ''}`);
  }

  /* ── Teacher Tools ── */
  async function getTeacherToolsState() {
    return request(`/schools/${getActiveSchoolId()}/teacher-tools/state`);
  }
  async function generatePlan(goal, courseVersionId, gradeBand) {
    return request(`/schools/${getActiveSchoolId()}/teacher-tools/generate-plan`, {
      method: 'POST',
      body: JSON.stringify({
        goal,
        ...(courseVersionId ? { courseVersionId } : {}),
        ...(gradeBand ? { gradeBand } : {}),
      }),
    });
  }
  async function listDrafts() {
    return request(`/schools/${getActiveSchoolId()}/teacher-tools/drafts`);
  }
  async function saveDraft(toolSource, title, content) {
    return request(`/schools/${getActiveSchoolId()}/teacher-tools/drafts`, {
      method: 'POST',
      body: JSON.stringify({ toolSource, title, content }),
    });
  }
  async function getExternalServices() {
    return request(`/schools/${getActiveSchoolId()}/external-services`);
  }

  /* ── AI Lesson Planning ── */
  async function createLessonPlanJob(goal, courseVersionId, gradeBand, idempotencyKey) {
    return request(`/schools/${getActiveSchoolId()}/ai/lesson-plan-jobs`, {
      method: 'POST',
      body: JSON.stringify({
        goal,
        ...(courseVersionId ? { courseVersionId } : {}),
        ...(gradeBand ? { gradeBand } : {}),
        ...(idempotencyKey ? { idempotencyKey } : {}),
      }),
    });
  }
  async function getLessonPlanJob(jobId) {
    return request(`/schools/${getActiveSchoolId()}/ai/lesson-plan-jobs/${encodeURIComponent(jobId)}`);
  }
  async function cancelLessonPlanJob(jobId) {
    return request(`/schools/${getActiveSchoolId()}/ai/lesson-plan-jobs/${encodeURIComponent(jobId)}/cancel`, {
      method: 'POST',
    });
  }
  async function listLessonPlanDrafts() {
    return request(`/schools/${getActiveSchoolId()}/ai/lesson-plan-drafts`);
  }
  async function getLessonPlanDraft(draftId) {
    return request(`/schools/${getActiveSchoolId()}/ai/lesson-plan-drafts/${encodeURIComponent(draftId)}`);
  }
  async function updateLessonPlanDraft(draftId, title, content, expectedRevision) {
    return request(`/schools/${getActiveSchoolId()}/ai/lesson-plan-drafts/${encodeURIComponent(draftId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...(title != null ? { title } : {}),
        content,
        expectedRevision,
      }),
    });
  }
  async function approveLessonPlanDraft(draftId) {
    return request(`/schools/${getActiveSchoolId()}/ai/lesson-plan-drafts/${encodeURIComponent(draftId)}/approve`, {
      method: 'POST',
    });
  }
  async function getLessonPlanWorkflowStatus() {
    return request(`/schools/${getActiveSchoolId()}/ai/workflows/lesson-planner/status`);
  }
  async function getInviteCode() {
    return request(`/schools/${getActiveSchoolId()}/teacher-tools/invite-code`);
  }
  async function createTeacherInvitation(payload) {
    return request(`/schools/${getActiveSchoolId()}/teacher-invitations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  async function listMyTeacherInvitations() {
    return request(`/schools/${getActiveSchoolId()}/teacher-invitations/mine`);
  }
  async function bindTeacherInvitation(code) {
    return request('/student/teacher-invitations/bind', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  /* ── Student Dashboard ── */
  async function getStudentProfile() {
    return request(`/schools/${getActiveSchoolId()}/student/profile`);
  }
  async function getStudentToday() {
    return request(`/schools/${getActiveSchoolId()}/student/today`);
  }
  async function getStudentCoursesDashboard() {
    return request(`/schools/${getActiveSchoolId()}/student/courses-dashboard`);
  }
  async function getStudentRecommendations() {
    return request(`/schools/${getActiveSchoolId()}/student/recommendations`);
  }
  async function getStudentTeacherAdvice(options = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);
    const qs = params.toString();
    return request(`/schools/${getActiveSchoolId()}/student/teacher-advice${qs ? '?' + qs : ''}`);
  }

  /* ── Student Recordings ── */
  async function initRecording(enrollmentId, partCount, options = {}) {
    return request(`/schools/${getActiveSchoolId()}/recordings`, {
      method: 'POST',
      body: JSON.stringify({
        enrollmentId,
        partCount,
        ...(options.submissionId ? { submissionId: options.submissionId } : {}),
        ...(options.mimeType ? { mimeType: options.mimeType } : {}),
        ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
      }),
    });
  }
  async function getRecordingPartUploadUrl(recordingId, partNumber) {
    return request(`/schools/${getActiveSchoolId()}/recordings/${recordingId}/parts/${partNumber}/upload-url`, {
      method: 'POST',
    });
  }
  async function completeRecording(recordingId, options = {}) {
    return request(`/schools/${getActiveSchoolId()}/recordings/${recordingId}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        ...(options.durationMs != null ? { durationMs: options.durationMs } : {}),
        ...(options.objectKey != null ? { objectKey: options.objectKey } : {}),
        ...(options.assessmentItemId != null ? { assessmentItemId: options.assessmentItemId } : {}),
        ...(options.targetText != null ? { targetText: options.targetText } : {}),
      }),
    });
  }
  async function getRecordingStatus(recordingId) {
    return request(`/schools/${getActiveSchoolId()}/recordings/${recordingId}`);
  }
  async function listMyAssessmentRecordings() {
    return request(`/schools/${getActiveSchoolId()}/recordings/mine`);
  }
  async function getRecordingEvidence(recordingId) {
    return request(`/schools/${getActiveSchoolId()}/recordings/${recordingId}/evidence`);
  }

  /* ── Simple Single-File Recording (preferred for assessment) ── */
  async function initSimpleRecording(payload) {
    return request(`/schools/${getActiveSchoolId()}/recordings/simple`, {
      method: 'POST',
      body: JSON.stringify({
        enrollmentId: payload.enrollmentId,
        ...(payload.submissionId ? { submissionId: payload.submissionId } : {}),
        ...(payload.mimeType ? { mimeType: payload.mimeType } : {}),
        ...(payload.idempotencyKey ? { idempotencyKey: payload.idempotencyKey } : {}),
      }),
    });
  }

  /**
   * Upload a Blob to a presigned URL using real XMLHttpRequest.upload.onprogress.
   * Returns a promise that resolves with { ok, status, progress }.
   * Rejects on network error or non-2xx status.
   */
  function uploadBlobToPresignedUrl(uploadUrl, blob, { mimeType, onProgress, signal } = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const target = new URL(uploadUrl, window.location.origin);
      const localMinio = target.hostname === '127.0.0.1' && target.port === '59000';
      const requestUrl = localMinio
        ? `/storage-upload?url=${encodeURIComponent(target.href)}`
        : target.href;
      xhr.open('PUT', requestUrl, true);
      if (mimeType) xhr.setRequestHeader('Content-Type', mimeType);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && typeof onProgress === 'function') {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct, e.loaded, e.total);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ ok: true, status: xhr.status, response: xhr.responseText });
        } else {
          const err = new Error(`预签名上传失败 (${xhr.status})`);
          err.status = xhr.status;
          err.response = xhr.responseText;
          reject(err);
        }
      };
      xhr.onerror = () => {
        const err = new Error('预签名上传网络错误');
        err.status = 0;
        reject(err);
      };
      xhr.onabort = () => {
        const err = new Error('预签名上传已取消');
        err.status = 0;
        err.aborted = true;
        reject(err);
      };
      if (signal) {
        if (signal.aborted) { xhr.abort(); return; }
        signal.addEventListener('abort', () => xhr.abort());
      }
      xhr.send(blob);
    });
  }

  async function completeSimpleRecording(recordingId, payload) {
    return request(`/schools/${getActiveSchoolId()}/recordings/${recordingId}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        ...(payload.durationMs != null ? { durationMs: payload.durationMs } : {}),
        ...(payload.objectKey != null ? { objectKey: payload.objectKey } : {}),
        ...(payload.assessmentItemId != null ? { assessmentItemId: payload.assessmentItemId } : {}),
        ...(payload.targetText != null ? { targetText: payload.targetText } : {}),
      }),
    });
  }

  /* ── Speech Jobs ── */
  async function createSpeechJob(payload) {
    return request(`/schools/${getActiveSchoolId()}/speech-jobs`, {
      method: 'POST',
      body: JSON.stringify({
        recordingId: payload.recordingId,
        assessmentItemId: payload.assessmentItemId,
        targetText: payload.targetText,
        ...(payload.scorerVersion ? { scorerVersion: payload.scorerVersion } : {}),
        ...(payload.provider ? { provider: payload.provider } : {}),
      }),
    });
  }
  async function getSpeechJob(jobId) {
    return request(`/schools/${getActiveSchoolId()}/speech-jobs/${jobId}`);
  }
  async function getSpeechJobByItem(assessmentItemId) {
    return request(`/schools/${getActiveSchoolId()}/speech-jobs/by-item/${assessmentItemId}`);
  }

  /* ── Device Check ── */
  async function logAssessmentDeviceCheck(payload) {
    return request(`/schools/${getActiveSchoolId()}/assessments/device-check`, {
      method: 'POST',
      body: JSON.stringify({
        checkResult: payload.checkResult,
        ...(payload.userAgent ? { userAgent: payload.userAgent } : {}),
      }),
    });
  }

  /* ── Feedback ── */
  async function createFeedback(submissionId, payload) {
    return request(`/schools/${getActiveSchoolId()}/submissions/${submissionId}/feedback`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  async function listFeedback(submissionId) {
    return request(`/schools/${getActiveSchoolId()}/submissions/${submissionId}/feedback`);
  }

  /* ── Learning Progress ── */
  async function updateLearningProgress(activityId, payload) {
    return request(`/schools/${getActiveSchoolId()}/learning/activities/${activityId}/progress`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }
  async function getLearningProgress(activityId, enrollmentId) {
    return request(`/schools/${getActiveSchoolId()}/learning/activities/${activityId}/progress?enrollmentId=${encodeURIComponent(enrollmentId)}`);
  }

  /* ── Classes ── */
  async function listClasses(options = {}) {
    const params = new URLSearchParams();
    if (options.role) params.set('role', options.role);
    if (options.limit) params.set('limit', String(options.limit));
    const qs = params.toString();
    return request(`/schools/${getActiveSchoolId()}/classes${qs ? '?' + qs : ''}`);
  }
  async function createClassAssessment(classId, payload) {
    return request(`/schools/${getActiveSchoolId()}/classes/${classId}/assessments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /* ── Assessment Sessions ── */
  async function listAssessmentSessions(options = {}) {
    const params = new URLSearchParams();
    if (options.enrollmentId) params.set('enrollmentId', options.enrollmentId);
    if (options.classId) params.set('classId', options.classId);
    if (options.status) params.set('status', options.status);
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);
    const qs = params.toString();
    return request(`/schools/${getActiveSchoolId()}/assessments/sessions${qs ? '?' + qs : ''}`);
  }
  async function getAssessmentSession(sessionId) {
    return request(`/schools/${getActiveSchoolId()}/assessments/sessions/${sessionId}`);
  }
  async function createAssessmentSession(payload) {
    return request(`/schools/${getActiveSchoolId()}/assessments/sessions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  async function startAssessmentSession(sessionId) {
    return request(`/schools/${getActiveSchoolId()}/assessments/sessions/${sessionId}/start`, {
      method: 'POST',
    });
  }
  function getCoursePracticeContext(sessionId) {
    try {
      const value = JSON.parse(localStorage.getItem(`yuzan-course-practice-context:${sessionId}`) || 'null');
      return value && typeof value === 'object' ? value : null;
    } catch {
      return null;
    }
  }
  function safeCourseReturnTo(candidate) {
    if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//')) return null;
    const parsed = new URL(candidate, location.origin);
    if (parsed.origin !== location.origin || !parsed.pathname.startsWith('/student/courses/course-detail/')) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  async function retryCoursePracticeCompletion(sessionId, options = {}) {
    const contextKey = `yuzan-course-practice-context:${sessionId}`;
    const courseContext = getCoursePracticeContext(sessionId);
    if (!courseContext) return { linked: false, reason: 'NO_COURSE_CONTEXT' };
    const returnTo = safeCourseReturnTo(courseContext.returnTo);
    if (!courseContext.assignmentId || !courseContext.submissionId || !courseContext.activityId || !returnTo) {
      const invalid = new Error('课程进度同步上下文不完整，请返回原课程重新进入练习');
      invalid.code = 'COURSE_PROGRESS_CONTEXT_INVALID';
      throw invalid;
    }
    try {
      const completion = await completeCoursePractice(
        courseContext.assignmentId,
        courseContext.submissionId,
        courseContext.activityId,
        sessionId,
      );
      localStorage.removeItem(contextKey);
      const separator = returnTo.includes('?') ? '&' : '?';
      const navigateTo = `${returnTo}${separator}practiceAttemptId=${encodeURIComponent(sessionId)}`;
      if (options.navigate !== false) location.href = navigateTo;
      return { linked: true, completion, navigateTo };
    } catch (cause) {
      const pending = {
        ...courseContext,
        syncStatus: 'PENDING',
        lastSyncError: {
          code: cause?.code || 'COURSE_PROGRESS_SYNC_FAILED',
          message: cause?.message || '课程进度同步失败',
        },
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(contextKey, JSON.stringify(pending));
      const error = new Error(`练习已提交，课程进度待同步：${pending.lastSyncError.message}`);
      error.status = cause?.status || 0;
      error.code = 'COURSE_PROGRESS_SYNC_PENDING';
      error.cause = cause;
      throw error;
    }
  }
  async function submitAssessmentSession(sessionId) {
    const result = await request(`/schools/${getActiveSchoolId()}/assessments/sessions/${sessionId}/submit`, {
      method: 'POST',
    });
    if (getCoursePracticeContext(sessionId)) {
      const courseSync = await retryCoursePracticeCompletion(sessionId);
      return { ...result, courseSync };
    }
    return result;
  }

  /* ── Assessment Reading ── */
  async function getReadingItem(sessionId, itemId) {
    return request(`/schools/${getActiveSchoolId()}/assessments/sessions/${sessionId}/reading/${itemId}`);
  }
  async function attachAssessmentRecording(sessionId, itemId, recordingId) {
    return request(`/schools/${getActiveSchoolId()}/assessments/sessions/${sessionId}/reading/${itemId}/recording`, {
      method: 'POST',
      body: JSON.stringify({ recordingId }),
    });
  }
  async function listAssessmentItems(sessionId) {
    return request(`/schools/${getActiveSchoolId()}/assessments/sessions/${sessionId}/items`);
  }

  /* ── Assessment Written ── */
  async function getWrittenItems(sessionId) {
    return request(`/schools/${getActiveSchoolId()}/assessments/sessions/${sessionId}/written`);
  }
  async function saveWrittenAnswer(sessionId, itemId, payload) {
    return request(`/schools/${getActiveSchoolId()}/assessments/sessions/${sessionId}/items/${itemId}/answer`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }
  async function finalizeWrittenAnswer(sessionId, itemId) {
    return request(`/schools/${getActiveSchoolId()}/assessments/sessions/${sessionId}/items/${itemId}/answer/finalize`, {
      method: 'POST',
    });
  }

  /* ── Assessment Report ── */
  async function generateAssessmentReport(sessionId) {
    return request(`/schools/${getActiveSchoolId()}/assessments/sessions/${sessionId}/report/generate`, {
      method: 'POST',
    });
  }
  async function getAssessmentReport(sessionId) {
    return request(`/schools/${getActiveSchoolId()}/assessments/sessions/${sessionId}/report`);
  }

  /* ── Assessment Review & Retest ── */
  async function reviewAssessmentItem(sessionId, itemId, payload) {
    return request(`/schools/${getActiveSchoolId()}/assessments/sessions/${sessionId}/items/${itemId}/review`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }
  async function getItemRecordingEvidence(sessionId, itemId) {
    return request(`/schools/${getActiveSchoolId()}/assessments/sessions/${sessionId}/items/${itemId}/recording`);
  }
  async function exportAssessmentReport(sessionId, purpose) {
    return request(`/schools/${getActiveSchoolId()}/assessments/sessions/${sessionId}/export`, {
      method: 'POST',
      body: JSON.stringify(purpose ? { purpose } : {}),
    });
  }
  async function scheduleRetest(sessionId) {
    return request(`/schools/${getActiveSchoolId()}/assessments/sessions/${sessionId}/retest`, {
      method: 'POST',
    });
  }
  async function getAssessmentHistory(options = {}) {
    const params = new URLSearchParams();
    if (options.enrollmentId) params.set('enrollmentId', options.enrollmentId);
    if (options.range) params.set('range', options.range);
    const qs = params.toString();
    return request(`/schools/${getActiveSchoolId()}/assessments/history${qs ? '?' + qs : ''}`);
  }
  async function getAssessmentHistoryEvents(enrollmentId) {
    const params = new URLSearchParams();
    if (enrollmentId) params.set('enrollmentId', enrollmentId);
    const qs = params.toString();
    return request(`/schools/${getActiveSchoolId()}/assessments/history/events${qs ? '?' + qs : ''}`);
  }

  /* ── Reusable student practices ── */
  async function listPractices(filters = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    }
    const suffix = params.toString();
    return request(`/schools/${getActiveSchoolId()}/practices${suffix ? `?${suffix}` : ''}`);
  }
  async function getPractice(practiceDefinitionId) {
    return request(`/schools/${getActiveSchoolId()}/practices/${encodeURIComponent(practiceDefinitionId)}`);
  }
  async function createOrResumePractice(practiceDefinitionId, context = {}) {
    return request(`/schools/${getActiveSchoolId()}/practices/${encodeURIComponent(practiceDefinitionId)}/attempts`, { method: 'POST', body: JSON.stringify(context) });
  }
  async function getPracticeAttempt(attemptId) {
    return request(`/schools/${getActiveSchoolId()}/practices/attempts/${encodeURIComponent(attemptId)}`);
  }
  async function getPracticeAttemptItems(attemptId) {
    return request(`/schools/${getActiveSchoolId()}/practices/attempts/${encodeURIComponent(attemptId)}/items`);
  }
  async function favoritePractice(practiceDefinitionId) {
    return request(`/schools/${getActiveSchoolId()}/practices/${encodeURIComponent(practiceDefinitionId)}/favorite`, { method: 'POST' });
  }
  async function unfavoritePractice(practiceDefinitionId) {
    return request(`/schools/${getActiveSchoolId()}/practices/${encodeURIComponent(practiceDefinitionId)}/favorite`, { method: 'DELETE' });
  }

  /* ── Student course learning closure ── */
  async function listStudentCourses(filters = {}) {
    const schoolId = await requireActiveSchoolId();
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    const query = params.toString();
    return request(`/schools/${schoolId}/student/courses${query ? `?${query}` : ''}`);
  }
  async function getStudentCourse(assignmentId) {
    const schoolId = await requireActiveSchoolId();
    return request(`/schools/${schoolId}/student/courses/${encodeURIComponent(assignmentId)}`);
  }
  async function createOrResumeCourseSubmission(assignmentId) {
    const schoolId = await requireActiveSchoolId();
    return request(`/schools/${schoolId}/student/courses/${encodeURIComponent(assignmentId)}/submissions`, { method: 'POST', body: '{}' });
  }
  async function saveCourseActivityAttempt(assignmentId, submissionId, activityId, payload) {
    const schoolId = await requireActiveSchoolId();
    return request(`/schools/${schoolId}/student/courses/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submissionId)}/activities/${encodeURIComponent(activityId)}/attempt`, { method: 'PUT', body: JSON.stringify(payload) });
  }
  async function linkCourseRecording(assignmentId, submissionId, activityId, recordingId) {
    const schoolId = await requireActiveSchoolId();
    return request(`/schools/${schoolId}/student/courses/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submissionId)}/activities/${encodeURIComponent(activityId)}/recordings/${encodeURIComponent(recordingId)}/link`, { method: 'POST', body: '{}' });
  }
  async function getStudentActivityNote(activityId) {
    const schoolId = await requireActiveSchoolId();
    return request(`/schools/${schoolId}/learning/activities/${encodeURIComponent(activityId)}/note`);
  }
  async function saveStudentActivityNote(activityId, content, revision) {
    const schoolId = await requireActiveSchoolId();
    return request(`/schools/${schoolId}/learning/activities/${encodeURIComponent(activityId)}/note`, { method: 'PUT', body: JSON.stringify({ content, revision }) });
  }
  async function submitStudentCourse(assignmentId, submissionId, revision) {
    const schoolId = await requireActiveSchoolId();
    return request(`/schools/${schoolId}/student/courses/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submissionId)}/submit`, { method: 'POST', body: JSON.stringify({ revision }) });
  }
  async function completeCoursePractice(assignmentId, submissionId, activityId, attemptId) {
    const schoolId = await requireActiveSchoolId();
    return request(`/schools/${schoolId}/student/courses/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submissionId)}/activities/${encodeURIComponent(activityId)}/practice-attempts/${encodeURIComponent(attemptId)}/complete`, { method: 'POST', body: '{}' });
  }
  async function addCourseFavorite(assignmentId) {
    const schoolId = await requireActiveSchoolId();
    return request(`/schools/${schoolId}/student/courses/${encodeURIComponent(assignmentId)}/favorite`, { method: 'POST' });
  }
  async function removeCourseFavorite(assignmentId) {
    const schoolId = await requireActiveSchoolId();
    return request(`/schools/${schoolId}/student/courses/${encodeURIComponent(assignmentId)}/favorite`, { method: 'DELETE' });
  }
  async function listStudentActivityNotes(activityId) {
    const schoolId = await requireActiveSchoolId();
    return request(`/schools/${schoolId}/learning/activities/${encodeURIComponent(activityId)}/notes`);
  }
  async function createStudentActivityNote(activityId, content, videoTimestamp) {
    const schoolId = await requireActiveSchoolId();
    return request(`/schools/${schoolId}/learning/activities/${encodeURIComponent(activityId)}/notes`, { method: 'POST', body: JSON.stringify({ content, videoTimestamp }) });
  }
  async function deleteStudentActivityNote(activityId, noteId) {
    const schoolId = await requireActiveSchoolId();
    return request(`/schools/${schoolId}/learning/activities/${encodeURIComponent(activityId)}/notes/${encodeURIComponent(noteId)}`, { method: 'DELETE' });
  }
  async function updateStudentActivityNote(activityId, noteId, content, videoTimestamp, revision) {
    const schoolId = await requireActiveSchoolId();
    return request(`/schools/${schoolId}/learning/activities/${encodeURIComponent(activityId)}/notes/${encodeURIComponent(noteId)}`, { method: 'PUT', body: JSON.stringify({ content, videoTimestamp, revision }) });
  }
  async function getStudentRecommendationsForCourse(assignmentId) {
    const schoolId = await requireActiveSchoolId();
    return request(`/schools/${schoolId}/student/courses/${encodeURIComponent(assignmentId)}/recommendations`);
  }

  window.YuzanApi = {
    request,
    login,
    register,
    redeemInvitation,
    getHomeUrlByRole,
    me,
    selectSchool,
    logout,
    getToken,
    setToken,
    clearSession,
    getStoredUser,
    getActiveSchoolId,
    setActiveSchoolId,
    requireAuth,
    whenSessionReady: () => protectedEntryValidationPromise || Promise.resolve(true),
    /* Teacher */
    getDashboard,
    getAdminDashboard,
    getAdminAssessmentOverview,
    getAdminCurriculum,
    getAdminCurriculumDetail,
    updateAdminCurriculum,
    publishAdminCurriculum,
    createAdminCurriculumAssignment,
    exportAdminAuditLogs,
    listAdminAuditLogs,
    updateAdminCurriculumActivity,
    updateAdminCurriculumQuestion,
    createAdminCurriculumActivity,
    createAdminCurriculumQuestion,
    reorderAdminCurriculumActivity,
    reorderAdminCurriculumQuestion,
    deleteAdminCurriculumActivity,
    deleteAdminCurriculumQuestion,
    batchUpdateAdminCurriculumActivities,
    batchUpdateAdminCurriculumQuestions,
    exportAdminUserPrivacy,
    listAdminPrivacyRequests,
    createAdminPrivacyRequest,
    decideAdminPrivacyRequest,
    executeAdminPrivacyRequest,
    revokeAdminPrivacyFreeze,
    listAdminProviders,
    createAdminProvider,
    updateAdminProvider,
    checkAdminProviderHealth,
    listAdminProductPlans,
    listAdminSchools,
    getAdminSchool,
    createAdminSchool,
    updateAdminSchool,
    listAdminUsers,
    listAdminContentReviewQueue,
    getAdminContentReview,
    decideAdminContentReview,
    createAdminProductPlan,
    updateAdminProductPlan,
    getAdminSchoolSubscription,
    getAdminSchoolQuotaUsage,
    recordAdminQuotaUsageEvent,
    listAdminInvitations,
    revokeAdminInvitation,
    createAdminSchoolSubscription,
    updateAdminSubscription,
    renewAdminSubscription,
    listAdminDataPolicies,
    createAdminDataPolicy,
    activateAdminDataPolicy,
    listAdminRetentionJobs,
    createAdminRetentionJob,
    runAdminRetentionJob,
    listAdminSchoolImportJobs,
    importAdminSchools,
    runAdminSchoolImportJob,
    listAdminAssessmentLinks,
    createAdminAssessmentLink,
    revokeAdminAssessmentLink,
    listAdminAssessmentLinkAccesses,
    resolveAssessmentLink,
    getAtRiskStudents,
    getPronunciationClusters,
    /* Notifications */
    getNotifications,
    markNotificationRead,
    /* Curriculum (Course Versions) */
    listCourseVersions,
    getCourseVersionDetail,
    createCourseDraft,
    updateCourseDraft,
    publishCourseVersion,
    submitForReview,
    attachResource,
    listResources,
    attachOfflinePackage,
    /* Resources (Presigned Upload) */
    presignUpload,
    confirmUpload,
    getResourcePlaybackUrl,
    getResourceInfo,
    /* Assignments */
    createAssignment,
    listAssignments,
    /* Teacher Tools */
    getTeacherToolsState,
    generatePlan,
    listDrafts,
    saveDraft,
    getExternalServices,
    /* AI Lesson Planning */
    createLessonPlanJob,
    getLessonPlanJob,
    cancelLessonPlanJob,
    listLessonPlanDrafts,
    getLessonPlanDraft,
    updateLessonPlanDraft,
    approveLessonPlanDraft,
    getLessonPlanWorkflowStatus,
    getInviteCode,
    createTeacherInvitation,
    listMyTeacherInvitations,
    bindTeacherInvitation,
    /* Student Dashboard */
    getStudentProfile,
    getStudentToday,
    getStudentCoursesDashboard,
    getStudentRecommendations,
    getStudentTeacherAdvice,
    /* Student Recordings */
    initRecording,
    getRecordingPartUploadUrl,
    completeRecording,
    getRecordingStatus,
    listMyAssessmentRecordings,
    getRecordingEvidence,
    initSimpleRecording,
    uploadBlobToPresignedUrl,
    completeSimpleRecording,
    /* Speech Jobs */
    createSpeechJob,
    getSpeechJob,
    getSpeechJobByItem,
    /* Device Check */
    logAssessmentDeviceCheck,
    /* Feedback */
    createFeedback,
    listFeedback,
    /* Learning Progress */
    updateLearningProgress,
    getLearningProgress,
    /* Classes */
    listClasses,
    createClassAssessment,
    /* Assessment Sessions */
    listAssessmentSessions,
    getAssessmentSession,
    createAssessmentSession,
    startAssessmentSession,
    submitAssessmentSession,
    getCoursePracticeContext,
    retryCoursePracticeCompletion,
    /* Assessment Reading */
    getReadingItem,
    attachAssessmentRecording,
    listAssessmentItems,
    /* Assessment Written */
    getWrittenItems,
    saveWrittenAnswer,
    finalizeWrittenAnswer,
    /* Assessment Report */
    generateAssessmentReport,
    getAssessmentReport,
    /* Assessment Review & Retest */
    reviewAssessmentItem,
    getItemRecordingEvidence,
    exportAssessmentReport,
    scheduleRetest,
    getAssessmentHistory,
    getAssessmentHistoryEvents,
    listPractices,
    getPractice,
    createOrResumePractice,
    getPracticeAttempt,
    getPracticeAttemptItems,
    favoritePractice,
    unfavoritePractice,
    listStudentCourses,
    getStudentCourse,
    createOrResumeCourseSubmission,
    saveCourseActivityAttempt,
    linkCourseRecording,
    getStudentActivityNote,
    saveStudentActivityNote,
    submitStudentCourse,
    completeCoursePractice,
    addCourseFavorite,
    removeCourseFavorite,
    listStudentActivityNotes,
    createStudentActivityNote,
    deleteStudentActivityNote,
    updateStudentActivityNote,
    getStudentRecommendationsForCourse,
  };
})();
