(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  const typeLabels = { TEXT: '阅读', VIDEO: '视频', AUDIO: '听力', CHOICE: '选择', FILL_BLANK: '填空', SPEECH: '口语' };
  const attainmentLabels = { PENDING: '达标结果处理中', PASSED: '学习达标', NEEDS_PRACTICE: '建议继续练习', NEEDS_REVIEW: '等待老师复核', PROVIDER_UNAVAILABLE: '评分服务暂不可用' };
  const state = { detail: null, assignmentId: '', submissionId: '', activityId: '', activities: [], activity: null, note: null, noteTimer: null, noteSaving: false, recordingUploaded: false };

  function routeParams() {
    const match = location.pathname.match(/^\/student\/courses\/([^/]+)\/submissions\/([^/]+)\/activities\/([^/]+)\/?$/);
    return match ? match.slice(1).map(decodeURIComponent) : null;
  }
  function toast(message) { const el = $('#toast'); el.textContent = message; el.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.hidden = true; }, 2800); }
  function setSync(message, tone = '') { $('#syncState').textContent = message; $('#syncState').dataset.tone = tone; }
  function activityUrl(activityId) { return `/student/courses/${state.assignmentId}/submissions/${state.submissionId}/activities/${activityId}`; }

  async function init() {
    if (!YuzanApi.requireAuth()) return;
    const params = routeParams();
    if (!params) return showError('课程地址无效', '请从课程中心重新进入。');
    [state.assignmentId, state.submissionId, state.activityId] = params;
    try {
      const detail = await YuzanApi.getStudentCourse(state.assignmentId);
      if (detail.existingSubmission?.id !== state.submissionId) throw Object.assign(new Error('课程提交不属于当前学生或已失效'), { status: 403 });
      state.detail = detail;
      state.activities = detail.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities.map((activity) => ({ ...activity, unitTitle: unit.title, lessonTitle: lesson.title }))));
      state.activity = state.activities.find((activity) => activity.id === state.activityId);
      if (!state.activity) throw Object.assign(new Error('活动不属于当前课程'), { status: 404 });
      render();
      $('#loadingState').hidden = true;
      $('#learningShell').hidden = false;
      await loadNote();
    } catch (error) { showError(error.status === 403 ? '没有访问权限' : '课程位置无法恢复', error.message || '请稍后重试。'); }
  }

  function showError(title, message) { $('#loadingState').hidden = true; const el = $('#errorState'); el.hidden = false; el.innerHTML = `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><a href="/student/courses">返回课程中心</a>`; }
  function render() {
    const detail = state.detail; const activity = state.activity; const completion = detail.courseCompletion;
    document.title = `${activity.title}｜${detail.courseVersion.title}`;
    $('#backToCourse').href = `/student/courses/${state.assignmentId}`;
    $('#courseEyebrow').textContent = `${activity.unitTitle} · ${activity.lessonTitle}`;
    $('#courseTitle').textContent = detail.courseVersion.title;
    $('#progressPercent').textContent = `${completion.progressPercent}%`;
    $('#attainmentStatus').textContent = attainmentLabels[completion.attainmentStatus] || '学习中';
    $('#activityType').textContent = typeLabels[activity.type] || activity.type;
    $('#activityTitle').textContent = activity.title;
    $('#activityInstruction').textContent = activity.instruction?.text || '';
    renderPath(); renderContent(); renderPoints();
    const index = state.activities.findIndex((item) => item.id === activity.id);
    $('#previousActivity').disabled = index <= 0;
    $('#previousActivity').onclick = () => { if (index > 0) location.href = activityUrl(state.activities[index - 1].id); };
    $('#completeActivity').textContent = activity.progress?.completed ? (index === state.activities.length - 1 ? '查看课程完成状态' : '下一个活动') : '完成并继续';
    $('#completeActivity').onclick = completeActivity;
  }
  function renderPath() {
    $('#chapterPath').innerHTML = state.activities.map((activity, index) => `<a href="${activityUrl(activity.id)}" class="${activity.id === state.activityId ? 'active' : ''} ${activity.progress?.completed ? 'completed' : ''}"><span>${String(index + 1).padStart(2, '0')}</span><b>${escapeHtml(activity.title)}</b></a>`).join('');
  }
  function renderPoints() {
    const notes = state.activity.studentNotes; const items = notes?.published === true && Array.isArray(notes.items) ? notes.items : [];
    $('#coursePoints').innerHTML = items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><small>${notes.source === 'AI_AUDITED' ? '已审计课程摘要' : '教师发布内容'}</small>` : '<p class="muted">本活动暂未发布课程要点。</p>';
  }
  function renderContent() {
    const activity = state.activity; const content = activity.content || {}; const target = $('#activityContent'); const action = $('#activityAction'); action.innerHTML = '';
    if (activity.practiceReference) {
      target.innerHTML = `<div class="practice-callout"><p class="eyebrow">COURSE_PRACTICE</p><h3>${escapeHtml(activity.practiceReference.title)}</h3><p>使用统一练习执行器完成，结果会关联回当前课程活动。</p></div>`;
      action.innerHTML = '<button type="button" class="primary-button" id="launchPractice">进入课程练习</button>';
      $('#launchPractice').onclick = launchPractice;
      return;
    }
    if (activity.type === 'TEXT') target.innerHTML = (content.paragraphs || []).map((paragraph) => `<p class="reading-paragraph">${escapeHtml(paragraph)}</p>`).join('');
    else if (activity.type === 'AUDIO') target.innerHTML = `<div class="media-block"><audio controls preload="metadata" src="${escapeHtml(content.audioUrl || '')}"></audio>${content.transcript ? `<details><summary>查看听力文本</summary><p>${escapeHtml(content.transcript)}</p></details>` : ''}</div>`;
    else if (activity.type === 'VIDEO') target.innerHTML = `<div class="media-block"><video controls preload="metadata" src="${escapeHtml(content.videoUrl || '')}"></video>${content.caption ? `<p>${escapeHtml(content.caption)}</p>` : ''}</div>`;
    else if (activity.type === 'CHOICE') target.innerHTML = `<fieldset class="answer-field"><legend>${escapeHtml(content.prompt || activity.instruction?.text || '')}</legend>${(content.options || []).map((option, index) => `<label><input type="radio" name="choice" value="${index}"><span>${escapeHtml(option)}</span></label>`).join('')}</fieldset>`;
    else if (activity.type === 'FILL_BLANK') target.innerHTML = `<label class="answer-field"><span>${escapeHtml(content.prompt || '')}</span><textarea id="writtenAnswer" placeholder="${escapeHtml(content.placeholder || '填写答案')}">${escapeHtml(activity.attempt?.value?.answer || '')}</textarea></label>`;
    else if (activity.type === 'SPEECH') {
      target.innerHTML = `<div class="speech-target"><p class="eyebrow">目标文本</p><blockquote>${escapeHtml(content.targetText || '')}</blockquote></div><div id="courseRecorder" class="recorder" data-voice-recorder data-storage-key="yuzan:course:${state.submissionId}:${activity.id}" data-min-seconds="2"></div>`;
      if (window.YuzanVoiceRecorder) $('#courseRecorder').__voiceRecorder = new window.YuzanVoiceRecorder($('#courseRecorder'));
      $('#completeActivity').textContent = activity.progress?.completed ? '下一个活动' : '上传录音并继续';
    } else target.innerHTML = '<p class="muted">当前活动内容暂不可用。</p>';
  }

  async function launchPractice() {
    const button = $('#launchPractice'); button.disabled = true; button.textContent = '正在准备统一练习…';
    try {
      const result = await YuzanApi.createOrResumePractice(state.activity.practiceReference.practiceDefinitionId, { assignmentId: state.assignmentId, submissionId: state.submissionId, activityId: state.activity.id });
      const returnTo = activityUrl(state.activity.id);
      localStorage.setItem(`yuzan-course-practice-context:${result.attemptId}`, JSON.stringify({ assignmentId: state.assignmentId, submissionId: state.submissionId, activityId: state.activity.id, returnTo }));
      location.href = `/student/practices/attempts/${encodeURIComponent(result.attemptId)}/prepare/?returnTo=${encodeURIComponent(returnTo)}`;
    } catch (error) { button.disabled = false; button.textContent = '重试进入课程练习'; toast(error.message || '课程练习准备失败'); }
  }

  function answerPayload() {
    if (state.activity.type === 'CHOICE') { const selected = document.querySelector('input[name="choice"]:checked'); if (!selected) throw new Error('请先选择一个答案'); return { selectedIndex: Number(selected.value) }; }
    if (state.activity.type === 'FILL_BLANK') { const answer = $('#writtenAnswer')?.value.trim(); if (!answer) throw new Error('请先填写答案'); return { answer }; }
    return { acknowledgedAt: new Date().toISOString() };
  }
  async function completeActivity() {
    const activity = state.activity; const index = state.activities.findIndex((item) => item.id === activity.id);
    if (activity.progress?.completed) return goNext(index);
    if (activity.practiceReference) return toast('请先完成课程练习');
    const button = $('#completeActivity'); button.disabled = true;
    try {
      setSync(activity.type === 'SPEECH' ? '正在上传录音…' : '正在保存学习记录…');
      if (activity.type === 'SPEECH') await uploadSpeech();
      else await YuzanApi.saveCourseActivityAttempt(state.assignmentId, state.submissionId, activity.id, { kind: activity.type, value: answerPayload(), completed: true, expectedProgressRevision: activity.progress?.revision ?? 0 });
      setSync('已同步到学习记录', 'success'); activity.progress = { ...(activity.progress || {}), completed: true };
      setTimeout(() => goNext(index), 450);
    } catch (error) { setSync(activity.type === 'SPEECH' ? '上传失败，录音仍保存在本机' : '保存失败，尚未同步', 'error'); toast(error.message || '保存失败'); button.disabled = false; }
  }
  function goNext(index) { if (index < state.activities.length - 1) location.href = activityUrl(state.activities[index + 1].id); else location.href = `/student/courses/${state.assignmentId}`; }
  async function uploadSpeech() {
    const recorder = $('#courseRecorder')?.__voiceRecorder;
    if (!recorder) throw new Error('录音组件尚未就绪');
    if (!recorder.blob) { const completed = await recorder.complete(); if (!completed || !recorder.blob) throw new Error('请先完成录音'); }
    const targetText = state.activity.content?.targetText || '';
    const initialized = await YuzanApi.initSimpleRecording({ enrollmentId: state.detail.existingSubmission.enrollmentId, submissionId: state.submissionId, mimeType: recorder.blob.type || 'audio/webm', idempotencyKey: `course:${state.submissionId}:${state.activity.id}` });
    await YuzanApi.uploadBlobToPresignedUrl(initialized.uploadUrl.url, recorder.blob, { mimeType: recorder.blob.type || 'audio/webm', onProgress: (percent) => setSync(`正在上传录音 ${percent}%`) });
    await YuzanApi.completeSimpleRecording(initialized.id, { durationMs: Math.round(recorder.elapsedMs || 0), objectKey: initialized.uploadUrl.objectKey, targetText });
    await YuzanApi.linkCourseRecording(state.assignmentId, state.submissionId, state.activity.id, initialized.id);
    state.recordingUploaded = true; recorder.setSync?.('synced');
  }

  async function loadNote() {
    const textarea = $('#noteContent'); const label = $('#noteState'); textarea.disabled = true;
    try { state.note = await YuzanApi.getStudentActivityNote(state.activityId); textarea.value = state.note.content || ''; label.textContent = state.note.updatedAt ? '已从云端恢复' : '尚未记录'; textarea.disabled = false; textarea.addEventListener('input', scheduleNoteSave); }
    catch (error) { label.textContent = '读取失败'; label.dataset.tone = 'error'; textarea.placeholder = error.message || '笔记暂时无法读取'; }
  }
  function scheduleNoteSave() { $('#noteState').textContent = '有未保存修改'; $('#noteState').dataset.tone = ''; clearTimeout(state.noteTimer); state.noteTimer = setTimeout(saveNote, 700); }
  async function saveNote() {
    if (state.noteSaving || !state.note) return; state.noteSaving = true; const content = $('#noteContent').value; $('#noteState').textContent = '正在保存…';
    try { const saved = await YuzanApi.saveStudentActivityNote(state.activityId, content, state.note.revision || 0); state.note = saved; $('#noteState').textContent = '已保存'; $('#noteState').dataset.tone = 'success'; }
    catch (error) { $('#noteState').textContent = error.status === 409 ? '版本冲突，请刷新' : '保存失败'; $('#noteState').dataset.tone = 'error'; toast(error.message || '笔记保存失败'); }
    finally { state.noteSaving = false; }
  }
  window.addEventListener('beforeunload', () => { if (state.noteTimer) clearTimeout(state.noteTimer); });
  init();
})();
