(() => {
  'use strict';

  /* ── State ── */
  const state = {
    courses: [],
    filtered: [],
    filters: {
      gradeBand: '',
      capabilityTheme: '',
      taskGroup: '',
      culturalElement: '',
      difficulty: 5,
      search: '',
      sort: 'latest',
      view: 'grid',
    },
    counts: { gradeBand: {}, capabilityTheme: {}, taskGroup: {}, culturalElement: {} },
    cursor: null,
    hasMore: false,
    loading: false,
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const esc = (v = '') => String(v).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);

  const GRADE_OPTIONS = [
    { value: '', label: '全部年级' },
    { value: 'PRIMARY_LOW', label: '小学低学段(1-2年级)' },
    { value: 'PRIMARY_MID', label: '小学中学段(3-4年级)' },
    { value: 'PRIMARY_HIGH', label: '小学高学段(5-6年级)' },
    { value: 'JUNIOR', label: '初中学段' },
  ];

  const CATEGORY_OPTIONS = [
    { value: '', label: '全部课程' },
    { value: 'PHONICS', label: '发音基础' },
    { value: 'LISTENING', label: '听说理解' },
    { value: 'READING', label: '朗读表达' },
    { value: 'WRITING', label: '阅读写作' },
    { value: 'CLASSICS', label: '古诗文' },
    { value: 'COMPREHENSIVE', label: '综合实践' },
    { value: 'CULTURE', label: '文化素养' },
  ];

  const DIFFICULTY_LABELS = ['入门', '基础', '进阶', '高级', '专家'];
  const STATUS_LABELS = {
    NOT_STARTED: '未开始',
    IN_PROGRESS: '进行中',
    COMPLETED: '已完成',
    RESULT_PENDING: '结果处理中',
  };

  const FALLBACK_COVERS = [
    '/assets/cover-spring.png',
    '/assets/cover-barley.png',
    '/assets/cover-morning.png',
    '/assets/cover-phonics.png',
    '/assets/cover-progress.png',
    '/assets/cover-thinking.png',
    '/assets/cover-translation.png',
    '/assets/cover-volunteer.png',
  ];

  function fallbackCover(id) {
    return FALLBACK_COVERS[(typeof id === 'string' ? id.charCodeAt(0) : Number(id) || 0) % FALLBACK_COVERS.length];
  }

  /* ── SVG Icons (replacing Font Awesome) ── */
  const ICONS = {
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    starFill: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  };

  /* ── Toast ── */
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 2600);
  }

  /* ── Error state ── */
  function showError(title, msg, retry) {
    $('#catalogLoading').hidden = true;
    const panel = $('#catalogState');
    panel.innerHTML = `<h3>${esc(title)}</h3><p>${esc(msg)}</p>${retry ? '<button type="button" class="cc-btn-outline" data-retry>重新加载</button>' : ''}`;
    panel.hidden = false;
    panel.querySelector('[data-retry]')?.addEventListener('click', loadCatalog);
  }

  /* ── Build filter sidebar ── */
  function buildFilters() {
    // Grade filters
    $('#gradeFilters').innerHTML = GRADE_OPTIONS.map(o =>
      `<div class="cc-filter-item${o.value === state.filters.gradeBand ? ' active' : ''}" data-filter="gradeBand" data-value="${o.value}">${o.label}</div>`
    ).join('');

    // Category filters
    $('#categoryFilters').innerHTML = CATEGORY_OPTIONS.map(o =>
      `<div class="cc-filter-item${o.value === state.filters.capabilityTheme ? ' active' : ''}" data-filter="capabilityTheme" data-value="${o.value}">${o.label}</div>`
    ).join('');

    // Task groups - dynamic from API data
    buildDynamicFilter('taskGroupFilters', 'taskGroup', state.counts.taskGroup);

    // Cultural elements - dynamic from API data
    buildDynamicFilter('culturalFilters', 'culturalElement', state.counts.culturalElement);
  }

  function buildDynamicFilter(containerId, filterKey, counts) {
    const container = $(`#${containerId}`);
    if (!container) return;
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      container.innerHTML = '<div class="cc-filter-item" style="color:var(--cc-gray-mid);cursor:default">暂无数据</div>';
      return;
    }
    let html = `<div class="cc-filter-item${!state.filters[filterKey] ? ' active' : ''}" data-filter="${filterKey}" data-value="">全部<span class="cc-filter-count">${Object.values(counts).reduce((s, v) => s + v, 0)}</span></div>`;
    for (const [name, count] of entries) {
      html += `<div class="cc-filter-item${state.filters[filterKey] === name ? ' active' : ''}" data-filter="${filterKey}" data-value="${esc(name)}">${esc(name)}<span class="cc-filter-count">${count}</span></div>`;
    }
    container.innerHTML = html;
  }

  function computeCounts() {
    state.counts = { gradeBand: {}, capabilityTheme: {}, taskGroup: {}, culturalElement: {} };
    for (const c of state.courses) {
      if (c.gradeBand) state.counts.gradeBand[c.gradeBand] = (state.counts.gradeBand[c.gradeBand] || 0) + 1;
      if (c.capabilityTheme) state.counts.capabilityTheme[c.capabilityTheme] = (state.counts.capabilityTheme[c.capabilityTheme] || 0) + 1;
      const tgs = c.taskGroups || [];
      for (const tg of tgs) state.counts.taskGroup[tg] = (state.counts.taskGroup[tg] || 0) + 1;
      const ces = c.culturalElements || [];
      for (const ce of ces) state.counts.culturalElement[ce] = (state.counts.culturalElement[ce] || 0) + 1;
    }
  }

  /* ── Filter logic ── */
  function applyFilters() {
    const f = state.filters;
    state.filtered = state.courses.filter(c => {
      if (f.gradeBand && c.gradeBand !== f.gradeBand) return false;
      if (f.capabilityTheme && c.capabilityTheme !== f.capabilityTheme) return false;
      if (f.taskGroup && !(c.taskGroups || []).includes(f.taskGroup)) return false;
      if (f.culturalElement && !(c.culturalElements || []).includes(f.culturalElement)) return false;
      if (f.difficulty < 5 && c.difficultyLevel && c.difficultyLevel > f.difficulty) return false;
      if (f.search) {
        const q = f.search.toLowerCase();
        const hay = [c.title, c.description, c.teacherName, c.capabilityTheme].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // Sort
    if (f.sort === 'popular') state.filtered.sort((a, b) => (b.enrollCount || 0) - (a.enrollCount || 0));
    else if (f.sort === 'rating') state.filtered.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));
    else state.filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  /* ── Render course grid ── */
  function render() {
    applyFilters();
    renderActiveTags();
    renderGrid();
    $('#resultCount').textContent = `显示 ${state.filtered.length} 门`;
    $('#emptyState').hidden = state.filtered.length > 0;
    $('#loadMore').hidden = !state.hasMore;
    updateViewToggle();
  }

  function renderGrid() {
    const grid = $('#courseGrid');
    const isListView = state.filters.view === 'list';
    grid.className = `cc-grid cc-grid--${isListView ? '1' : '3'}`;
    grid.innerHTML = state.filtered.map(cardMarkup).join('');
    bindCardActions();
  }

  function cardMarkup(c) {
    const progress = Number(c.progressPercent) || 0;
    const coverUrl = c.coverAsset || fallbackCover(c.assignmentId);
    const isNew = isNewCourse(c);
    const dashoffset = 100 - progress;
    const teacherDisplay = c.teacherName || '待定教师';
    const lessonCount = c.lessonCount || c.totalActivities || 0;
    const themeLabel = c.capabilityTheme || '综合';
    const gradeLabel = gradeLabelFor(c.gradeBand);
    const isFav = c.isFavorited || false;

    return `
      <div class="cc-card" data-assignment-id="${esc(c.assignmentId)}">
        <div class="cc-card-cover">
          <img src="${esc(coverUrl)}" alt="${esc(c.title)}" loading="lazy" />
          ${gradeLabel ? `<div class="cc-card-badge-grade">${esc(gradeLabel)}</div>` : ''}
          ${isNew ? '<div class="cc-card-badge-new">新课</div>' : ''}
          ${progress > 0 ? `
            <div class="cc-card-progress-bar">
              <svg class="cc-progress-ring" viewBox="0 0 36 36">
                <circle stroke="#fff" stroke-opacity=".3" stroke-width="3" fill="transparent" r="16" cx="18" cy="18" stroke-dasharray="100" stroke-dashoffset="0"/>
                <circle class="cc-progress-ring-circle" stroke="#fff" stroke-width="3" fill="transparent" r="16" cx="18" cy="18" stroke-dasharray="100" stroke-dashoffset="${dashoffset}"/>
              </svg>
              <span class="cc-card-progress-text">已学习 ${progress}%</span>
            </div>
          ` : ''}
        </div>
        <div class="cc-card-body">
          <div class="cc-card-meta">
            <span class="cc-card-theme">${esc(themeLabel)}</span>
            <span class="cc-card-lessons">${lessonCount}课时</span>
          </div>
          <h3 class="cc-card-title">${esc(c.title)}</h3>
          <p class="cc-card-desc">${esc(c.description || '')}</p>
          <div class="cc-card-footer">
            <span class="cc-card-teacher">${ICONS.user} ${esc(teacherDisplay)}</span>
            <div class="cc-card-actions">
              <button class="cc-card-action${isFav ? ' favorited' : ''}" data-fav="${esc(c.assignmentId)}" aria-label="${isFav ? '取消收藏' : '收藏'}">${isFav ? ICONS.starFill : ICONS.star}</button>
              <button class="cc-card-action" data-offline="${esc(c.assignmentId)}" aria-label="离线下载">${ICONS.download}</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  function isNewCourse(c) {
    if (!c.createdAt) return false;
    const d = new Date(c.createdAt);
    const now = new Date();
    return (now - d) < 30 * 24 * 60 * 60 * 1000; // within 30 days
  }

  function gradeLabelFor(g) {
    const found = GRADE_OPTIONS.find(o => o.value === g);
    return found && found.value ? found.label : '';
  }

  /* ── Active tags ── */
  function renderActiveTags() {
    const tags = [];
    const f = state.filters;
    if (f.gradeBand) tags.push({ key: 'gradeBand', value: f.gradeBand, label: gradeLabelFor(f.gradeBand) });
    if (f.capabilityTheme) tags.push({ key: 'capabilityTheme', value: f.capabilityTheme, label: CATEGORY_OPTIONS.find(o => o.value === f.capabilityTheme)?.label || f.capabilityTheme });
    if (f.taskGroup) tags.push({ key: 'taskGroup', value: f.taskGroup, label: f.taskGroup });
    if (f.culturalElement) tags.push({ key: 'culturalElement', value: f.culturalElement, label: f.culturalElement });
    if (f.difficulty < 5) tags.push({ key: 'difficulty', value: f.difficulty, label: `难度≤${DIFFICULTY_LABELS[f.difficulty - 1]}` });
    if (f.search) tags.push({ key: 'search', value: f.search, label: `搜索: ${f.search}` });

    const container = $('#activeTags');
    container.hidden = tags.length === 0;
    container.innerHTML = tags.map(t =>
      `<span class="cc-tag">${esc(t.label)}<button class="cc-tag-close" data-remove-filter="${t.key}" data-remove-value="${esc(String(t.value))}">&times;</button></span>`
    ).join('');
  }

  function updateViewToggle() {
    $$('.cc-view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === state.filters.view);
    });
  }

  /* ── Bind events ── */
  function bindCardActions() {
    // Card click -> navigate to player
    $$('.cc-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Don't navigate if clicking action buttons
        if (e.target.closest('.cc-card-action')) return;
        const id = card.dataset.assignmentId;
        if (id) location.href = `/student/courses/course-detail/?id=${encodeURIComponent(id)}`;
      });
    });

    // Favorite toggle
    $$('.cc-card-action[data-fav]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.fav;
        try {
          if (btn.classList.contains('favorited')) {
            await YuzanApi.removeCourseFavorite(id);
            btn.classList.remove('favorited');
            btn.innerHTML = ICONS.star;
            btn.setAttribute('aria-label', '收藏');
            toast('已取消收藏');
          } else {
            await YuzanApi.addCourseFavorite(id);
            btn.classList.add('favorited');
            btn.innerHTML = ICONS.starFill;
            btn.setAttribute('aria-label', '取消收藏');
            toast('已添加收藏');
          }
        } catch (err) {
          toast(err.message || '操作失败');
        }
      });
    });

    // Offline download
    $$('.cc-card-action[data-offline]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toast('离线下载功能即将上线');
      });
    });
  }

  /* ── Main load ── */
  async function loadCatalog() {
    $('#catalogLoading').hidden = false;
    $('#catalogState').hidden = true;
    $('#catalogContent').hidden = true;

    if (!navigator.onLine) {
      showError('当前处于离线状态', '课程目录需要联网读取。', true);
      return;
    }

    try {
      const data = await YuzanApi.listStudentCourses();
      state.courses = Array.isArray(data?.courses) ? data.courses : Array.isArray(data) ? data : [];
      state.cursor = data?.nextCursor || null;
      state.hasMore = !!data?.hasMore;

      computeCounts();
      buildFilters();
      render();

      $('#catalogLoading').hidden = true;
      $('#catalogContent').hidden = false;
    } catch (err) {
      if (err.status === 401) {
        location.href = '/login?returnTo=' + encodeURIComponent(location.pathname);
        return;
      }
      showError(
        err.status === 403 ? '没有课程访问权限' : '课程暂时无法加载',
        err.message || '请稍后重试。',
        true,
      );
    }
  }

  /* ── Load more ── */
  async function loadMore() {
    if (state.loading || !state.cursor) return;
    state.loading = true;
    try {
      const data = await YuzanApi.listStudentCourses({ cursor: state.cursor });
      const more = Array.isArray(data?.courses) ? data.courses : [];
      state.courses.push(...more);
      state.cursor = data?.nextCursor || null;
      state.hasMore = !!data?.hasMore;
      computeCounts();
      buildFilters();
      render();
    } catch (err) {
      toast(err.message || '加载更多失败');
    }
    state.loading = false;
  }

  /* ── Event delegation ── */
  function initEvents() {
    // Filter items
    document.addEventListener('click', (e) => {
      const item = e.target.closest('.cc-filter-item[data-filter]');
      if (item) {
        const key = item.dataset.filter;
        const val = item.dataset.value;
        state.filters[key] = val;
        buildFilters();
        render();
      }
    });

    // Remove filter tag
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove-filter]');
      if (btn) {
        const key = btn.dataset.removeFilter;
        if (key === 'difficulty') state.filters.difficulty = 5;
        else if (key === 'search') { state.filters.search = ''; $('#searchInput').value = ''; }
        else state.filters[key] = '';
        buildFilters();
        render();
      }
    });

    // Search
    let searchTimer;
    $('#searchInput').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.filters.search = e.target.value.trim();
        render();
      }, 300);
    });
    $('#searchBtn').addEventListener('click', () => {
      state.filters.search = $('#searchInput').value.trim();
      render();
    });
    $('#searchInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        state.filters.search = e.target.value.trim();
        render();
      }
    });

    // Sort
    $('#sortSelect').addEventListener('change', (e) => {
      state.filters.sort = e.target.value;
      render();
    });

    // View toggle
    $$('.cc-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.filters.view = btn.dataset.view;
        render();
      });
    });

    // Difficulty slider
    $('#difficultyRange').addEventListener('input', (e) => {
      state.filters.difficulty = Number(e.target.value);
      render();
    });

    // Clear all filters
    $('#clearAllFilters').addEventListener('click', clearAllFilters);
    $('#clearFilters')?.addEventListener('click', clearAllFilters);

    // Load more
    $('#loadMoreBtn')?.addEventListener('click', loadMore);

    // Offline modal
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-close-modal]')) {
        $('#offlineModal').hidden = true;
        $('#offlineModal').setAttribute('aria-hidden', 'true');
      }
    });
  }

  function clearAllFilters() {
    state.filters = {
      gradeBand: '',
      capabilityTheme: '',
      taskGroup: '',
      culturalElement: '',
      difficulty: 5,
      search: '',
      sort: state.filters.sort,
      view: state.filters.view,
    };
    $('#searchInput').value = '';
    $('#difficultyRange').value = 5;
    buildFilters();
    render();
  }

  /* ── Boot ── */
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof YuzanApi === 'undefined') {
      showError('系统加载失败', 'API客户端未就绪，请刷新页面重试。', true);
      return;
    }
    initEvents();
    loadCatalog();
  });
})();
