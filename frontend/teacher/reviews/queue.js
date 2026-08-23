(() => {
  'use strict';
  const root = document.querySelector('#review-root');
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const familyLabel = (strategy) => ({RUBRIC_TEXT:'文字量表',SPEECH_READING:'朗读诊断',SPEECH_OPEN_RESPONSE:'图片表达'}[strategy] || strategy || '待复核');
  const familyClass = (strategy) => strategy === 'SPEECH_OPEN_RESPONSE' ? 'open' : strategy === 'RUBRIC_TEXT' ? 'rubric' : '';
  const render = (payload) => {
    const items = Array.isArray(payload) ? payload : (payload?.items || []);
    const openCount = items.filter((item) => item.strategy === 'SPEECH_OPEN_RESPONSE').length;
    const readingCount = items.filter((item) => item.strategy === 'SPEECH_READING').length;
    root.innerHTML = `<div class="review-header"><div><span class="review-kicker">QUESTION BANK · LEVEL 1</span><h1>题库人工复核</h1><p>只处理文字量表、朗读诊断与图片表达；正式分数由教师提交。</p></div><button class="review-refresh" data-refresh>刷新队列</button></div><div class="review-stats"><div class="review-stat accent"><strong>${items.length}</strong><span>当前待复核题目</span></div><div class="review-stat"><strong>${readingCount}</strong><span>朗读诊断</span></div><div class="review-stat green"><strong>${openCount}</strong><span>图片表达</span></div></div><section class="review-card"><div class="review-card-head"><h2>待复核队列</h2><span>同校且任课班级范围内</span></div><div class="review-list">${items.length ? items.map((item) => `<a class="review-row" href="/teacher/reviews/${encodeURIComponent(item.itemId)}"><div><strong>${esc(item.student?.displayName || '学生')}</strong><small>${esc(item.practice?.title || 'Level 1 综合诊断')} · 第 ${Number(item.sortOrder ?? 0) + 1} 题</small></div><div><span class="review-family ${familyClass(item.strategy)}">${esc(familyLabel(item.strategy))}</span><small>${esc(item.domain || '未分域')}</small></div><div class="review-score">${esc(item.maxScore ?? '—')} 分</div><div><span class="review-status">待复核</span></div><div><span class="review-back">查看证据 →</span></div></a>`).join('') : '<div class="review-empty">暂无待复核题目。学生提交后，朗读与图片表达会在这里进入教师队列。</div>'}</div></section>`;
    root.querySelector('[data-refresh]')?.addEventListener('click', load);
  };
  async function load() {
    if (!window.YuzanApi?.requireAuth?.()) return;
    root.innerHTML = '<div class="review-error">正在加载复核队列…</div>';
    try { render(await YuzanApi.getAssessmentReviewQueue()); }
    catch (error) { root.innerHTML = `<div class="review-error">加载失败：${esc(error.message || '请稍后重试')}<br><button class="review-refresh" data-refresh>重试</button></div>`; root.querySelector('[data-refresh]')?.addEventListener('click', load); }
  }
  load();
})();
