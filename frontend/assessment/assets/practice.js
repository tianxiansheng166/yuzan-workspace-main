(() => {
  'use strict';

  const Api = window.YuzanApi;
  const Visuals = window.YuzanPracticeVisuals;
  const page = document.body.dataset.practicePage;
  const app = document.querySelector('#app');
  const parts = location.pathname.replace(/^\/+|\/+$/g, '').split('/').map(decodeURIComponent);
  const recommendedLabel = new URLSearchParams(location.search).get('recommendedLabel') || '';
  const definitionId = parts[2] || '';
  const categoryOrder = ['发音基础', '听辨训练', '跟读模仿', '独立朗读', '听后复述', '口语交际', '阅读理解', '书面表达', '古诗文'];
  const tabs = [
    ['RECOMMENDED', '推荐给我'], ['ALL', '全部练习'], ['SPECIALIZED', '专项训练'],
    ['COMPREHENSIVE', '综合练习'], ['MOCK', '模拟练习'], ['FAVORITE', '我的收藏'],
  ];
  const state = { query: '', tab: 'RECOMMENDED', filters: {}, sort: 'RECOMMENDED', view: 'grid', cursor: null, catalog: null, assignedRemediations: null, practiceAttemptsByDefinition: null, practiceAttemptStatusPromise: null, loadingMore: false, requestSerial: 0, message: '', messageRole: 'status' };
  const safe = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const shell = body => `<div class="shell practice-${page}"><main class="page practice-page"><div class="practice-contours"></div>${body}</main></div>`;
  const icon = name => Visuals?.icon(name) || `<span class="practice-icon-fallback" aria-hidden="true">${({ search: '⌕', filter: '≡', grid: '▦', list: '☷', arrow: '→', star: '☆', filledStar: '★', clock: '◷', mic: '◉', close: '×', book: '▤' }[name] || '•')}</span>`;
  const error = (message, status) => {
    const bind = status === 403 && String(message || '').includes('学生班级关系');
    app.innerHTML = shell(`<section class="practice-catalog-head"><div><p class="eyebrow">练习中心</p><h1>${bind ? '先连接到你的学习班级' : '暂时无法打开练习中心'}</h1><p>${safe(bind ? '绑定教师邀请码后，即可发现老师开放的练习和自主训练。' : message)}</p></div></section><section class="practice-state practice-error"><img src="/assessment/assets/practice-catalog/snow-peak-success.png" alt=""><div><h2>${bind ? '还没有可访问的练习' : '连接练习中心时遇到问题'}</h2><p>不会显示本地示例内容。请检查网络后重试。</p>${bind ? `<a class="btn primary" href="/student/profile/">前往绑定教师 ${icon('arrow')}</a>` : `<button type="button" class="btn primary" data-error-retry>重新加载 ${icon('retry')}</button>`}</div></section>`);
    document.querySelector('[data-error-retry]')?.addEventListener('click', () => page === 'catalog' ? refreshCatalog() : refreshPracticeDetail());
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
  const chip = (label, value, key, count) => `<button type="button" class="facet-chip ${state.filters[key] === value ? 'selected' : ''}" data-filter-key="${safe(key)}" data-filter-value="${safe(value)}" aria-pressed="${state.filters[key] === value}">${safe(label)}<small>${count}</small></button>`;
  const practiceAttemptStatus = new Set(['CREATED', 'IN_PROGRESS', 'SUBMITTED', 'PROCESSING', 'FAILED', 'COMPLETED']);
  const attemptFor = definitionId => state.practiceAttemptsByDefinition?.get(definitionId) || null;
  const attemptPath = attempt => `/student/practices/attempts/${encodeURIComponent(attempt.id)}`;
  const attemptAction = attempt => {
    if (!attempt) return null;
    if (attempt.status === 'CREATED') return { href: `${attemptPath(attempt)}/runner/`, label: '开始练习' };
    if (attempt.status === 'IN_PROGRESS') return { href: `${attemptPath(attempt)}/runner/`, label: '继续练习' };
    if (['SUBMITTED', 'PROCESSING', 'FAILED'].includes(attempt.status)) return { href: `${attemptPath(attempt)}/processing/`, label: '查看处理状态' };
    if (attempt.status === 'COMPLETED') return { href: `${attemptPath(attempt)}/report/`, label: '查看结果' };
    return null;
  };
  const estimatedMinutesLabel = value => Number.isFinite(Number(value)) && Number(value) > 0 ? `${Number(value)} 分钟` : '预计时长未提供';
  const countLabel = value => Number.isFinite(Number(value)) ? String(Number(value)) : '未提供';
  const statusLabel = item => {
    const attempt = attemptFor(item.id);
    if (attempt) return ({ CREATED: '待开始', IN_PROGRESS: '进行中', SUBMITTED: '已提交', PROCESSING: '处理中', FAILED: '处理失败', COMPLETED: '已完成' })[attempt.status] || '查看详情';
    return ({ IN_PROGRESS: '继续练习', COMPLETED: '已完成', NOT_STARTED: item.mode === 'ASSIGNMENT' ? '教师任务' : '开始练习' }[item.studentState?.completionStatus] || '查看详情');
  };
  const practiceAction = item => attemptAction(attemptFor(item.id)) || {
    href: `/student/practices/${encodeURIComponent(item.id)}/`,
    label: item.studentState?.completionStatus === 'COMPLETED' ? '再次练习' : '查看详情',
  };
  const actionLink = (item, className = '') => { const action = practiceAction(item); return `<a ${className ? `class="${className}"` : ''} href="${safe(action.href)}">${safe(action.label)} ${icon('arrow')}</a>`; };
  const detailHref = item => `/student/practices/${encodeURIComponent(item.id)}/`;
  const favoriteButton = item => `<button type="button" class="favorite-button ${item.studentState?.favorite ? 'is-favorite' : ''}" data-favorite="${safe(item.id)}" aria-label="${item.studentState?.favorite ? '取消收藏' : '收藏练习'}：${safe(item.title)}" aria-pressed="${Boolean(item.studentState?.favorite)}" title="${item.studentState?.favorite ? '取消收藏' : '收藏练习'}">${icon(item.studentState?.favorite ? 'filledStar' : 'star')}</button>`;
  const card = (item, index) => `<article class="practice-tile" data-practice-detail="${safe(item.id)}"><div class="practice-cover-wrap"><a class="practice-cover" href="${detailHref(item)}" aria-label="查看 ${safe(item.title)}"><img src="${safe(window.YuzanVisualAssets?.practiceCover(item, undefined, index) || item.coverAsset || '/assets/generated-covers/practice-reading.png')}" alt="" loading="lazy"><span class="cover-shade"></span><span class="practice-kind">${item.mode === 'ASSIGNMENT' ? '教师开放' : item.catalogType === 'SPECIALIZED' ? '专项训练' : item.catalogType === 'MOCK' ? '模拟练习' : '综合练习'}</span></a>${favoriteButton(item)}</div><div class="practice-tile-body"><div class="practice-tile-meta"><span>${safe(item.gradeBand)}</span><i></i><span>${safe(item.difficulty)}</span><i></i><span>${icon('clock')} ${estimatedMinutesLabel(item.estimatedMinutes)}</span></div><h2><a href="${detailHref(item)}">${safe(item.title)}</a></h2><p>${safe(item.summary)}</p><div class="tag-row">${item.abilityCategories.slice(0, 3).map(tag => `<span>${safe(tag)}</span>`).join('')}</div><div class="practice-tile-foot"><span class="practice-state-label ${safe(attemptFor(item.id)?.status || item.studentState?.completionStatus || 'NOT_STARTED').toLowerCase()}">${safe(statusLabel(item))}</span>${actionLink(item)}</div></div></article>`;
  const listRow = (item, index) => `<article class="practice-row"><a class="practice-row-cover" href="${detailHref(item)}" aria-label="查看 ${safe(item.title)}"><img src="${safe(window.YuzanVisualAssets?.practiceCover(item, undefined, index) || item.coverAsset || '/assets/generated-covers/practice-reading.png')}" alt="" loading="lazy"></a><div class="practice-row-main"><div class="practice-tile-meta"><span>${safe(item.gradeBand)}</span><i></i><span>${safe(item.difficulty)}</span><i></i><span>${estimatedMinutesLabel(item.estimatedMinutes)}</span></div><h2><a href="${detailHref(item)}">${safe(item.title)}</a></h2><p>${safe(item.summary)}</p><div class="tag-row">${item.abilityCategories.map(tag => `<span>${safe(tag)}</span>`).join('')}</div></div><div class="practice-row-state"><p>${safe(item.recommendationReason)}</p><span class="practice-state-label ${safe(attemptFor(item.id)?.status || item.studentState?.completionStatus || 'NOT_STARTED').toLowerCase()}">${safe(statusLabel(item))}</span>${actionLink(item, 'btn primary')}</div></article>`;
  const assignedStatus = status => ({ CREATED: '未开始', IN_PROGRESS: '进行中', SUBMITTED: '已提交', PROCESSING: '处理中', FAILED: '处理失败', COMPLETED: '已完成', CANCELLED: '已取消' }[status] || status);
  const assignedAction = item => attemptAction({ id: item.attemptId, status: item.status }) || { href: '/student/practices/', label: '回到练习中心' };
  const assignedRemediationSection = () => {
    const items = state.assignedRemediations?.items || [];
    if (!items.length) return '';
    return `<section class="assigned-remediations"><div class="catalog-section-head"><div><p class="eyebrow">老师布置</p><h2>老师布置的专项巩固</h2></div><span>${items.filter(item => !['COMPLETED', 'CANCELLED'].includes(item.status)).length} 项待完成</span></div><div class="assigned-remediation-list">${items.map(item => `<article><div><strong>${safe(item.focus?.displayName || '专项巩固')}</strong><p>${safe(item.practiceTitle)}${item.teacherDisplayName ? ` · ${safe(item.teacherDisplayName)}老师布置` : ' · 老师布置'} · ${item.itemCount} 道题</p></div><div><span class="practice-state-label ${safe(item.status).toLowerCase()}">${safe(assignedStatus(item.status))}</span><a class="btn primary" href="${safe(assignedAction(item).href)}">${item.status === 'CREATED' ? '开始巩固' : item.status === 'IN_PROGRESS' ? '继续巩固' : item.status === 'COMPLETED' ? '查看结果' : item.status === 'CANCELLED' ? '回到练习中心' : '查看处理状态'} ${icon('arrow')}</a></div></article>`).join('')}</div></section>`;
  };
  function catalogView() {
    const catalog = state.catalog || { items: [], facets: {}, total: 0, nextCursor: null };
    const activeFilters = Object.entries(state.filters).filter(([, value]) => value).map(([key, value]) => `<button type="button" class="active-filter" data-clear-filter="${safe(key)}" aria-label="移除筛选：${safe(value)}">${safe(value)} ${icon('close')}</button>`).join('');
    const abilityFacets = facetValues('abilityCategory');
    const selectedCategory = state.filters.abilityCategory;
    const results = catalog.items || [];
    const tabControls = tabs.map(([value, label]) => `<button type="button" class="${state.tab === value ? 'active' : ''}" data-tab="${value}" aria-pressed="${state.tab === value}">${label}</button>`).join('');
    const abilityControls = categoryOrder.filter(category => abilityFacets.some(item => item.value === category)).map(category => {
      const facet = abilityFacets.find(item => item.value === category);
      return `<button type="button" class="ability-button ${selectedCategory === category ? 'selected' : ''}" data-filter-key="abilityCategory" data-filter-value="${safe(category)}" aria-pressed="${selectedCategory === category}"><span class="ability-mark">${Visuals?.icon(Visuals.abilityIcon(category)) || icon('book')}</span><b>${safe(category)}</b><small>${Number(facet.count) || 0} 项可练</small></button>`;
    }).join('');
    const mockNote = state.tab === 'MOCK' ? '<p class="practice-mode-note" role="note">模拟练习采用机考式答题界面，仅用于练习；不代表官方考试，也不会生成官方成绩。</p>' : '';
    app.innerHTML = shell(`<section class="practice-catalog-head"><div class="catalog-intro"><p class="eyebrow">学生练习中心</p><h1>把每一次听、读、说、写，练成看得见的进步</h1><p>从老师开放的练习与自主专项中选择；开始后才会创建一次真实练习记录。</p></div><div class="catalog-head-tools"><nav class="catalog-archive-nav" aria-label="练习档案"><a href="/student/practices/history/">练习历史与报告</a><a href="/student/practices/recordings/">我的录音</a></nav><form class="catalog-search" data-search-form role="search"><label><span>${icon('search')}</span><input data-search-input aria-label="搜索练习名称、能力或文化主题" value="${safe(state.query)}" placeholder="搜索练习名称、能力或文化主题"></label><button class="btn primary" type="submit">搜索</button></form></div></section>${assignedRemediationSection()}<nav class="catalog-tabs" aria-label="练习范围">${tabControls}</nav>${mockNote}<section class="catalog-ability"><div class="catalog-section-head"><div><p class="eyebrow">能力方向</p><h2>先从想巩固的一项能力开始</h2></div><button type="button" class="text-action ${selectedCategory ? '' : 'selected'}" data-clear-filter="abilityCategory">全部方向</button></div><div class="ability-rail">${abilityControls}</div></section><section class="catalog-workbench"><aside class="catalog-filters" aria-label="练习筛选"><div class="filter-heading"><h2>${icon('filter')} 筛选练习</h2>${activeFilters ? '<button type="button" class="text-action" data-clear-all>清除全部</button>' : ''}</div><div class="filter-group"><h3>学段</h3>${facetValues('gradeBand').map(item => chip(item.value, item.value, 'gradeBand', item.count)).join('')}</div><div class="filter-group"><h3>难度</h3>${facetValues('difficulty').map(item => chip(item.value, item.value, 'difficulty', item.count)).join('')}</div><div class="filter-group"><h3>预计时长</h3>${facetValues('duration').map(item => chip(({ SHORT: '10 分钟以内', MEDIUM: '11–20 分钟', LONG: '20 分钟以上' })[item.value], item.value, 'duration', item.count)).join('')}</div><div class="filter-group"><h3>题型</h3>${facetValues('itemType').map(item => chip(item.value.replaceAll('_', ' '), item.value, 'itemType', item.count)).join('')}</div><div class="filter-group"><h3>文化主题</h3>${facetValues('cultureTag').map(item => chip(item.value, item.value, 'cultureTag', item.count)).join('')}</div><div class="filter-group"><h3>完成状态</h3>${facetValues('completionStatus').map(item => chip(({ NOT_STARTED: '未开始', IN_PROGRESS: '进行中', COMPLETED: '已完成', FAVORITE: '我的收藏' })[item.value], item.value, 'completionStatus', item.count)).join('')}</div></aside><section class="catalog-results" aria-live="polite" aria-busy="false"><div class="result-toolbar"><div><p class="eyebrow">${state.tab === 'RECOMMENDED' ? '针对我的薄弱项' : '练习库'}</p><h2>${Number(catalog.total) || 0} 项已开放练习</h2>${activeFilters ? `<div class="active-filter-row">${activeFilters}</div>` : ''}</div><div class="result-actions"><label class="visually-hidden" for="practice-sort">练习排序</label><select id="practice-sort" data-sort aria-label="练习排序"><option value="RECOMMENDED" ${state.sort === 'RECOMMENDED' ? 'selected' : ''}>优先推荐</option><option value="DURATION_ASC" ${state.sort === 'DURATION_ASC' ? 'selected' : ''}>时长由短到长</option><option value="DURATION_DESC" ${state.sort === 'DURATION_DESC' ? 'selected' : ''}>时长由长到短</option><option value="TITLE" ${state.sort === 'TITLE' ? 'selected' : ''}>按名称</option></select><div class="view-switch" role="group" aria-label="结果视图"><button type="button" data-view="grid" class="${state.view === 'grid' ? 'active' : ''}" aria-pressed="${state.view === 'grid'}" aria-label="网格视图">${icon('grid')}</button><button type="button" data-view="list" class="${state.view === 'list' ? 'active' : ''}" aria-pressed="${state.view === 'list'}" aria-label="列表视图">${icon('list')}</button></div></div></div>${results.length ? `<div class="${state.view === 'grid' ? 'practice-grid' : 'practice-list'}">${results.map((item, index) => (state.view === 'grid' ? card(item, index) : listRow(item, index))).join('')}</div>${catalog.nextCursor ? '<button type="button" class="load-more" data-load-more>加载更多练习</button>' : ''}` : `<div class="practice-state no-results"><img src="/assessment/assets/practice-catalog/snow-peak-success.png" alt=""><div><h2>${state.query || activeFilters ? '没有匹配的练习' : '暂时没有开放练习'}</h2><p>${state.query || activeFilters ? '可以清除部分筛选条件，或换一个关键词再试。' : '老师开放练习后会在这里出现；练习内容不会由 Attempt 列表代替。'}</p>${state.query || activeFilters ? '<button type="button" class="btn" data-clear-all>清除筛选</button>' : ''}</div></div>`}<div data-practice-message class="practice-message" role="${safe(state.messageRole)}" aria-live="polite" ${state.message ? '' : 'hidden'}>${safe(state.message)}</div></section></section>`);
    document.querySelector('.catalog-tabs')?.insertAdjacentHTML('beforebegin',
      window.YuzanPracticeJourney?.render({ items: state.catalog?.items || [], tab: state.tab }) || '');
    if (recommendedLabel) {
      const banner = document.createElement('article');
      banner.className = 'card notice';
      banner.style.marginBottom = '14px';
      banner.innerHTML = `${icon('book')} 推荐题型：<strong>${safe(recommendedLabel)}</strong>。可以从下面已开放的练习中选择适合自己的内容。`;
      document.querySelector('.catalog-tabs')?.before(banner);
    }
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
      const [result, assignedRemediations] = await Promise.all([Api.listPractices(requestFilters()), Api.listAssignedRemediations(), loadPracticeAttemptStates()]);
      if (!Array.isArray(result?.items) || !Number.isFinite(Number(result.total)) || !result.facets || !Array.isArray(assignedRemediations?.items)) throw new Error('练习目录响应不完整，请刷新后重试。');
      if (serial !== state.requestSerial) return;
      state.catalog = result;
      state.assignedRemediations = assignedRemediations;
      catalogView();
    } catch (err) {
      if (serial !== state.requestSerial) return;
      if (!state.catalog) error(err.message || '后端服务暂不可用', err.status);
      else { setCatalogRefreshing(false); announcePractice(`练习列表未更新：${err.message || '网络错误'}。当前内容仍可查看，请重试。`, 'alert'); }
    }
  }
  async function mapLimit(items, concurrency, callback) {
    const output = new Array(items.length);
    let index = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (index < items.length) {
        const current = index++;
        output[current] = await callback(items[current]);
      }
    }));
    return output;
  }
  async function loadPracticeAttemptStates() {
    if (state.practiceAttemptsByDefinition) return state.practiceAttemptsByDefinition;
    if (state.practiceAttemptStatusPromise) return state.practiceAttemptStatusPromise;
    state.practiceAttemptStatusPromise = (async () => {
      const sessions = [];
      const seenCursors = new Set();
      let cursor;
      for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
        const page = await Api.listAssessmentSessions({ limit: 100, ...(cursor ? { cursor } : {}) });
        if (!Array.isArray(page?.items)) throw new Error('无法确认最近练习的状态，请刷新后重试。');
        sessions.push(...page.items);
        const nextCursor = page.nextCursor;
        if (!nextCursor || seenCursors.has(nextCursor)) break;
        seenCursors.add(nextCursor);
        cursor = nextCursor;
      }
      const candidates = sessions.filter(session => practiceAttemptStatus.has(session.status));
      const attempts = await mapLimit(candidates, 8, async session => {
        try { return await Api.getPracticeAttempt(session.id); }
        catch (err) { if (err.status === 404) return null; throw err; }
      });
      const byDefinition = new Map();
      for (const attempt of attempts) {
        if (!attempt?.practiceDefinitionId) continue;
        const current = byDefinition.get(attempt.practiceDefinitionId);
        const updatedAt = Date.parse(attempt.updatedAt || attempt.createdAt || '') || 0;
        const currentUpdatedAt = current ? Date.parse(current.updatedAt || current.createdAt || '') || 0 : -1;
        if (!current || updatedAt > currentUpdatedAt) byDefinition.set(attempt.practiceDefinitionId, attempt);
      }
      state.practiceAttemptsByDefinition = byDefinition;
      return byDefinition;
    })();
    try { return await state.practiceAttemptStatusPromise; }
    finally { state.practiceAttemptStatusPromise = null; }
  }
  async function toggleFavorite(id, button) {
    button.disabled = true;
    const item = state.catalog?.items?.find(candidate => candidate.id === id);
    const wasFavorite = Boolean(item?.studentState?.favorite);
    try {
      if (wasFavorite) await Api.unfavoritePractice(id); else await Api.favoritePractice(id);
      if (item) item.studentState = { ...item.studentState, favorite: !wasFavorite };
      announcePractice(`${wasFavorite ? '已取消收藏' : '已收藏'}：${item?.title || '练习'}`);
      await refreshCatalog();
    } catch (err) {
      if (item) item.studentState = { ...item.studentState, favorite: wasFavorite };
      button.disabled = false;
      announcePractice(`收藏未保存：${err.message || '网络错误'}。请重试。`, 'alert');
    }
  }
  function announcePractice(message, role = 'status') {
    state.message = message;
    state.messageRole = role;
    const region = document.querySelector('[data-practice-message]');
    if (!region) return;
    region.setAttribute('role', role);
    region.hidden = false;
    region.textContent = message;
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
    document.querySelectorAll('[data-practice-detail]').forEach(tile => tile.addEventListener('click', event => {
      if (event.target.closest('a, button, input, select, textarea, summary')) return;
      const target = tile.querySelector('.practice-cover')?.getAttribute('href');
      if (target) location.href = target;
    }));
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
    document.querySelector('[data-load-more]')?.addEventListener('click', async event => { if (state.loadingMore || !state.catalog.nextCursor) return; const button = event.currentTarget; const serial = state.requestSerial; state.loadingMore = true; button.disabled = true; button.textContent = '正在加载…'; try { const result = await Api.listPractices({ ...requestFilters(), cursor: state.catalog.nextCursor }); if (!Array.isArray(result?.items)) throw new Error('练习目录分页响应不完整。'); if (serial !== state.requestSerial) return; state.catalog = { ...result, items: [...state.catalog.items, ...result.items] }; catalogView(); } catch (err) { if (serial === state.requestSerial) { button.disabled = false; button.textContent = '加载失败，点击重试'; button.title = err.message || '加载更多失败'; } } finally { state.loadingMore = false; } });
  }
  function detailView(practice) {
    const stateInfo = practice.studentState || {};
    const latest = stateInfo.recentResult?.overallScore;
    const currentAttempt = attemptFor(practice.id);
    const currentAction = attemptAction(currentAttempt);
    const modeLabel = practice.mode === 'ASSIGNMENT' ? '教师开放练习' : '自主练习';
    const kindLabel = practice.catalogType === 'SPECIALIZED' ? '专项训练' : practice.catalogType === 'MOCK' ? '模拟练习' : '综合练习';
    const attemptStatus = currentAttempt ? `<p class="detail-attempt-status"><span class="status-orbit" aria-hidden="true">${icon(currentAttempt.status === 'COMPLETED' ? 'check' : currentAttempt.status === 'FAILED' ? 'retry' : 'wave')}</span><span>最近一次练习：<b>${safe(({ CREATED: '待开始', IN_PROGRESS: '进行中', SUBMITTED: '已提交', PROCESSING: '处理中', FAILED: '处理失败', COMPLETED: '已完成' })[currentAttempt.status] || currentAttempt.status)}</b></span></p>` : '';
    const modeNote = practice.catalogType === 'MOCK' ? '<p class="practice-mode-note" role="note">这是机考式模拟练习，不是官方考试；练习结果以系统实际保存与处理状态为准。</p>' : '';
    app.innerHTML = shell(`<section class="practice-detail-hero"><div class="detail-cover"><img src="${safe(window.YuzanVisualAssets?.practiceCover(practice) || practice.coverAsset || '/assets/generated-covers/practice-reading.png')}" alt=""><span></span></div><div class="detail-copy"><p class="eyebrow">${safe(modeLabel)} · ${safe(kindLabel)}</p><h1>${safe(practice.title)}</h1><p>${safe(practice.summary)}</p><div class="detail-metrics"><span>${safe(practice.gradeBand)}</span><span>${safe(practice.difficulty)}</span><span>${icon('clock')} ${Number.isFinite(Number(practice.estimatedMinutes)) && Number(practice.estimatedMinutes) > 0 ? `约 ${Number(practice.estimatedMinutes)} 分钟` : '预计时长未提供'}</span><span>${icon('mic')} ${practice.requiresRecording ? '需要录音' : '无需录音'}</span></div><div class="tag-row">${(practice.abilityCategories || []).map(tag => `<span>${safe(tag)}</span>`).join('')}</div>${attemptStatus}${modeNote}<div class="detail-actions">${currentAction ? `<a class="btn primary practice-cta" href="${safe(currentAction.href)}">${icon(currentAttempt.status === 'COMPLETED' ? 'check' : currentAttempt.status === 'IN_PROGRESS' ? 'play' : 'arrow')} ${safe(currentAction.label)}</a>` : `<button type="button" class="btn primary practice-cta" data-start>${icon('play')} ${stateInfo.completionStatus === 'COMPLETED' ? '再次练习' : '开始练习'}</button>`}<button type="button" class="btn practice-favorite-action" data-detail-favorite aria-pressed="${Boolean(stateInfo.favorite)}">${icon(stateInfo.favorite ? 'filledStar' : 'star')} ${stateInfo.favorite ? '已收藏' : '收藏练习'}</button></div><div data-detail-message class="practice-message" role="status" aria-live="polite" hidden></div></div></section><section class="practice-detail-grid"><article class="card detail-sections"><div class="section-title"><h2>训练流程</h2><span>${(practice.sections || []).length} 个环节</span></div>${(practice.sections || []).map((section, index) => `<div class="detail-section"><b>${String(index + 1).padStart(2, '0')}</b><div><h3>${safe(section.title)}</h3><p>${safe(section.description || '完成本环节练习')} · 约 ${Number.isFinite(Number(section.estimatedMinutes)) && Number(section.estimatedMinutes) > 0 ? `${Number(section.estimatedMinutes)} 分钟` : '时长未提供'}</p></div></div>`).join('')}</article><aside class="detail-side"><article class="card detail-facts"><h2>开始前了解这些</h2><dl><div><dt>题目数量</dt><dd>${countLabel(practice.oralItemCount)} 个口语环节 · ${countLabel(practice.writtenItemCount)} 个书面环节</dd></div><div><dt>示范与录音</dt><dd>${practice.requiresRecording ? '部分口语题会请求麦克风权限。录音须先试听，再确认上传到服务器。' : '本练习不要求录音。'}</dd></div><div><dt>重录规则</dt><dd>${safe(practice.reRecordPolicy?.maxAttempts ? `每题最多 ${practice.reRecordPolicy.maxAttempts} 次录制机会。` : '以老师设置的练习规则为准。')}</dd></div><div><dt>评分与复核</dt><dd>${safe(practice.scoringDisclosure)}</dd></div><div><dt>最近一次成绩</dt><dd>${latest === null || latest === undefined ? '暂未形成可用成绩' : `${safe(latest)} 分`}</dd></div><div><dt>推荐原因</dt><dd>${safe(practice.recommendationReason)}</dd></div></dl></article><article class="detail-note"><img src="/assessment/assets/practice-catalog/snow-peak-success.png" alt=""><p>完成后可在历史记录中查看真实处理状态、录音和已生成结果。</p></article></aside></section>`);
    document.querySelector('[data-start]')?.addEventListener('click', async event => { const button = event.currentTarget; if (button.disabled) return; button.disabled = true; button.textContent = '正在准备练习…'; document.querySelector('[data-start-error]')?.remove(); try { const result = await Api.createOrResumePractice(practice.id); if (!result?.attemptId) throw new Error('服务器没有返回本次练习编号，请重试。'); location.href = `/student/practices/attempts/${encodeURIComponent(result.attemptId)}/runner/`; } catch (err) { button.disabled = false; button.textContent = stateInfo.completionStatus === 'COMPLETED' ? '再次练习' : '开始练习'; const feedback = document.createElement('p'); feedback.dataset.startError = ''; feedback.setAttribute('role', 'alert'); feedback.textContent = err.message || '创建练习失败，请重试。'; button.after(feedback); } });
    document.querySelector('[data-detail-favorite]')?.addEventListener('click', async event => { const button = event.currentTarget; if (button.disabled) return; button.disabled = true; try { if (stateInfo.favorite) await Api.unfavoritePractice(practice.id); else await Api.favoritePractice(practice.id); const fresh = await Api.getPractice(practice.id); detailView(fresh); } catch (err) { button.disabled = false; const message = document.querySelector('[data-detail-message]'); if (message) { message.hidden = false; message.setAttribute('role', 'alert'); message.textContent = `收藏未保存：${err.message || '网络错误'}。请重试。`; } } });
  }
  async function refreshPracticeDetail() {
    loading();
    try {
      const [practice] = await Promise.all([Api.getPractice(definitionId), loadPracticeAttemptStates()]);
      detailView(practice);
    } catch (err) { error(err.message || '后端服务暂不可用', err.status); }
  }
  if (!Api?.getToken?.()) { error('请先登录后再进入练习中心。'); return; }
  window.addEventListener('offline', () => {
    const message = '当前网络已断开。已加载的练习仍可查看，保存、收藏和上传需要联网。';
    if (page === 'catalog' && state.catalog) announcePractice(message, 'alert');
    else if (page === 'detail' && document.querySelector('[data-detail-message]')) {
      const region = document.querySelector('[data-detail-message]');
      region.hidden = false;
      region.setAttribute('role', 'alert');
      region.textContent = message;
    } else error('当前处于离线状态，无法加载练习内容。');
  });
  window.addEventListener('online', () => {
    state.practiceAttemptsByDefinition = null;
    state.message = '';
    if (page === 'catalog') refreshCatalog();
    else refreshPracticeDetail();
  });
  if (page === 'catalog') refreshCatalog();
  else refreshPracticeDetail();
})();
