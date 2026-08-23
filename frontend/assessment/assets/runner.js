(() => {
  'use strict';
  const Api = window.YuzanApi;
  const app = document.querySelector('#app');
  const parts = location.pathname.split('/').filter(Boolean);
  const attemptId = parts[3] || '';
  const state = { attempt: null, items: [], currentIndex: 0, save: 'IDLE', error: '', timers: new Map(), saves: new Map(), media: null, blob: null, blobUrl: null, elapsed: 0, resourceUrls: new Map(), resourceErrors: new Map(), resolvingResources: new Set() };
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
  const current = () => state.items[state.currentIndex];
  const answerValue = item => item?.studentAnswer?.content?.value ?? '';

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
  function saved(item) { return Boolean(item.recordingId || item.studentAnswer?.content?.value); }
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
    if (state.resourceErrors.has(resourceId)) return `<p class="runner-error">${safe(label)}资源加载失败，请稍后重试。</p>`;
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
      return `<section class="runner-stimulus audio-stimulus">${title}${instruction}${url ? `<audio controls preload="metadata" src="${safe(url)}">浏览器不支持音频播放。</audio>` : resourceStatus(s.resourceId, '音频')}</section>`;
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
      return `<button class="runner-option ${String(answerValue(item)) === String(value) ? 'selected' : ''}" data-choice="${safe(value)}"><b>${safe(option?.key || String.fromCharCode(65 + index))}</b>${image ? `<img src="${safe(image)}" alt="${safe(label || '选项图片')}">` : ''}${imageState}<span>${safe(label || value)}</span></button>`;
    }).join('')}</div>`;
    if (response.type === 'TEXT') return `<div class="runner-text-response"><textarea data-text placeholder="${safe(response.placeholder || '请输入你的答案')}" ${response.maxLength ? `maxlength="${Number(response.maxLength)}"` : ''}>${safe(answerValue(item))}</textarea><p data-save-status>${statusText()}</p></div>`;
    if (response.type === 'SPEECH') return renderSpeech(item);
    return `<p class="runner-error">不支持的作答类型：${safe(response.type)}</p>`;
  }
  function statusText() { return ({ IDLE: '答案会自动保存', DIRTY: '等待保存…', SAVING: '正在保存…', SAVED: '已保存', ERROR: `保存失败：${state.error}` })[state.save] || ''; }
  function resetTransientMedia() {
    if (state.media?.clock) clearInterval(state.media.clock);
    state.media?.stream?.getTracks?.().forEach(track => track.stop());
    if (state.blobUrl) URL.revokeObjectURL(state.blobUrl);
    state.media = null;
    state.blob = null;
    state.blobUrl = null;
    state.elapsed = 0;
  }
  function renderSpeech(item) {
    if (item.recordingId) return '<div class="runner-speech saved"><b>录音已保存</b><p>已成功绑定到本题。</p></div>';
    const phase = state.media?.state || 'IDLE';
    if (phase === 'COUNTDOWN') return `<div class="runner-speech"><b>准备录音</b><strong data-countdown>3</strong></div>`;
    if (phase === 'RECORDING') return `<div class="runner-speech"><b>正在录音</b><strong data-elapsed>${state.elapsed}s</strong><button class="btn" data-stop-recording>停止录音</button></div>`;
    if (phase === 'REVIEW') return `<div class="runner-speech"><b>请试听录音</b><audio controls src="${safe(state.blobUrl)}"></audio><button class="btn" data-rerecord>重录</button><button class="btn primary" data-upload-recording>确认并上传</button></div>`;
    if (phase === 'UPLOADING') return '<div class="runner-speech"><b>正在上传录音…</b></div>';
    return '<div class="runner-speech"><p>首次录音时将请求麦克风权限。</p><button class="btn primary" data-start-recording>开始录音</button></div>';
  }
  function render() {
    const item = current();
    if (!item) { app.innerHTML = '<main class="runner-page"><p class="runner-error">此练习没有可执行题目。</p></main>'; return; }
    const spec = normalize(item); const count = state.items.length;
    app.innerHTML = `<main class="runner-page"><header class="runner-header"><a href="/student/practices/">返回练习中心</a><div><b>统一答题 Runner</b><span>${state.attempt?.status || 'IN_PROGRESS'}</span></div></header><section class="runner-progress"><span>第 ${state.currentIndex + 1} / ${count} 题</span><div><i style="width:${((state.currentIndex + 1) / count) * 100}%"></i></div></section><nav class="runner-map" aria-label="题目导航">${state.items.map((entry, index) => `<button data-go="${index}" class="${index === state.currentIndex ? 'current' : ''} ${saved(entry) ? 'answered' : ''}">${index + 1}</button>`).join('')}</nav><article class="question-shell"><p class="runner-section">${safe(item.sectionTitle || '练习题')}</p>${renderStimulus(spec.stimulus)}<section class="runner-response">${renderResponse(item, spec)}</section></article><footer class="runner-footer"><button class="btn" data-prev ${state.currentIndex ? '' : 'disabled'}>上一题</button><span data-save-state>${safe(statusText())}</span>${state.currentIndex === count - 1 ? '<button class="btn primary" data-submit>检查并提交</button>' : '<button class="btn primary" data-next>下一题</button>'}</footer></main>`;
    bind();
  }
  function save(item, value) {
    const active = state.saves.get(item.id);
    if (active) return active.then(() => String(answerValue(item)) === String(value) ? undefined : save(item, value));
    const pending = (async () => { state.save = 'SAVING'; render(); try { await Api.saveWrittenAnswer(attemptId, item.id, { content: { responseType: normalize(item).response.type, value }, wordCount: 0, charCount: String(value).length }); item.studentAnswer = { content: { responseType: normalize(item).response.type, value } }; state.save = 'SAVED'; } catch (error) { state.error = error.message || '网络错误'; state.save = 'ERROR'; } finally { state.saves.delete(item.id); render(); } })();
    state.saves.set(item.id, pending);
    return pending;
  }
  function flush() { const item = current(); const textarea = document.querySelector('[data-text]'); const timer = state.timers.get(item?.id); if (timer) { clearTimeout(timer); state.timers.delete(item.id); } if (textarea && String(answerValue(item)) !== textarea.value) return save(item, textarea.value); return state.saves.get(item?.id) || Promise.resolve(); }
  async function beginSpeech() { try { const getUserMedia = window.__yuzanRunnerGetUserMedia || navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices); if (!getUserMedia) throw new Error('浏览器不支持麦克风'); const stream = await getUserMedia({ audio: true }); const recorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported('audio/webm') ? { mimeType: 'audio/webm' } : undefined); const chunks = []; recorder.ondataavailable = e => e.data.size && chunks.push(e.data); recorder.onstop = () => { state.blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }); state.blobUrl = URL.createObjectURL(state.blob); state.media = { state: 'REVIEW', stream }; render(); }; state.media = { state: 'COUNTDOWN', stream, recorder }; render(); let n = 3; const timer = setInterval(() => { const el = document.querySelector('[data-countdown]'); if (el) el.textContent = String(--n); if (n <= 0) { clearInterval(timer); recorder.start(); state.media.state = 'RECORDING'; state.elapsed = 0; state.media.clock = setInterval(() => { state.elapsed++; const e = document.querySelector('[data-elapsed]'); if (e) e.textContent = `${state.elapsed}s`; }, 1000); render(); } }, 800); } catch (error) { state.error = '麦克风不可用，请允许浏览器访问麦克风后重试。'; state.save = 'ERROR'; render(); } }
  async function uploadSpeech() { const item = current(); state.media.state = 'UPLOADING'; render(); try { const initialized = await Api.initSimpleRecording({ enrollmentId: state.attempt.enrollmentId, mimeType: state.blob.type || 'audio/webm', idempotencyKey: `runner-${attemptId}-${item.id}` }); await Api.uploadBlobToPresignedUrl(initialized.uploadUrl.url, state.blob, { mimeType: state.blob.type || 'audio/webm' }); const stimulus = normalize(item).stimulus || {}; const completion = { durationMs: state.elapsed * 1000, objectKey: initialized.uploadUrl.objectKey, assessmentItemId: item.id }; if (stimulus.type !== 'IMAGE') completion.targetText = stimulus.promptText || ''; await Api.completeSimpleRecording(initialized.id, completion); await Api.attachAssessmentRecording(attemptId, item.id, initialized.id); item.recordingId = initialized.id; state.media.stream?.getTracks().forEach(track => track.stop()); state.media = null; render(); } catch (error) { state.error = error.message || '录音上传失败'; state.save = 'ERROR'; state.media = { state: 'REVIEW' }; render(); } }
  async function submit() { await flush(); const incomplete = state.items.filter(item => normalize(item).response?.type !== 'NONE' && !saved(item)); if (incomplete.length) { state.error = `还有 ${incomplete.length} 题未完成`; state.save = 'ERROR'; render(); return; } try { for (const item of state.items) if (normalize(item).response?.type === 'CHOICE' || normalize(item).response?.type === 'TEXT') await Api.finalizeWrittenAnswer(attemptId, item.id); await Api.submitAssessmentSession(attemptId); location.href = `/student/practices/attempts/${encodeURIComponent(attemptId)}/processing/`; } catch (error) { state.error = error.message || '提交失败'; state.save = 'ERROR'; render(); } }
  function bind() { document.querySelectorAll('[data-go]').forEach(button => button.onclick = async () => { await flush(); resetTransientMedia(); state.currentIndex = Number(button.dataset.go); render(); }); document.querySelector('[data-prev]')?.addEventListener('click', async () => { await flush(); resetTransientMedia(); state.currentIndex--; render(); }); document.querySelector('[data-next]')?.addEventListener('click', async () => { await flush(); resetTransientMedia(); state.currentIndex++; render(); }); document.querySelectorAll('[data-choice]').forEach(button => button.onclick = () => save(current(), button.dataset.choice)); const textarea = document.querySelector('[data-text]'); textarea?.addEventListener('input', () => { const item = current(); const value = textarea.value; state.save = 'DIRTY'; clearTimeout(state.timers.get(item.id)); state.timers.set(item.id, setTimeout(() => { state.timers.delete(item.id); void save(item, value); }, 700)); document.querySelector('[data-save-status]').textContent = statusText(); document.querySelector('[data-save-state]').textContent = statusText(); }); document.querySelector('[data-start-recording]')?.addEventListener('click', beginSpeech); document.querySelector('[data-stop-recording]')?.addEventListener('click', () => { clearInterval(state.media.clock); state.media.recorder.stop(); }); document.querySelector('[data-rerecord]')?.addEventListener('click', () => { resetTransientMedia(); render(); }); document.querySelector('[data-upload-recording]')?.addEventListener('click', uploadSpeech); document.querySelector('[data-submit]')?.addEventListener('click', submit); }
  async function boot() { if (!attemptId || !Api?.requireAuth || !Api.requireAuth()) return; try { const [attempt, items] = await Promise.all([Api.getPracticeAttempt(attemptId), Api.getPracticeAttemptItems(attemptId)]); state.attempt = attempt; state.items = Array.isArray(items) ? items : items.items || []; if (attempt.status === 'CREATED') { state.attempt = await Api.startAssessmentSession(attemptId); } render(); } catch (error) { app.innerHTML = `<main class="runner-page"><p class="runner-error">加载练习失败：${safe(error.message || '请稍后重试')}</p></main>`; } }
  boot();
})();
