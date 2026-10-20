(() => {
  'use strict';

  const PAGE_SIZE = 12;
  const state = {
    courses: [],
    filters: {
      gradeBand: '',
      capabilityTheme: '',
      difficulty: '',
      taskGroup: '',
      culturalElement: '',
      search: '',
      sortBy: 'publishedAt',
      sortOrder: 'desc',
      view: 'grid',
    },
    categories: [],
    gradeBands: [],
    difficulties: [],
    total: null,
    cursor: null,
    hasMore: false,
    loading: false,
    pageLoading: false,
    hasLoaded: false,
    requestId: 0,
    pendingFavorites: new Set(),
    pageCursorByCourseId: new Map(),
  };
  const textTimers = new Map();

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);
  const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);

  const GRADE_LABELS = {
    PRIMARY_LOW: '小学低学段（1–2 年级）',
    PRIMARY_MID: '小学中学段（3–4 年级）',
    PRIMARY_HIGH: '小学高学段（5–6 年级）',
    JUNIOR: '初中学段',
  };
  const CATEGORY_LABELS = {
    PHONICS: '发音基础',
    LISTENING: '听说理解',
    READING: '朗读表达',
    WRITING: '阅读写作',
    CLASSICS: '古诗文',
    COMPREHENSIVE: '综合实践',
    CULTURE: '文化素养',
  };
  const STATUS_LABELS = {
    NOT_STARTED: '尚未开始',
    IN_PROGRESS: '学习中',
    COMPLETED: '已完成',
    RESULT_PENDING: '结果处理中',
  };
  const SOURCE_LABELS = {
    TEACHER_ASSIGNED: '老师布置',
    RECOMMENDED: '推荐学习',
    SELF_STUDY: '自主学习',
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
  const ICONS = {
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.4l6.1-.9L12 3Z"/></svg>',
    starFill: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.4l6.1-.9L12 3Z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
  };

  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  function gradeLabel(value) {
    return GRADE_LABELS[value] || value || '';
  }

  function categoryLabel(value) {
    return CATEGORY_LABELS[value] || value || '';
  }

  function coverFor(course) {
    const selected = window.YuzanVisualAssets?.courseCover(course) || course.coverAsset;
    if (selected) return selected;
    const seed = String(course.assignmentId || 'course').charCodeAt(0);
    return FALLBACK_COVERS[seed % FALLBACK_COVERS.length];
  }

  function apiFilters(cursor) {
    const query = {
      sortBy: state.filters.sortBy,
      sortOrder: state.filters.sortOrder,
      limit: PAGE_SIZE,
    };
    for (const key of ['gradeBand', 'capabilityTheme', 'difficulty', 'taskGroup', 'culturalElement', 'search']) {
      const value = state.filters[key].trim?.() ?? state.filters[key];
      if (value) query[key] = value;
    }
    if (cursor) query.cursor = cursor;
    return query;
  }

  function replaceOptions(select, values, emptyLabel, labels = {}) {
    const selected = select.value;
    const options = [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' && value.trim()))]
      .sort((left, right) => left.localeCompare(right, 'zh-CN'));
    if (selected && !options.includes(selected)) options.push(selected);
    select.innerHTML = `<option value="">${esc(emptyLabel)}</option>${options.map((value) =>
      `<option value="${esc(value)}">${esc(labels[value] || value)}</option>`
    ).join('')}`;
    select.value = selected;
  }

  function updateFilterOptions(data) {
    if (Array.isArray(data.categories)) state.categories = data.categories;
    if (Array.isArray(data.gradeBands)) state.gradeBands = data.gradeBands;
    if (Array.isArray(data.difficulties)) state.difficulties = data.difficulties;
    replaceOptions($('#gradeFilter'), state.gradeBands, '全部年级', GRADE_LABELS);
    replaceOptions($('#categoryFilter'), state.categories, '全部类别', CATEGORY_LABELS);
    replaceOptions($('#difficultyFilter'), state.difficulties, '全部难度');
    $('#gradeFilter').value = state.filters.gradeBand;
    $('#categoryFilter').value = state.filters.capabilityTheme;
    $('#difficultyFilter').value = state.filters.difficulty;
    $('#taskGroupFilter').value = state.filters.taskGroup;
    $('#culturalFilter').value = state.filters.culturalElement;
    $('#searchInput').value = state.filters.search;
    $('#sortSelect').value = state.filters.sortBy;
  }

  function statusLabel(course) {
    return STATUS_LABELS[course.status] || '学习进度';
  }

  function actionLabel(course) {
    if (course.status === 'IN_PROGRESS') return '继续学习';
    if (course.status === 'COMPLETED') return '查看课程';
    if (course.status === 'RESULT_PENDING') return '查看学习进度';
    return '开始学习';
  }

  function courseMarkup(course) {
    const id = String(course.assignmentId || '');
    const title = course.title || '未命名课程';
    const rawProgress = course.progressPercent;
    const hasProgress = typeof rawProgress === 'number' && Number.isFinite(rawProgress) && rawProgress >= 0 && rawProgress <= 100;
    const progress = hasProgress ? rawProgress : null;
    const circumference = 113.1;
    const offset = circumference * (1 - (progress == null ? 0 : progress) / 100);
    const isFavorite = course.isFavorite === true;
    const category = categoryLabel(course.capabilityTheme);
    const grade = gradeLabel(course.gradeBand);
    const difficulty = course.difficulty || '';
    const source = SOURCE_LABELS[course.source] || '';
    const estimatedMinutes = Number(course.estimatedMinutes);
    const description = typeof course.description === 'string' ? course.description.trim() : '';
    const nextActivity = course.nextActivity && typeof course.nextActivity.title === 'string'
      ? course.nextActivity.title.trim()
      : '';
    const nextActivityId = course.nextActivity && typeof course.nextActivity.id === 'string'
      ? course.nextActivity.id
      : '';
    const detailHref = `/student/courses/course-detail/?id=${encodeURIComponent(id)}${nextActivityId ? `&activityId=${encodeURIComponent(nextActivityId)}` : ''}`;
    const taskGroup = Array.isArray(course.taskGroups) ? course.taskGroups.find(Boolean) : '';
    const culturalElement = Array.isArray(course.culturalElements) ? course.culturalElements.find(Boolean) : '';
    const extraTags = [taskGroup, culturalElement].filter(Boolean);

    return `<article class="cc-card" data-course-id="${esc(id)}">
      <a class="cc-card-link" href="${esc(detailHref)}" aria-label="${esc(`${actionLabel(course)}：${title}`)}">
        <div class="cc-card-cover">
          <img src="${esc(coverFor(course))}" alt="" loading="lazy" />
          <span class="cc-cover-wash" aria-hidden="true"></span>
          <span class="cc-cover-category">${esc(category || '学习课程')}</span>
          <div class="cc-cover-bottom">
            <span class="cc-cover-status">${esc(statusLabel(course))}</span>
            ${grade ? `<span class="cc-cover-grade">${esc(grade)}</span>` : ''}
          </div>
        </div>
        <div class="cc-card-body">
          <div class="cc-card-meta">
            ${difficulty ? `<span class="cc-meta-item"><span class="cc-meta-dot" aria-hidden="true"></span>${esc(difficulty)}</span>` : ''}
            ${source ? `<span class="cc-meta-source">${esc(source)}</span>` : ''}
          </div>
          <h3 class="cc-card-title">${esc(title)}</h3>
          ${description ? `<p class="cc-card-description">${esc(description)}</p>` : ''}
          ${extraTags.length ? `<div class="cc-card-tags">${extraTags.slice(0, 2).map((tag) => `<span>${esc(tag)}</span>`).join('')}</div>` : ''}
          ${nextActivity ? `<p class="cc-next-activity"><span>下一项</span><strong>${esc(nextActivity)}</strong></p>` : ''}
          <div class="cc-learning-progress" role="progressbar" aria-label="${esc(`${title}学习进度`)}" aria-valuemin="0" aria-valuemax="100" ${hasProgress ? `aria-valuenow="${progress}"` : 'aria-valuetext="进度暂不可用"'}>
            <span class="cc-progress-dial" aria-hidden="true">
              <svg viewBox="0 0 42 42"><circle class="cc-progress-track" cx="21" cy="21" r="18"/><circle class="cc-progress-value" cx="21" cy="21" r="18" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/></svg>
              <span>${hasProgress ? `${progress}%` : '—'}</span>
            </span>
            <span class="cc-progress-copy"><strong>${hasProgress ? (progress === 100 ? '课程已完成' : `已完成 ${progress}%`) : '进度暂不可用'}</strong><span>个人学习进度</span></span>
            <span class="cc-progress-arrow" aria-hidden="true">${ICONS.arrow}</span>
          </div>
          <span class="cc-card-cta"><span>${esc(actionLabel(course))}</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 10h12m-4.5-4.5L15.5 10 11 14.5"/></svg></span>
        </div>
      </a>
      <button class="cc-favorite-button${isFavorite ? ' is-favorite' : ''}" type="button" data-favorite="${esc(id)}" aria-label="${isFavorite ? '取消收藏' : '收藏课程'}：${esc(title)}" aria-pressed="${isFavorite}" title="${isFavorite ? '取消收藏' : '收藏课程'}">
        ${isFavorite ? ICONS.starFill : ICONS.star}
      </button>
    </article>`;
  }

  function renderGrid() {
    const grid = $('#courseGrid');
    grid.className = `cc-grid${state.filters.view === 'list' ? ' cc-grid--list' : ''}`;
    grid.innerHTML = state.courses.map(courseMarkup).join('');
    grid.setAttribute('aria-busy', String(state.loading || state.pageLoading));
    updateViewButtons();
  }

  function renderActiveTags() {
    const labels = [
      ['gradeBand', gradeLabel(state.filters.gradeBand)],
      ['capabilityTheme', categoryLabel(state.filters.capabilityTheme)],
      ['difficulty', state.filters.difficulty],
      ['taskGroup', state.filters.taskGroup],
      ['culturalElement', state.filters.culturalElement],
      ['search', state.filters.search],
    ].filter(([, label]) => label);
    const tags = $('#activeTags');
    tags.hidden = labels.length === 0;
    tags.innerHTML = labels.map(([key, label]) => `<span class="cc-active-tag">${esc(label)}<button type="button" data-remove-filter="${key}" aria-label="移除筛选：${esc(label)}">×</button></span>`).join('');
  }

  function updateViewButtons() {
    $$('.cc-view-button').forEach((button) => {
      const active = button.dataset.view === state.filters.view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function updateResultCount() {
    if (state.total !== null) {
      $('#resultCount').textContent = `共 ${state.total} 门 · 已加载 ${state.courses.length} 门`;
    } else if (state.hasLoaded) {
      $('#resultCount').textContent = `已加载 ${state.courses.length} 门`;
    } else {
      $('#resultCount').textContent = '正在加载…';
    }
  }

  function renderPage() {
    renderActiveTags();
    renderGrid();
    updateResultCount();
    $('#emptyState').hidden = state.loading || state.pageLoading || state.courses.length > 0;
    $('#loadMore').hidden = !state.hasMore || !state.cursor || state.courses.length === 0;
    $('#loadMoreBtn').disabled = state.pageLoading;
    $('#loadMoreBtn').textContent = state.pageLoading ? '正在加载…' : '加载更多课程';
  }

  function showInitialError(title, message) {
    $('#catalogLoading').hidden = true;
    $('#catalogContent').hidden = true;
    const panel = $('#catalogState');
    panel.innerHTML = `<span class="cc-error-mark" aria-hidden="true">!</span><div><h2>${esc(title)}</h2><p>${esc(message)}</p><button class="cc-outline-button" type="button" data-retry>重新加载</button></div>`;
    panel.hidden = false;
  }

  function showRequestError(title, message) {
    const panel = $('#requestError');
    panel.innerHTML = `<span>${esc(title)}：${esc(message)}</span><button class="cc-text-button" type="button" data-retry>重试</button>`;
    panel.hidden = false;
  }

  function clearRequestError() {
    $('#requestError').hidden = true;
    $('#requestError').textContent = '';
  }

  function showNetworkNotice(message) {
    $('#networkMessage').textContent = message;
    $('#networkNotice').hidden = false;
    $('#networkRetry').disabled = !navigator.onLine;
  }

  function clearNetworkNotice() {
    $('#networkNotice').hidden = true;
    $('#networkMessage').textContent = '';
  }

  function appendPage(data, pageCursor) {
    const incoming = Array.isArray(data?.courses) ? data.courses : [];
    const known = new Set(state.courses.map((course) => course.assignmentId));
    for (const course of incoming) {
      if (!course?.assignmentId || known.has(course.assignmentId)) continue;
      known.add(course.assignmentId);
      state.pageCursorByCourseId.set(course.assignmentId, pageCursor || null);
      state.courses.push(course);
    }
    state.total = Number.isInteger(data?.total) && data.total >= 0 ? data.total : null;
    state.cursor = typeof data?.nextCursor === 'string' && data.nextCursor ? data.nextCursor : null;
    state.hasMore = data?.hasMore === true && Boolean(state.cursor);
  }

  function handleRequestError(error) {
    if (error?.status === 401) {
      location.href = `/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`;
      return;
    }
    if (!navigator.onLine || error?.offline || error instanceof TypeError) {
      const message = '当前需要联网加载课程。网络恢复后可以重试。';
      showNetworkNotice(navigator.onLine ? '网络连接暂不可用。请检查网络后重试。' : message);
      if (!state.hasLoaded) showInitialError('课程目录需要联网', message);
      else showRequestError('课程暂时无法更新', message);
      return;
    }
    const title = error?.status === 403 ? '没有课程访问权限' : '课程暂时无法加载';
    const message = error?.message || '请稍后重试。';
    if (!state.hasLoaded) showInitialError(title, message);
    else showRequestError(title, message);
  }

  async function loadCatalog({ append = false } = {}) {
    if (append) {
      if (state.loading || state.pageLoading || !state.cursor || !state.hasMore) return;
      state.pageLoading = true;
      const requestId = state.requestId;
      const pageCursor = state.cursor;
      const filters = apiFilters(pageCursor);
      renderPage();
      try {
        const data = await YuzanApi.listStudentCourses(filters);
        if (requestId !== state.requestId) return;
        appendPage(data, pageCursor);
        updateFilterOptions(data);
        renderPage();
        clearRequestError();
      } catch (error) {
        if (requestId === state.requestId) handleRequestError(error);
      } finally {
        if (requestId === state.requestId) {
          state.pageLoading = false;
          renderPage();
        }
      }
      return;
    }

    const requestId = ++state.requestId;
    state.loading = true;
    state.pageLoading = false;
    state.courses = [];
    state.total = null;
    state.cursor = null;
    state.hasMore = false;
    state.pageCursorByCourseId.clear();
    clearRequestError();
    $('#catalogState').hidden = true;
    $('#catalogLoading').hidden = state.hasLoaded;
    $('#catalogContent').hidden = !state.hasLoaded;
    $('#gridLoading').hidden = !state.hasLoaded;
    renderPage();

    try {
      if (!navigator.onLine) {
        const offlineError = new Error('当前需要联网加载课程。网络恢复后可以重试。');
        offlineError.offline = true;
        throw offlineError;
      }
      const data = await YuzanApi.listStudentCourses(apiFilters());
      if (requestId !== state.requestId) return;
      state.courses = [];
      state.pageCursorByCourseId.clear();
      appendPage(data, null);
      updateFilterOptions(data);
      state.hasLoaded = true;
      state.loading = false;
      $('#catalogLoading').hidden = true;
      $('#catalogState').hidden = true;
      $('#catalogContent').hidden = false;
      $('#gridLoading').hidden = true;
      clearNetworkNotice();
      clearRequestError();
      renderPage();
    } catch (error) {
      if (requestId !== state.requestId) return;
      state.loading = false;
      $('#gridLoading').hidden = true;
      renderPage();
      handleRequestError(error);
    }
  }

  function setFilter(key, value) {
    if (state.filters[key] === value) return;
    state.filters[key] = value;
    loadCatalog();
  }

  function resetFilters() {
    for (const timer of textTimers.values()) clearTimeout(timer);
    textTimers.clear();
    state.filters.gradeBand = '';
    state.filters.capabilityTheme = '';
    state.filters.difficulty = '';
    state.filters.taskGroup = '';
    state.filters.culturalElement = '';
    state.filters.search = '';
    updateFilterOptions({});
    loadCatalog();
  }

  async function reconcileFavorite(courseId, pageCursor) {
    const data = await YuzanApi.listStudentCourses(apiFilters(pageCursor));
    const updated = Array.isArray(data?.courses)
      ? data.courses.find((course) => course.assignmentId === courseId)
      : null;
    if (!updated) return false;
    const current = state.courses.find((course) => course.assignmentId === courseId);
    if (!current) return false;
    current.isFavorite = updated.isFavorite === true;
    updateFavoriteButton(courseId, current);
    return true;
  }

  function updateFavoriteButton(courseId, course) {
    document.querySelectorAll(`[data-favorite="${CSS.escape(courseId)}"]`).forEach((button) => {
      const favorite = course.isFavorite === true;
      button.classList.toggle('is-favorite', favorite);
      button.setAttribute('aria-pressed', String(favorite));
      button.setAttribute('aria-label', `${favorite ? '取消收藏' : '收藏课程'}：${course.title || '课程'}`);
      button.title = favorite ? '取消收藏' : '收藏课程';
      button.innerHTML = favorite ? ICONS.starFill : ICONS.star;
    });
  }

  async function toggleFavorite(button) {
    const courseId = button.dataset.favorite;
    const course = state.courses.find((item) => item.assignmentId === courseId);
    if (!course || state.pendingFavorites.has(courseId)) return;
    const wasFavorite = course.isFavorite === true;
    const pageCursor = state.pageCursorByCourseId.get(courseId) || null;
    state.pendingFavorites.add(courseId);
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');

    try {
      let result;
      if (wasFavorite) {
        result = await YuzanApi.removeCourseFavorite(courseId);
      } else {
        result = await YuzanApi.addCourseFavorite(courseId);
      }
      if (typeof result?.favorited !== 'boolean') {
        const reconciled = await reconcileFavorite(courseId, pageCursor);
        if (!reconciled) throw new Error('收藏结果尚未同步，请稍后重试。');
      } else {
        course.isFavorite = result.favorited;
        updateFavoriteButton(courseId, course);
      }
      toast(course.isFavorite ? '已收藏这门课程' : '已取消收藏');
    } catch (error) {
      try {
        await reconcileFavorite(courseId, pageCursor);
      } catch {
        // The control was never changed optimistically; retain its last server state.
      }
      const message = error?.status === 0 || error?.name === 'TypeError'
        ? '网络连接失败，收藏状态未更改，请检查网络后重试。'
        : error?.message || '收藏操作失败，请稍后重试。';
      toast(message);
    } finally {
      state.pendingFavorites.delete(courseId);
      const activeButton = document.querySelector(`[data-favorite="${CSS.escape(courseId)}"]`);
      if (activeButton) {
        activeButton.disabled = false;
        activeButton.removeAttribute('aria-busy');
      }
    }
  }

  function bindEvents() {
    $('#searchForm').addEventListener('submit', (event) => {
      event.preventDefault();
      setFilter('search', $('#searchInput').value.trim());
    });

    for (const [elementId, key] of [
      ['gradeFilter', 'gradeBand'],
      ['categoryFilter', 'capabilityTheme'],
      ['difficultyFilter', 'difficulty'],
    ]) {
      $(`#${elementId}`).addEventListener('change', (event) => setFilter(key, event.target.value));
    }

    for (const [elementId, key] of [
      ['taskGroupFilter', 'taskGroup'],
      ['culturalFilter', 'culturalElement'],
    ]) {
      const input = $(`#${elementId}`);
      input.addEventListener('input', (event) => {
        clearTimeout(textTimers.get(key));
        const value = event.target.value.trim();
        textTimers.set(key, setTimeout(() => setFilter(key, value), 320));
      });
      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        clearTimeout(textTimers.get(key));
        setFilter(key, input.value.trim());
      });
    }

    $('#searchInput').addEventListener('input', (event) => {
      clearTimeout(textTimers.get('search'));
      const value = event.target.value.trim();
      textTimers.set('search', setTimeout(() => setFilter('search', value), 320));
    });

    $('#sortSelect').addEventListener('change', (event) => setFilter('sortBy', event.target.value));
    $('#clearAllFilters').addEventListener('click', resetFilters);
    $('#clearEmptyFilters').addEventListener('click', resetFilters);
    $('#loadMoreBtn').addEventListener('click', () => loadCatalog({ append: true }));
    $('#networkRetry').addEventListener('click', () => loadCatalog());

    document.addEventListener('click', (event) => {
      const favorite = event.target.closest('[data-favorite]');
      if (favorite) {
        event.preventDefault();
        toggleFavorite(favorite);
        return;
      }
      const removeFilter = event.target.closest('[data-remove-filter]');
      if (removeFilter) {
        const key = removeFilter.dataset.removeFilter;
        clearTimeout(textTimers.get(key));
        textTimers.delete(key);
        if (key === 'search') $('#searchInput').value = '';
        if (key === 'taskGroup') $('#taskGroupFilter').value = '';
        if (key === 'culturalElement') $('#culturalFilter').value = '';
        setFilter(key, '');
        return;
      }
      if (event.target.closest('[data-retry]')) loadCatalog();
    });

    $$('.cc-view-button').forEach((button) => {
      button.addEventListener('click', () => {
        state.filters.view = button.dataset.view;
        renderGrid();
      });
    });

    window.addEventListener('offline', () => {
      const message = '当前需要联网加载课程。网络恢复后可以重试。';
      if (state.hasLoaded) showNetworkNotice(message);
    });
    window.addEventListener('online', () => {
      if (state.hasLoaded && !$('#networkNotice').hidden) {
        showNetworkNotice('网络已恢复，可以重试加载课程。');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof YuzanApi === 'undefined') {
      showInitialError('系统暂时不可用', '课程服务没有准备好，请刷新页面重试。');
      return;
    }
    updateFilterOptions({});
    bindEvents();
    loadCatalog();
  });
})();
