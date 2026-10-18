(() => {
  'use strict';

  const root = document.querySelector('#review-detail-root');
  const itemId = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
  const returnFilters = readQuery(location.search || '');
  const returnParams = new Map();
  for (const key of ['student', 'strategy', 'domain']) {
    const value = returnFilters.get(key);
    if (value) returnParams.set(key, value);
  }
  const returnQuery = () => [...returnParams].map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
  const returnHref = `/teacher/reviews/${returnParams.size ? `?${returnQuery()}` : ''}`;
  let detail = null;
  let submitting = false;
  let nextItemLoading = false;
  let imageLoading = false;
  let audioLoading = false;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
  const label = (strategy) => ({
    RUBRIC_TEXT: '文字量表',
    SPEECH_READING: '朗读诊断',
    SPEECH_OPEN_RESPONSE: '图片表达',
  }[strategy] || strategy || '题型未提供');
  const providerLabel = (provider) => ({ iflytek: '科大讯飞 ISE', tencent: '腾讯云 SOE', local: '本地语音' }[provider] || provider || '语音 provider');
  const metricValue = (value) => typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)} / 100` : '本次未提供';

  function readQuery(search) {
    const values = new Map();
    for (const entry of String(search || '').replace(/^\?/, '').split('&')) {
      if (!entry) continue;
      const [rawKey, ...rawValue] = entry.split('=');
      try {
        values.set(decodeURIComponent(rawKey.replace(/\+/g, ' ')), decodeURIComponent(rawValue.join('=').replace(/\+/g, ' ')));
      } catch {
        // Malformed optional return filters do not affect the safe queue route.
      }
    }
    return values;
  }

  function validateScore(rawValue, maxScore) {
    const raw = String(rawValue ?? '');
    const trimmed = raw.trim();
    if (!trimmed) return { error: '请先输入得分。若要提交 0 分，请主动输入 0。' };
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return { error: '请输入有效数字。' };

    // Parse only after checking the original field so Number('') can never become a formal zero.
    const score = Number(trimmed);
    if (!Number.isFinite(score)) return { error: '请输入有效数字。' };
    if (score < 0 || trimmed.startsWith('-')) return { error: '得分不能低于 0 分。' };
    if (typeof maxScore !== 'number' || !Number.isFinite(maxScore) || maxScore <= 0) {
      return { error: '题目满分信息无效，暂时不能提交评分。' };
    }
    if (score > maxScore) return { error: `得分不能超过本题满分 ${maxScore} 分。` };
    const precision = trimmed.split('.')[1]?.replace(/0+$/, '') || '';
    if (precision.length > 1) return { error: '得分最多保留一位小数。' };
    return { score };
  }

  function findResourceId(value) {
    if (!value || typeof value !== 'object') return '';
    if (Array.isArray(value)) {
      for (const entry of value) {
        const found = findResourceId(entry);
        if (found) return found;
      }
      return '';
    }
    if (typeof value.resourceId === 'string' && value.resourceId) return value.resourceId;
    for (const nested of Object.values(value)) {
      const found = findResourceId(nested);
      if (found) return found;
    }
    return '';
  }

  function formatDiagnostic(diagnostic, strategy) {
    if (strategy === 'SPEECH_OPEN_RESPONSE' && !diagnostic) {
      return '<div class="diagnostic-unavailable">自动语义分析未启用 · 请依据原始录音人工复核</div>';
    }
    if (strategy === 'SPEECH_READING') {
      const metrics = diagnostic?.metrics || {};
      const dimensions = [['accuracy', '准确度'], ['completeness', '完整度'], ['fluency', '流利度'], ['tone', '声调']];
      const state = diagnostic?.state || 'NEEDS_REVIEW';
      const calibration = diagnostic?.calibrationStatus === 'CALIBRATED' ? '已校准' : '未校准';
      const candidate = typeof diagnostic?.candidatePoints === 'number' && Number.isFinite(diagnostic.candidatePoints)
        ? `${diagnostic.candidatePoints} / ${diagnostic.maxScore ?? '—'}`
        : '本次未提供';
      return `<div class="diagnostic-context"><span class="diagnostic-source">${esc(providerLabel(diagnostic?.provider))}</span><span class="diagnostic-badge">${esc(state)}</span><span>${calibration}</span><span>自动诊断证据 · 不代表正式得分</span></div>
        <div class="diagnostic-grid diagnostic-grid-reading">${dimensions.map(([key, name]) => `<div class="diagnostic-cell"><span>${name}</span><strong>${metricValue(metrics[key])}</strong></div>`).join('')}</div>
        <div class="diagnostic-reference"><span>自动参考值</span><strong>${esc(candidate)}</strong><small>仅供教师参考，不会自动填入正式得分。</small></div>
        ${diagnostic?.reasonCodes?.length ? `<p class="detail-json">诊断状态：${esc(diagnostic.reasonCodes.join(' · '))}</p>` : ''}`;
    }
    const metrics = diagnostic?.diagnostics || diagnostic?.metrics || {};
    const cells = [
      ['时长', metrics.durationMs != null ? `${Math.round(metrics.durationMs)} ms` : '—'],
      ['语音时长', metrics.speechDurationMs != null ? `${Math.round(metrics.speechDurationMs)} ms` : '—'],
      ['语速', metrics.speechRate != null ? `${Number(metrics.speechRate).toFixed(1)} 字/秒` : '—'],
      ['静音比例', metrics.silenceRatio != null ? `${Math.round(metrics.silenceRatio * 100)}%` : '—'],
      ['流畅度', metrics.fluency != null ? `${Number(metrics.fluency).toFixed(1)}` : '—'],
      ['置信度', diagnostic?.confidence != null ? `${Math.round(diagnostic.confidence * 100)}%` : '—'],
    ];
    return `<div class="diagnostic-grid">${cells.map(([name, value]) => `<div class="diagnostic-cell"><span>${name}</span><strong>${esc(value)}</strong></div>`).join('')}</div>
      ${diagnostic?.reasonCodes?.length ? `<p class="detail-json">诊断状态：${esc(diagnostic.reasonCodes.join(' · '))}</p>` : ''}`;
  }

  function renderFailure(error) {
    const title = error?.status === 403
      ? '当前账号没有该题的复核权限'
      : error?.status === 404
        ? '这道题已不存在或已退出复核队列'
        : error?.status === 409
          ? '这道题当前不能复核'
          : '复核证据加载失败';
    const message = error?.status === 403
      ? '服务器拒绝了当前账号的访问。请返回队列，只打开本人授权的待复核题目。'
      : error?.message || '网络暂时不可用，请检查连接后重试。';
    root.setAttribute?.('aria-busy', 'false');
    const retry = [401, 403, 404, 409].includes(error?.status)
      ? ''
      : '<button class="review-refresh" type="button" data-retry-detail>重新加载证据</button>';
    root.innerHTML = `<div class="detail-load-error" role="alert"><svg viewBox="0 0 42 42" aria-hidden="true"><circle cx="21" cy="21" r="16"/><path d="M21 12v12m0 6h.01"/></svg><h1>${esc(title)}</h1><p>${esc(message)}</p>${retry}<a class="review-back" href="${returnHref}">返回复核队列</a></div>`;
    root.querySelector('[data-retry-detail]')?.addEventListener('click', load);
  }

  function promptText(item) {
    const prompt = item?.prompt;
    if (typeof prompt === 'string') return prompt;
    if (!prompt || typeof prompt !== 'object') return '';
    for (const value of [prompt.text, prompt.promptText, prompt.instruction, prompt.title]) {
      if (typeof value === 'string' && value.trim()) return value;
    }
    return '';
  }

  function rubricMarkup(review) {
    const rubric = Array.isArray(review.rubric) ? review.rubric : [];
    const rules = Array.isArray(review.deductionRules) ? review.deductionRules : [];
    return `<section class="detail-card rubric-card"><div class="section-label"><span class="section-index">02</span><span>教师参考</span></div><h2>人工评分量表</h2>
      ${rubric.length ? `<div class="rubric-block"><h3>评分标准</h3><ul>${rubric.map((entry) => `<li>${esc(entry)}</li>`).join('')}</ul></div>` : '<p class="rubric-missing">服务端未提供该题的量表条目，请结合可见题目证据审慎复核。</p>'}
      ${review.referenceAnswer ? `<div class="rubric-block"><h3>教师参考答案</h3><p>${esc(review.referenceAnswer)}</p></div>` : ''}
      ${rules.length ? `<div class="rubric-block"><h3>扣分规则</h3><ul>${rules.map((entry) => `<li>${esc(entry)}</li>`).join('')}</ul></div>` : ''}
    </section>`;
  }

  function render(detailData) {
    detail = detailData;
    root.setAttribute?.('aria-busy', 'false');
    const item = detail.item || {};
    const strategy = item.strategy || '';
    const evidence = detail.evidence || {};
    const review = detail.review || {};
    const isReading = strategy === 'SPEECH_READING';
    const isPicture = strategy === 'SPEECH_OPEN_RESPONSE';
    const answer = item.answer && typeof item.answer === 'object'
      ? (item.answer.value ?? item.answer.text ?? JSON.stringify(item.answer))
      : item.answer;
    const maxScore = typeof item.maxScore === 'number' && Number.isFinite(item.maxScore) ? item.maxScore : null;
    const hasSavedScore = typeof item.scoredScore === 'number' && Number.isFinite(item.scoredScore);
    const isReadingDiagnostic = isReading && evidence.diagnostic && typeof evidence.diagnostic === 'object';
    const hasOpenResponseDiagnostic = isPicture && evidence.diagnostic && typeof evidence.diagnostic === 'object';
    const diagnosticTitle = isReadingDiagnostic
      ? `${providerLabel(evidence.diagnostic.provider)} · 自动诊断证据`
      : hasOpenResponseDiagnostic ? '本地语音诊断（仅证据，不自动给语义分）' : '自动语义分析状态';
    const diagnosticNote = isReading
      ? '自动结果未作为正式得分。请依据原始录音和量表独立判断。'
      : isPicture ? '请以学生原始表达为评分依据，诊断数据仅供参考。' : '以下内容只用于辅助理解学生作答。';
    const currentState = hasSavedScore
      ? `<div class="saved-review-banner" role="status"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12"/><path d="m10 16 4 4 8-9"/></svg><span><strong>服务器已保存复核</strong><small>正式得分 ${esc(item.scoredScore)} 分${item.reviewedAt ? ` · ${esc(new Date(item.reviewedAt).toLocaleString('zh-CN'))}` : ''}</small></span></div>`
      : '';

    root.innerHTML = `<div class="detail-wrap">
      <header class="detail-top"><a class="review-back" href="${returnHref}"><span aria-hidden="true">←</span> 返回复核队列</a><div class="detail-student-heading"><span class="review-kicker">教师复核 · 原始证据</span><h1>${esc(detail.student?.displayName || '学生姓名未提供')}</h1><p>${esc(detail.practice?.title || '练习名称未提供')} <span>·</span> ${esc(typeof item.domain === 'string' ? item.domain : '未设置领域')}</p></div>
        <div class="detail-status-chip ${hasSavedScore ? 'is-done' : 'is-pending'}"><svg viewBox="0 0 24 24" aria-hidden="true">${hasSavedScore ? '<path d="m5 12 4 4L19 6"/>' : '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>'}</svg><span>${hasSavedScore ? '已复核' : '待处理'}</span></div>
      </header>
      ${currentState}
      <div class="detail-layout">
        <div class="detail-main">
          <section class="detail-card evidence-card">
            <div class="section-label"><span class="section-index">01</span><span>学生原始作答</span><span class="source-stamp">AssessmentSession · AssessmentItem</span></div>
            <div class="detail-meta"><span class="detail-pill emphasis">${esc(label(strategy))}</span><span class="detail-pill">${maxScore === null ? '满分未提供' : `本题满分 ${esc(maxScore)} 分`}</span><span class="detail-pill">${esc(evidence.speechJobStatus || item.state || '复核待处理')}</span></div>
            <div class="detail-evidence-strip"><strong>${isReading ? '同一条原始录音' : isPicture ? '图片表达证据' : '题目作答证据'}</strong><span>${isReading ? `${providerLabel(evidence.diagnostic?.provider)} 提供的诊断值不预填得分` : '以下信息来自服务端保存的题目与作答'}</span></div>
            <h2>${isPicture ? '题目图片与学生表达' : '题目与学生作答'}</h2>
            ${isPicture
              ? `<figure class="detail-stimulus"><div class="picture-frame"><div class="picture-state" data-picture-state role="status" aria-live="polite">正在获取图片授权地址…</div><img data-picture alt="复核题目的原始图片" hidden></div><figcaption>${esc(promptText(item) || '服务端未提供图片说明')}</figcaption><button class="media-retry" type="button" data-picture-retry hidden>重新获取图片</button></figure>`
              : `<div class="detail-stimulus text-stimulus">${esc(item.targetText || promptText(item) || '服务端未提供题目文本')}</div>`}
            ${item.targetText ? `<div class="detail-answer"><b>朗读目标文本</b><p>${esc(item.targetText)}</p></div>` : ''}
            <div class="detail-answer"><b>学生文字作答</b><p>${answer != null && String(answer) !== '' ? esc(answer) : '该题未保存文字作答内容。'}</p></div>
            <div class="detail-audio" data-audio-panel>
              <div class="audio-title-row"><div><span class="section-label-small">RECORDING</span><h3>学生原始录音</h3></div><span class="audio-status" data-audio-state role="status" aria-live="polite">${evidence.playbackUrl ? '录音地址已授权，等待加载' : '正在核对录音地址'}</span></div>
              ${evidence.durationMs != null || evidence.mimeType ? `<p class="audio-meta">${evidence.durationMs != null ? `${esc(Math.round(evidence.durationMs / 1000))} 秒` : ''}${evidence.durationMs != null && evidence.mimeType ? ' · ' : ''}${esc(evidence.mimeType || '')}${evidence.recordingStatus ? ` · ${esc(evidence.recordingStatus)}` : ''}</p>` : ''}
              <audio data-review-audio controls preload="metadata" aria-label="播放学生原始录音" ${evidence.playbackUrl ? '' : 'hidden'}></audio>
              <button class="media-retry" type="button" data-audio-retry>${evidence.playbackUrl ? '重新获取播放地址' : '获取录音播放地址'}</button>
            </div>
            <section class="detail-diagnostic"><div class="diagnostic-heading"><div><span class="section-label-small">REVIEW CONTEXT</span><h2>${esc(diagnosticTitle)}</h2></div><p>${esc(diagnosticNote)}</p></div>${formatDiagnostic(evidence.diagnostic, strategy)}${evidence.transcript ? `<div class="transcript"><b>教师可见转写</b><p>${esc(evidence.transcript)}</p></div>` : '<div class="transcript">服务端未提供转写内容。</div>'}</section>
          </section>
          ${rubricMarkup(review)}
        </div>
        <aside class="detail-card review-form-card" aria-labelledby="score-title">
          <div class="section-label"><span class="section-index">03</span><span>人工评分</span></div><h2 id="score-title">提交正式得分</h2>
          <p class="score-intro">请先听取录音并阅读量表，再独立填写。自动诊断数值不会填入这里。</p>
          <form data-review-form novalidate>
            <label class="score-label" for="review-score">正式得分 <span>必填</span></label>
            <div class="score-entry"><input id="review-score" class="score-input" data-review-score type="number" inputmode="decimal" autocomplete="off" min="0" ${maxScore !== null ? `max="${esc(maxScore)}"` : ''} step="0.1" value="${hasSavedScore ? esc(item.scoredScore) : ''}" placeholder="留空，待填写" aria-describedby="score-hint score-error score-preview" aria-invalid="false" ${hasSavedScore ? 'disabled' : ''}><span class="score-suffix">分</span></div>
            <div class="score-range"><div class="score-scale" role="img" aria-label="得分范围从 0 到 ${maxScore === null ? '未知' : `${maxScore} 分`}" data-score-scale><span class="scale-track"></span><span class="scale-marker" data-score-marker hidden><span data-marker-label></span></span>${[0, 25, 50, 75, 100].map((percent) => `<span class="scale-tick" style="--tick-position:${percent}%"><i></i><small>${maxScore === null ? '—' : esc(Number((maxScore * percent / 100).toFixed(1)))}</small></span>`).join('')}</div><div class="scale-caption"><span>0 分</span><span>${maxScore === null ? '满分未提供' : `${esc(maxScore)} 分`}</span></div></div>
            <p class="score-hint" id="score-hint">${maxScore === null ? '服务器没有返回有效满分，评分已停用。' : `分值范围 0–${esc(maxScore)} 分，最多保留一位小数。主动输入 0 可合法提交。`}</p>
            <p class="score-preview" id="score-preview" data-score-preview aria-live="polite">${hasSavedScore ? `服务器已保存 ${esc(item.scoredScore)} 分` : '当前未选择分数'}</p>
            <p class="score-error" id="score-error" data-score-error role="alert"></p>
            <label class="comment-label" for="review-comment">教师评语 <span>选填</span></label>
            <textarea id="review-comment" class="comment-input" data-review-comment maxlength="2000" placeholder="写下与本次作答相关的反馈…" aria-describedby="comment-hint" ${hasSavedScore ? 'disabled' : ''}>${hasSavedScore ? esc(item.reviewerComment || '') : ''}</textarea><small class="comment-hint" id="comment-hint">评语会随正式结果保存并显示给学生。</small>
            <button class="submit-review" type="submit" data-review-submit ${hasSavedScore || maxScore === null ? 'disabled' : ''}>${hasSavedScore ? '复核已保存' : '确认并提交复核'}</button>
            <div class="review-message" data-review-message role="status" aria-live="polite"></div>
          </form>
          <div class="post-review-actions" data-post-review-actions ${hasSavedScore ? '' : 'hidden'}><a class="review-secondary" href="${returnHref}">返回更新后的队列</a><button class="next-review" type="button" data-next-review>继续复核下一题 <span aria-hidden="true">→</span></button><p class="next-review-message" data-next-message role="status" aria-live="polite"></p></div>
        </aside>
      </div>
    </div>`;

    const form = root.querySelector('[data-review-form]');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      submit();
    });
    root.querySelector('[data-review-score]')?.addEventListener('input', updateScorePreview);
    root.querySelector('[data-picture-retry]')?.addEventListener('click', loadPicture);
    root.querySelector('[data-audio-retry]')?.addEventListener('click', refreshAudioAddress);
    root.querySelector('[data-next-review]')?.addEventListener('click', continueNext);
    bindAudioState();
    updateScorePreview();
    if (isPicture) loadPicture();
    else root.querySelector('[data-picture-state]')?.closest('figure')?.remove();
    setInitialAudioState();
    if (hasSavedScore) {
      const savedScore = item.scoredScore;
      const report = detail.report;
      showConfirmedResult({ item: { id: detail.itemId, scoredScore: savedScore, reviewerComment: item.reviewerComment, status: 'REVIEWED' }, report }, true);
    }
  }

  function showScoreError(message) {
    const input = root.querySelector('[data-review-score]');
    const error = root.querySelector('[data-score-error]');
    if (error) error.textContent = message;
    input?.setAttribute('aria-invalid', 'true');
    input?.focus();
  }

  function updateScorePreview() {
    const input = root.querySelector('[data-review-score]');
    const preview = root.querySelector('[data-score-preview]');
    const marker = root.querySelector('[data-score-marker]');
    const markerLabel = root.querySelector('[data-marker-label]');
    const error = root.querySelector('[data-score-error]');
    if (!input || !detail) return;
    const current = input.value.trim();
    if (!current) {
      if (preview) preview.textContent = '当前未选择分数';
      if (marker) marker.hidden = true;
      if (error) error.textContent = '';
      input.setAttribute('aria-invalid', 'false');
      return;
    }
    const validation = validateScore(current, detail.item?.maxScore);
    if (validation.error) {
      if (preview) preview.textContent = '请检查当前分数';
      if (marker) marker.hidden = true;
      return;
    }
    const maxScore = detail.item.maxScore;
    const position = Math.max(0, Math.min(100, (validation.score / maxScore) * 100));
    if (preview) preview.textContent = `当前选择：${validation.score} 分`;
    if (marker) {
      marker.hidden = false;
      marker.style.setProperty('--score-position', `${position}%`);
    }
    if (markerLabel) markerLabel.textContent = String(validation.score);
    if (error) error.textContent = '';
    input.setAttribute('aria-invalid', 'false');
  }

  function bindAudioState() {
    const audio = root.querySelector('[data-review-audio]');
    const state = root.querySelector('[data-audio-state]');
    if (!audio || !state) return;
    audio.addEventListener('loadstart', () => { state.textContent = '正在连接录音…'; state.dataset.state = 'loading'; });
    audio.addEventListener('canplay', () => { state.textContent = '录音已就绪'; state.dataset.state = 'ready'; });
    audio.addEventListener('playing', () => { state.textContent = '正在播放录音'; state.dataset.state = 'playing'; });
    audio.addEventListener('pause', () => {
      if (audio.ended) return;
      if (audio.currentTime > 0) { state.textContent = '录音已暂停'; state.dataset.state = 'paused'; }
    });
    audio.addEventListener('ended', () => { state.textContent = '录音播放完成'; state.dataset.state = 'played'; });
    audio.addEventListener('error', () => {
      state.textContent = mediaErrorText(audio.error);
      state.dataset.state = 'error';
      const retry = root.querySelector('[data-audio-retry]');
      if (retry) retry.textContent = '重新获取播放地址并重试';
    });
  }

  function mediaErrorText(error) {
    const reasons = { 1: '播放已中止', 2: '录音网络加载失败', 3: '录音格式无法解码', 4: '浏览器不支持该录音格式' };
    return `${reasons[error?.code] || '录音未能播放'}。未确认播放成功；可重新获取授权地址后重试。`;
  }

  function setInitialAudioState() {
    const audio = root.querySelector('[data-review-audio]');
    const state = root.querySelector('[data-audio-state]');
    const retry = root.querySelector('[data-audio-retry]');
    if (!audio || !state) return;
    const playbackUrl = detail?.evidence?.playbackUrl;
    if (typeof playbackUrl !== 'string' || !playbackUrl) {
      state.textContent = detail?.evidence?.recordingId
        ? '服务端暂未返回录音地址；可以重新获取授权地址。'
        : '服务端未关联录音证据。';
      state.dataset.state = 'missing';
      audio.hidden = true;
      if (retry) retry.hidden = !detail?.evidence?.recordingId;
      return;
    }
    audio.src = playbackUrl;
    audio.hidden = false;
    audio.load();
    state.textContent = '录音地址已授权，正在加载…';
    state.dataset.state = 'loading';
  }

  async function refreshAudioAddress() {
    if (audioLoading) return;
    const state = root.querySelector('[data-audio-state]');
    const audio = root.querySelector('[data-review-audio]');
    const button = root.querySelector('[data-audio-retry]');
    if (!audio || !detail?.evidence?.recordingId) {
      if (state) state.textContent = '服务端未关联可重试的录音资源。';
      return;
    }
    audioLoading = true;
    if (button) { button.disabled = true; button.textContent = '正在重新获取授权地址…'; }
    if (state) { state.textContent = '正在向服务器重新获取录音授权地址…'; state.dataset.state = 'loading'; }
    try {
      const latest = await YuzanApi.getAssessmentReviewDetail(itemId);
      const playbackUrl = latest?.evidence?.playbackUrl;
      if (typeof playbackUrl !== 'string' || !playbackUrl) {
        throw new Error(latest?.evidence?.recordingStatus
          ? `服务器没有返回可播放地址（录音状态：${latest.evidence.recordingStatus}）。`
          : '服务器没有返回可播放地址。');
      }
      detail.evidence = { ...detail.evidence, ...latest.evidence };
      audio.pause();
      audio.src = playbackUrl;
      audio.hidden = false;
      audio.load();
      if (state) { state.textContent = '授权地址已更新，正在加载录音…'; state.dataset.state = 'loading'; }
      if (button) button.textContent = '重试播放';
    } catch (error) {
      if (state) { state.textContent = `录音地址获取失败：${error?.message || '网络错误'}。录音尚未播放。`; state.dataset.state = 'error'; }
      if (button) button.textContent = '重试获取播放地址';
    } finally {
      audioLoading = false;
      if (button) button.disabled = false;
    }
  }

  async function loadPicture() {
    if (imageLoading) return;
    const image = root.querySelector('[data-picture]');
    const state = root.querySelector('[data-picture-state]');
    const button = root.querySelector('[data-picture-retry]');
    const resourceId = findResourceId(detail?.item?.deliverySpec);
    if (!image || !state) return;
    if (!resourceId) {
      state.textContent = '题目快照中没有图片资源编号，无法请求授权图片。';
      state.dataset.state = 'missing';
      if (button) button.hidden = true;
      return;
    }
    imageLoading = true;
    state.textContent = '正在请求图片授权地址…';
    state.dataset.state = 'loading';
    image.hidden = true;
    if (button) { button.hidden = false; button.disabled = true; button.textContent = '正在加载图片…'; }
    try {
      const media = await YuzanApi.getResourcePlaybackUrl(resourceId);
      if (typeof media?.url !== 'string' || !media.url) throw new Error('服务器没有返回可用的授权图片地址。');
      image.onload = () => {
        image.hidden = false;
        state.textContent = '题目图片已加载';
        state.dataset.state = 'ready';
        if (button) { button.disabled = false; button.textContent = '重新加载图片'; }
        imageLoading = false;
      };
      image.onerror = () => {
        image.hidden = true;
        state.textContent = '图片资源加载失败，图片尚未显示。可以重新获取授权地址后重试。';
        state.dataset.state = 'error';
        if (button) { button.disabled = false; button.textContent = '重试加载图片'; }
        imageLoading = false;
      };
      image.src = media.url;
    } catch (error) {
      state.textContent = `图片授权地址获取失败：${error?.message || '网络错误'}。`;
      state.dataset.state = 'error';
      if (button) { button.disabled = false; button.textContent = '重试获取图片'; }
      imageLoading = false;
    }
  }

  function confirmSave(result, submittedComment, readOnly = false) {
    const savedItem = result?.item || result?.data?.item || null;
    const savedScore = savedItem?.scoredScore;
    if (savedItem?.id !== itemId || typeof savedScore !== 'number' || !Number.isFinite(savedScore) || savedItem.status !== 'REVIEWED') {
      return false;
    }
    showConfirmedResult(result, readOnly, submittedComment);
    return true;
  }

  function showConfirmedResult(result, readOnly, submittedComment = '') {
    const savedItem = result?.item || result?.data?.item || null;
    const report = result?.report || result?.data?.report || null;
    if (!savedItem) return;
    const message = root.querySelector('[data-review-message]');
    const form = root.querySelector('[data-review-form]');
    const input = root.querySelector('[data-review-score]');
    const commentField = root.querySelector('[data-review-comment]');
    const button = root.querySelector('[data-review-submit]');
    const actions = root.querySelector('[data-post-review-actions]');
    const banner = root.querySelector('.saved-review-banner');
    const statusChip = root.querySelector('.detail-status-chip');
    const actualComment = typeof savedItem.reviewerComment === 'string' ? savedItem.reviewerComment : '';
    if (form) form.classList.add('is-confirmed');
    if (input) input.disabled = true;
    if (commentField) commentField.disabled = true;
    if (button) { button.disabled = true; button.textContent = '复核已保存'; }
    if (statusChip) {
      statusChip.classList.remove('is-pending');
      statusChip.classList.add('is-done');
      statusChip.querySelector('span').textContent = '已复核';
      statusChip.querySelector('svg').innerHTML = '<path d="m5 12 4 4L19 6"/>';
    }
    if (actions) actions.hidden = false;
    if (banner) {
      banner.querySelector('strong').textContent = '服务器已保存复核';
      banner.querySelector('small').textContent = `正式得分 ${savedItem.scoredScore} 分`;
      banner.classList.add('is-confirmed');
    } else {
      const state = document.createElement('div');
      state.className = 'saved-review-banner is-confirmed';
      state.setAttribute('role', 'status');
      state.innerHTML = `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12"/><path d="m10 16 4 4 8-9"/></svg><span><strong>服务器已保存复核</strong><small>正式得分 ${esc(savedItem.scoredScore)} 分</small></span>`;
      root.querySelector('.detail-top')?.after(state);
    }
    if (!message) return;
    message.className = 'review-message review-success';
    message.innerHTML = `<strong>服务器已保存正式得分 ${esc(savedItem.scoredScore)} 分。</strong>${actualComment ? `<span>已保存评语：${esc(actualComment)}</span>` : '<span>本次未提交评语。</span>'}${submittedComment && submittedComment.trim() !== actualComment ? '<span class="review-save-note">服务端返回的评语与当前输入不同，页面展示已保存内容；请勿重复提交以覆盖。</span>' : ''}${report ? `<span class="report-confirmation">服务端已生成正式报告${typeof report.overallScore === 'number' ? ` · ${esc(report.overallScore)} 分` : ''}</span>` : '<span>服务端确认其他必要题目仍待复核，尚未生成正式报告。</span>'}`;
    if (!readOnly) message.classList.add('save-pop');
  }

  async function submit() {
    if (submitting || !detail) return;
    const input = root.querySelector('[data-review-score]');
    const commentField = root.querySelector('[data-review-comment]');
    const message = root.querySelector('[data-review-message]');
    const button = root.querySelector('[data-review-submit]');
    const error = root.querySelector('[data-score-error]');
    const validation = validateScore(input?.value, detail.item?.maxScore);
    if (validation.error) {
      showScoreError(validation.error);
      return;
    }
    if (error) error.textContent = '';
    submitting = true;
    if (button) { button.disabled = true; button.textContent = '正在保存…'; }
    if (message) { message.className = 'review-message'; message.textContent = '正在向服务器提交正式评分…'; }
    const comment = commentField?.value || '';
    try {
      const result = await YuzanApi.submitAssessmentReview(itemId, {
        score: validation.score,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
      if (!confirmSave(result, comment)) {
        throw new Error('服务器响应中缺少可核对的已保存题目、得分或复核状态。输入仍保留，请刷新核对后重试。');
      }
    } catch (error) {
      if (message) {
        message.className = 'review-message review-error-message';
        message.textContent = `${error?.message || '请求失败'}。输入内容已保留。可用相同分数安全重试；服务器不会静默覆盖已保存结果。`;
      }
      if (button) { button.disabled = false; button.textContent = '重试提交复核'; }
    } finally {
      submitting = false;
    }
  }

  function matchesReturnFilters(item) {
    const studentNeedle = (returnFilters.get('student') || '').trim().toLocaleLowerCase();
    const strategy = returnFilters.get('strategy') || '';
    const domain = returnFilters.get('domain') || '';
    if (studentNeedle && !String(item?.student?.displayName || '').toLocaleLowerCase().includes(studentNeedle)) return false;
    if (strategy && item?.strategy !== strategy) return false;
    if (domain === '__no_domain__' && item?.domain != null) return false;
    if (domain && domain !== '__no_domain__' && item?.domain !== domain) return false;
    return true;
  }

  async function continueNext() {
    if (nextItemLoading) return;
    const button = root.querySelector('[data-next-review]');
    const message = root.querySelector('[data-next-message]');
    nextItemLoading = true;
    if (button) { button.disabled = true; button.textContent = '正在刷新授权队列…'; }
    if (message) message.textContent = '正在重新读取服务器授权队列。';
    try {
      const response = await YuzanApi.getAssessmentReviewQueue();
      const items = Array.isArray(response) ? response : response?.items;
      if (!Array.isArray(items)) throw new Error('服务器未返回可用队列。');
      const next = items.find((item) => item?.itemId && item.itemId !== itemId && matchesReturnFilters(item));
      if (!next) {
        if (message) message.textContent = returnFilters.size
          ? '当前筛选下没有下一道待复核题目。返回队列后可清除筛选查看其他题目。'
          : '本人授权队列中目前没有其他待复核题目。';
        return;
      }
      const href = `/teacher/reviews/${encodeURIComponent(next.itemId)}${returnParams.size ? `?${returnQuery()}` : ''}`;
      location.assign(href);
    } catch (error) {
      if (message) message.textContent = `重新读取授权队列失败：${error?.message || '网络错误'}。可安全重试。`;
    } finally {
      nextItemLoading = false;
      if (button) { button.disabled = false; button.innerHTML = '继续复核下一题 <span aria-hidden="true">→</span>'; }
    }
  }

  async function load() {
    if (!window.YuzanApi?.requireAuth?.()) {
      root.setAttribute?.('aria-busy', 'false');
      root.innerHTML = '<div class="detail-load-error" role="status"><h1>需要登录</h1><p>登录后才能查看授权的复核证据。</p><a class="review-back" href="/teacher/reviews/">返回复核队列</a></div>';
      return;
    }
    try {
      const detailData = await YuzanApi.getAssessmentReviewDetail(itemId);
      render(detailData);
    } catch (error) {
      renderFailure(error);
    }
  }

  load();
})();
