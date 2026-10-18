(() => {
  'use strict';

  const root = document.querySelector('#review-root');
  const noDomain = '__no_domain__';
  const params = new URLSearchParams(location.search);
  const filters = {
    student: params.get('student') || '',
    strategy: params.get('strategy') || '',
    domain: params.get('domain') || '',
  };
  let queue = { items: [], total: 0 };
  let loading = false;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
  const familyLabel = (strategy) => ({
    RUBRIC_TEXT: '文字量表',
    SPEECH_READING: '朗读诊断',
    SPEECH_OPEN_RESPONSE: '图片表达',
  }[strategy] || strategy || '题型未提供');
  const familyClass = (strategy) => strategy === 'SPEECH_OPEN_RESPONSE'
    ? 'open'
    : strategy === 'RUBRIC_TEXT' ? 'rubric' : '';
  const itemStudent = (item) => typeof item?.student?.displayName === 'string' ? item.student.displayName : '';
  const itemDomain = (item) => typeof item?.domain === 'string' ? item.domain : '';
  const hasActiveFilters = () => Boolean(filters.student.trim() || filters.strategy || filters.domain);

  function filteredItems() {
    const needle = filters.student.trim().toLocaleLowerCase();
    return queue.items.filter((item) => {
      if (needle && !itemStudent(item).toLocaleLowerCase().includes(needle)) return false;
      if (filters.strategy && item.strategy !== filters.strategy) return false;
      if (filters.domain === noDomain && item.domain != null) return false;
      if (filters.domain && filters.domain !== noDomain && item.domain !== filters.domain) return false;
      return true;
    });
  }

  function currentDetailHref(itemId) {
    const query = new URLSearchParams();
    if (filters.student.trim()) query.set('student', filters.student.trim());
    if (filters.strategy) query.set('strategy', filters.strategy);
    if (filters.domain) query.set('domain', filters.domain);
    const suffix = query.size ? `?${query}` : '';
    return `/teacher/reviews/${encodeURIComponent(itemId)}${suffix}`;
  }

  function renderState(kind, title, message, action = '') {
    const icon = kind === 'complete'
      ? '<svg class="queue-state-icon" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12"/><path d="m10 16 4 4 8-9"/></svg>'
      : '<svg class="queue-state-icon waiting" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12"/><path d="M16 9v8l5 3"/></svg>';
    return `<div class="queue-state queue-state-${esc(kind)}">${icon}<h3>${esc(title)}</h3><p>${esc(message)}</p>${action}</div>`;
  }

  function render() {
    if (!root) return;
    const items = filteredItems();
    const strategyOptions = [...new Set(queue.items.map((item) => item.strategy).filter((value) => typeof value === 'string' && value))];
    const domains = [...new Set(queue.items.map((item) => itemDomain(item)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    const includesNoDomain = queue.items.some((item) => item.domain == null);
    const state = queue.total === 0
      ? renderState('complete', '当前没有待复核题目', '本人授权范围内暂无待处理的题目。队列刷新后会读取服务器最新状态。')
      : items.length === 0
        ? renderState('empty', '没有匹配的题目', '当前筛选结果为空。调整筛选条件，或清除筛选后查看授权队列。', '<button class="review-secondary" type="button" data-clear>清除筛选</button>')
        : '';

    root.setAttribute('aria-busy', loading ? 'true' : 'false');
    root.innerHTML = `<div class="review-header">
      <div class="review-heading">
        <span class="review-kicker">语赞心声 · 教师工作台</span>
        <h1>题库人工复核</h1>
        <p>依据学生原始作答与教师量表提交正式评分。自动诊断只作参考。</p>
      </div>
      <button class="review-refresh" type="button" data-refresh ${loading ? 'disabled' : ''}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 7a6.5 6.5 0 0 0-11.5-2L3 7m0-4v4h4M4 13a6.5 6.5 0 0 0 11.5 2L17 13m0 4v-4h-4"/></svg>
        刷新队列
      </button>
    </div>
    <div class="review-stats" aria-label="队列数量">
      <div class="review-stat accent"><span>本人授权待复核</span><strong>${esc(queue.total)}</strong><small>服务端队列总数</small></div>
      <div class="review-stat"><span>当前筛选匹配</span><strong>${esc(items.length)}</strong><small>按下方条件筛选</small></div>
    </div>
    <section class="review-card" aria-labelledby="queue-title">
      <div class="review-card-head"><div><h2 id="queue-title">待复核队列</h2><p>只展示服务器返回的本人授权题目。</p></div><span class="queue-count">${esc(items.length)} 条匹配</span></div>
      <form class="queue-filters" data-filter-form role="search" aria-label="筛选待复核题目">
        <label class="filter-search"><span>学生姓名</span><input type="search" name="student" data-student-filter value="${esc(filters.student)}" placeholder="输入学生姓名" autocomplete="off"></label>
        <label><span>题型</span><select name="strategy" data-strategy-filter><option value="">全部题型</option>${strategyOptions.map((value) => `<option value="${esc(value)}" ${filters.strategy === value ? 'selected' : ''}>${esc(familyLabel(value))}</option>`).join('')}</select></label>
        <label><span>能力领域</span><select name="domain" data-domain-filter><option value="">全部领域</option>${domains.map((value) => `<option value="${esc(value)}" ${filters.domain === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}${includesNoDomain ? `<option value="${noDomain}" ${filters.domain === noDomain ? 'selected' : ''}>未设置领域</option>` : ''}</select></label>
        <button class="review-secondary clear-filters" type="button" data-clear ${hasActiveFilters() ? '' : 'disabled'}>清除筛选</button>
      </form>
      <div class="queue-result-note" aria-live="polite">${queue.total === 0 ? '授权队列为空' : `授权队列共 ${esc(queue.total)} 条 · 当前匹配 ${esc(items.length)} 条`}</div>
      <nav class="review-list" aria-label="复核题目">
        ${state || items.map((item) => {
          const student = itemStudent(item) || '学生姓名未提供';
          const practice = typeof item?.practice?.title === 'string' && item.practice.title ? item.practice.title : '练习名称未提供';
          const number = Number.isInteger(item.sortOrder) && item.sortOrder >= 0 ? `第 ${item.sortOrder + 1} 题` : '题目序号未提供';
          const maxScore = typeof item.maxScore === 'number' && Number.isFinite(item.maxScore) ? `${item.maxScore} 分` : '满分未提供';
          const domain = itemDomain(item) || '未设置领域';
          return `<a class="review-row" href="${currentDetailHref(item.itemId)}" aria-label="复核 ${esc(student)}，${esc(familyLabel(item.strategy))}，${esc(maxScore)}">
            <span class="row-student"><strong>${esc(student)}</strong><small>${esc(practice)} · ${esc(number)}</small></span>
            <span class="row-subject"><span class="review-family ${familyClass(item.strategy)}">${esc(familyLabel(item.strategy))}</span><small>${esc(domain)}</small></span>
            <span class="review-score"><small>题目满分</small><strong>${esc(maxScore)}</strong></span>
            <span class="row-status"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span>待处理</span></span>
            <span class="row-open">查看证据 <span aria-hidden="true">↗</span></span>
          </a>`;
        }).join('')}
      </nav>
    </section>`;

    root.querySelector('[data-refresh]')?.addEventListener('click', load);
    root.querySelector('[data-clear]')?.addEventListener('click', clearFilters);
    root.querySelector('[data-student-filter]')?.addEventListener('input', (event) => {
      filters.student = event.currentTarget.value;
      render();
      const input = root.querySelector('[data-student-filter]');
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    });
    root.querySelector('[data-strategy-filter]')?.addEventListener('change', (event) => {
      filters.strategy = event.currentTarget.value;
      render();
    });
    root.querySelector('[data-domain-filter]')?.addEventListener('change', (event) => {
      filters.domain = event.currentTarget.value;
      render();
    });
  }

  function clearFilters() {
    filters.student = '';
    filters.strategy = '';
    filters.domain = '';
    const next = new URL(location.href);
    next.search = '';
    history.replaceState(null, '', `${next.pathname}${next.hash}`);
    render();
    root.querySelector('[data-student-filter]')?.focus();
  }

  function renderFailure(error) {
    const message = error?.status === 403
      ? '当前账号没有查看复核队列的权限。请确认账号所属学校与任课班级。'
      : error?.status === 401
        ? '登录状态已失效，请重新登录后再查看复核队列。'
        : `队列加载失败：${error?.message || '网络暂时不可用，请检查连接后重试。'}`;
    root.setAttribute('aria-busy', 'false');
    root.innerHTML = `<div class="review-load-error" role="alert">
      <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="15"/><path d="M20 11v11m0 6h.01"/></svg>
      <h2>${error?.status === 403 ? '无法访问复核队列' : '队列暂时无法加载'}</h2><p>${esc(message)}</p>
      <button class="review-refresh" type="button" data-refresh>重试加载</button>
    </div>`;
    root.querySelector('[data-refresh]')?.addEventListener('click', load);
  }

  async function load() {
    if (loading) return;
    if (!window.YuzanApi?.requireAuth?.()) {
      root.innerHTML = '<div class="review-load-error" role="status"><h2>需要登录</h2><p>登录后才能读取本人授权的复核队列。</p></div>';
      return;
    }
    loading = true;
    root.setAttribute('aria-busy', 'true');
    root.innerHTML = '<div class="review-loading" role="status"><span class="loading-rule" aria-hidden="true"></span><strong>正在读取本人授权队列</strong><span>正在向服务器确认待复核题目…</span></div>';
    try {
      const response = await YuzanApi.getAssessmentReviewQueue();
      const items = Array.isArray(response) ? response : response?.items;
      if (!Array.isArray(items)) throw new Error('服务器未返回复核题目列表。');
      queue = {
        items,
        total: Number.isInteger(response?.total) && response.total >= 0 ? response.total : items.length,
      };
      loading = false;
      render();
    } catch (error) {
      loading = false;
      renderFailure(error);
    }
  }

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) load();
  });
  load();
})();
