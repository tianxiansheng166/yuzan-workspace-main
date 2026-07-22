const assets = {
  red: 'assets/red.jpg',
  valley: 'assets/valley.jpg',
  teacher: 'assets/teacher.jpg',
  tree: 'assets/tree.jpg',
  network: 'assets/network.jpg',
  mountain: 'assets/mountain.jpg'
};

const courses = [
  { id: 1, title: '高原上的春天', sub: '语文 · 六年级下册', size: '12.6 MB', cover: assets.red, tag: '中' },
  { id: 2, title: '少年中国说（节选）', sub: '语文 · 六年级下册', size: '8.4 MB', cover: assets.valley, tag: '中' },
  { id: 3, title: '把句子说出画面感', sub: '朗读技巧', size: '15.3 MB', cover: assets.valley, tag: '推' },
  { id: 4, title: '情感的声音：喜与忧', sub: '表达提升', size: '10.7 MB', cover: assets.valley, tag: '推' },
  { id: 5, title: '声母韵母基础练习', sub: '发音基础', size: '9.8 MB', cover: assets.red, tag: '练' }
];

const queue = [
  { id: 3, title: '把句子说出画面感', sub: '朗读技巧', size: '15.3 MB', cover: assets.valley, progress: 68, speed: '10.4 MB/s', paused: false },
  { id: 4, title: '情感的声音：喜与忧', sub: '表达提升', size: '10.7 MB', cover: assets.valley, progress: 32, speed: '6.2 MB/s', paused: false }
];

const localItems = [
  { title: '高原上的春天', sub: '语文 · 六年级下册', size: '12.6 MB', state: 'local', label: '本地', time: '更新：今天 09:15', cover: assets.red },
  { title: '少年中国说（节选）', sub: '语文 · 六年级下册', size: '8.4 MB', state: 'pending', label: '待同步', time: '更新：今天 08:47', cover: assets.valley },
  { title: '声母韵母基础练习', sub: '发音基础', size: '9.8 MB', state: 'synced', label: '已同步', time: '更新：昨天 16:30', cover: assets.red },
  { title: '日常对话模拟', sub: '口语练习', size: '6.2 MB', state: 'failed', label: '同步失败', time: '更新：昨天 14:22', cover: assets.mountain },
  { title: '藏语基础词汇', sub: '词汇积累', size: '7.1 MB', state: 'local', label: '本地', time: '更新：前天 11:05', cover: assets.tree }
];

let activeFilter = 'all';
let allPaused = false;
const stateMeta = {
  local: { color: 'green', icon: 'trash' },
  pending: { color: 'orange', icon: 'upload' },
  synced: { color: 'green', icon: 'more' },
  failed: { color: 'red', icon: 'retry' }
};

const qs = (s) => document.querySelector(s);
const qsa = (s) => [...document.querySelectorAll(s)];
const icon = (id) => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;

function renderCourses() {
  qs('#courseList').innerHTML = courses.map(c => `
    <article class="course-row">
      <img src="${c.cover}" alt="${c.title}封面" />
      <div class="course-meta"><strong>${c.title}</strong><p>${c.sub}</p><small><em>${c.tag}</em>${c.size}</small></div>
      <button class="download-btn ${queue.some(q => q.id === c.id) ? 'queued' : ''}" data-download="${c.id}" aria-label="下载${c.title}">
        ${queue.some(q => q.id === c.id) ? icon('check') : icon('download')}
      </button>
    </article>`).join('');
}

function renderQueue() {
  qs('#queueCount').textContent = `(${queue.length})`;
  qs('#queueList').innerHTML = queue.map(q => `
    <article class="queue-item">
      <img src="${q.cover}" alt="${q.title}封面" />
      <div class="queue-info"><strong>${q.title}</strong><small>${q.sub}</small><small>${q.size}</small></div>
      <div class="queue-progress">
        <div class="progress-track"><div class="progress-fill" style="width:${q.progress}%"></div></div>
        <span>${q.paused ? '已暂停' : '下载中'}&nbsp;&nbsp;${q.progress}%</span><span>${q.paused ? '—' : q.speed}</span>
      </div>
      <button class="pause-btn" data-pause="${q.id}" aria-label="${q.paused ? '继续' : '暂停'}${q.title}">${icon(q.paused ? 'play' : 'pause')}</button>
    </article>`).join('');
  qs('#pauseAll').textContent = allPaused ? '全部继续' : '全部暂停';
}

