(() => {
  'use strict';
  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  // Buttons keep using the existing catalog's server-side tab/facet handlers.
  function lanes({ items = [], tab = 'RECOMMENDED' } = {}) {
    const available = Array.isArray(items) ? items : [];
    const speaking = available.find(p => p?.id && p?.title && p.requiresRecording === true);
    return [
      {
        type: 'oral', code: 'SPEAK', title: '录音跟读与口语',
        text: speaking ? `已开放：${speaking.title}` : '按真实录音要求筛选已开放的练习。',
        href: speaking ? `/student/practices/${encodeURIComponent(speaking.id)}/` : '',
        label: speaking ? '进入这项口语练习' : '筛选需要录音的练习',
        filter: speaking ? null : { key: 'requiresRecording', value: 'true' },
      },
      {
        type: 'mock', code: 'EXAM MODE', title: '机考式模拟练习',
        text: '按题型作答、提交与查看处理结果；不是官方考试。',
        tab: 'MOCK', selected: tab === 'MOCK', label: '查看真实模拟练习',
      },
      {
        type: 'focus', code: 'PRACTICE', title: '专项巩固训练',
        text: '查看学校当前开放的专项训练，不生成虚构的推荐。',
        tab: 'SPECIALIZED', selected: tab === 'SPECIALIZED', label: '查看专项训练',
      },
    ];
  }

  function render(data) {
    return `<section class="practice-journey" aria-labelledby="practice-journey-title">
      <div class="practice-journey-heading"><div><p class="eyebrow">真实练习 · 真实作答</p>
        <h2 id="practice-journey-title">从开口训练到机考式测评</h2></div>
        <a href="/student/practices/history/">我的学习记录与正式报告 →</a></div>
      <div class="practice-journey-grid">${lanes(data).map(lane => `<article class="practice-journey-lane practice-journey-${lane.type}">
        <span class="practice-journey-code">${lane.code}</span>
        <span class="practice-journey-signal" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
        <h3>${lane.title}</h3><p>${safe(lane.text)}</p>
        ${lane.href
          ? `<a href="${safe(lane.href)}">${lane.label} <span aria-hidden="true">↗</span></a>`
          : lane.filter
            ? `<button type="button" data-journey-oral>${lane.label} <span aria-hidden="true">↗</span></button>`
            : `<button type="button" data-tab="${lane.tab}" aria-pressed="${Boolean(lane.selected)}">${lane.label} <span aria-hidden="true">↗</span></button>`}
      </article>`).join('')}</div>
    </section>`;
  }
  window.YuzanPracticeJourney = Object.freeze({ lanes, render });
})();
