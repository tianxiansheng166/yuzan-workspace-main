const statCards = [
  { label: '高风险事件', value: '8', trend: '较上周 +3', trendClass: 'trend-up', color: 'red', icon: 'danger' },
  { label: '中风险事件', value: '23', trend: '较上周 +5', trendClass: 'trend-up', color: 'orange', icon: 'warning' },
  { label: '低风险事件', value: '61', trend: '较上周 -12', trendClass: 'trend-down', color: 'green', icon: 'safe' },
  { label: '已处置率', value: '86%', trend: '较上周 +9%', trendClass: 'trend-up', color: 'navy', icon: 'record' }
];

let events = [
  {
    id: 1, tab: 'export', time: '2024-06-05 14:32:18', type: '数据导出', typeIcon: 'export', typeClass: 'type-export',
    risk: '高风险', riskClass: 'red', summary: '导出学生测评数据（含敏感字段）',
    operator: '张伟', role: '教务主任', scope: '那曲市第二中学', scopeDetail: '1,326 名学生',
    info: [
      ['操作者', '张伟（教务主任）'], ['来源 IP', '183.12.***.45（青海 西宁）'], ['所属学校', '那曲市第二中学'],
      ['影响范围', '学生 1,326 人，测评数据（含敏感字段）'], ['关联流程', '课程服务 > 测评服务 > 数据导出']
    ],
    before: '{\n  "student_id": "S20240605001",\n  "name": "次仁卓玛",\n  "gender": "女",\n  "grade": "初二",\n  "anxiety_score": 68,\n  "advice": "建议继续关注…",\n  "phone": null,\n  "id_card": null\n}',
    after: '{\n  "student_id": "S20240605001",\n  "name": "次仁卓玛",\n  "gender": "女",\n  "grade": "初二",\n  "anxiety_score": 68,\n  "advice": "建议继续关注…",\n  "phone": "189****5678",\n  "id_card": "6321******2015"\n}',
    policies: ['个人信息保护法（2021）', '未成年人保护法（2020）', '平台隐私政策 v2.3'],
    masks: ['手机号（中间四位）', '身份证号（中间八位）', '家庭住址（已遮蔽）', '更多 2 项'],
    evidence: [
      ['导出请求日志', '2024-06-05 14:32:18', '1.2 KB'],
      ['导出数据清单（字段级）', '2024-06-05 14:32:19', '8.7 KB'],
      ['访问会话记录', '2024-06-05 14:32:20', '2.1 KB']
    ]
  },
  {
    id: 2, tab: 'consent', time: '2024-06-05 10:11:07', type: '同意变更', typeIcon: 'checksheet', typeClass: 'type-consent',
    risk: '中风险', riskClass: 'orange', summary: '批量更新家长同意状态', operator: '李娜', role: '心理老师',
    scope: '改则县中学', scopeDetail: '468 名学生',
    info: [['操作者', '李娜（心理老师）'], ['来源 IP', '10.22.**.16（校园网）'], ['所属学校', '改则县中学'], ['影响范围', '学生家长授权状态 468 条'], ['关联流程', '家校协同 > 授权管理 > 同意变更']],
    before: '{\n  "consent_version": "v2.1",\n  "status": "pending",\n  "updated_by": null\n}',
    after: '{\n  "consent_version": "v2.3",\n  "status": "agreed",\n  "updated_by": "李娜"\n}',
    policies: ['家长授权管理规范', '平台隐私政策 v2.3'], masks: ['仅保留授权版本号', '手机号未展示'],
    evidence: [['授权变更日志', '2024-06-05 10:11:08', '2.4 KB'], ['批量任务回执', '2024-06-05 10:11:09', '3.1 KB']]
  },
  {
    id: 3, tab: 'visit', time: '2024-06-04 22:47:53', type: '访问异常', typeIcon: 'warning', typeClass: 'type-visit',
    risk: '高风险', riskClass: 'red', summary: '非常用设备访问敏感数据', operator: '王磊', role: '平台管理员',
    scope: '平台后台', scopeDetail: '59 所学校',
    info: [['操作者', '王磊（平台管理员）'], ['来源 IP', '103.88.***.9（新设备）'], ['所属学校', '平台后台'], ['影响范围', '多租户访问记录 59 条'], ['关联流程', '后台管理 > 访问审计 > 异常访问']],
    before: '{\n  "device_trust": "unknown",\n  "resource_scope": "all_school",\n  "download": false\n}',
    after: '{\n  "device_trust": "restricted",\n  "resource_scope": "all_school",\n  "download": false\n}',
    policies: ['平台安全基线 v3.0', '异常访问处置规范'], masks: ['IP 末段已遮蔽', '无原始口令'],
    evidence: [['设备指纹摘要', '2024-06-04 22:47:54', '1.6 KB'], ['访问事件流水', '2024-06-04 22:47:56', '4.8 KB']]
  },
  { id: 4, tab: 'export', time: '2024-06-04 16:20:31', type: '数据导出', typeIcon: 'export', typeClass: 'type-export', risk: '中风险', riskClass: 'orange', summary: '导出课堂互动数据', operator: '次仁央宗', role: '班主任', scope: '申扎县小学', scopeDetail: '2 个班级' },
  { id: 5, tab: 'consent', time: '2024-06-04 09:05:12', type: '同意变更', typeIcon: 'checksheet', typeClass: 'type-consent', risk: '低风险', riskClass: 'green', summary: '家长撤回同意', operator: '家长（系统）', role: '自动同步', scope: '色尼区小学', scopeDetail: '1 名学生' },
  { id: 6, tab: 'visit', time: '2024-06-03 21:18:09', type: '访问异常', typeIcon: 'warning', typeClass: 'type-visit', risk: '中风险', riskClass: 'orange', summary: '非工作时间批量访问', operator: '玖强', role: '教务主任', scope: '班戈县中学', scopeDetail: '多名学生' },
  { id: 7, tab: 'export', time: '2024-06-03 15:33:44', type: '数据导出', typeIcon: 'export', typeClass: 'type-export', risk: '低风险', riskClass: 'green', summary: '导出课程学习数据', operator: '格桑曲珍', role: '教研员', scope: '尼玛县中学', scopeDetail: '5 个班级' },
  { id: 8, tab: 'visit', time: '2024-06-03 11:07:22', type: '访问异常', typeIcon: 'warning', typeClass: 'type-visit', risk: '低风险', riskClass: 'green', summary: '敏感字段访问频次偏高', operator: '系统（检测）', role: '自动告警', scope: '平台后台', scopeDetail: '多所学校' }
];

