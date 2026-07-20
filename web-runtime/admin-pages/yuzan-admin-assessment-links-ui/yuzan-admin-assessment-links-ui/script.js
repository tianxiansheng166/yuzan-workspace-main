
const links = [
  {
    id:'T20240529001',
    name:'高原心理健康普测 - 初二（1）班',
    school:'拉萨市藏文中学',
    clazz:'初二（1）班',
    target:'学生',
    count:'45 人',
    expireMain:'2024-05-29 10:00 至',
    expireSub:'2024-06-12 23:59',
    expireText:'剩余 3 天',
    expireType:'green',
    policy:'匿名作答',
    policyDesc:'仅校方查看汇总',
    policyColor:'green',
    visits:36,
    complete:31,
    visitRate:'80.0%',
    completeRate:'68.9%',
    bar:68.9,
    barClass:'',
    status:'active',
    statusLabel:'进行中',
    statusSub:'正常',
    creator:'嘉宾（只读）',
    createdAt:'2024-05-29 09:30',
    remark:'高原心理健康普测（学生匿名作答）',
    url:'https://yuzan.org/p/ab12cd34ef56'
  },
  {
    id:'T20240526002',
    name:'高原适应性测评 - 高一（2）班',
    school:'那曲市第二中学',
    clazz:'高一（2）班',
    target:'学生',
    count:'48 人',
    expireMain:'2024-05-26 09:00 至',
    expireSub:'2024-06-05 23:59',
    expireText:'剩余 1 天',
    expireType:'orange',
    policy:'实名作答',
    policyDesc:'校方可看明细',
    policyColor:'orange',
    visits:43,
    complete:40,
    visitRate:'89.6%',
    completeRate:'83.3%',
    bar:83.3,
    barClass:'orange',
    status:'expiring',
    statusLabel:'即将到期',
    statusSub:'正常',
    creator:'格桑老师',
    createdAt:'2024-05-26 08:10',
    remark:'高原适应性测评（学生实名作答）',
    url:'https://yuzan.org/p/qr88tf22mj11'
  },
  {
    id:'T20240515003',
    name:'中考心理调适测评 - 初三（3）班',
    school:'日喀则市第一中学',
    clazz:'初三（3）班',
    target:'学生',
    count:'42 人',
    expireMain:'2024-05-15 08:00 至',
    expireSub:'2024-05-22 23:59',
    expireText:'已过期',
    expireType:'red',
    policy:'匿名作答',
    policyDesc:'仅校方查看汇总',
    policyColor:'gray',
    visits:42,
    complete:41,
    visitRate:'100%',
    completeRate:'97.6%',
    bar:97.6,
    barClass:'',
    status:'disabled',
    statusLabel:'已停用',
    statusSub:'已过期',
    creator:'次仁管理员',
    createdAt:'2024-05-15 07:40',
    remark:'中考心理调适测评（已停用）',
    url:'https://yuzan.org/p/zx88dc00ya12'
  },
  {
    id:'T20240528004',
    name:'高原心理健康普测 - 初一（5）班',
    school:'昌都市实验中学',
    clazz:'初一（5）班',
    target:'学生',
    count:'50 人',
    expireMain:'2024-05-28 14:00 至',
    expireSub:'2024-06-10 23:59',
    expireText:'剩余 2 天',
    expireType:'green',
    policy:'实名作答',
    policyDesc:'校方可看明细',
    policyColor:'orange',
    visits:12,
    complete:3,
    visitRate:'24.0%',
    completeRate:'6.0%',
    bar:6,
    barClass:'red',
    status:'abnormal',
    statusLabel:'异常',
    statusSub:'存在异常访问',
    creator:'嘉宾（只读）',
    createdAt:'2024-05-28 13:55',
    remark:'高原心理健康普测（学生实名作答）',
    url:'https://yuzan.org/p/yy66rr42cc09'
  }
];

const listEl = document.getElementById('linkList');
const toast = document.getElementById('toast');
const schoolFilter = document.getElementById('schoolFilter');
const statusFilter = document.getElementById('statusFilter');
const searchInput = document.getElementById('searchInput');
let currentId = links[0].id;

function showToast(text){
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(showToast.t);
  showToast.t = setTimeout(()=> toast.classList.remove('show'), 1700);
}

