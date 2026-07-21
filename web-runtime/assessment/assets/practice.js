(() => {
  'use strict';

  const Api = window.YuzanApi;
  const page = document.body.dataset.practicePage;
  const app = document.querySelector('#app');
  const parts = location.pathname.replace(/^\/+|\/+$/g, '').split('/').map(decodeURIComponent);
  const definitionId = parts[2] || '';
  const categoryOrder = ['发音基础', '听辨训练', '跟读模仿', '独立朗读', '听后复述', '口语交际', '阅读理解', '书面表达', '古诗文'];
  const tabs = [
    ['RECOMMENDED', '推荐给我'], ['ALL', '全部练习'], ['SPECIALIZED', '专项训练'],
    ['COMPREHENSIVE', '综合练习'], ['MOCK', '模拟测评'], ['FAVORITE', '我的收藏'],
  ];
  const state = { query: '', tab: 'RECOMMENDED', filters: {}, sort: 'RECOMMENDED', view: 'grid', cursor: null, catalog: null, loadingMore: false, requestSerial: 0 };
  const safe = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const shell = body => `<div class="shell practice-${page}"><main class="page practice-page"><div class="practice-contours"></div>${body}</main></div>`;
  const icon = name => ({ search: '⌕', filter: '≡', grid: '▦', list: '☷', arrow: '→', star: '☆', filledStar: '★', clock: '◷', mic: '◉', close: '×', book: '▤' }[name] || '•');
  const error = (message, status) => {
    const bind = status === 403 && String(message || '').includes('学生班级关系');
    app.innerHTML = shell(`<section class="practice-catalog-head"><div><p class="eyebrow">练习中心</p><h1>${bind ? '先连接到你的学习班级' : '暂时无法打开练习中心'}</h1><p>${safe(bind ? '绑定教师邀请码后，即可发现老师开放的练习和自主训练。' : message)}</p></div></section><section class="practice-state practice-error"><img src="/assessment/assets/practice-catalog/snow-peak-success.png" alt=""><div><h2>${bind ? '还没有可访问的练习' : '连接练习中心时遇到问题'}</h2><p>不会显示本地示例内容。请检查网络后重试。</p><a class="btn primary" href="${bind ? '/student/profile/' : '/student/practices/'}">${bind ? '前往绑定教师' : '重新加载'} ${icon('arrow')}</a></div></section>`);
  };
  const loading = () => app.innerHTML = shell(`<section class="practice-catalog-head"><div><p class="eyebrow">练习中心</p><h1>发现适合你的练习</h1><p>正在从学校练习库加载内容。</p></div></section><section class="practice-state"><div class="loading-spinner"></div><p>正在整理练习、进度和推荐…</p></section>`);
  const requestFilters = () => ({
    ...state.filters,
    query: state.query || undefined,
    sort: state.tab === 'RECOMMENDED' ? 'RECOMMENDED' : state.sort,
    completionStatus: state.tab === 'FAVORITE' ? 'FAVORITE' : state.filters.completionStatus,
    catalogType: ['SPECIALIZED', 'COMPREHENSIVE', 'MOCK'].includes(state.tab) ? state.tab : undefined,
    cursor: state.cursor || undefined,
  });
  const facetValues = (key, values) => (state.catalog?.facets?.[key] || []).filter(item => values ? values.includes(item.value) : true);
  const chip = (label, value, key, count) => `<button class="facet-chip ${state.filters[key] === value ? 'selected' : ''}" data-filter-key="${safe(key)}" data-filter-value="${safe(value)}">${safe(label)}<small>${count}</small></button>`;
  const statusLabel = item => ({ IN_PROGRESS: '继续练习', COMPLETED: '已完成', NOT_STARTED: item.mode === 'ASSIGNMENT' ? '教师任务' : '开始练习' }[item.studentState?.completionStatus] || '查看详情');
  const card = item => `<article class="practice-tile"><a class="practice-cover" href="/student/practices/${encodeURIComponent(item.id)}/" aria-label="查看 ${safe(item.title)}"><img src="${safe(item.coverAsset || '')}" alt="" loading="lazy"><span class="cover-shade"></span><span class="practice-kind">${item.mode === 'ASSIGNMENT' ? '教师任务' : item.catalogType === 'SPECIALIZED' ? '专项训练' : '综合练习'}</span><button class="favorite-button ${item.studentState?.favorite ? 'is-favorite' : ''}" data-favorite="${safe(item.id)}" aria-label="${item.studentState?.favorite ? '取消收藏' : '收藏练习'}">${icon(item.studentState?.favorite ? 'filledStar' : 'star')}</button></a><div class="practice-tile-body"><div class="practice-tile-meta"><span>${safe(item.gradeBand)}</span><i></i><span>${safe(item.difficulty)}</span><i></i><span>${icon('clock')} ${item.estimatedMinutes} 分钟</span></div><h2><a href="/student/practices/${encodeURIComponent(item.id)}/">${safe(item.title)}</a></h2><p>${safe(item.summary)}</p><div class="tag-row">${item.abilityCategories.slice(0, 3).map(tag => `<span>${safe(tag)}</span>`).join('')}</div><div class="practice-tile-foot"><span class="practice-state-label ${safe(item.studentState?.completionStatus || 'NOT_STARTED').toLowerCase()}">${safe(statusLabel(item))}</span><a href="/student/practices/${encodeURIComponent(item.id)}/">查看详情 ${icon('arrow')}</a></div></div></article>`;
  const listRow = item => `<article class="practice-row"><img src="${safe(item.coverAsset || '')}" alt=""><div class="practice-row-main"><div class="practice-tile-meta"><span>${safe(item.gradeBand)}</span><i></i><span>${safe(item.difficulty)}</span><i></i><span>${item.estimatedMinutes} 分钟</span></div><h2>${safe(item.title)}</h2><p>${safe(item.summary)}</p><div class="tag-row">${item.abilityCategories.map(tag => `<span>${safe(tag)}</span>`).join('')}</div></div><div class="practice-row-state"><p>${safe(item.recommendationReason)}</p><span class="practice-state-label ${safe(item.studentState?.completionStatus || 'NOT_STARTED').toLowerCase()}">${safe(statusLabel(item))}</span><a class="btn primary" href="/student/practices/${encodeURIComponent(item.id)}/">进入练习 ${icon('arrow')}</a></div></article>`;
  function catalogView() {
    const catalog = state.catalog || { items: [], facets: {}, total: 0, nextCursor: null };
    const activeFilters = Object.entries(state.filters).filter(([, value]) => value).map(([key, value]) => `<button class="active-filter" data-clear-filter="${safe(key)}">${safe(value)} ${icon('close')}</button>`).join('');
    const abilityFacets = facetValues('abilityCategory');
    const selectedCategory = state.filters.abilityCategory;
    const results = catalog.items || [];
    app.innerHTML = shell(`<section class="practice-catalog-head"><div class="catalog-intro"><p class="eyebrow">学生练习中心</p><h1>把每一次听、读、说、写，练成看得见的进步</h1><p>从老师开放的练习与自主专项中选择；开始后才会创建一次真实练习记录。</p></div><div class="catalog-head-tools"><nav class="catalog-archive-nav" aria-label="练习档案"><a href="/student/practices/history/">测评报告</a><a href="/student/practices/history/">历史记录</a><a href="/student/practices/recordings/">我的录音</a></nav><form class="catalog-search" data-search-form><label><span>${icon('search')}</span><input data-search-input value="${safe(state.query)}" placeholder="搜索练习名称、能力或文化主题"></label><button class="btn primary" type="submit">搜索</button></form></div></section><nav class="catalog-tabs" aria-label="练习范围">${tabs.map(([value, label]) => `<button class="${state.tab === value ? 'active' : ''}" data-tab="${value}">${label}</button>`).join('')}</nav><section class="catalog-ability"><div class="catalog-section-head"><div><p class="eyebrow">能力方向</p><h2>先从想巩固的一项能力开始</h2></div><button class="text-action ${selectedCategory ? '' : 'selected'}" data-clear-filter="abilityCategory">全部方向</button></div><div class="ability-rail">${categoryOrder.filter(category => abilityFacets.some(item => item.value === category)).map(category => { const facet = abilityFacets.find(item => item.value === category); return `<button class="ability-button ${selectedCategory === category ? 'selected' : ''}" data-filter-key="abilityCategory" data-filter-value="${safe(category)}"><b>${safe(category)}</b><small>${facet.count} 项可练</small></button>`; }).join('')}</div></section><section class="catalog-workbench"><aside class="catalog-filters"><div class="filter-heading"><h2>${icon('filter')} 筛选练习</h2>${activeFilters ? '<button class="text-action" data-clear-all>清除全部</button>' : ''}</div><div class="filter-group"><h3>学段</h3>${facetValues('gradeBand').map(item => chip(item.value, item.value, 'gradeBand', item.count)).join('')}</div><div class="filter-group"><h3>难度</h3>${facetValues('difficulty').map(item => chip(item.value, item.value, 'difficulty', item.count)).join('')}</div><div class="filter-group"><h3>预计时长</h3>${facetValues('duration').map(item => chip(({ SHORT: '10 分钟以内', MEDIUM: '11–20 分钟', LONG: '20 分钟以上' })[item.value], item.value, 'duration', item.count)).join('')}</div><div class="filter-group"><h3>题型</h3>${facetValues('itemType').map(item => chip(item.value.replaceAll('_', ' '), item.value, 'itemType', item.count)).join('')}</div><div class="filter-group"><h3>文化主题</h3>${facetValues('cultureTag').map(item => chip(item.value, item.value, 'cultureTag', item.count)).join('')}</div><div class="filter-group"><h3>完成状态</h3>${facetValues('completionStatus').map(item => chip(({ NOT_STARTED: '未开始', IN_PROGRESS: '进行中', COMPLETED: '已完成', FAVORITE: '我的收藏' })[item.value], item.value, 'completionStatus', item.count)).join('')}</div></aside><section class="catalog-results"><div class="result-toolbar"><div><p class="eyebrow">${state.tab === 'RECOMMENDED' ? '针对我的薄弱项' : '练习库'}</p><h2>${catalog.total} 项真实练习</h2>${activeFilters ? `<div class="active-filter-row">${activeFilters}</div>` : ''}</div><div class="result-actions"><select data-sort aria-label="排序"><option value="RECOMMENDED" ${state.sort === 'RECOMMENDED' ? 'selected' : ''}>优先推荐</option><option value="DURATION_ASC" ${state.sort === 'DURATION_ASC' ? 'selected' : ''}>时长由短到长</option><option value="DURATION_DESC" ${state.sort === 'DURATION_DESC' ? 'selected' : ''}>时长由长到短</option><option value="TITLE" ${state.sort === 'TITLE' ? 'selected' : ''}>按名称</option></select><div class="view-switch"><button data-view="grid" class="${state.view === 'grid' ? 'active' : ''}" aria-label="网格视图">${icon('grid')}</button><button data-view="list" class="${state.view === 'list' ? 'active' : ''}" aria-label="列表视图">${icon('list')}</button></div></div></div>${results.length ? `<div class="${state.view === 'grid' ? 'practice-grid' : 'practice-list'}">${results.map(state.view === 'grid' ? card : listRow).join('')}</div>${catalog.nextCursor ? '<button class="load-more" data-load-more>加载更多练习</button>' : ''}` : `<div class="practice-state no-results"><img src="/assessment/assets/practice-catalog/snow-peak-success.png" alt=""><div><h2>${state.query || activeFilters ? '没有匹配的练习' : '暂时没有开放练习'}</h2><p>${state.query || activeFilters ? '可以清除部分筛选条件，或换一个关键词再试。' : '老师开放练习后会在这里出现；练习内容不会由 Attempt 列表代替。'}</p>${state.query || activeFilters ? '<button class="btn" data-clear-all>清除筛选</button>' : ''}</div></div>`}</section></section>`);
    bindCatalog();
  }
  const setCatalogRefreshing = refreshing => {
    const results = document.querySelector('.catalog-results');
    if (!results) return;
    results.classList.toggle('is-refreshing', refreshing);
    results.setAttribute('aria-busy', String(refreshing));
    let indicator = results.querySelector('[data-catalog-refreshing]');
    if (refreshing && !indicator) {
      indicator = document.createElement('span');
      indicator.dataset.catalogRefreshing = 'true';
      indicator.className = 'catalog-refreshing';
      indicator.textContent = '正在更新结果';
      results.querySelector('.result-toolbar')?.append(indicator);
    }
    if (!refreshing) indicator?.remove();
  };
  async function refreshCatalog({ resetCursor = true } = {}) {
    if (resetCursor) state.cursor = null;
    const serial = ++state.requestSerial;
    if (!state.catalog) loading(); else setCatalogRefreshing(true);
    try {
      const result = await Api.listPractices(requestFilters());
      if (serial !== state.requestSerial) return;
      state.catalog = result;
      catalogView();
    } catch (err) {
      if (serial !== state.requestSerial) return;
      if (!state.catalog) error(err.message || '后端服务暂不可用', err.status);
      else setCatalogRefreshing(false);
    }
  }
  async function toggleFavorite(id, button) {
    button.disabled = true;
    try {
      const item = state.catalog.items.find(candidate => candidate.id === id);
      if (item?.studentState?.favorite) await Api.unfavoritePractice(id); else await Api.favoritePractice(id);
      await refreshCatalog();
    } catch (err) { button.disabled = false; alert(err.message || '收藏操作失败'); }
  }
  const extraCatalogFilters = () => `<div class="filter-group"><h3>投放方式</h3>${facetValues('mode').map(item => chip(({ ASSIGNMENT: '教师任务', SELF_PRACTICE: '自主练习' })[item.value], item.value, 'mode', item.count)).join('')}</div><div class="filter-group"><h3>录音要求</h3>${facetValues('requiresRecording').map(item => chip(item.value === 'true' ? '需要录音' : '无需录音', item.value, 'requiresRecording', item.count)).join('')}</div><div class="filter-group"><h3>反馈方式</h3>${facetValues('instantFeedback').map(item => chip(item.value === 'true' ? '即时反馈' : '提交后反馈', item.value, 'instantFeedback', item.count)).join('')}</div>`;
  const compactCatalogFilters = () => {
    const panel = document.querySelector('.catalog-filters');
    if (!panel) return;
    const primary = new Set(['学段', '难度', '预计时长', '录音要求', '完成状态']);
    const groups = [...panel.querySelectorAll('.filter-group')];
    const secondary = groups.filter(group => !primary.has(group.querySelector('h3')?.textContent));
    if (!secondary.length) return;
    const more = document.createElement('details');
    more.className = 'more-filters';
    more.innerHTML = `<summary>更多条件 <span>${secondary.length} 项</span></summary>`;
    secondary.forEach(group => more.append(group));
    panel.append(more);
  };
  function bindCatalog() {
    document.querySelector('.catalog-filters')?.insertAdjacentHTML('beforeend', extraCatalogFilters());
    compactCatalogFilters();
    document.querySelector('[data-search-form]')?.addEventListener('submit', event => { event.preventDefault(); state.query = document.querySelector('[data-search-input]').value.trim(); refreshCatalog(); });
    document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => { state.tab = button.dataset.tab; if (state.tab !== 'RECOMMENDED') state.sort = 'RECOMMENDED'; refreshCatalog(); }));
    document.querySelectorAll('[data-filter-key]').forEach(button => button.addEventListener('click', () => { const key = button.dataset.filterKey; const value = button.dataset.filterValue; state.filters[key] = state.filters[key] === value ? undefined : value; refreshCatalog(); }));
    document.querySelectorAll('[data-clear-filter]').forEach(button => button.addEventListener('click', () => { delete state.filters[button.dataset.clearFilter]; refreshCatalog(); }));
    document.querySelectorAll('[data-clear-all]').forEach(button => button.addEventListener('click', () => { state.filters = {}; state.query = ''; state.tab = 'ALL'; refreshCatalog(); }));
    document.querySelector('[data-sort]')?.addEventListener('change', event => { state.sort = event.currentTarget.value; state.tab = 'ALL'; refreshCatalog(); });
    document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { state.view = button.dataset.view; catalogView(); }));
    document.querySelectorAll('[data-favorite]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); toggleFavorite(button.dataset.favorite, button); }));
    document.querySelector('[data-load-more]')?.addEventListener('click', async event => { if (state.loadingMore || !state.catalog.nextCursor) return; state.loadingMore = true; event.currentTarget.textContent = '正在加载…'; try { const result = await Api.listPractices({ ...requestFilters(), cursor: state.catalog.nextCursor }); state.catalog = { ...result, items: [...state.catalog.items, ...result.items] }; catalogView(); } catch (err) { alert(err.message || '加载更多失败'); } finally { state.loadingMore = false; } });
  }
  function detailView(practice) {
    const stateInfo = practice.studentState || {};
    const latest = stateInfo.recentResult?.overallScore;
    app.innerHTML = shell(`<section class="practice-detail-hero"><div class="detail-cover"><img src="${safe(practice.coverAsset || '')}" alt=""><span></span></div><div class="detail-copy"><p class="eyebrow">${practice.mode === 'ASSIGNMENT' ? '教师任务' : '自主练习'} · ${safe(practice.catalogType === 'SPECIALIZED' ? '专项训练' : '综合练习')}</p><h1>${safe(practice.title)}</h1><p>${safe(practice.summary)}</p><div class="detail-metrics"><span>${safe(practice.gradeBand)}</span><span>${safe(practice.difficulty)}</span><span>${icon('clock')} 约 ${practice.estimatedMinutes} 分钟</span><span>${icon('mic')} ${practice.requiresRecording ? '需要录音' : '无需录音'}</span></div><div class="tag-row">${practice.abilityCategories.map(tag => `<span>${safe(tag)}</span>`).join('')}</div><div class="detail-actions"><button class="btn primary" data-start>${stateInfo.completionStatus === 'IN_PROGRESS' ? '继续练习' : '开始练习'} ${icon('arrow')}</button><button class="btn" data-detail-favorite>${stateInfo.favorite ? '已收藏' : '收藏练习'} ${icon(stateInfo.favorite ? 'filledStar' : 'star')}</button></div></div></section><section class="practice-detail-grid"><article class="card detail-sections"><div class="section-title"><h2>练习目录</h2><span>${practice.sections.length} 个环节</span></div>${practice.sections.map((section, index) => `<div class="detail-section"><b>${String(index + 1).padStart(2, '0')}</b><div><h3>${safe(section.title)}</h3><p>${safe(section.description || '完成本环节练习')} · 约 ${section.estimatedMinutes} 分钟</p></div></div>`).join('')}</article><aside class="detail-side"><article class="card detail-facts"><h2>开始前了解这些</h2><dl><div><dt>口语与书面题</dt><dd>${practice.oralItemCount} 个口语环节 · ${practice.writtenItemCount} 个书面环节</dd></div><div><dt>示范与录音</dt><dd>${practice.requiresRecording ? '有示范的口语题会在播放后进入录音；请使用麦克风。' : '本练习不要求录音。'}</dd></div><div><dt>重录规则</dt><dd>${safe(practice.reRecordPolicy?.maxAttempts ? `每题最多 ${practice.reRecordPolicy.maxAttempts} 次录制机会。` : '以老师设置的练习规则为准。')}</dd></div><div><dt>评分与复核</dt><dd>${safe(practice.scoringDisclosure)}</dd></div><div><dt>最近一次成绩</dt><dd>${latest === null || latest === undefined ? '暂未形成可用成绩' : `${latest} 分`}</dd></div><div><dt>推荐原因</dt><dd>${safe(practice.recommendationReason)}</dd></div></dl></article><article class="detail-note"><img src="/assessment/assets/practice-catalog/snow-peak-success.png" alt=""><p>完成后可在报告中查看真实处理状态、录音和历史记录。</p></article></aside></section>`);
    document.querySelector('[data-start]')?.addEventListener('click', async event => { const button = event.currentTarget; button.disabled = true; button.textContent = '正在准备练习…'; try { const result = await Api.createOrResumePractice(practice.id); location.href = `/student/practices/attempts/${encodeURIComponent(result.attemptId)}/prepare/`; } catch (err) { button.disabled = false; button.textContent = '开始练习'; alert(err.message || '创建练习失败'); } });
    document.querySelector('[data-detail-favorite]')?.addEventListener('click', async event => { const button = event.currentTarget; button.disabled = true; try { if (stateInfo.favorite) await Api.unfavoritePractice(practice.id); else await Api.favoritePractice(practice.id); const fresh = await Api.getPractice(practice.id); detailView(fresh); } catch (err) { button.disabled = false; alert(err.message || '收藏操作失败'); } });
  }
  if (!Api?.getToken?.()) { error('请先登录后再进入练习中心。'); return; }
  window.addEventListener('offline', () => error('当前处于离线状态，无法加载新的练习内容。'));
  if (page === 'catalog') refreshCatalog();
  else { loading(); Api.getPractice(definitionId).then(detailView).catch(err => error(err.message || '后端服务暂不可用', err.status)); }
})();
