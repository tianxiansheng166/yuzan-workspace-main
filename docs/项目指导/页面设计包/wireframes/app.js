(() => {
  const fixturePath = '../../design-fixtures/古诗文朗读与理解训练-v1.json';
  const app = document.querySelector('#app');
  const pageSelect = document.querySelector('#page-select');
  const stateSelect = document.querySelector('#state-select');
  const typeSelect = document.querySelector('#type-select');
  const typeControl = document.querySelector('#type-control');
  const modeSelect = document.querySelector('#mode-select');
  const mobilePolicySelect = document.querySelector('#mobile-policy-select');
  const mobilePolicyControl = document.querySelector('#mobile-policy-control');
  const reloadButton = document.querySelector('#reload-fixture');
  let fixture = null;

  function parseRoute() {
    const raw = location.hash.slice(1) || '/S01?state=normal';
    const [path, query = ''] = raw.split('?');
    const id = path.replace(/^\/+/, '').toUpperCase();
    const page = window.WF_PAGES.pageMeta.find((item) => item.id === id) || window.WF_PAGES.pageMeta[0];
    const params = new URLSearchParams(query);
    const states = page.id === 'S04' ? [...window.WF_STATES.common, ...window.WF_STATES.executor] : window.WF_STATES.common;
    const state = states.includes(params.get('state')) ? params.get('state') : 'normal';
    const type = window.WF_PAGES.types.includes(params.get('type')) ? params.get('type') : 'READ_ALOUD';
    const mode = window.WF_PAGES.deliveryModes.includes(params.get('mode')) ? params.get('mode') : 'ASSIGNMENT';
    const mobilePolicy = window.WF_PAGES.mobilePolicies.includes(params.get('mobilePolicy')) ? params.get('mobilePolicy') : 'UNSPECIFIED';
    return { page, state, type, mode, mobilePolicy, states };
  }

  function updateHash(overrides) {
    const route = parseRoute();
    const next = {
      page: route.page.id,
      state: route.state,
      type: route.type,
      mode: route.mode,
      mobilePolicy: route.mobilePolicy,
      ...overrides
    };
    const typeQuery = next.page === 'S04' ? `&type=${encodeURIComponent(next.type)}` : '';
    location.hash = `/${next.page}?state=${encodeURIComponent(next.state)}${typeQuery}&mode=${encodeURIComponent(next.mode)}&mobilePolicy=${encodeURIComponent(next.mobilePolicy)}`;
  }

  function setOptions(select, entries, current) {
    select.innerHTML = entries.map(([value, label]) => `<option value="${value}" ${value === current ? 'selected' : ''}>${label}</option>`).join('');
  }

  function render() {
    if (!fixture) return;
    const route = parseRoute();
    setOptions(pageSelect, window.WF_PAGES.pageMeta.map((p) => [p.id, `${p.id} ${p.name}`]), route.page.id);
    setOptions(stateSelect, route.states.map((s) => [s, window.WF_STATES.labels[s]]), route.state);
    setOptions(typeSelect, window.WF_PAGES.types.map((t) => [t, `${t} · ${window.WF_PAGES.typeLabels[t]}`]), route.type);
    setOptions(modeSelect, window.WF_PAGES.deliveryModes.map((mode) => [mode, `${mode} · ${window.WF_PAGES.deliveryModeLabels[mode]}`]), route.mode);
    setOptions(mobilePolicySelect, window.WF_PAGES.mobilePolicies.map((policy) => [policy, window.WF_PAGES.mobilePolicyLabels[policy]]), route.mobilePolicy);
    typeControl.hidden = route.page.id !== 'S04';
    mobilePolicyControl.hidden = !['COURSE_PRACTICE', 'ASSIGNMENT'].includes(route.mode);
    document.querySelector('#student-context').innerHTML = `<strong>${fixture.student.name}</strong><span>${fixture.class.name}</span>`;
    app.innerHTML = window.WF_PAGES.render(route.page, fixture, route.state, route.type, route.mode, route.mobilePolicy);
    document.title = `${route.page.id} ${route.page.name} · 低保真线框`;
    document.querySelector('#wireframe-main').focus({ preventScroll: true });
  }

  async function loadFixture() {
    app.innerHTML = '<section class="fixture-loading" role="status">正在读取统一设计 Fixture…</section>';
    try {
      const response = await fetch(fixturePath, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      fixture = await response.json();
      render();
    } catch (error) {
      fixture = null;
      app.innerHTML = `<section class="fixture-error" role="alert"><h1>设计Fixture加载失败</h1><p>${String(error.message || error)}</p><button id="fixture-retry" class="button primary" type="button">重新加载</button></section>`;
      document.querySelector('#fixture-retry').addEventListener('click', loadFixture);
    }
  }

  pageSelect.addEventListener('change', () => updateHash({ page: pageSelect.value, state: 'normal' }));
  stateSelect.addEventListener('change', () => updateHash({ state: stateSelect.value }));
  typeSelect.addEventListener('change', () => updateHash({ type: typeSelect.value }));
  modeSelect.addEventListener('change', () => {
    const mode = modeSelect.value;
    const mobilePolicy = mode === 'COURSE_PRACTICE' ? 'ALLOW' : 'UNSPECIFIED';
    updateHash({ mode, mobilePolicy });
  });
  mobilePolicySelect.addEventListener('change', () => updateHash({ mobilePolicy: mobilePolicySelect.value }));
  reloadButton.addEventListener('click', loadFixture);
  addEventListener('hashchange', render);
  loadFixture();
})();
