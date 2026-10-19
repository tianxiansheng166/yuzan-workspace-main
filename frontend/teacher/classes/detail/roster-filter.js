(() => {
  'use strict';

  const RISK_FILTERS = new Set(['', 'OK', 'AT_RISK', 'INACTIVE', 'UNKNOWN']);
  const SCORE_FILTERS = new Set(['', 'SCORED', 'NO_SCORE']);
  const SORTS = new Set(['name', 'activity', 'progress']);
  const KNOWN_RISKS = new Set(['OK', 'AT_RISK', 'INACTIVE']);
  const PARAMS = Object.freeze({ search: 'rosterSearch', risk: 'rosterRisk', score: 'rosterScore', sort: 'rosterSort' });
  const DEFAULT_STATE = Object.freeze({ search: '', risk: '', score: '', sort: 'name' });
  const MAX_SEARCH_LENGTH = 80;

  function text(value) {
    return Array.from(String(value ?? '').normalize('NFKC').trim()).slice(0, MAX_SEARCH_LENGTH).join('');
  }

  function sanitizeState(value = {}) {
    const risk = String(value.risk ?? '');
    const score = String(value.score ?? '');
    const sort = String(value.sort ?? '');
    return {
      search: text(value.search),
      risk: RISK_FILTERS.has(risk) ? risk : '',
      score: SCORE_FILTERS.has(score) ? score : '',
      sort: SORTS.has(sort) ? sort : DEFAULT_STATE.sort,
    };
  }

  function stateFromParams(params) {
    return sanitizeState({
      search: params.get(PARAMS.search),
      risk: params.get(PARAMS.risk),
      score: params.get(PARAMS.score),
      sort: params.get(PARAMS.sort),
    });
  }

  function hasLegalStateParam(params) {
    return (params.has(PARAMS.search) && text(params.get(PARAMS.search)) !== '')
      || (params.has(PARAMS.risk) && RISK_FILTERS.has(String(params.get(PARAMS.risk))))
      || (params.has(PARAMS.score) && SCORE_FILTERS.has(String(params.get(PARAMS.score))))
      || (params.has(PARAMS.sort) && SORTS.has(String(params.get(PARAMS.sort))));
  }

  function writeParams(params, value) {
    const state = sanitizeState(value);
    Object.values(PARAMS).forEach((key) => params.delete(key));
    if (state.search) params.set(PARAMS.search, state.search);
    if (state.risk) params.set(PARAMS.risk, state.risk);
    if (state.score) params.set(PARAMS.score, state.score);
    if (state.sort !== DEFAULT_STATE.sort) params.set(PARAMS.sort, state.sort);
    return params;
  }

  function normalizeSearch(value) {
    return text(value).toLocaleLowerCase('zh-CN');
  }

  function riskGroup(value) {
    return KNOWN_RISKS.has(value) ? value : 'UNKNOWN';
  }

  function hasFormalScore(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function timestamp(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function compareName(left, right) {
    const nameOrder = String(left?.displayName ?? '').localeCompare(
      String(right?.displayName ?? ''),
      'zh-CN',
      { sensitivity: 'base', numeric: true },
    );
    return nameOrder || String(left?.enrollmentId ?? '').localeCompare(String(right?.enrollmentId ?? ''));
  }

  function sortRoster(rows, sort) {
    return [...rows].sort((left, right) => {
      if (sort === 'activity') {
        const leftTime = timestamp(left?.lastActiveAt);
        const rightTime = timestamp(right?.lastActiveAt);
        if (leftTime !== rightTime) {
          if (leftTime == null) return 1;
          if (rightTime == null) return -1;
          return rightTime - leftTime;
        }
      } else if (sort === 'progress') {
        const leftProgress = Number.isFinite(left?.courseProgress) ? left.courseProgress : null;
        const rightProgress = Number.isFinite(right?.courseProgress) ? right.courseProgress : null;
        if (leftProgress !== rightProgress) {
          if (leftProgress == null) return 1;
          if (rightProgress == null) return -1;
          return rightProgress - leftProgress;
        }
      }
      return compareName(left, right);
    });
  }

  function filterAndSort(rows, value) {
    const state = sanitizeState(value);
    const needle = normalizeSearch(state.search);
    const filtered = rows.filter((student) => {
      const name = normalizeSearch(student?.displayName);
      const nameMatches = !needle || name.includes(needle);
      const riskMatches = !state.risk || riskGroup(student?.riskStatus) === state.risk;
      const scoreExists = hasFormalScore(student?.latestAssessmentScore);
      const scoreMatches = !state.score || (state.score === 'SCORED' ? scoreExists : !scoreExists);
      return nameMatches && riskMatches && scoreMatches;
    });
    return sortRoster(filtered, state.sort);
  }

  window.YuzanRosterFilter = Object.freeze({
    DEFAULT_STATE,
    PARAMS,
    hasFormalScore,
    hasLegalStateParam,
    riskGroup,
    sanitizeState,
    stateFromParams,
    filterAndSort,
    writeParams,
  });
})();
