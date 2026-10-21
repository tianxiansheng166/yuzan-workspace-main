(() => {
  'use strict';

  const TOKEN_KEY = 'yuzan-access-token';
  const USER_KEY = 'yuzan-current-user';
  const SCHOOL_KEY = 'yuzan-active-school-id';
  const UAT_DEFAULT_TEACHER_INVITATION_CODE = 'TC-43B17-BAD91';

  function getUatDefaultTeacherInvitationCode() {
    return UAT_DEFAULT_TEACHER_INVITATION_CODE;
  }

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
    const memberships = (getStoredUser()?.memberships || [])
      .filter((membership) => membership?.schoolId)
      .sort((left, right) => String(left.schoolId).localeCompare(String(right.schoolId)));
    const preferredMembership = memberships.find((membership) => membership?.role === 'STUDENT') || memberships[0];
    if (preferredMembership) {
      const schoolId = preferredMembership.schoolId;
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
    const url = path.startsWith('http') ? path : normalizeApiPath(path);
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(url, {
      credentials: 'include',
      ...options,
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
    if (options.responseType === 'text') return response.text();
    const payload = await response.json();
    return payload && payload.data !== undefined ? payload.data : payload;
  }

  async function login(identifier, password) {
    const result = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    const data = result.data || result;
    if (data.accessToken) setToken(data.accessToken);
    if (data.user) setStoredUser(data.user);
    setActiveSchoolId(data.activeSchoolId || '');
    return data;
  }

  async function register(identifier, password, role) {
    const result = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, role }),
    });
    const data = result.data || result;
    if (data.accessToken) setToken(data.accessToken);
    if (data.user) setStoredUser(data.user);
    setActiveSchoolId(data.activeSchoolId || '');
    return data;
  }
  async function redeemInvitation(payload) {
    return request('/auth/invitations/redeem', { method: 'POST', body: JSON.stringify(payload) });
  }

  /**
   * 根据用户角色返回默认跳转页面
   */
  function getHomeUrlByRole(user) {
    const memberships = user?.memberships || [];
    if (memberships.length > 0) {
      const role = memberships[0].role;
      if (role === 'STUDENT') return '/student/today';
      if (role === 'TEACHER') return '/teacher';
      if (role === 'SCHOOL_ADMIN' || role === 'PLATFORM_ADMIN') return '/admin';
      if (role === 'VOLUNTEER') return '/volunteer';
      if (role === 'RESEARCHER') return '/research';
    }
    return '/select-school';
  }

  async function me() {
    const result = await request('/me', { method: 'GET' });
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
    clearCoursePracticeContexts();
  }

  function requireAuth(fallback = '/login') {
    if (!getToken()) {
      location.href = fallback;
      return false;
    }
    return true;
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
    if (options.classId) params.set('classId', options.classId);
    if (options.search) params.set('search', options.search);
    if (options.dueAtFrom) params.set('dueAtFrom', options.dueAtFrom);
    if (options.dueAtTo) params.set('dueAtTo', options.dueAtTo);
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);
    const qs = params.toString();
    return request(`/schools/${getActiveSchoolId()}/assignments${qs ? '?' + qs : ''}`);
  }
  async function getAssignment(assignmentId) {
    return request(`/schools/${getActiveSchoolId()}/assignments/${encodeURIComponent(assignmentId)}`);
  }
  async function getAssignmentStats(assignmentId) {
    return request(`/schools/${getActiveSchoolId()}/assignments/${encodeURIComponent(assignmentId)}/stats`);
  }
  async function getAssignmentSubmissions(assignmentId, options = {}) {
    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status);
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);
    const qs = params.toString();
    return request(`/schools/${getActiveSchoolId()}/assignments/${encodeURIComponent(assignmentId)}/submissions${qs ? '?' + qs : ''}`);
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
  async function revokeTeacherInvitation(invitationId) {
    return request(`/schools/${getActiveSchoolId()}/teacher-invitations/${encodeURIComponent(invitationId)}/revoke`, {
      method: 'POST',
    });
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
  /* ── Pilot observability and product feedback ── */
  async function createPilotFeedback(payload) {
    const schoolId = await requireActiveSchoolId();
    return request(`/schools/${schoolId}/pilot/feedback`, { method: 'POST', body: JSON.stringify(payload) });
  }
  async function listMyPilotFeedback() {
    const schoolId = await requireActiveSchoolId();
    return request(`/schools/${schoolId}/pilot/feedback/mine`);
  }
  async function getPilotOverview(window = '24h') {
    const schoolId = await requireActiveSchoolId();
    return request(`/schools/${schoolId}/pilot/overview?window=${encodeURIComponent(window)}`);
  }
  async function listPilotFeedback(filters = {}) {
    const schoolId = await requireActiveSchoolId();
    const params = new URLSearchParams();
    ['status', 'category', 'cursor', 'limit'].forEach(key => { if (filters[key]) params.set(key, String(filters[key])); });
    return request(`/schools/${schoolId}/pilot/feedback${params.toString() ? `?${params}` : ''}`);
  }
  async function updatePilotFeedbackStatus(feedbackId, payload) {
    const schoolId = await requireActiveSchoolId();
    return request(`/schools/${schoolId}/pilot/feedback/${encodeURIComponent(feedbackId)}/status`, { method: 'PATCH', body: JSON.stringify(payload) });
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
  async function getClassStudentSummaries(classId) {
    return request(`/schools/${getActiveSchoolId()}/classes/${encodeURIComponent(classId)}/student-summaries`);
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
  async function createAssessmentRemediation(sourceSessionId) {
    return request(`/schools/${getActiveSchoolId()}/assessments/sessions/${encodeURIComponent(sourceSessionId)}/remediation`, {
      method: 'POST',
    });
  }
  async function getAssessmentRemediationResult(sessionId) {
    return request(`/schools/${getActiveSchoolId()}/assessments/sessions/${encodeURIComponent(sessionId)}/remediation-result`);
  }
  async function listAssignedRemediations() {
    return request(`/schools/${getActiveSchoolId()}/assessments/sessions/assigned-remediations`);
  }
  async function getQuestionBankProgress() {
    return request(`/schools/${getActiveSchoolId()}/students/me/question-bank-progress`);
  }
  async function getTeacherQuestionBankDiagnosticCatalog() {
    return request(`/schools/${getActiveSchoolId()}/teacher/question-bank-diagnostics`);
  }
  async function getTeacherQuestionBankDiagnosticDashboard(classId, practiceDefinitionId) {
    const params = new URLSearchParams({ practiceDefinitionId });
    return request(`/schools/${getActiveSchoolId()}/teacher/question-bank-diagnostics/classes/${encodeURIComponent(classId)}?${params.toString()}`);
  }
  async function getTeacherQuestionBankDiagnosticStudentDetail(classId, enrollmentId, practiceDefinitionId) {
    const params = new URLSearchParams({ practiceDefinitionId });
    return request(`/schools/${getActiveSchoolId()}/teacher/question-bank-diagnostics/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(enrollmentId)}?${params.toString()}`);
  }
  async function createTeacherQuestionBankRemediationAssignments(classId, payload) {
    return request(`/schools/${getActiveSchoolId()}/teacher/question-bank-diagnostics/classes/${encodeURIComponent(classId)}/remediation-assignments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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
  function clearCoursePracticeContext(sessionId) {
    localStorage.removeItem(`yuzan-course-practice-context:${sessionId}`);
  }
  function clearCoursePracticeContexts() {
    const keys = [];
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith('yuzan-course-practice-context:')) keys.push(key);
      }
    } catch {}
    keys.forEach(key => localStorage.removeItem(key));
  }
  function courseContextKey(sessionId) {
    return `yuzan-course-practice-context:${sessionId}`;
  }
  function safeCourseReturnTo(candidate, courseContext, sessionId, strict = true) {
    if (typeof candidate !== 'string' || !courseContext || !courseContext.assignmentId || !courseContext.submissionId || !courseContext.activityId) return null;
    let parsed;
    try { parsed = new URL(candidate, location.origin); } catch { return null; }
    if (parsed.origin !== location.origin || parsed.username || parsed.password || parsed.pathname !== '/student/courses/course-detail/') return null;
    for (const [key, expected] of [['id', courseContext.assignmentId], ['activityId', courseContext.activityId], ['submissionId', courseContext.submissionId]]) {
      const values = parsed.searchParams.getAll(key);
      if ((strict && values.length !== 1) || (!strict && key !== 'submissionId' && values.length !== 1) || values.length > 1 || (values.length === 1 && values[0] !== String(expected))) return null;
    }
    const attemptValues = parsed.searchParams.getAll('practiceAttemptId');
    if (attemptValues.length > 1 || (attemptValues.length === 1 && attemptValues[0] !== String(sessionId))) return null;
    if (!strict) return `${parsed.pathname}${parsed.search}`;
    const query = new URLSearchParams({ id: String(courseContext.assignmentId), activityId: String(courseContext.activityId), submissionId: String(courseContext.submissionId) });
    return `${parsed.pathname}?${query.toString()}`;
  }
  function coursePracticeNavigateTo(courseContext, sessionId, strict = true) {
    const returnTo = safeCourseReturnTo(courseContext?.returnTo, courseContext, sessionId, strict);
    if (!returnTo) return '/student/courses/';
    const parsed = new URL(returnTo, location.origin);
    parsed.searchParams.set('practiceAttemptId', sessionId);
    return `${parsed.pathname}${parsed.search}`;
  }
  function getCoursePracticeReturnTo(sessionId) {
    const courseContext = getCoursePracticeContext(sessionId);
    return courseContext ? coursePracticeNavigateTo(courseContext, sessionId) : '/student/practices/';
  }
  function courseError(message, code, status = 0, cause) {
    const error = new Error(message);
    error.code = code;
    error.status = status;
    if (cause) error.cause = cause;
    return error;
  }
  function courseSyncPendingError(message, cause, submitted) {
    const error = courseError(message, 'COURSE_PROGRESS_SYNC_PENDING', cause?.status || 0, cause);
    error.submitted = submitted;
    return error;
  }
  function validateCoursePracticeContext(sessionId, courseContext) {
    if (!courseContext?.assignmentId || !courseContext?.submissionId || !courseContext?.activityId) {
      throw courseError('课程练习上下文不完整，请从本人课程重新进入。', 'COURSE_PROGRESS_CONTEXT_INVALID', 409);
    }
    if (courseContext.attemptId && courseContext.attemptId !== sessionId) {
      throw courseError('课程练习 Attempt 与恢复记录不一致。', 'COURSE_PROGRESS_CONTEXT_INVALID', 409);
    }
    const currentUserId = getStoredUser()?.id;
    const currentSchoolId = getActiveSchoolId();
    if ((courseContext.userId && currentUserId && courseContext.userId !== currentUserId)
      || (courseContext.schoolId && currentSchoolId && courseContext.schoolId !== currentSchoolId)) {
      throw courseError('登录身份或学校已变化，请从当前账号的课程目录重新进入。', 'COURSE_PRACTICE_IDENTITY_CHANGED', 403);
    }
  }
  function isCourseAccessError(error) {
    return [401, 403, 404].includes(Number(error?.status));
  }
  function clearCourseSessionForAccessFailure(sessionId, cause) {
    clearCoursePracticeContexts();
    clearCoursePracticeContext(sessionId);
    clearSession();
    return courseError('当前账号无法访问原课程练习，已清除旧会话。请重新登录并从本人课程目录继续。', 'COURSE_PROGRESS_ACCESS_LOST', cause?.status || 403, cause);
  }
  function savePendingCoursePracticeContext(sessionId, courseContext, cause, submitted) {
    const pending = {
      ...courseContext,
      attemptId: sessionId,
      syncStatus: 'PENDING',
      submitStatus: submitted ? 'CONFIRMED' : 'UNCONFIRMED',
      lastSyncError: {
        code: cause?.code || 'COURSE_PROGRESS_SYNC_FAILED',
        message: cause?.message || '课程进度暂未获服务器确认',
      },
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(courseContextKey(sessionId), JSON.stringify(pending));
    return pending;
  }
  function pendingCourseSyncResult(sessionId, error, submitted) {
    return {
      linked: false,
      pending: true,
      submitted: Boolean(submitted),
      message: submitted ? '练习已交卷，课程同步待核实' : '交卷状态待核实',
      errorCode: error?.code || 'COURSE_PROGRESS_SYNC_PENDING',
      navigateTo: getCoursePracticeReturnTo(sessionId),
    };
  }
  async function readCoursePracticeTruth(sessionId, courseContext) {
    const [session, attempt] = await Promise.all([getAssessmentSession(sessionId), getPracticeAttempt(sessionId)]);
    if (session?.id !== sessionId || attempt?.id !== sessionId) {
      throw courseError('服务器返回的练习 Attempt 与当前记录不一致。', 'COURSE_PROGRESS_CONTEXT_CONFLICT', 409);
    }
    const schoolId = getActiveSchoolId();
    const enrollmentId = courseContext.enrollmentId || attempt.enrollmentId || session.enrollmentId;
    if (!enrollmentId || session.enrollmentId !== enrollmentId || attempt.enrollmentId !== enrollmentId
      || (courseContext.schoolId && courseContext.schoolId !== schoolId)
      || (session.schoolId && session.schoolId !== schoolId)
      || attempt.courseSubmissionId !== courseContext.submissionId
      || attempt.courseActivityId !== courseContext.activityId) {
      throw courseError('服务器练习记录与当前学生、课程或活动不一致。', 'COURSE_PROGRESS_CONTEXT_CONFLICT', 409);
    }
    const progress = await getLearningProgress(courseContext.activityId, enrollmentId);
    if (progress && (progress.activityId !== courseContext.activityId || progress.enrollmentId !== enrollmentId)) {
      throw courseError('服务器课程进度与当前活动不一致。', 'COURSE_PROGRESS_CONTEXT_CONFLICT', 409);
    }
    return {
      session,
      attempt,
      progress,
      enrollmentId,
      submitted: ['SUBMITTED', 'PROCESSING', 'COMPLETED'].includes(session.status),
      completed: progress?.completed === true,
    };
  }
  async function verifyCourseReturnAccess(courseContext) {
    const course = await getStudentCourse(courseContext.assignmentId);
    if (course?.assignment?.id !== courseContext.assignmentId) {
      throw courseError('当前账号无法恢复原课程。', 'COURSE_RETURN_ACCESS_LOST', 404);
    }
    if (course.existingSubmission?.id && course.existingSubmission.id !== courseContext.submissionId) {
      throw courseError('课程提交已切换，请从当前课程记录重新进入。', 'COURSE_RETURN_ACCESS_LOST', 409);
    }
    const activities = (course.units || course.courseVersion?.units || []).flatMap(unit => (unit.lessons || []).flatMap(lesson => lesson.activities || []));
    if (!activities.some(activity => activity.id === courseContext.activityId)) {
      throw courseError('原课程活动已不可访问，请从本人课程目录继续。', 'COURSE_RETURN_ACCESS_LOST', 404);
    }
    return course;
  }
  async function retryCoursePracticeCompletion(sessionId, options = {}) {
    const courseContext = getCoursePracticeContext(sessionId);
    if (!courseContext) return { linked: false, reason: 'NO_COURSE_CONTEXT' };
    const contextKey = courseContextKey(sessionId);
    try { validateCoursePracticeContext(sessionId, courseContext); }
    catch (error) {
      if (error.status === 401 || error.status === 403) throw clearCourseSessionForAccessFailure(sessionId, error);
      throw error;
    }
    const returnTo = safeCourseReturnTo(courseContext.returnTo, courseContext, sessionId, options.verifyServer === true);
    if (options.verifyServer === true) {
      let truth;
      try { truth = await readCoursePracticeTruth(sessionId, courseContext); }
      catch (cause) {
        if (isCourseAccessError(cause)) throw clearCourseSessionForAccessFailure(sessionId, cause);
        savePendingCoursePracticeContext(sessionId, courseContext, cause, null);
        throw courseSyncPendingError('交卷或课程进度暂未获服务器确认，可安全重试核实。', cause, null);
      }
      if (!truth.submitted) {
        const cause = courseError('服务器尚未确认本次练习已交卷。', 'COURSE_SUBMISSION_NOT_CONFIRMED', 409);
        savePendingCoursePracticeContext(sessionId, courseContext, cause, false);
        throw courseSyncPendingError('交卷状态待核实，请重试服务器核实。', cause, false);
      }
      let completion = null;
      let reconciledAfterLostResponse = false;
      if (!truth.completed) {
        try { completion = await completeCoursePractice(courseContext.assignmentId, courseContext.submissionId, courseContext.activityId, sessionId); }
        catch (cause) {
          let confirmed;
          try { confirmed = await readCoursePracticeTruth(sessionId, courseContext); }
          catch (verifyError) {
            if (isCourseAccessError(verifyError)) throw clearCourseSessionForAccessFailure(sessionId, verifyError);
            savePendingCoursePracticeContext(sessionId, courseContext, cause, true);
            throw courseSyncPendingError('练习已交卷，课程同步待核实。请稍后安全重试。', cause, true);
          }
          if (!confirmed.completed) {
            if (isCourseAccessError(cause)) throw clearCourseSessionForAccessFailure(sessionId, cause);
            savePendingCoursePracticeContext(sessionId, courseContext, cause, true);
            throw courseSyncPendingError('练习已交卷，课程同步待核实。请稍后安全重试。', cause, true);
          }
          truth = confirmed;
          reconciledAfterLostResponse = true;
        }
        if (completion) {
          try { truth = await readCoursePracticeTruth(sessionId, courseContext); }
          catch (cause) {
            if (isCourseAccessError(cause)) throw clearCourseSessionForAccessFailure(sessionId, cause);
            savePendingCoursePracticeContext(sessionId, courseContext, cause, true);
            throw courseSyncPendingError('练习已交卷，课程同步待核实。请稍后安全重试。', cause, true);
          }
          if (!truth.completed) {
            const cause = courseError('服务器尚未确认课程活动完成。', 'COURSE_PROGRESS_NOT_CONFIRMED', 409);
            savePendingCoursePracticeContext(sessionId, courseContext, cause, true);
            throw courseSyncPendingError('练习已交卷，课程同步待核实。请稍后安全重试。', cause, true);
          }
        }
      }
      try { await verifyCourseReturnAccess(courseContext); }
      catch (cause) {
        clearCoursePracticeContext(sessionId);
        if (isCourseAccessError(cause) || cause?.code === 'COURSE_RETURN_ACCESS_LOST') throw clearCourseSessionForAccessFailure(sessionId, cause);
        savePendingCoursePracticeContext(sessionId, courseContext, cause, true);
        throw courseError('练习已交卷，课程进度已写入，但返回课程权限待核实。请重试核实或返回课程目录。', 'COURSE_PROGRESS_SYNC_PENDING', cause?.status || 0, cause);
      }
      const confirmedContext = { ...courseContext, attemptId: sessionId, enrollmentId: truth.enrollmentId, syncStatus: 'COMPLETED', updatedAt: new Date().toISOString() };
      localStorage.setItem(contextKey, JSON.stringify(confirmedContext));
      return {
        linked: true,
        completion,
        navigateTo: returnTo ? coursePracticeNavigateTo(confirmedContext, sessionId, true) : '/student/courses/',
        serverConfirmed: true,
        activityProgress: truth.progress,
        alreadyCompleted: !completion && !reconciledAfterLostResponse,
        reconciledAfterLostResponse,
        returnToValid: Boolean(returnTo),
      };
    }
    try {
      const completion = await completeCoursePractice(
        courseContext.assignmentId,
        courseContext.submissionId,
        courseContext.activityId,
        sessionId,
      );
      localStorage.removeItem(contextKey);
      const navigateTo = returnTo ? coursePracticeNavigateTo(courseContext, sessionId, false) : '/student/courses/';
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
  async function submitAssessmentSession(sessionId, options = {}) {
    if (options.verifyServer === true && getCoursePracticeContext(sessionId)) {
      let truth;
      let courseContext = getCoursePracticeContext(sessionId);
      try {
        validateCoursePracticeContext(sessionId, courseContext);
        truth = await readCoursePracticeTruth(sessionId, courseContext);
      } catch (cause) {
        if (isCourseAccessError(cause) || cause?.code === 'COURSE_PRACTICE_IDENTITY_CHANGED') throw clearCourseSessionForAccessFailure(sessionId, cause);
        const submitted = cause?.code === 'COURSE_PROGRESS_CONTEXT_CONFLICT' ? null : false;
        savePendingCoursePracticeContext(sessionId, courseContext, cause, submitted);
        return { id: sessionId, courseSync: pendingCourseSyncResult(sessionId, cause, submitted) };
      }
      if (truth.submitted) {
        try {
          const courseSync = await retryCoursePracticeCompletion(sessionId, { verifyServer: true, navigate: false });
          return { ...truth.session, courseSync };
        } catch (cause) {
          if (cause?.code !== 'COURSE_PROGRESS_SYNC_PENDING') throw cause;
          return { ...truth.session, courseSync: pendingCourseSyncResult(sessionId, cause, true) };
        }
      }
      if (!['CREATED', 'IN_PROGRESS'].includes(truth.session.status)) {
        const cause = courseError('服务器练习状态不允许交卷，请先核实当前课程记录。', 'COURSE_SUBMISSION_NOT_CONFIRMED', 409);
        savePendingCoursePracticeContext(sessionId, courseContext, cause, false);
        return { ...truth.session, courseSync: pendingCourseSyncResult(sessionId, cause, false) };
      }
      let result;
      let submitError = null;
      try {
        result = await request(`/schools/${getActiveSchoolId()}/assessments/sessions/${sessionId}/submit`, { method: 'POST' });
      } catch (cause) { submitError = cause; }
      try {
        const courseSync = await retryCoursePracticeCompletion(sessionId, { verifyServer: true, navigate: false });
        return { ...(result || truth.session), courseSync };
      } catch (cause) {
        if (cause?.code !== 'COURSE_PROGRESS_SYNC_PENDING') throw cause;
        const submitted = cause.submitted === undefined ? (result ? true : null) : cause.submitted;
        const wrapped = submitError || cause;
        savePendingCoursePracticeContext(sessionId, courseContext, wrapped, submitted);
        return { ...(result || truth.session), courseSync: pendingCourseSyncResult(sessionId, cause, submitted) };
      }
    }
    const result = await request(`/schools/${getActiveSchoolId()}/assessments/sessions/${sessionId}/submit`, {
      method: 'POST',
    });
    if (getCoursePracticeContext(sessionId)) {
      const courseSync = await retryCoursePracticeCompletion(sessionId, { navigate: false });
      if (options.navigate !== false && courseSync.navigateTo) location.href = courseSync.navigateTo;
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
  async function getAssessmentReviewQueue() {
    return request(`/schools/${getActiveSchoolId()}/assessment-reviews`);
  }
  async function getAssessmentReviewDetail(itemId) {
    return request(`/schools/${getActiveSchoolId()}/assessment-reviews/${encodeURIComponent(itemId)}`);
  }
  async function submitAssessmentReview(itemId, payload) {
    return request(`/schools/${getActiveSchoolId()}/assessment-reviews/${encodeURIComponent(itemId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
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
    return request(`/schools/${schoolId}/student/courses/${encodeURIComponent(assignmentId)}/favorite`, { method: 'PUT' });
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
    getUatDefaultTeacherInvitationCode,
    setActiveSchoolId,
    requireAuth,
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
    getAssignmentStats,
    getAssignment,
    getAssignmentSubmissions,
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
    revokeTeacherInvitation,
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
    createPilotFeedback,
    listMyPilotFeedback,
    getPilotOverview,
    listPilotFeedback,
    updatePilotFeedbackStatus,
    /* Learning Progress */
    updateLearningProgress,
    getLearningProgress,
    /* Classes */
    listClasses,
    getClassStudentSummaries,
    createClassAssessment,
    /* Assessment Sessions */
    listAssessmentSessions,
    getAssessmentSession,
    createAssessmentRemediation,
    getAssessmentRemediationResult,
    listAssignedRemediations,
    getQuestionBankProgress,
    getTeacherQuestionBankDiagnosticCatalog,
    getTeacherQuestionBankDiagnosticDashboard,
    getTeacherQuestionBankDiagnosticStudentDetail,
    createTeacherQuestionBankRemediationAssignments,
    createAssessmentSession,
    startAssessmentSession,
    submitAssessmentSession,
    getCoursePracticeContext,
    getCoursePracticeReturnTo,
    clearCoursePracticeContext,
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
    getAssessmentReviewQueue,
    getAssessmentReviewDetail,
    submitAssessmentReview,
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