const qs = (s) => document.querySelector(s);
const qsa = (s) => [...document.querySelectorAll(s)];
const icon = (id) => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
let currentTab = 'all';
let selectedId = 1;
let loadError = '';
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));

function showToast(text){ const t = qs('#toast'); t.textContent = text; t.classList.add('show'); clearTimeout(window.__toast); window.__toast = setTimeout(()=>t.classList.remove('show'), 1800); }

function renderStats(){
  qs('#riskStats').innerHTML = statCards.map(card => `
    <article class="stat-card">
      <div class="stat-top"><span class="icon-wrap ${card.color}">${icon(card.icon)}</span><span>${card.label}</span></div>
      <div class="stat-value">${card.value}</div>
      <div class="stat-trend ${card.trendClass}">${card.trend}</div>
    </article>`).join('');
}

function visibleEvents(){ return currentTab === 'all' ? events : events.filter(e => e.tab === currentTab); }

function renderTable(){
  const rows = visibleEvents();
  qs('#tableBody').innerHTML = loadError ? `<tr><td colspan="7" class="empty-state">${esc(loadError)}</td></tr>` : rows.map(row => `
    <tr data-id="${esc(row.id)}" class="${row.id === selectedId ? 'active' : ''}">
      <td>${esc(row.time)}</td>
      <td><div class="type-cell ${row.typeClass}">${icon(row.typeIcon)}<span>${esc(row.type)}</span></div></td>
      <td><span class="risk-badge ${row.riskClass}">${esc(row.risk)}</span></td>
      <td>${esc(row.summary)}</td>
      <td><div class="operator-cell"><span>${esc(row.operator)}</span><small>${esc(row.role)}</small></div></td>
      <td><div class="scope-cell"><span>${esc(row.scope)}</span><small>${esc(row.scopeDetail)}</small></div></td>
      <td><span class="row-chevron">${icon('chevron')}</span></td>
    </tr>`).join('') || '<tr><td colspan="7" class="empty-state">暂无审计记录</td></tr>';
}

function fillTags(id, values){ qs(id).innerHTML = values.map(v => `<span class="tag">${v}</span>`).join(''); }

