(() => {
  'use strict';

  // A filter affordance, not an extra promotional "feature landing page".
  // MOCK and SPECIALIZED already have real tabs in the catalog; don't repeat them.
  function render({ filters = {}, tab = 'RECOMMENDED' } = {}) {
    const active = tab === 'ALL' && filters.requiresRecording === 'true';
    return `<div class="catalog-oral-toolbar" role="group" aria-label="按练习方式筛选">
      <span class="catalog-oral-caption">练习方式</span>
      <button type="button" class="catalog-oral-filter${active ? ' is-active' : ''}"
        data-journey-oral aria-pressed="${active}">
        <span class="catalog-oral-indicator" aria-hidden="true">◉</span>
        ${active ? '正在筛选录音练习' : '查找口语录音练习'}
      </button>
      <span class="catalog-oral-help">按当前学校已开放的真实录音要求筛选</span>
    </div>`;
  }

  window.YuzanPracticeJourney = Object.freeze({ render });
})();
