(() => {
  'use strict';
  if (!/^\/admin\/pilot\/?$/.test(location.pathname)) return;
  const Api = window.YuzanApi;
  const app = document.getElementById('admin-app');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const stateText = { HEALTHY: '正常', ATTENTION: '需关注', DEGRADED: '服务异常' };
  const statusText = { OPEN: '待处理', ACKNOWLEDGED: '已知悉', RESOLVED: '已解决' };
  const categoryText = { CONTENT: '题目内容', MEDIA: '图片/音频', RECORDING: '录音', SCORING: '评分结果', USABILITY: '使用体验', TECHNICAL: '系统问题', OTHER: '其他' };
  const dependencyText = { database: '数据库', redis: '任务队列', objectStorage: '媒体存储', worker: '后台任务', speechDiagnostic: '语音诊断' };
  let windowValue = '24h';
  let overview = null;
  let feedback = [];

  function number(value) { return value == null ? '—' : Number(value).toLocaleString('zh-CN'); }
  function rate(value) { return value == null ? '—' : `${(Number(value) * 100).toFixed(1)}%`; }
  function age(value) { return value == null ? '—' : `${number(value)} 分钟`; }
  function dependencyClass(value) { return String(value || '').toLowerCase().replace(/_/g, '-'); }
  function card(value, label, hint = '') { return `<article class="pilot-card"><strong>${esc(value)}</strong><span>${esc(label)}</span>${hint ? `<small>${esc(hint)}</small>` : ''}</article>`; }

  function render() {
    if (!overview) { app.innerHTML = '<main class="pilot-dashboard-content"><p class="pilot-error">正在加载试点运行数据…</p></main>'; return; }
    const standard = overview.standardSessions || {};
    const backlog = overview.teacherReviewBacklog || {};
    const processing = overview.processingBacklog || {};
    const remediation = overview.remediation || {};
    const deps = overview.dependencies || {};
    const stateClass = String(overview.overallState || '').toLowerCase();
    const warnings = (overview.warnings || []).map(item => esc(item)).join('、');
    const health = ['database', 'redis', 'objectStorage', 'worker', 'speechDiagnostic'].map(key => `<div><b class="pilot-${dependencyClass(deps[key])}">${esc(deps[key] || 'UNKNOWN')}</b><small>${dependencyText[key]}</small></div>`).join('');
    const rows = feedback.map(item => `<tr><td>${esc(categoryText[item.category] || item.category)}</td><td>${esc(item.message)}</td><td>${esc(item.reporter?.displayName || '—')} · ${esc(item.reporter?.role || '')}</td><td>${esc(statusText[item.status] || item.status)}</td><td>${item.status === 'OPEN' ? `<button class="pilot-action" data-feedback-action="ack" data-feedback-id="${esc(item.id)}">已知悉</button>` : item.status === 'ACKNOWLEDGED' ? `<button class="pilot-action" data-feedback-action="resolve" data-feedback-id="${esc(item.id)}">处理完成</button>` : '—'}</td></tr>`).join('');
    app.innerHTML = `<main class="pilot-dashboard-content"><header class="pilot-dashboard-header"><div><p class="eyebrow">PILOT OPERATIONS · ${esc(windowValue)}</p><h1>试点运行</h1><p>查看测评完成、复核积压、专项巩固、语音任务与反馈闭环；不展示学生排名。</p></div><div class="pilot-controls"><button class="pilot-window ${windowValue === '24h' ? 'active' : ''}" data-window="24h">24 小时</button><button class="pilot-window ${windowValue === '7d' ? 'active' : ''}" data-window="7d">7 天</button><span class="pilot-state ${stateClass}">${esc(stateText[overview.overallState] || overview.overallState)}</span></div></header><section class="pilot-grid">${card(number(standard.started), '正式测评已开始', `创建 ${number(standard.created)}`)}${card(number(standard.completed), '正式测评已完成', `完成率 ${rate(overview.formalSessions?.completionRate)}`)}${card(number(backlog.pendingReviewItems), '教师复核积压', `${number(backlog.pendingReviewStudents)} 名学生`)}${card(number(overview.feedback?.openCount), '开放反馈', '待处理 / 已知悉')}</section><div class="pilot-layout"><section class="pilot-panel"><div class="pilot-panel-head"><h2>系统运行状态</h2><span>生成于 ${esc(new Date(overview.generatedAt).toLocaleString('zh-CN'))}</span></div><div class="pilot-health">${health}</div>${warnings ? `<p class="pilot-warnings">需关注：${warnings}</p>` : ''}</section><section class="pilot-panel"><div class="pilot-panel-head"><h2>测评与积压</h2><span>窗口内创建的正式测评</span></div><div class="pilot-table-wrap"><table class="pilot-table"><tbody><tr><th>正式测评</th><td>创建 ${number(standard.created)} · 进行中 ${number(standard.inProgress)} · 已提交 ${number(standard.submitted)} · 处理中 ${number(standard.processing)} · 已完成 ${number(standard.completed)}</td></tr><tr><th>处理积压</th><td>${number(processing.staleProcessingCount)} 个超过 30 分钟，最早 ${age(processing.oldestProcessingAgeMinutes)}</td></tr><tr><th>教师复核</th><td>${number(backlog.pendingReviewItems)} 题，最早 ${age(backlog.oldestPendingAgeMinutes)}</td></tr><tr><th>专项巩固</th><td>自主 ${number(remediation.selfInitiated?.created)} 创建 / ${number(remediation.selfInitiated?.completed)} 完成；教师 ${number(remediation.teacherAssigned?.created)} 创建 / ${number(remediation.teacherAssigned?.completed)} 完成</td></tr><tr><th>语音任务</th><td>${Object.entries(overview.speech?.jobs || {}).map(([key, value]) => `${esc(key)} ${number(value)}`).join(' · ') || '暂无任务'}</td></tr></tbody></table></div></section></div><section class="pilot-panel" style="margin-top:18px"><div class="pilot-panel-head"><div><h2>最近反馈</h2><span>仅保存安全上下文和用户描述，不保存答案、录音或转写</span></div></div><div class="pilot-table-wrap"><table class="pilot-table"><thead><tr><th>类型</th><th>描述</th><th>反馈人</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="pilot-empty">暂无反馈。</td></tr>'}</tbody></table></div></section></main>`;
    app.querySelectorAll('[data-window]').forEach(button => button.addEventListener('click', () => { windowValue = button.dataset.window; void load(); }));
    app.querySelectorAll('[data-feedback-action]').forEach(button => button.addEventListener('click', () => void updateFeedback(button.dataset.feedbackId, button.dataset.feedbackAction)));
  }

  async function updateFeedback(id, action) {
    const status = action === 'ack' ? 'ACKNOWLEDGED' : 'RESOLVED';
    const resolutionNote = status === 'RESOLVED' ? window.prompt('请填写简短处理说明：')?.trim() : undefined;
    if (status === 'RESOLVED' && !resolutionNote) return;
    try { await Api.updatePilotFeedbackStatus(id, { status, ...(resolutionNote ? { resolutionNote } : {}) }); await load(); } catch (error) { window.alert(error.message || '反馈状态更新失败'); }
  }
  async function load() {
    render();
    try { [overview, feedback] = await Promise.all([Api.getPilotOverview(windowValue), Api.listPilotFeedback({ limit: 20 })]); feedback = feedback?.items || []; render(); } catch (error) { app.innerHTML = `<main class="pilot-dashboard-content"><p class="pilot-error">加载失败：${esc(error.message || '请稍后重试')}</p></main>`; }
  }
  if (!Api?.requireAuth || !Api.requireAuth()) return;
  void load();
})();
