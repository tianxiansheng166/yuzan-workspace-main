(() => {
  'use strict';
  const Api = window.YuzanApi;
  const Visuals = window.YuzanPracticeVisuals;
  const app = document.querySelector('#app');
  const parts = location.pathname.split('/').filter(Boolean);
  const attemptId = parts[3] || '';
  const state = { attempt: null, items: [], currentIndex: 0, save: 'IDLE', error: '', composing: false, submitting: false, submitConfirm: false, timers: new Map(), saves: new Map(), pendingAnswers: new Map(), media: null, blob: null, blobUrl: null, recordingIdempotencyKey: null, elapsed: 0, resourceUrls: new Map(), resourceErrors: new Map(), resolvingResources: new Set(), feedbackOpen: false, feedbackMessage: '', feedbackHistory: [] };
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = name => Visuals?.icon(name) || `<span class="runner-icon-fallback" aria-hidden="true">${({ play: '▶', pause: 'Ⅱ', stop: '■', mic: '●', arrow: '→', check: '✓', retry: '↻', upload: '↑', clock: '◷' })[name] || '•'}</span>`;
  const waveform = (kind, extraClass = '') => Visuals?.waveform({ kind, className: extraClass }) || '<span class="runner-waveform-fallback" aria-hidden="true">〰</span>';
  const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
  const current = () => state.items[state.currentIndex];
  const storedAnswer = item => item?.studentAnswer?.content?.value;
  const answerValue = item => state.pendingAnswers.has(item?.id) ? state.pendingAnswers.get(item.id) : storedAnswer(item) ?? '';
  const complete = item => normalize(item).response?.type === 'NONE' || saved(item);

  // Audio drafts are device-local evidence only. Server items remain the sole
  // authority for saved answers. Keys include the server-authorized enrollment.
  async function draftStore(mode, value) {
    const key = `${state.attempt.enrollmentId}:${attemptId}`;
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('yuzan-runner-audio-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('drafts');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('drafts', mode === 'get' ? 'readonly' : 'readwrite');
        const store = tx.objectStore('drafts');
        const request = mode === 'get' ? store.get(key) : mode === 'delete' ? store.delete(key) : store.put(value, key);
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  }
  async function restoreDraft() {
    try {
      const draft = await draftStore('get');
      const index = state.items.findIndex(item => item.id === draft?.itemId);
      if (index < 0 || !draft.blob?.size) return;
      if (saved(state.items[index])) { await draftStore('delete'); return; }
      state.currentIndex = index;
      await restoreDraftForCurrentItem(draft);
    } catch { /* Storage can be unavailable; no server-saved claim is made. */ }
  }
  async function restoreDraftForCurrentItem(existingDraft) {
    try {
      const draft = existingDraft || await draftStore('get');
      const item = current();
      if (!item || draft?.itemId !== item.id || !draft.blob?.size) return false;
      if (saved(item)) { await draftStore('delete'); return false; }
      if (state.blobUrl) URL.revokeObjectURL(state.blobUrl);
      state.blob = draft.blob;
      state.blobUrl = URL.createObjectURL(draft.blob);
      state.elapsed = Math.max(0, Number(draft.elapsed) || 0);
      state.recordingIdempotencyKey = draft.idempotencyKey;
      state.media = { state: 'REVIEW', cached: true, source: draft.source || null };
      return true;
    } catch { return false; }
  }
  function legacy(item) {
    const config = isObject(item.itemConfig) ? item.itemConfig : {};
    const type = item.itemType || '';
    const prompt = config.prompt || config.targetText || config.stimulus || config.instruction || '';
    const stimulus = { type: config.demoAudioUrl ? 'AUDIO' : 'TEXT', promptText: prompt, instruction: config.instruction, url: config.demoAudioUrl };
    if (['LISTEN_ONLY'].includes(type)) return { stimulus, response: { type: 'NONE' } };
    if (['READING', 'SPEECH', 'LISTEN_REPEAT', 'READ_ALOUD'].includes(type)) return { stimulus, response: { type: 'SPEECH' } };
    if (['CHOICE', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE'].includes(type)) return { stimulus, response: { type: 'CHOICE', options: config.options || [] } };
    return { stimulus, response: { type: 'TEXT', multiline: type !== 'FILL_BLANK', placeholder: config.placeholder } };
  }
  function normalize(item) {
    const config = isObject(item.itemConfig) ? item.itemConfig : null;
    if (config?.stimulus && config?.response) return config;
    const prompt = isObject(item.prompt) ? item.prompt : null;
    return prompt?.stimulus && prompt?.response ? prompt : legacy(item);
  }
  function saved(item) {
    const value = storedAnswer(item);
    return Boolean((item.recordingId && item.recordingStatus !== 'FAILED') || (value !== null && value !== undefined && String(value).trim().length > 0));
  }
  function resolveResourceUrl(resourceId, fallbackUrl) {
    if (fallbackUrl) return fallbackUrl;
    if (!resourceId || typeof resourceId !== 'string') return '';
    const cached = state.resourceUrls.get(resourceId);
    if (cached) return cached;
    if (!state.resolvingResources.has(resourceId) && !state.resourceErrors.has(resourceId)) {
      state.resolvingResources.add(resourceId);
      const request = Api?.getResourcePlaybackUrl
        ? Api.getResourcePlaybackUrl(resourceId)
        : Promise.reject(new Error('资源播放服务不可用'));
      Promise.resolve(request)
        .then(result => {
          if (!result?.url || typeof result.url !== 'string') throw new Error('资源播放地址不可用');
          state.resourceUrls.set(resourceId, result.url);
        })
        .catch(() => state.resourceErrors.set(resourceId, true))
        .finally(() => {
          state.resolvingResources.delete(resourceId);
          if (state.items.length) render();
        });
    }
    return '';
  }
  function resourceStatus(resourceId, label) {
    if (!resourceId) return `<p class="runner-error">${safe(label)}资源暂不可读取。</p>`;
    if (state.resourceErrors.has(resourceId)) return `<div class="runner-resource-error"><p class="runner-error">${safe(label)}资源加载失败。</p><button type="button" class="runner-quiet-button" data-retry-resource="${safe(resourceId)}">${icon('retry')} 重试加载</button></div>`;
    return `<p class="runner-muted">正在加载${safe(label)}资源…</p>`;
  }
  function renderStimulus(spec) {
    const s = isObject(spec) ? spec : {};
    const title = s.title ? `<h2>${safe(s.title)}</h2>` : '';
    const instruction = s.instruction ? `<p class="runner-instruction">${safe(s.instruction)}</p>` : '';
    if (s.type === 'TEXT' || !s.type) return `<section class="runner-stimulus text-stimulus">${title}${instruction}<p>${safe(s.promptText || s.text || '题目内容不可用')}</p>${s.secondaryText ? `<small>${safe(s.secondaryText)}</small>` : ''}</section>`;
    if (s.type === 'IMAGE') {
      const url = resolveResourceUrl(s.resourceId, s.url || s.imageUrl);
      return `<section class="runner-stimulus image-stimulus">${title}${instruction}${url ? `<img src="${safe(url)}" alt="${safe(s.alt || s.caption || '题目图片')}">` : resourceStatus(s.resourceId, '图片')}${s.caption ? `<small>${safe(s.caption)}</small>` : ''}</section>`;
    }
    if (s.type === 'AUDIO') {
      const url = resolveResourceUrl(s.resourceId, s.url || s.audioUrl || s.demoAudioUrl);
      return `<section class="runner-stimulus audio-stimulus">${title}${instruction}${s.promptText ? `<p>${safe(s.promptText)}</p>` : ''}${url ? `<div class="runner-audio-player" data-audio-player><div class="runner-audio-visual">${waveform('playback')}</div><p class="runner-audio-status" data-audio-status role="status" aria-live="polite">音频已就绪，点击播放</p><audio data-prompt-audio controls preload="metadata" src="${safe(url)}">浏览器不支持音频播放。</audio></div>` : resourceStatus(s.resourceId, '音频')}</section>`;
    }
    return `<p class="runner-error">不支持的刺激类型：${safe(s.type)}</p>`;
  }
  function renderResponse(item, spec) {
    const response = isObject(spec.response) ? spec.response : {};
    if (response.type === 'NONE') return '<p class="runner-muted">请完成聆听后继续下一题。</p>';
    if (response.type === 'CHOICE') return `<div class="runner-options">${(Array.isArray(response.options) ? response.options : []).map((option, index) => {
      const value = isObject(option) ? option.key : String(option);
      const label = isObject(option) ? option.text : option;
      const image = isObject(option) ? resolveResourceUrl(option.imageResourceId, option.imageUrl || option.url) : '';
      const imageState = isObject(option) && option.imageResourceId && !image
        ? (state.resourceErrors.has(option.imageResourceId) ? '<em class="runner-error">图片加载失败</em>' : '<em class="runner-muted">图片加载中…</em>')
        : '';
      const selected = String(answerValue(item)) === String(value);
      return `<button type="button" class="runner-option ${selected ? 'selected' : ''}" data-choice="${safe(value)}" aria-pressed="${selected}"><b>${safe(option?.key || String.fromCharCode(65 + index))}</b>${image ? `<img src="${safe(image)}" alt="${safe(label || '选项图片')}">` : ''}${imageState}<span>${safe(label || value)}</span></button>`;
    }).join('')}</div>`;
    if (response.type === 'TEXT') return `<div class="runner-text-response"><label class="visually-hidden" for="runner-answer">本题答案</label><textarea id="runner-answer" data-text aria-label="本题答案" placeholder="${safe(response.placeholder || '请输入你的答案')}" ${response.maxLength ? `maxlength="${Number(response.maxLength)}"` : ''}>${safe(answerValue(item))}</textarea><p data-save-status>${statusText()}</p></div>`;
    if (response.type === 'SPEECH') return renderSpeech(item);
    return `<p class="runner-error">不支持的作答类型：${safe(response.type)}</p>`;
  }
  function statusText() { return ({ IDLE: '答案会自动保存', DIRTY: '等待保存…', SAVING: '正在保存…', SAVED: '答案已保存到服务器', ERROR: '保存失败，请查看本题错误提示' })[state.save] || ''; }
  function updateSaveStatus() {
    const text = statusText();
    document.querySelectorAll('[data-save-status], [data-save-state]').forEach(element => { element.textContent = text; });
    const message = document.querySelector('[data-runner-message]');
    if (message && !state.submitConfirm) {
      message.hidden = !state.error;
      message.innerHTML = state.error ? `<span>${safe(state.error)}</span>${state.pendingAnswers.has(current()?.id) ? `<button type="button" class="runner-quiet-button" data-retry-save>${icon('retry')} 重试保存</button>` : ''}` : '';
    }
  }
  function resetTransientMedia() {
    if (state.media?.clock) clearInterval(state.media.clock);
    if (state.media?.countdown) clearInterval(state.media.countdown);
    if (state.media?.meterFrame) cancelAnimationFrame(state.media.meterFrame);
    if (state.media?.recorder) {
      state.media.recorder.onstop = null;
      if (state.media.recorder.state !== 'inactive') state.media.recorder.stop();
    }
    state.media?.stream?.getTracks?.().forEach(track => track.stop());
    state.media?.audioContext?.close?.().catch?.(() => {});
    if (state.blobUrl) URL.revokeObjectURL(state.blobUrl);
    state.media = null;
    state.blob = null;
    state.blobUrl = null;
    state.recordingIdempotencyKey = null;
    state.elapsed = 0;
  }
  function renderSpeech(item) {
    const previousRecordingFailed = item.recordingId && item.recordingStatus === 'FAILED';
    if (item.recordingId && !previousRecordingFailed) return `<div class="runner-speech saved"><span class="runner-status-mark">${icon('check')}</span><b>服务器已确认保存</b><p>录音已绑定到本题；后续处理状态以服务器为准。</p><span class="runner-recording-status">${safe(item.recordingStatus || '已保存')}</span></div>`;
    const phase = state.media?.state || 'IDLE';
    const simulatedSource = state.media?.source === 'SIMULATED_MIC' ? '<span class="runner-simulated-source">SIMULATED_MIC · 测试音源，不代表真实硬件麦克风</span>' : '';
    if (phase === 'REQUESTING') return `<div class="runner-speech" aria-live="polite"><b>正在检查麦克风权限…</b><p>浏览器会请求麦克风；允许后才开始倒计时。</p></div>`;
    if (phase === 'COUNTDOWN') return `<div class="runner-speech runner-countdown" aria-live="polite"><b>准备录音</b><strong data-countdown>3</strong><p>倒计时结束后开始采集麦克风输入。</p>${simulatedSource}</div>`;
    if (phase === 'RECORDING') return `<div class="runner-speech runner-recording" aria-live="polite"><div class="runner-recording-head"><span class="recording-pulse"></span><b>正在录音</b><strong data-elapsed>${formatDuration(state.elapsed)}</strong></div>${waveform('input', state.media?.meterAvailable ? 'is-live' : '')}<p class="runner-meter-caption">${state.media?.meterAvailable ? '实时麦克风输入强弱；不用于评分。' : '浏览器未提供输入电平分析，录音状态由 MediaRecorder 确认。'}</p>${simulatedSource}<button type="button" class="btn runner-stop-button" data-stop-recording>${icon('stop')} 停止录音</button></div>`;
    if (phase === 'REVIEW') return `<div class="runner-speech runner-review"><b>请先试听录音</b><p>${state.media?.cached ? '本机草稿已保留，可刷新恢复；服务器尚未确认保存。' : '录音尚未上传；请留在本页完成上传或重录。'}</p>${simulatedSource}<audio data-take-audio controls preload="metadata" src="${safe(state.blobUrl)}">浏览器不支持音频试听。</audio><div class="runner-recording-meta"><span>录音时长 ${formatDuration(state.elapsed)}</span><span>${safe(state.blob?.type || '音频类型未知')}</span><span>${state.blob?.size ? `${Math.ceil(state.blob.size / 1024)} KB` : '音频大小未知'}</span></div><div class="runner-speech-actions"><button type="button" class="btn" data-rerecord>${icon('retry')} 重录</button><button type="button" class="btn primary" data-upload-recording>${icon('upload')} 确认并上传</button></div></div>`;
    if (phase === 'STOPPING') return `<div class="runner-speech" aria-live="polite"><b>正在生成试听音频…</b><p>浏览器正在完成这段录音。</p></div>`;
    if (phase === 'UPLOADING') return `<div class="runner-speech runner-uploading" aria-live="polite"><span class="runner-status-mark">${icon('upload')}</span><b>正在上传到服务器对象存储…</b>${Number.isFinite(state.media?.uploadProgress) ? `<label for="runner-upload-progress">已上传 ${state.media.uploadProgress}%</label><progress id="runner-upload-progress" max="100" value="${state.media.uploadProgress}">${state.media.uploadProgress}%</progress>` : '<p>正在等待服务器确认上传。</p>'}</div>`;
    return `<div class="runner-speech runner-mic-ready">${previousRecordingFailed ? '<b>之前录音处理失败</b><p>历史录音不会被覆盖；重新录制将作为新的录音证据。</p>' : '<p>点击后检查浏览器麦克风权限。录音完成后可先试听，再上传。</p>'}<button type="button" class="btn primary runner-record-button" data-start-recording>${icon('mic')} ${previousRecordingFailed ? '重新检查并录音' : '检查麦克风并开始录音'}</button></div>`;
  }
  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }
  async function moveTo(index) {
    if (index < 0 || index >= state.items.length || index === state.currentIndex) return;
    if (state.media && (state.media.state !== 'REVIEW' || !state.media.cached)) return;
    if (!await flush()) {
      state.error = state.error || '答案尚未保存到服务器，请重试保存后再切题。';
      state.save = 'ERROR';
      render();
      return;
    }
    document.querySelector('[data-prompt-audio]')?.pause?.();
    resetTransientMedia();
    state.currentIndex = index;
    state.error = '';
    state.save = 'IDLE';
    await restoreDraftForCurrentItem();
    render();
  }
  function bindAudioPlayback() {
    const audio = document.querySelector('[data-prompt-audio]');
    if (!audio || audio.dataset.practiceAudioBound) return;
    audio.dataset.practiceAudioBound = 'true';
    const update = (status, message) => {
      const player = audio.closest('[data-audio-player]');
      player?.classList.toggle('is-playing', status === 'playing');
      player?.classList.toggle('has-error', status === 'error');
      const label = player?.querySelector('[data-audio-status]');
      if (label) label.textContent = message;
      let retry = player?.querySelector('[data-retry-audio]');
      if (status === 'error' && player && !retry) {
        retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'runner-quiet-button';
        retry.dataset.retryAudio = 'true';
        retry.textContent = '重试播放音频';
        retry.addEventListener('click', () => { audio.load(); audio.play().catch(() => {}); });
        player.append(retry);
      }
      if (retry) retry.hidden = status !== 'error';
    };
    audio.addEventListener('play', () => update('playing', '正在播放题目音频'));
    audio.addEventListener('pause', () => update('paused', '题目音频已暂停'));
    audio.addEventListener('ended', () => update('ended', '题目音频播放完毕'));
    audio.addEventListener('error', () => update('error', '音频播放失败，请重试加载题目'));
  }
  function bind() {
    bindAudioPlayback();
    document.querySelectorAll('[data-retry-resource]').forEach(button => button.addEventListener('click', () => {
      const resourceId = button.dataset.retryResource;
      state.resourceErrors.delete(resourceId);
      state.resolvingResources.delete(resourceId);
      resolveResourceUrl(resourceId, '');
      render();
    }));
    document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => void moveTo(Number(button.dataset.go))));
    document.querySelector('[data-prev]')?.addEventListener('click', () => void moveTo(state.currentIndex - 1));
    document.querySelector('[data-next]')?.addEventListener('click', () => void moveTo(state.currentIndex + 1));
    document.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', async () => {
      const item = current();
      const value = button.dataset.choice;
      state.pendingAnswers.set(item.id, value);
      state.error = '';
      state.save = 'DIRTY';
      document.querySelectorAll('[data-choice]').forEach(option => {
        const selected = String(option.dataset.choice) === String(value);
        option.classList.toggle('selected', selected);
        option.setAttribute('aria-pressed', String(selected));
      });
      updateSaveStatus();
      await save(item, value);
      refreshProgress();
    }));
    const textarea = document.querySelector('[data-text]');
    const scheduleTextSave = () => {
      const item = current();
      if (!item || state.composing) return;
      const value = textarea.value;
      state.pendingAnswers.set(item.id, value);
      clearTimeout(state.timers.get(item.id));
      state.timers.set(item.id, setTimeout(() => {
        state.timers.delete(item.id);
        void save(item, value);
      }, 700));
    };
    textarea?.addEventListener('compositionstart', () => {
      state.composing = true;
      clearTimeout(state.timers.get(current()?.id));
      state.save = 'DIRTY';
      updateSaveStatus();
    });
    textarea?.addEventListener('compositionend', () => { state.composing = false; scheduleTextSave(); });
    textarea?.addEventListener('input', () => { state.error = ''; state.save = 'DIRTY'; updateSaveStatus(); scheduleTextSave(); });
    document.querySelector('[data-runner-message]')?.addEventListener('click', async event => {
      if (!event.target.closest('[data-retry-save]')) return;
      const item = current();
      const value = document.querySelector('[data-text]')?.value ?? state.pendingAnswers.get(item?.id);
      if (!item || value === undefined) return;
      await save(item, value);
      refreshProgress();
    });
    document.querySelector('[data-start-recording]')?.addEventListener('click', beginSpeech);
    document.querySelector('[data-stop-recording]')?.addEventListener('click', () => {
      if (state.media?.recorder?.state !== 'recording') return;
      clearInterval(state.media.clock);
      state.elapsed = Math.max(state.elapsed, Math.floor((performance.now() - state.media.startedAt) / 1000));
      if (state.media.meterFrame) cancelAnimationFrame(state.media.meterFrame);
      state.media.state = 'STOPPING';
      state.media.recorder.stop();
      render();
    });
    document.querySelector('[data-rerecord]')?.addEventListener('click', async () => {
      await draftStore('delete').catch(() => {});
      resetTransientMedia();
      state.error = '';
      state.save = 'IDLE';
      render();
    });
    document.querySelector('[data-upload-recording]')?.addEventListener('click', uploadSpeech);
    document.querySelector('[data-submit]')?.addEventListener('click', async () => {
      if (!await flush()) {
        state.error = state.error || '答案尚未保存，请重试后再交卷。';
        state.save = 'ERROR';
        render();
        return;
      }
      state.submitConfirm = true;
      state.error = '';
      render();
      document.querySelector('[data-cancel-submit]')?.focus?.();
    });
    document.querySelector('[data-cancel-submit]')?.addEventListener('click', () => {
      state.submitConfirm = false;
      render();
      document.querySelector('[data-submit]')?.focus?.();
    });
    document.querySelector('[data-confirm-submit]')?.addEventListener('click', () => void submit());
    document.querySelector('[data-fix-incomplete]')?.addEventListener('click', () => {
      state.currentIndex = state.items.findIndex(item => !complete(item));
      state.submitConfirm = false;
      render();
    });
    document.querySelector('.runner-confirm-card')?.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        state.submitConfirm = false;
        render();
        document.querySelector('[data-submit]')?.focus?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = [...document.querySelectorAll('.runner-confirm-card button:not([disabled])')];
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    document.querySelector('[data-feedback-open]')?.addEventListener('click', () => void openFeedback());
    document.querySelector('[data-feedback-close]')?.addEventListener('click', () => {
      state.feedbackOpen = false;
      render();
      document.querySelector('[data-feedback-open]')?.focus?.();
    });
    document.querySelector('[data-feedback-message]')?.addEventListener('input', event => { state.feedbackMessage = event.currentTarget.value; });
    document.querySelector('[data-feedback-submit]')?.addEventListener('click', () => void submitFeedback());
  }
  function progressCount() { return state.items.filter(complete).length; }
  function refreshProgress() {
    const count = state.items.length;
    const completed = progressCount();
    const copy = document.querySelector('[data-progress-copy]');
    if (copy) copy.textContent = `${completed} / ${count} 题已完成`;
    const track = document.querySelector('.runner-progress-track');
    if (track) track.setAttribute('aria-valuenow', String(completed));
    const bar = document.querySelector('[data-progress-bar]');
    const submitButton = document.querySelector('[data-submit]');
    if (submitButton) submitButton.disabled = Boolean(state.media && (state.media.state !== 'REVIEW' || !state.media.cached));
    if (bar) bar.style.width = `${count ? (completed / count) * 100 : 0}%`;
    document.querySelectorAll('[data-go]').forEach(button => {
      const item = state.items[Number(button.dataset.go)];
      const isCurrent = Number(button.dataset.go) === state.currentIndex;
      button.classList.toggle('answered', saved(item));
      button.classList.toggle('current', isCurrent);
      button.setAttribute('aria-current', isCurrent ? 'step' : 'false');
      button.setAttribute('aria-label', `第 ${Number(button.dataset.go) + 1} 题，${saved(item) ? '已保存' : complete(item) ? '无需作答' : '未完成'}`);
    });
  }
  function render() {
    const item = current();
    if (!item) { app.innerHTML = '<main class="runner-page"><p class="runner-error">此练习没有可执行题目。</p></main>'; return; }
    const spec = normalize(item);
    const count = state.items.length;
    const completed = progressCount();
    const incomplete = state.items.filter(entry => !complete(entry));
    const currentLocked = state.media && (state.media.state !== 'REVIEW' || !state.media.cached);
    const feedbackPanel = state.feedbackOpen ? `<div class="runner-feedback-modal" role="presentation"><div class="runner-feedback-card" role="dialog" aria-modal="true" aria-labelledby="runner-feedback-title"><button type="button" class="runner-feedback-close" data-feedback-close aria-label="关闭反馈">×</button><h2 id="runner-feedback-title">反馈问题</h2><p>请描述遇到的问题，不要填写手机号等敏感信息。不会提交你的答案、录音或评分细节。</p><label>问题类型<select data-feedback-category><option value="CONTENT">题目内容</option><option value="MEDIA">图片/音频</option><option value="RECORDING">录音</option><option value="SCORING">评分结果</option><option value="USABILITY">使用体验</option><option value="TECHNICAL">系统问题</option><option value="OTHER">其他</option></select></label><label for="runner-feedback-message">问题描述</label><textarea id="runner-feedback-message" data-feedback-message minlength="5" maxlength="1000" placeholder="至少输入 5 个字">${safe(state.feedbackMessage)}</textarea><button type="button" class="btn primary" data-feedback-submit>提交反馈</button><div class="runner-feedback-history"><b>我的反馈</b>${state.feedbackHistory.length ? state.feedbackHistory.map(entry => `<p>${safe(entry.category)} · ${safe({ OPEN: '待处理', ACKNOWLEDGED: '已知悉', RESOLVED: '已解决' }[entry.status] || entry.status)}${entry.resolutionNote ? `：${safe(entry.resolutionNote)}` : ''}</p>`).join('') : '<p>暂无反馈。</p>'}</div></div></div>` : '';
    const courseContext = Api.getCoursePracticeContext?.(attemptId);
    const returnTo = courseContext?.returnTo;
    const courseReturn = typeof returnTo === 'string' && /^\/student\/courses\/course-detail\/(?:\?|$)/.test(returnTo) ? returnTo : null;
    const questionMap = state.items.map((entry, index) => {
      const status = saved(entry) ? '已保存' : complete(entry) ? '无需作答' : '未完成';
      return `<button type="button" data-go="${index}" class="${index === state.currentIndex ? 'current' : ''} ${saved(entry) ? 'answered' : ''}" aria-current="${index === state.currentIndex ? 'step' : 'false'}" aria-label="第 ${index + 1} 题，${status}" ${currentLocked ? 'disabled' : ''}>${index + 1}</button>`;
    }).join('');
    const firstIncomplete = state.items.findIndex(entry => !complete(entry));
    const submitDialog = state.submitConfirm ? `<div class="runner-confirm-modal" role="presentation"><section class="runner-confirm-card" role="dialog" aria-modal="true" aria-labelledby="runner-confirm-title" aria-describedby="runner-confirm-copy"><span class="runner-confirm-icon">${icon(incomplete.length ? 'clock' : 'check')}</span><h2 id="runner-confirm-title">${incomplete.length ? '还有题目未完成' : '确认交卷'}</h2><p id="runner-confirm-copy">${incomplete.length ? `当前有 ${incomplete.length} 道题尚未保存答案或录音。` : `已完成 ${completed} / ${count} 题。提交后将进入服务器处理流程。`}</p><p class="runner-confirm-note">交卷不会生成未校准的语音分数；处理结果以服务器为准。</p><div class="runner-confirm-actions">${incomplete.length ? `<button type="button" class="btn primary" data-fix-incomplete>返回第 ${firstIncomplete + 1} 题继续作答</button>` : `<button type="button" class="btn primary" data-confirm-submit>${icon('check')} 确认交卷</button>`}<button type="button" class="btn" data-cancel-submit>${incomplete.length ? '留在本次练习' : '再检查一下'}</button></div></section></div>` : '';
    app.innerHTML = `<main class="runner-page" ${state.submitConfirm ? 'inert' : ''}><header class="runner-header"><a class="runner-back" href="${safe(courseReturn || '/student/practices/')}">${icon('arrow')} ${courseReturn ? '返回课程' : '返回练习中心'}</a><div class="runner-title"><b>听说训练台</b><span class="runner-attempt-state">${safe(state.attempt?.status || 'IN_PROGRESS')}</span></div><button type="button" class="btn runner-feedback-open" data-feedback-open>反馈问题</button></header><section class="runner-progress"><span class="runner-current-position">第 <b>${state.currentIndex + 1}</b> / ${count} 题</span><div class="runner-progress-track" role="progressbar" aria-label="已完成题目" aria-valuemin="0" aria-valuemax="${count}" aria-valuenow="${completed}"><i data-progress-bar style="width:${count ? (completed / count) * 100 : 0}%"></i></div><span data-progress-copy>${completed} / ${count} 题已完成</span></section><nav class="runner-map" aria-label="题目导航">${questionMap}</nav><article class="question-shell"><div class="runner-question-heading"><p class="runner-section">${safe(item.sectionTitle || '练习题')}</p><span>第 ${state.currentIndex + 1} 题</span></div>${renderStimulus(spec.stimulus)}<section class="runner-response">${renderResponse(item, spec)}</section><div data-runner-message class="runner-message" role="alert" aria-live="assertive" ${state.error ? '' : 'hidden'}>${state.error ? `<span>${safe(state.error)}</span>${state.pendingAnswers.has(item.id) ? `<button type="button" class="runner-quiet-button" data-retry-save>${icon('retry')} 重试保存</button>` : ''}` : ''}</div></article><footer class="runner-footer"><button type="button" class="btn" data-prev ${state.currentIndex && !currentLocked ? '' : 'disabled'}>${icon('arrow')} 上一题</button><span data-save-state aria-live="polite">${safe(statusText())}</span>${state.currentIndex === count - 1 ? `<button type="button" class="btn primary runner-submit-button" data-submit ${currentLocked ? 'disabled' : ''}>检查并交卷 ${icon('arrow')}</button>` : `<button type="button" class="btn primary runner-next-button" data-next ${currentLocked ? 'disabled' : ''}>下一题 ${icon('arrow')}</button>`}</footer></main>${feedbackPanel}${submitDialog}`;
    bind();
  }
  async function save(item, value) {
    state.pendingAnswers.set(item.id, value);
    const active = state.saves.get(item.id);
    if (active) {
      await active;
      if (String(storedAnswer(item) ?? '') === String(value)) return true;
      return save(item, state.pendingAnswers.get(item.id));
    }
    const pending = (async () => {
      state.save = 'SAVING';
      state.error = '';
      updateSaveStatus();
      try {
        await Api.saveWrittenAnswer(attemptId, item.id, { content: { responseType: normalize(item).response.type, value }, wordCount: 0, charCount: String(value).length });
        item.studentAnswer = { content: { responseType: normalize(item).response.type, value } };
        if (String(state.pendingAnswers.get(item.id)) === String(value)) state.pendingAnswers.delete(item.id);
        state.save = 'SAVED';
        refreshProgress();
      } catch (error) {
        state.error = error.message || '网络错误';
        state.save = 'ERROR';
      } finally {
        state.saves.delete(item.id);
        updateSaveStatus();
      }
    })();
    state.saves.set(item.id, pending);
    await pending;
    return state.save !== 'ERROR' && String(storedAnswer(item) ?? '') === String(value);
  }
  async function flush() {
    const item = current();
    if (!item) return false;
    const textarea = document.querySelector('[data-text]');
    const timer = state.timers.get(item.id);
    if (timer) { clearTimeout(timer); state.timers.delete(item.id); }
    if (textarea && String(storedAnswer(item) ?? '') !== textarea.value) {
      state.pendingAnswers.set(item.id, textarea.value);
      return save(item, textarea.value);
    }
    const active = state.saves.get(item.id);
    if (active) await active;
    const hasPending = state.pendingAnswers.has(item.id);
    return !hasPending;
  }
  function isSimulatedMicrophone(stream) {
    const injected = typeof window.__yuzanRunnerGetUserMedia === 'function'
      || window.__yuzanRunnerMicrophoneSource === 'SIMULATED_MIC';
    const track = stream.getAudioTracks?.()[0];
    const details = `${track?.label || ''} ${track?.getSettings?.().deviceId || ''}`.toLowerCase();
    return injected || /fake|simulat|test[-_ ]?mic/.test(details);
  }
  async function startInputMeter(media) {
    const AudioContextType = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextType) { media.meterAvailable = false; return; }
    try {
      const audioContext = new AudioContextType();
      const source = audioContext.createMediaStreamSource(media.stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      await audioContext.resume?.();
      media.audioContext = audioContext;
      media.analyser = analyser;
      media.meterAvailable = true;
      const samples = new Uint8Array(analyser.fftSize);
      const tick = () => {
        if (state.media !== media || media.state !== 'RECORDING') return;
        const bars = [...document.querySelectorAll('[data-waveform="input"] [data-wave-bar]')];
        if (!bars.length) return;
        analyser.getByteTimeDomainData(samples);
        const segmentSize = Math.max(1, Math.floor(samples.length / bars.length));
        bars.forEach((bar, index) => {
          const start = index * segmentSize;
          const end = index === bars.length - 1 ? samples.length : Math.min(samples.length, start + segmentSize);
          let power = 0;
          for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
            const amplitude = (samples[sampleIndex] - 128) / 128;
            power += amplitude * amplitude;
          }
          const rms = Math.sqrt(power / Math.max(1, end - start));
          const height = Math.max(2, Math.min(22, Math.round(2 + rms * 54)));
          bar.setAttribute('height', String(height));
          bar.setAttribute('y', String(Math.round((24 - height) / 2)));
        });
        media.meterFrame = requestAnimationFrame(tick);
      };
      media.meterFrame = requestAnimationFrame(tick);
    } catch {
      media.meterAvailable = false;
    }
  }
  async function beginSpeech() {
    if (state.media) return;
    const item = current();
    const media = { state: 'REQUESTING' };
    state.media = media;
    state.error = '';
    state.save = 'IDLE';
    render();
    try {
      const getUserMedia = window.__yuzanRunnerGetUserMedia || navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
      if (!getUserMedia || !window.MediaRecorder) throw new Error('此浏览器不支持录音，请使用支持录音的浏览器。');
      const stream = await getUserMedia({ audio: true });
      if (state.media !== media) { stream.getTracks().forEach(track => track.stop()); return; }
      media.stream = stream;
      media.source = isSimulatedMicrophone(stream) ? 'SIMULATED_MIC' : 'MICROPHONE';
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => window.MediaRecorder.isTypeSupported(type));
      const recorder = new window.MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      media.recorder = recorder;
      state.recordingIdempotencyKey = `runner-${attemptId}-${item.id}-${crypto.randomUUID()}`;
      const chunks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => { resetTransientMedia(); state.error = '录音中断，尚未上传，请重新录制。'; state.save = 'ERROR'; render(); };
      recorder.onstop = async () => {
        if (media.meterFrame) cancelAnimationFrame(media.meterFrame);
        media.audioContext?.close?.().catch?.(() => {});
        stream.getTracks().forEach(track => track.stop());
        if (state.media !== media) return;
        const actualType = recorder.mimeType || chunks.find(chunk => chunk.type)?.type;
        if (!actualType || !chunks.some(chunk => chunk.size)) { resetTransientMedia(); state.error = '没有生成有效音频，请重新录制。'; state.save = 'ERROR'; render(); return; }
        state.blob = new Blob(chunks, { type: actualType });
        state.blobUrl = URL.createObjectURL(state.blob);
        try { await draftStore('put', { itemId: item.id, blob: state.blob, elapsed: state.elapsed, idempotencyKey: state.recordingIdempotencyKey, source: media.source }); media.cached = true; } catch { media.cached = false; }
        if (state.media !== media) return;
        media.state = 'REVIEW';
        render();
      };
      media.state = 'COUNTDOWN';
      render();
      let n = 3;
      media.countdown = setInterval(async () => {
        const el = document.querySelector('[data-countdown]');
        n -= 1;
        if (el) el.textContent = String(n);
        if (n <= 0) {
          clearInterval(media.countdown);
          try { recorder.start(); } catch { recorder.onerror(); return; }
          media.state = 'RECORDING';
          state.elapsed = 0;
          media.startedAt = performance.now();
          await startInputMeter(media);
          media.clock = setInterval(() => {
            state.elapsed = Math.floor((performance.now() - media.startedAt) / 1000);
            const el = document.querySelector('[data-elapsed]');
            if (el) el.textContent = formatDuration(state.elapsed);
          }, 200);
          render();
        }
      }, 1000);
    } catch (error) {
      if (state.media !== media) return;
      resetTransientMedia();
      state.error = ({ NotAllowedError: '麦克风权限被拒绝。请在浏览器设置中允许麦克风后重试；尚未保存录音。', SecurityError: '浏览器出于安全限制无法访问麦克风；请通过安全连接后重试。', NotFoundError: '没有检测到可用麦克风，请连接设备后重试。', NotReadableError: '麦克风当前不可用，可能正被其他应用占用。关闭占用后重试。', OverconstrainedError: '当前麦克风不支持所需设置，请检查设备后重试。' })[error.name] || error.message || '麦克风不可用，请检查设备后重试。';
      state.save = 'ERROR';
      render();
    }
  }
  async function uploadSpeech() {
    if (state.media?.state !== 'REVIEW' || !state.blob?.size) return;
    const item = current();
    const media = state.media;
    media.state = 'UPLOADING';
    media.uploadProgress = null;
    state.error = '';
    state.save = 'SAVING';
    render();
    try {
      // Init is idempotent and renews the signed URL on each retry. Once complete,
      // retry only the binding; never overwrite an already completed object.
      const initialized = await Api.initSimpleRecording({ enrollmentId: state.attempt.enrollmentId, mimeType: state.blob.type, idempotencyKey: state.recordingIdempotencyKey });
      if (['INITIALIZED', 'UPLOADING'].includes(initialized.status)) {
        await Api.uploadBlobToPresignedUrl(initialized.uploadUrl.url, state.blob, {
          mimeType: state.blob.type,
          onProgress: percent => {
            media.uploadProgress = Math.max(0, Math.min(100, Math.floor(percent)));
            const progress = document.querySelector('#runner-upload-progress');
            if (progress) progress.value = media.uploadProgress;
            const label = document.querySelector('[for="runner-upload-progress"]');
            if (label) label.textContent = `已上传 ${media.uploadProgress}%`;
          },
        });
      }
      const stimulus = normalize(item).stimulus || {};
      const completion = { durationMs: state.elapsed * 1000, objectKey: initialized.uploadUrl.objectKey, assessmentItemId: item.id };
      if (stimulus.type !== 'IMAGE') completion.targetText = stimulus.promptText || '';
      await Api.completeSimpleRecording(initialized.id, completion);
      await Api.attachAssessmentRecording(attemptId, item.id, initialized.id);
      const items = await Api.getPracticeAttemptItems(attemptId);
      state.items = Array.isArray(items) ? items : items.items || [];
      if (current()?.recordingId !== initialized.id) throw new Error('服务器尚未确认录音绑定，请重试');
      await draftStore('delete').catch(() => {});
      resetTransientMedia();
      state.error = '';
      state.save = 'SAVED';
      render();
    } catch (error) {
      state.error = `上传尚未确认：${error.message || '网络错误'}。${media.cached ? '本机草稿已保留，可刷新后重试。' : '录音仍在本页，可试听并重试；离开或刷新可能丢失音频。'}`;
      state.save = 'ERROR';
      media.state = 'REVIEW';
      render();
    }
  }
  async function submit() {
    if (state.submitting) return;
    state.submitting = true;
    state.submitConfirm = false;
    state.error = '';
    state.save = 'SAVING';
    render();
    const flushed = await flush();
    if (!flushed) {
      state.submitting = false;
      state.error = '当前答案尚未保存到服务器，请重试保存后再交卷。';
      state.save = 'ERROR';
      render();
      return;
    }
    const incomplete = state.items.filter(item => !complete(item));
    if (incomplete.length) {
      state.submitting = false;
      state.currentIndex = state.items.findIndex(item => !complete(item));
      state.error = `还有 ${incomplete.length} 题未完成，请完成并保存后再交卷。`;
      state.save = 'ERROR';
      render();
      return;
    }
    try {
      for (const item of state.items) {
        if (normalize(item).response?.type === 'CHOICE' || normalize(item).response?.type === 'TEXT') {
          await Api.finalizeWrittenAnswer(attemptId, item.id);
        }
      }
      const result = await Api.submitAssessmentSession(attemptId);
      location.href = result.courseSync?.navigateTo || `/student/practices/attempts/${encodeURIComponent(attemptId)}/processing/`;
    } catch (error) {
      state.submitting = false;
      state.error = error.message || '提交失败';
      state.save = 'ERROR';
      render();
    }
  }
  async function openFeedback() { try { state.feedbackHistory = (await Api.listMyPilotFeedback()).items || []; } catch (error) { state.error = error.message || '反馈记录暂不可用'; } state.feedbackOpen = true; render(); }
  async function submitFeedback() { const message = document.querySelector('[data-feedback-message]')?.value?.trim() || ''; if (message.length < 5) { state.feedbackMessage = message; state.error = '请至少描述 5 个字'; render(); return; } const category = document.querySelector('[data-feedback-category]')?.value || 'OTHER'; try { await Api.createPilotFeedback({ category, message, sessionId: attemptId, assessmentItemId: current()?.id, currentPath: location.pathname }); state.feedbackMessage = ''; state.feedbackHistory = (await Api.listMyPilotFeedback()).items || []; state.save = 'SAVED'; state.feedbackOpen = true; render(); } catch (error) { state.error = error.message || '反馈提交失败'; render(); } }
  function bootFailure(message) {
    app.innerHTML = '<main class="runner-page runner-boot-error"><a href="/student/practices/">返回练习中心</a><h1>练习暂时无法打开</h1><p data-boot-error role="alert"></p><button type="button" class="btn primary" data-boot-retry>重新加载本次练习</button></main>';
    const detail = document.querySelector('[data-boot-error]');
    if (detail) detail.textContent = message;
    document.querySelector('[data-boot-retry]')?.addEventListener('click', () => void boot());
  }
  async function boot() {
    if (!attemptId || !Api?.requireAuth || !Api.requireAuth()) return;
    try {
      const attempt = await Api.getPracticeAttempt(attemptId);
      if (['SUBMITTED', 'PROCESSING', 'FAILED'].includes(attempt.status)) {
        location.href = '/student/practices/attempts/' + encodeURIComponent(attemptId) + '/processing/';
        return;
      }
      if (attempt.status === 'COMPLETED') {
        location.href = '/student/practices/attempts/' + encodeURIComponent(attemptId) + '/report/';
        return;
      }
      if (attempt.status === 'CANCELLED') {
        bootFailure('本次练习已取消，不能继续作答。');
        return;
      }
      const items = await Api.getPracticeAttemptItems(attemptId);
      state.attempt = attempt;
      state.items = Array.isArray(items) ? items : items.items || [];
      if (attempt.status === 'CREATED') state.attempt = await Api.startAssessmentSession(attemptId);
      if (!state.items.length) { bootFailure('服务器没有返回可执行题目，请返回练习中心重试。'); return; }
      await restoreDraft();
      render();
    } catch (error) { bootFailure('加载练习失败：' + (error.message || '网络错误')); }
  }
  addEventListener('pagehide', resetTransientMedia);
  addEventListener('beforeunload', event => { if (state.media || state.blob) { event.preventDefault(); event.returnValue = ''; } });
  boot();
})();