function renderLocal() {
  const visible = localItems.filter(item => activeFilter === 'all' || item.state === activeFilter || (activeFilter === 'synced' && item.state === 'synced'));
  qs('#localList').innerHTML = visible.map((item, index) => {
    const meta = stateMeta[item.state];
    let action = '';
    if (meta.icon === 'trash') action = `<button class="icon-btn" data-delete="${index}" aria-label="删除${item.title}">${icon('trash')}</button><button class="more-btn">${icon('more')}</button>`;
    if (meta.icon === 'upload') action = `<button class="icon-btn" data-upload="${index}" aria-label="同步${item.title}">${icon('upload')}</button><button class="more-btn">${icon('more')}</button>`;
    if (meta.icon === 'more') action = `<button class="more-btn">${icon('more')}</button>`;
    if (meta.icon === 'retry') action = `<button class="retry-btn" data-retry="${index}">重试</button><button class="more-btn">${icon('more')}</button>`;
    return `<article class="local-row">
      <img src="${item.cover}" alt="${item.title}封面" />
      <div class="local-title"><strong>${item.title}</strong><small>${item.sub}</small></div>
      <span class="local-size">${item.size}</span>
      <span class="state-label"><span class="status-dot ${meta.color}"></span>${item.label}</span>
      <span class="local-time">${item.time}</span>
      <div class="row-actions">${action}</div>
    </article>`;
  }).join('') || `<div style="padding:32px;text-align:center;color:#777;font-size:13px">当前筛选下暂无内容</div>`;
}

function toast(message) {
  const el = qs('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove('show'), 2100);
}

function toggleSwitch(button, label, onText, offText) {
  const on = button.classList.toggle('on');
  button.setAttribute('aria-checked', String(on));
  if (label) label.textContent = on ? onText : offText;
  return on;
}

renderCourses();
renderQueue();
renderLocal();

qs('#courseList').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-download]');
  if (!btn) return;
  const id = Number(btn.dataset.download);
  if (queue.some(q => q.id === id)) { toast('该课程已在下载队列中'); return; }
  const c = courses.find(c => c.id === id);
  queue.push({ ...c, progress: 0, speed: '准备中', paused: false });
  renderCourses(); renderQueue(); toast(`已将“${c.title}”加入下载队列`);
});

qs('#queueList').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-pause]');
  if (!btn) return;
  const q = queue.find(q => q.id === Number(btn.dataset.pause));
  q.paused = !q.paused;
  renderQueue();
  toast(q.paused ? `已暂停“${q.title}”` : `继续下载“${q.title}”`);
});

qs('#pauseAll').addEventListener('click', () => {
  allPaused = !allPaused;
  queue.forEach(q => q.paused = allPaused);
  renderQueue();
  toast(allPaused ? '全部下载任务已暂停' : '全部下载任务已继续');
});

qs('#pauseSync').addEventListener('click', (e) => {
  const paused = e.currentTarget.dataset.paused === '1';
  e.currentTarget.dataset.paused = paused ? '0' : '1';
  e.currentTarget.textContent = paused ? '全部暂停' : '继续同步';
  qs('#syncStatus').textContent = paused ? '正在同步…' : '同步已暂停';
  toast(paused ? '同步任务已继续' : '同步任务已暂停');
});

qs('#autoSync').addEventListener('click', (e) => {
  const on = toggleSwitch(e.currentTarget, qs('#autoSyncText'), '已开启', '已关闭');
  toast(on ? '已开启自动同步' : '已关闭自动同步');
});
qs('#wifiOnly').addEventListener('click', (e) => {
  const on = toggleSwitch(e.currentTarget);
  toast(on ? '仅在 Wi‑Fi 下下载' : '允许使用移动网络下载');
});

qsa('.tabs button').forEach(btn => btn.addEventListener('click', () => {
  qsa('.tabs button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); activeFilter = btn.dataset.filter; renderLocal();
}));

qs('#localList').addEventListener('click', (e) => {
  if (e.target.closest('[data-retry]')) toast('已重新加入同步队列');
  if (e.target.closest('[data-upload]')) toast('本地学习记录已加入待同步队列');
  if (e.target.closest('[data-delete]')) {
    qs('#modalBackdrop').hidden = false;
    document.body.dataset.pendingDelete = e.target.closest('[data-delete]').dataset.delete;
  }
});

qs('#cleanStorage').addEventListener('click', () => { qs('#modalBackdrop').hidden = false; delete document.body.dataset.pendingDelete; });
qs('#cancelModal').addEventListener('click', () => { qs('#modalBackdrop').hidden = true; });
qs('#modalBackdrop').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.hidden = true; });
qs('#confirmModal').addEventListener('click', () => {
  qs('#modalBackdrop').hidden = true;
  if (document.body.dataset.pendingDelete !== undefined) toast('已删除本地缓存，云端记录不受影响');
  else toast('已清理 420 MB 可安全移除的缓存');
});

qs('#keepLocal').addEventListener('click', () => toast('已选择保留本地版本，等待同步'));
qs('#useCloud').addEventListener('click', () => toast('已选择云端版本，本地内容将更新'));

let progressTimer = setInterval(() => {
  let changed = false;
  queue.forEach(q => {
    if (!q.paused && q.progress < 96) { q.progress += 1; changed = true; }
  });
  if (changed) renderQueue();
}, 5000);
window.addEventListener('beforeunload', () => clearInterval(progressTimer));