function renderDetail(){
  const row = events.find(e => e.id === selectedId) || events[0];
  if (!row) { qs('#detailTitle').textContent = loadError || '暂无可查看的审计记录'; return; }
  qs('#detailRisk').textContent = row.risk;
  qs('#detailRisk').className = `chip ${row.riskClass}`;
  qs('#detailTitle').textContent = `${row.type}：${row.summary}`;
  qs('#detailTime').textContent = row.time;
  qs('#infoGrid').innerHTML = (row.info || [['操作者', row.operator], ['所属学校', row.scope], ['关联流程', row.type]]).map(([k,v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  qs('#beforeJson').textContent = row.before || '{\n  "status": "before"\n}';
  qs('#afterJson').textContent = row.after || '{\n  "status": "after"\n}';
  fillTags('#policyTags', row.policies || ['平台隐私政策']);
  fillTags('#maskTags', row.masks || ['默认遮蔽规则']);
  qs('#evidenceList').innerHTML = (row.evidence || [['审计记录', row.time, '1.0 KB']]).map(item => `
    <div class="evidence-row">${icon('file')}<span>${item[0]}</span><span class="ev-time">${item[1]}</span><span class="ev-size">${item[2]}</span><button class="download-mini">下载</button></div>`).join('');
}

renderStats(); renderTable(); renderDetail();

qs('#tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]'); if(!btn) return;
  qsa('#tabs button').forEach(b => b.classList.remove('active')); btn.classList.add('active');
  currentTab = btn.dataset.tab; const rows = visibleEvents(); selectedId = rows[0]?.id || selectedId; renderTable(); renderDetail();
});

qs('#tableBody').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-id]'); if(!tr) return;
  selectedId = tr.dataset.id; renderTable(); renderDetail();
});

qs('#markReview').addEventListener('click', ()=>showToast('审计日志为只读记录，请通过合规工单处理'));
qs('#confirmRecord').addEventListener('click', ()=>showToast('审计日志已核对，原始记录不可修改'));
qs('#escalate').addEventListener('click', ()=>showToast('请在隐私请求页发起冻结、删除或导出审批'));
qs('.export-btn').addEventListener('click', async ()=>{ try { const csv = await window.YuzanApi.exportAdminAuditLogs({ limit: 100 }); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'audit-logs.csv'; a.click(); URL.revokeObjectURL(url); showToast('已导出当前审计记录'); } catch { showToast('导出失败，请确认管理员权限'); } });
qsa('.filter-btn,.ghost-btn').forEach(btn => btn.addEventListener('click', ()=>showToast('演示包中未连接真实筛选接口')));
qs('#menuBtn').addEventListener('click', ()=>qs('#sidebar').classList.toggle('open'));
qs('#sidebar').addEventListener('click', (e)=>{ if(e.target.closest('button')) qs('#sidebar').classList.remove('open'); });

async function loadAuditEvents(){
  if (!window.YuzanApi?.listAdminAuditLogs) return;
  try {
    const result = await window.YuzanApi.listAdminAuditLogs({ limit: 100 });
    const rows = result?.items || [];
    events = rows.map((row) => {
      const action = String(row.action || '').toUpperCase();
      const resource = String(row.resourceType || '');
      const isHigh = /DELETE|EXPORT|FREEZE|PRIVACY|REVOKE/.test(action);
      const isMedium = /UPDATE|CREATE|DECISION|REVIEW|LOGIN/.test(action);
      const risk = isHigh ? '高风险' : isMedium ? '中风险' : '低风险';
      const type = /EXPORT/.test(action) ? ['数据导出', 'export', 'type-export'] : /CONSENT/.test(action) ? ['同意变更', 'checksheet', 'type-consent'] : ['访问与操作', 'warning', 'type-visit'];
      const time = row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN', { hour12: false }) : '-';
      return { id: row.id, tab: type[0] === '数据导出' ? 'export' : type[0] === '同意变更' ? 'consent' : 'visit', time, type: type[0], typeIcon: type[1], typeClass: type[2], risk, riskClass: isHigh ? 'red' : isMedium ? 'orange' : 'green', summary: `${action || '审计操作'} · ${resource || '系统资源'}`, operator: row.actorUserId || '系统', role: '管理员', scope: row.schoolId || '平台范围', scopeDetail: row.resourceId || row.requestId || '审计记录', info: [['操作者', row.actorUserId || '系统'], ['所属学校', row.schoolId || '平台范围'], ['资源类型', resource || '-'], ['操作', action || '-'], ['请求编号', row.requestId || '-']], before: row.beforeSummary ? JSON.stringify(row.beforeSummary, null, 2) : '', after: row.afterSummary ? JSON.stringify(row.afterSummary, null, 2) : '', policies: ['平台隐私政策', '审计留存规范'], masks: ['敏感字段按权限展示'], evidence: [['审计记录', time, '系统生成']] };
    });
    selectedId = events[0]?.id || null;
    loadError = '';
    const high = events.filter((event) => event.risk === '高风险').length;
    const medium = events.filter((event) => event.risk === '中风险').length;
    const low = events.filter((event) => event.risk === '低风险').length;
    statCards[0].value = String(high); statCards[1].value = String(medium); statCards[2].value = String(low); statCards[3].value = events.length ? '100%' : '0%';
  } catch (error) {
    events = [];
    selectedId = null;
    loadError = error?.status === 401 ? '登录后才能查看审计记录' : '审计记录加载失败，请稍后重试';
    statCards.forEach((card, index) => { card.value = index === 3 ? '0%' : '0'; });
  }
  renderStats(); renderTable(); renderDetail();
}
loadAuditEvents();
