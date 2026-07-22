(() => {
  'use strict';
  const KEY = 'yuzan-demo-state-v4';
  const defaults = {
    network: navigator.onLine ? 'online' : 'offline',
    student: { courseProgress: 42, completedSteps: [1], currentStep: 2 },
    assessment: { readingStatus: 'not_started', writtenAnswers: {}, currentQuestion: 3 },
    teacher: { selectedStudent: 0, reviewsPending: 12, draftSavedAt: null },
    user: { role: 'student', school: '青海省海南州示范学校（演示）' }
  };

  const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
  const deepMerge = (target, source) => {
    if (!isObject(source)) return target;
    Object.entries(source).forEach(([key, value]) => {
      if (isObject(value)) target[key] = deepMerge(isObject(target[key]) ? target[key] : {}, value);
      else target[key] = value;
    });
    return target;
  };
  const parseStored = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  const state = deepMerge(structuredClone(defaults), parseStored());
  if (isObject(window.__YUZAN_BOOTSTRAP__)) deepMerge(state, window.__YUZAN_BOOTSTRAP__);

  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  const get = path => path ? path.split('.').reduce((value, key) => value?.[key], state) : state;
  const emit = (path, value, source = 'ui') => window.dispatchEvent(new CustomEvent('yuzan:state', { detail: { path, value, source, state } }));
  const set = (path, value, source = 'ui') => {
    const keys = path.split('.'); let cursor = state;
    keys.slice(0, -1).forEach(key => cursor = cursor[key] ||= {});
    cursor[keys.at(-1)] = value; save(); emit(path, value, source); refreshBindings(); return value;
  };
  const hydrate = (payload, source = 'backend') => {
    if (!isObject(payload)) return state;
    deepMerge(state, payload); save(); emit('*', payload, source); refreshBindings(); return state;
  };

  function parseValue(raw) {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw === 'null') return null;
    if (raw !== '' && Number.isFinite(Number(raw))) return Number(raw);
    try { if (/^[\[{]/.test(raw)) return JSON.parse(raw); } catch {}
    return raw;
  }

  function toast(message, tone = 'default') {
    let el = document.querySelector('.global-toast');
    if (!el) {
      el = document.createElement('div'); el.className = 'global-toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el);
    }
    el.dataset.tone = tone; el.textContent = message; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function bindPressFeedback() {
    document.addEventListener('pointerdown', event => event.target.closest('button,a,[role="button"]')?.classList.add('is-pressing'));
    const clear = () => document.querySelectorAll('.is-pressing').forEach(el => el.classList.remove('is-pressing'));
    document.addEventListener('pointerup', clear); document.addEventListener('pointercancel', clear);
  }

  function reflectNetwork() {
    state.network = navigator.onLine ? 'online' : 'offline'; save();
    document.documentElement.dataset.network = state.network;
    document.querySelectorAll('[data-network-label]').forEach(el => el.textContent = navigator.onLine ? '在线 · 自动同步' : '离线 · 已保存本机');
  }

  function refreshBindings() {
    document.querySelectorAll('[data-bind-text]').forEach(el => {
      const value = get(el.dataset.bindText); if (value !== undefined) el.textContent = value;
    });
    document.querySelectorAll('[data-bind-value]').forEach(el => {
      const value = get(el.dataset.bindValue); if (value !== undefined && 'value' in el) el.value = value;
    });
    document.querySelectorAll('[data-visible-when]').forEach(el => {
      const [path, expected] = el.dataset.visibleWhen.split('='); el.hidden = String(get(path)) !== expected;
    });
    document.querySelectorAll('[data-class-when]').forEach(el => {
      const [expression, className] = el.dataset.classWhen.split(':'); const [path, expected] = expression.split('=');
      if (className) el.classList.toggle(className, String(get(path)) === expected);
    });
  }

  async function loadBackendState(endpoint, options = {}) {
    if (!endpoint) return null;
    try {
      const response = await fetch(endpoint, { credentials: 'include', headers: { Accept: 'application/json' }, ...options });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json(); hydrate(payload.state || payload, 'backend');
      document.documentElement.dataset.backendState = 'ready'; return payload;
    } catch (error) {
      document.documentElement.dataset.backendState = 'fallback';
      window.dispatchEvent(new CustomEvent('yuzan:backend-error', { detail: { endpoint, error } }));
      return null;
    }
  }

  function bindBackendState() {
    const params = new URLSearchParams(location.search);
    for (const [key, raw] of params) if (key.startsWith('state.')) set(key.slice(6), parseValue(raw), 'query');
    refreshBindings();
    const endpoint = document.querySelector('meta[name="yuzan-state-endpoint"]')?.content || document.documentElement.dataset.stateEndpoint;
    if (endpoint) loadBackendState(endpoint);
  }

  window.YuzanDemo = {
    state, get, set, save, hydrate, loadBackendState, toast,
    subscribe(handler) { addEventListener('yuzan:state', handler); return () => removeEventListener('yuzan:state', handler); },
    reset: () => { localStorage.removeItem(KEY); location.reload(); }
  };
  addEventListener('online', () => { reflectNetwork(); toast('网络已恢复，正在同步本地记录', 'success'); });
  addEventListener('offline', () => { reflectNetwork(); toast('网络不可用，操作将安全保存在本机', 'warning'); });
  function bindDataNav() {
    document.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (!nav) return;
      const href = nav.getAttribute('data-nav');
      if (href) {
        e.preventDefault();
        location.href = href;
      }
    });
  }

  addEventListener('DOMContentLoaded', () => { reflectNetwork(); bindPressFeedback(); bindBackendState(); bindDataNav(); });
})();