function renderList(){
  const q = searchInput.value.trim();
  const school = schoolFilter.value;
  const st = statusFilter.value;
  const filtered = links.filter(item => {
    const hitQ = !q || [item.name,item.school,item.id,item.clazz].join(' ').includes(q);
    const hitSchool = school === 'all' || item.school === school;
    const hitStatus = st === 'all' || item.status === st;
    return hitQ && hitSchool && hitStatus;
  });
  listEl.innerHTML = filtered.map(item => `
    <div class="table-row grid-row ${item.id===currentId?'selected':''}" data-id="${item.id}">
      <div><div class="cell-title">${item.name}</div><div class="code-line">${item.id}<svg viewBox="0 0 24 24"><rect x="9" y="9" width="10" height="10" rx="2"></rect><rect x="5" y="5" width="10" height="10" rx="2"></rect></svg></div></div>
      <div class="school-cell"><strong>${item.school}</strong><span class="muted">${item.clazz}</span></div>
      <div class="object-cell"><strong>${item.target}</strong><span class="muted">${item.count}</span></div>
      <div class="expire-cell"><div class="date-main">${item.expireMain}</div><div class="muted">${item.expireSub}</div><div class="expire-remaining expire-${item.expireType}">${item.expireText}</div></div>
      <div class="policy-cell"><div class="policy-tag"><i class="policy-dot ${item.policyColor}"></i>${item.policy}</div><div class="muted">${item.policyDesc}</div></div>
      <div class="visit-cell"><div class="visit-main"><div><strong>${item.visits}</strong><span class="muted">访问</span></div><div><strong>${item.complete}</strong><span class="muted">完成</span></div></div><div class="muted">${item.visitRate}　${item.completeRate}</div><div class="visit-bar ${item.barClass}"><i style="width:${item.bar}%"></i></div></div>
      <div class="status-cell"><span class="status-text ${item.status}">${item.statusLabel}</span><span class="status-sub">${item.statusSub}</span></div>
      <div class="row-actions"><button class="more-btn" aria-label="更多"><svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none"></circle><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"></circle><circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none"></circle></svg></button></div>
    </div>`).join('');
  listEl.querySelectorAll('.table-row').forEach(row => {
    row.addEventListener('click', ()=>{
      currentId = row.dataset.id;
      renderList();
      renderDetail();
    });
  });
}

function renderDetail(){
  const item = links.find(x => x.id===currentId) || links[0];
  document.getElementById('detailTitle').textContent = item.name;
  const st = document.getElementById('detailStatus');
  st.textContent = item.statusLabel;
  st.className = 'state-pill ' + item.status;
  document.getElementById('taskCode').textContent = item.id;
  document.getElementById('linkField').value = item.url;
  document.getElementById('creator').textContent = item.creator;
  document.getElementById('createdAt').textContent = item.createdAt;
  document.getElementById('remark').textContent = item.remark;
}

function bindEvents(){
  searchInput.addEventListener('input', renderList);
  schoolFilter.addEventListener('change', renderList);
  statusFilter.addEventListener('change', renderList);
  document.getElementById('resetFilters').addEventListener('click', ()=>{
    searchInput.value=''; schoolFilter.value='all'; statusFilter.value='all'; renderList(); showToast('筛选已重置');
  });
  document.getElementById('copyLink').addEventListener('click', async ()=>{
    const value = document.getElementById('linkField').value;
    try{ await navigator.clipboard.writeText(value); showToast('链接已复制'); }
    catch{ showToast('已复制到输入框，可手动复制'); document.getElementById('linkField').select(); }
  });
  document.querySelectorAll('.tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.tab;
      document.getElementById('tab-info').classList.toggle('hidden', target!=='info');
      document.getElementById('tab-qr').classList.toggle('hidden', target!=='qr');
    });
  });
  ['regenBtn','disableBtn','exportBtn'].forEach(id=>{
    document.getElementById(id).addEventListener('click', ()=>{
      const label = {regenBtn:'已触发重新生成', disableBtn:'已进入停用流程', exportBtn:'已开始导出'}[id];
      showToast(label);
    });
  });
  const sidebar = document.getElementById('sidebar');
  document.getElementById('mobileMenu').addEventListener('click', ()=> sidebar.classList.toggle('open'));
}

renderList();
renderDetail();
bindEvents();
