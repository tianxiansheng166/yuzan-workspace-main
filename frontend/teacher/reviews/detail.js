(() => {
  'use strict';
  const root = document.querySelector('#review-detail-root');
  const itemId = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const findResourceId = (value) => {
    if (!value || typeof value !== 'object') return '';
    if (Array.isArray(value)) {
      for (const entry of value) {
        const found = findResourceId(entry);
        if (found) return found;
      }
      return '';
    }
    if (typeof value.resourceId === 'string') return value.resourceId;
    for (const nested of Object.values(value)) {
      const found = findResourceId(nested);
      if (found) return found;
    }
    return '';
  };
  const label = (strategy) => ({RUBRIC_TEXT:'文字量表',SPEECH_READING:'朗读诊断',SPEECH_OPEN_RESPONSE:'图片表达'}[strategy] || strategy);
  const providerLabel = (provider) => ({iflytek:'科大讯飞 ISE',tencent:'腾讯云 SOE',local:'本地语音'}[provider] || provider || '语音 provider');
  const metricValue = (value) => typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)} / 100` : '本次未提供';
  const formatDiagnostic = (diagnostic, strategy, maxScore) => {
    if (strategy === 'SPEECH_OPEN_RESPONSE' && !diagnostic) {
      return '<div class="diagnostic-unavailable">自动语义分析未启用 · 请依据原始录音人工复核</div>';
    }
    if (strategy === 'SPEECH_READING') {
      const metrics = diagnostic?.metrics || {};
      const dimensions = [['accuracy','准确度'],['completeness','完整度'],['fluency','流利度'],['tone','声调']];
      const state = diagnostic?.state || 'NEEDS_REVIEW';
      const calibration = diagnostic?.calibrationStatus === 'CALIBRATED' ? '已校准' : '未校准';
      const candidate = typeof diagnostic?.candidatePoints === 'number' && Number.isFinite(diagnostic.candidatePoints)
        ? `${diagnostic.candidatePoints} / ${diagnostic.maxScore ?? maxScore ?? '—'}`
        : '本次未提供';
      return `<div class="diagnostic-context"><span class="diagnostic-source">${esc(providerLabel(diagnostic?.provider))}</span><span class="diagnostic-badge">${esc(state)}</span><span>${calibration}</span><span>自动诊断证据</span></div><div class="diagnostic-grid diagnostic-grid-reading">${dimensions.map(([key,name]) => `<div class="diagnostic-cell"><span>${name}</span><strong>${metricValue(metrics[key])}</strong></div>`).join('')}</div><div class="diagnostic-reference"><span>自动参考值</span><strong>${esc(candidate)}</strong><small>仅供教师参考，不会自动填入正式得分。</small></div>${diagnostic?.reasonCodes?.length ? `<p class="detail-json">诊断状态：${esc(diagnostic.reasonCodes.join(' · '))}</p>` : ''}`;
    }
    const metrics = diagnostic?.diagnostics || diagnostic?.metrics || {};
    const cells = [['时长', metrics.durationMs != null ? `${Math.round(metrics.durationMs)} ms` : '—'],['语音时长', metrics.speechDurationMs != null ? `${Math.round(metrics.speechDurationMs)} ms` : '—'],['语速', metrics.speechRate != null ? `${Number(metrics.speechRate).toFixed(1)} 字/秒` : '—'],['静音比例', metrics.silenceRatio != null ? `${Math.round(metrics.silenceRatio * 100)}%` : '—'],['流畅度', metrics.fluency != null ? `${Number(metrics.fluency).toFixed(1)}` : '—'],['置信度', diagnostic?.confidence != null ? `${Math.round(diagnostic.confidence * 100)}%` : '—']];
    return `<div class="diagnostic-grid">${cells.map(([name,value]) => `<div class="diagnostic-cell"><span>${name}</span><strong>${esc(value)}</strong></div>`).join('')}</div>${diagnostic?.reasonCodes?.length ? `<p class="detail-json">诊断状态：${esc(diagnostic.reasonCodes.join(' · '))}</p>` : ''}`;
  };
  async function load() {
    if (!window.YuzanApi?.requireAuth?.()) return;
    try {
      const detail = await YuzanApi.getAssessmentReviewDetail(itemId);
      render(detail);
      const resourceId = findResourceId(detail.item?.deliverySpec);
      if (resourceId) {
        try {
          const media = await YuzanApi.getResourcePlaybackUrl(resourceId);
          const image = root.querySelector('[data-picture]');
          if (image) {
            image.src = media.url;
            image.hidden = false;
            root.querySelector('[data-picture-loading]')?.remove();
          }
        } catch {}
      }
    } catch (error) {
      root.innerHTML = `<div class="review-error">加载失败：${esc(error.message || '请稍后重试')}<br><a class="review-back" href="/teacher/reviews/">返回复核队列</a></div>`;
    }
  }
  function render(detail) {
    const item = detail.item || {};
    const strategy = item.strategy || '';
    const evidence = detail.evidence || {};
    const review = detail.review || {};
    const isReading = strategy === 'SPEECH_READING';
    const isPicture = strategy === 'SPEECH_OPEN_RESPONSE';
    const answer = item.answer && typeof item.answer === 'object' ? (item.answer.value ?? item.answer.text ?? JSON.stringify(item.answer)) : item.answer;
    const hasOpenResponseDiagnostic = isPicture && evidence.diagnostic && typeof evidence.diagnostic === 'object';
    const diagnosticTitle = isReading ? `${providerLabel(evidence.diagnostic?.provider)} · 自动诊断证据` : hasOpenResponseDiagnostic ? '本地语音诊断（仅证据，不自动给语义分）' : '自动语义分析状态';
    const diagnosticNote = isReading ? '未校准结果只作为复核线索；正式得分必须由教师独立输入。' : hasOpenResponseDiagnostic ? '' : '自动语义分析未启用 · 请依据原始录音人工复核。';
    root.innerHTML = `<div class="detail-wrap"><div class="detail-top"><div><a class="review-back" href="/teacher/reviews/">← 返回复核队列</a><h1>${esc(detail.student?.displayName || '学生')} · ${esc(label(strategy))}</h1><p>${esc(detail.practice?.title || 'Level 1 综合诊断')} · ${esc(item.domain || '未分域')} · 仅教师可见</p></div></div><div class="detail-layout"><div class="detail-main"><section class="detail-card"><div class="detail-meta"><span class="detail-pill emphasis">${esc(label(strategy))}</span><span class="detail-pill">满分 ${esc(item.maxScore ?? '—')} 分</span><span class="detail-pill">${esc(evidence.speechJobStatus || item.state || '待复核')}</span></div><div class="detail-evidence-strip"><strong>${isReading ? '同一条原始录音' : '作答证据'}</strong><span>${isReading ? `${providerLabel(evidence.diagnostic?.provider)} · 自动诊断证据 · 待教师复核` : '录音与作答内容，仅供教师复核'}</span></div><h2>${isPicture ? '图片与表达证据' : '题目与作答证据'}</h2><figure class="detail-stimulus">${isPicture ? '<div data-picture-loading>图片加载中…</div><img data-picture alt="题目图片" hidden>' : `<div>${esc(item.targetText || item.prompt?.text || item.prompt?.promptText || '朗读题目')}</div>`}<figcaption>${isPicture ? esc(item.prompt?.promptText || '仔细观察图片，说一说画面里有什么。') : '服务端题目快照，仅用于教师复核'}</figcaption></figure>${item.targetText ? `<div class="detail-answer"><b>朗读目标</b>${esc(item.targetText)}</div>` : ''}${answer ? `<div class="detail-answer"><b>学生文字作答</b>${esc(answer)}</div>` : ''}<div class="detail-audio"><p>同一条原始录音${evidence.durationMs != null ? ` · ${Math.round(evidence.durationMs / 1000)} 秒` : ''}${evidence.mimeType ? ` · ${esc(evidence.mimeType)}` : ''}</p>${evidence.playbackUrl ? `<audio controls src="${esc(evidence.playbackUrl)}"></audio>` : '<p>音频播放地址暂未生成</p>'}</div><section class="detail-diagnostic"><div class="diagnostic-heading"><h2>${diagnosticTitle}</h2>${diagnosticNote ? `<p>${diagnosticNote}</p>` : ''}</div>${formatDiagnostic(evidence.diagnostic, strategy, item.maxScore)}${evidence.transcript ? `<div class="transcript"><b>教师可见转写</b><br>${esc(evidence.transcript)}</div>` : '<div class="transcript">暂无转写证据</div>'}</section></section><section class="detail-card"><h2>教师参考量表</h2><div class="review-rubric"><div class="rubric-block"><h3>评分标准</h3>${Array.isArray(review.rubric) ? `<ul>${review.rubric.map((entry) => `<li>${esc(entry)}</li>`).join('')}</ul>` : '<p>该题没有可展示的量表条目。</p>'}</div>${review.referenceAnswer ? `<div class="rubric-block"><h3>参考答案</h3><p>${esc(review.referenceAnswer)}</p></div>` : ''}${review.deductionRules?.length ? `<div class="rubric-block"><h3>扣分规则</h3><ul>${review.deductionRules.map((entry) => `<li>${esc(entry)}</li>`).join('')}</ul></div>` : ''}</div></section></div><aside class="detail-card review-form"><h2>提交正式评分</h2><label for="review-score">得分</label><input id="review-score" class="score-input" data-review-score type="number" min="0" max="${esc(item.maxScore ?? 0)}" step="0.1" value="${esc(item.scoredScore ?? '')}" placeholder="0">${isReading ? '<p class="form-note">自动参考值不会预填正式得分；请结合录音和量表独立输入。</p>' : ''}<div class="score-range">分数范围：0–${esc(item.maxScore ?? 0)} 分</div><label for="review-comment" style="margin-top:22px">教师意见（可选）</label><textarea id="review-comment" class="comment-input" data-review-comment placeholder="记录本次复核依据…">${esc(item.reviewerComment || '')}</textarea><button class="submit-review" data-review-submit>提交复核</button><div class="review-message" data-review-message></div></aside></div></div>`;
    root.querySelector('[data-review-submit]')?.addEventListener('click', submit);
  }
  async function submit() {
    const score = Number(root.querySelector('[data-review-score]')?.value);
    const comment = root.querySelector('[data-review-comment]')?.value || '';
    const message = root.querySelector('[data-review-message]');
    const button = root.querySelector('[data-review-submit]');
    if (!Number.isFinite(score)) {
      message.textContent = '请输入有效分数。';
      return;
    }
    button.disabled = true;
    message.textContent = '正在保存…';
    try {
      const result = await YuzanApi.submitAssessmentReview(itemId, { score, ...(comment.trim() ? { comment: comment.trim() } : {}) });
      message.className = 'review-message review-success';
      message.textContent = result?.report || result?.data?.report ? '已保存，最后一道复核完成，Level 1 报告已生成。' : '已保存，返回队列继续复核。';
      setTimeout(() => { location.href = '/teacher/reviews/'; }, 900);
    } catch (error) {
      button.disabled = false;
      message.textContent = error.message || '保存失败，请刷新后重试。';
    }
  }
  load();
})();
