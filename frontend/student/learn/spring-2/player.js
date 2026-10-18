(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const typeLabels = { TEXT: '阅读', VIDEO: '视频', AUDIO: '听力', CHOICE: '选择', FILL_BLANK: '填空', SPEECH: '口语' };
  const terminalRecordingStates = new Set(['COMPLETE', 'PROCESSING', 'READY']);
  const state = {
    detail: null,
    assignmentId: '',
    submissionId: '',
    activityId: '',
    enrollmentId: '',
    activities: [],
    activity: null,
    note: null,
    noteLoaded: false,
    noteTimer: 0,
    noteSavePromise: null,
    noteNeedsSave: false,
    noteDraftVersion: 0,
    noteSubmittedVersion: 0,
    noteConfirmedVersion: 0,
    noteConflict: null,
    noteError: false,
    noteTimedOut: false,
    noteScope: '',
    mediaReady: false,
    mediaEnded: false,
    mediaElement: null,
    mediaLastSavedAt: 0,
    mediaPendingPosition: null,
    mediaSavePromise: null,
    imageRequest: 0,
    activityAvailable: true,
    completing: false,
  };

  function routeParams() {
    const match = location.pathname.match(/^\/student\/courses\/([^/]+)\/submissions\/([^/]+)\/activities\/([^/]+)\/?$/);
    return match ? match.slice(1).map((value) => decodeURIComponent(value)) : null;
  }

  function toast(message) {
    const element = $('#toast');
    element.textContent = message;
    element.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { element.hidden = true; }, 3200);
  }

  function setSync(message, tone = '') {
    const element = $('#syncState');
    element.textContent = message;
    element.dataset.tone = tone;
  }

  function activityUrl(activityId) {
    return `/student/courses/${encodeURIComponent(state.assignmentId)}/submissions/${encodeURIComponent(state.submissionId)}/activities/${encodeURIComponent(activityId)}`;
  }

  function courseUrl() {
    const query = new URLSearchParams({ id: state.assignmentId, activityId: state.activityId, submissionId: state.submissionId });
    return `/student/courses/course-detail/?${query.toString()}`;
  }

  function flattenActivities(detail) {
    return (detail.units || []).flatMap((unit) => (unit.lessons || []).flatMap((lesson) => (lesson.activities || []).map((activity) => ({
      ...activity,
      unitTitle: unit.title || '',
      lessonTitle: lesson.title || '',
    }))));
  }

  function instructionText(instruction) {
    if (typeof instruction === 'string') return instruction;
    if (!instruction || typeof instruction !== 'object') return '';
    return instruction.text || instruction.originalText || instruction.translation || '';
  }

  async function init() {
    if (!window.YuzanApi?.requireAuth()) return;
    const params = routeParams();
    if (!params) {
      showError('课程地址无效', '请从课程中心重新进入。');
      return;
    }
    [state.assignmentId, state.submissionId, state.activityId] = params;

    try {
      const detail = await YuzanApi.getStudentCourse(state.assignmentId);
      if (!detail?.assignment?.id || detail.assignment.id !== state.assignmentId || !detail.courseVersion?.id) {
        throw Object.assign(new Error('课程版本信息不完整，无法恢复学习。'), { status: 404 });
      }
      if (detail.courseVersion.status !== 'PUBLISHED') {
        throw Object.assign(new Error('当前课程版本尚未开放学习。'), { status: 404 });
      }
      const activities = flattenActivities(detail);
      const selected = activities.find((activity) => activity.id === state.activityId);
      if (!selected) throw Object.assign(new Error('该活动不属于当前学生可访问的课程版本。'), { status: 404 });

      if (detail.existingSubmission?.id && detail.existingSubmission.id !== state.submissionId) {
        throw Object.assign(new Error('课程提交已变化，请从课程页面重新进入当前学习记录。'), { status: 409 });
      }
      const submissionResponse = await YuzanApi.createOrResumeCourseSubmission(state.assignmentId);
      const submission = submissionResponse?.submission || submissionResponse;
      if (!submission?.id) throw new Error('服务器没有返回课程 Submission ID。');
      if (submission.id !== state.submissionId) {
        throw Object.assign(new Error('当前活动地址与服务器的课程 Submission 不一致。'), { status: 403 });
      }

      state.detail = detail;
      state.detail.existingSubmission = submission;
      state.assignmentId = detail.assignment.id;
      state.submissionId = submission.id;
      state.enrollmentId = submission.enrollmentId || detail.existingSubmission?.enrollmentId || '';
      state.activities = activities;
      state.activity = selected;
      state.noteScope = `${state.enrollmentId}:${state.activityId}`;

      render();
      $('#loadingState').hidden = true;
      $('#learningShell').hidden = false;
      await loadNote();
    } catch (error) {
      const title = error.status === 401 ? '登录已过期' : error.status === 403 ? '没有访问权限' : error.status === 404 ? '课程活动不可用' : error.status === 409 ? '课程记录已更新' : '课程位置无法恢复';
      showError(title, error.message || '请稍后重试。');
    }
  }

  function showError(title, message) {
    $('#loadingState').hidden = true;
    const element = $('#errorState');
    element.innerHTML = `<p class="eyebrow">课程学习</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><a class="primary-button" href="/student/courses">返回课程中心</a>`;
    element.hidden = false;
  }

  function courseCompletion() {
    return state.detail?.courseCompletion || state.detail?.studentProgress || {};
  }

  function renderProgressSummary() {
    const completion = courseCompletion();
    const percent = Math.max(0, Math.min(100, Number(completion.progressPercent) || 0));
    $('#progressPercent').textContent = `${Math.round(percent)}%`;
    const seal = $('.progress-seal');
    seal.setAttribute('aria-valuenow', String(Math.round(percent)));
    $('#progressRing').style.strokeDashoffset = String(144.5 * (1 - percent / 100));
    $('#attainmentStatus').textContent = completion.attainmentStatus === 'PASSED'
      ? '学习达标'
      : completion.attainmentStatus === 'NEEDS_REVIEW'
        ? '等待老师复核'
        : completion.attainmentStatus === 'NEEDS_PRACTICE'
          ? '建议继续练习'
          : completion.attainmentStatus === 'PROVIDER_UNAVAILABLE'
            ? '评分服务暂不可用'
            : completion.attainmentStatus === 'PENDING'
              ? '达标结果处理中'
              : '课程学习中';
  }

  function render() {
    const detail = state.detail;
    const activity = state.activity;
    document.title = `${activity.title || '课程活动'}｜${detail.courseVersion.title}｜语赞心声`;
    $('#backToCourse').href = courseUrl();
    $('#courseEyebrow').textContent = [activity.unitTitle, activity.lessonTitle].filter(Boolean).join(' · ');
    $('#courseTitle').textContent = detail.courseVersion.title;
    renderCourseCover(detail);
    $('#activityType').textContent = typeLabels[activity.type] || activity.type;
    $('#activityTitle').textContent = activity.title || '课程活动';
    $('#activityInstruction').textContent = instructionText(activity.instruction);
    renderProgressSummary();
    renderPath();
    renderPoints();
    renderContent();
    configureNavigation();
    updateCompletionControl();
    setSync(activity.progress?.completed ? '服务器记录：本活动已完成' : '服务器记录：尚未完成本活动');
  }

  function renderPath() {
    const nav = $('#chapterPath');
    nav.replaceChildren();
    state.activities.forEach((activity, index) => {
      const link = document.createElement('a');
      const completed = activity.progress?.completed === true;
      const active = activity.id === state.activityId;
      link.href = activityUrl(activity.id);
      link.className = `activity-link${active ? ' active' : ''}${completed ? ' completed' : ''}`;
      if (active) link.setAttribute('aria-current', 'step');
      link.setAttribute('aria-label', `第 ${index + 1} 个活动：${activity.title || '未命名活动'}，${completed ? '已完成' : active ? '当前活动' : '未完成'}`);
      const number = document.createElement('span');
      number.className = 'activity-number';
      number.textContent = String(index + 1).padStart(2, '0');
      const title = document.createElement('b');
      title.textContent = activity.title || '未命名活动';
      const stateText = document.createElement('small');
      stateText.textContent = completed ? '已完成' : active ? '正在学习' : '未完成';
      link.append(number, title, stateText);
      nav.appendChild(link);
    });
  }

  function renderPoints() {
    const notes = state.activity.studentNotes;
    const items = notes?.published === true && Array.isArray(notes.items) ? notes.items : [];
    const target = $('#coursePoints');
    target.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = '本活动暂未发布课程要点。';
      target.appendChild(empty);
      return;
    }
    const list = document.createElement('ul');
    items.forEach((item) => {
      const row = document.createElement('li');
      row.textContent = item;
      list.appendChild(row);
    });
    const source = document.createElement('small');
    source.textContent = notes.source === 'AI_AUDITED' ? '已审计课程摘要' : '教师发布内容';
    target.append(list, source);
  }

  function renderCourseCover(detail) {
    const heading = $('#courseHeading');
    const version = detail?.courseVersion || {};
    const preferred = checkedMediaUrl(version.coverAsset || detail?.course?.coverAsset || '');
    const suggested = window.YuzanVisualAssets?.courseCover(version) || '';
    const cover = preferred || checkedMediaUrl(suggested);
    if (cover) heading.style.setProperty('--course-cover', `url(${JSON.stringify(cover)})`);
  }

  function setContentMessage(target, message, tone = 'muted') {
    const paragraph = document.createElement('p');
    paragraph.className = tone;
    paragraph.setAttribute(tone === 'error-copy' ? 'role' : 'aria-live', tone === 'error-copy' ? 'alert' : 'polite');
    paragraph.textContent = message;
    target.appendChild(paragraph);
  }

  function renderContent() {
    const activity = state.activity;
    const content = activity.content && typeof activity.content === 'object' ? activity.content : {};
    const target = $('#activityContent');
    const action = $('#activityAction');
    target.replaceChildren();
    action.replaceChildren();
    state.mediaElement = null;
    state.mediaReady = false;
    state.mediaEnded = false;
    state.activityAvailable = true;
    renderActivityImages(target, activity, content);

    if (activity.practiceReference) {
      const callout = document.createElement('section');
      callout.className = 'practice-callout';
      callout.innerHTML = `<p class="eyebrow">课程练习</p><h3>${escapeHtml(activity.practiceReference.title || '统一练习')}</h3><p>进入现有正式题库执行器。练习 Attempt 由服务器创建，完成后同步回本课程活动。</p>`;
      target.appendChild(callout);
      const launch = document.createElement('button');
      launch.type = 'button';
      launch.className = 'primary-button practice-button';
      launch.id = 'launchPractice';
      launch.textContent = '进入课程练习';
      launch.addEventListener('click', launchPractice);
      action.appendChild(launch);
      return;
    }

    if (activity.type === 'TEXT') {
      const paragraphs = Array.isArray(content.paragraphs) ? content.paragraphs : typeof content.text === 'string' ? [content.text] : [];
      if (!paragraphs.length || paragraphs.every((paragraph) => !String(paragraph).trim())) {
        state.activityAvailable = false;
        setContentMessage(target, '此阅读活动没有可显示的正文，暂时不能标记完成。', 'error-copy');
        return;
      }
      paragraphs.forEach((paragraph) => {
        const element = document.createElement('p');
        element.className = 'reading-paragraph';
        element.textContent = paragraph;
        target.appendChild(element);
      });
      const label = document.createElement('label');
      label.className = 'acknowledgement';
      label.innerHTML = '<input id="textReadAcknowledged" type="checkbox"><span>我已阅读本活动正文</span>';
      action.appendChild(label);
      $('#textReadAcknowledged').addEventListener('change', updateCompletionControl);
      return;
    }

    if (activity.type === 'AUDIO' || activity.type === 'VIDEO') {
      renderMedia(target, activity, content);
      return;
    }

    if (activity.type === 'CHOICE') {
      const options = Array.isArray(content.options) ? content.options : Array.isArray(content.choices) ? content.choices : [];
      if (options.length < 2) {
        state.activityAvailable = false;
        setContentMessage(target, '此选择活动没有有效选项，暂时不能提交。', 'error-copy');
        return;
      }
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'answer-field';
      const legend = document.createElement('legend');
      legend.textContent = content.prompt || instructionText(activity.instruction) || activity.title || '请选择一个答案';
      fieldset.appendChild(legend);
      const previousIndex = Number(activity.attempt?.value?.selectedIndex ?? activity.attempt?.value?.answerIndex);
      options.forEach((option, index) => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'choice';
        input.value = String(index);
        input.checked = Number.isInteger(previousIndex) && previousIndex === index;
        const text = document.createElement('span');
        text.textContent = typeof option === 'string' ? option : option.label || option.text || option.value || '';
        label.append(input, text);
        fieldset.appendChild(label);
      });
      target.appendChild(fieldset);
      target.addEventListener('change', updateCompletionControl, { once: true });
      return;
    }

    if (activity.type === 'FILL_BLANK') {
      const label = document.createElement('label');
      label.className = 'answer-field fill-answer';
      const prompt = document.createElement('span');
      prompt.textContent = content.prompt || instructionText(activity.instruction) || activity.title || '填写答案';
      const textarea = document.createElement('textarea');
      textarea.id = 'writtenAnswer';
      textarea.maxLength = 4000;
      textarea.placeholder = content.placeholder || '填写你的答案';
      const previous = activity.attempt?.value?.answers;
      textarea.value = activity.attempt?.value?.answer || (Array.isArray(previous) ? previous.join('\n') : '');
      label.append(prompt, textarea);
      target.appendChild(label);
      textarea.addEventListener('input', updateCompletionControl);
      return;
    }

    if (activity.type === 'SPEECH') {
      const targetText = String(content.targetText || '').trim();
      if (!targetText) {
        state.activityAvailable = false;
        setContentMessage(target, '此口语活动没有真实目标文本，暂时不能录音提交。', 'error-copy');
        return;
      }
      const prompt = document.createElement('section');
      prompt.className = 'speech-target';
      prompt.innerHTML = `<p class="eyebrow">朗读目标</p><blockquote>${escapeHtml(targetText)}</blockquote>`;
      const recorder = document.createElement('div');
      recorder.id = 'courseRecorder';
      recorder.className = 'recorder';
      recorder.dataset.voiceRecorder = '';
      recorder.dataset.storageKey = `yuzan:course:${state.enrollmentId}:${state.submissionId}:${activity.id}`;
      recorder.dataset.minSeconds = '2';
      target.append(prompt, recorder);
      const help = document.createElement('p');
      help.className = 'note-help recorder-help';
      help.textContent = '录音保存在本机，点击“上传录音并完成”后才会提交到课程。不会生成自动转写。';
      target.appendChild(help);
      if (window.YuzanVoiceRecorder) recorder.__voiceRecorder = new window.YuzanVoiceRecorder(recorder);
      recorder.addEventListener('recorder:state', (event) => {
        if (event.detail.state === 'error') setSync('麦克风不可用，请检查权限后重试。', 'error');
        if (event.detail.state === 'recorded') setSync('录音保存在本机；尚未上传。');
        updateCompletionControl();
      });
      return;
    }

    setContentMessage(target, '当前活动类型不受支持，无法提交学习记录。', 'error-copy');
  }

  function imageEntries(activity, content) {
    const entries = [];
    const listed = Array.isArray(content.images) ? content.images : [];
    const candidates = content.imageUrl ? [{ url: content.imageUrl, altText: content.imageAlt, caption: content.imageCaption }] : [];
    listed.forEach((item) => candidates.push(typeof item === 'string' ? { url: item } : item));
    candidates.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const url = item.url || item.src;
      if (!url) return;
      entries.push({ url, altText: item.altText || item.alt || content.imageAlt || '课程内容图片', caption: item.caption || '' });
    });

    (Array.isArray(activity.resources) ? activity.resources : []).forEach((link) => {
      const resource = link?.resource || link;
      if (!resource || typeof resource !== 'object') return;
      const kind = String(resource.kind || resource.type || '').toUpperCase();
      const mediaType = String(resource.mediaType || resource.mimeType || '').toLowerCase();
      if (kind !== 'IMAGE' && !mediaType.startsWith('image/')) return;
      if (!resource.id) return;
      entries.push({
        resourceId: resource.id,
        altText: resource.altText || link?.meta?.altText || '课程内容图片',
        caption: resource.caption || link?.meta?.caption || '',
      });
    });

    const seen = new Set();
    return entries.filter((entry) => {
      const key = entry.resourceId ? `resource:${entry.resourceId}` : `url:${entry.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function renderActivityImages(target, activity, content) {
    const entries = imageEntries(activity, content);
    if (!entries.length) return;
    const requestId = ++state.imageRequest;
    const gallery = document.createElement('div');
    gallery.className = 'course-content-images';
    gallery.setAttribute('aria-label', '课程内容图片');
    target.appendChild(gallery);

    entries.forEach((entry) => {
      const figure = document.createElement('figure');
      figure.className = 'course-content-image-card';
      figure.setAttribute('aria-busy', 'true');
      const image = document.createElement('img');
      image.className = 'course-content-image';
      image.alt = entry.altText;
      image.decoding = 'async';
      image.loading = 'eager';
      const status = document.createElement('p');
      status.className = 'course-image-state';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.textContent = '正在读取课程图片…';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'quiet-button course-image-retry';
      retry.textContent = '重新读取图片';
      retry.hidden = true;
      const caption = document.createElement('figcaption');
      caption.textContent = entry.caption;
      caption.hidden = !entry.caption;
      figure.append(image, status, retry, caption);
      gallery.appendChild(figure);

      const showError = (message) => {
        if (requestId !== state.imageRequest || !figure.isConnected) return;
        figure.setAttribute('aria-busy', 'false');
        status.textContent = message;
        status.dataset.tone = 'error';
        status.setAttribute('role', 'alert');
        retry.hidden = false;
      };
      const load = async () => {
        retry.disabled = true;
        retry.hidden = true;
        status.textContent = '正在读取课程图片…';
        delete status.dataset.tone;
        status.setAttribute('role', 'status');
        try {
          let source = entry.url;
          if (entry.resourceId) {
            let timeoutId;
            try {
              const playback = await Promise.race([
                YuzanApi.getResourcePlaybackUrl(entry.resourceId),
                new Promise((resolve) => {
                  timeoutId = window.setTimeout(() => resolve({ timedOut: true }), 12000);
                }),
              ]);
              if (playback?.timedOut) throw new Error('读取授权图片超时，请重试。');
              source = playback?.url;
            } finally {
              window.clearTimeout(timeoutId);
            }
          }
          if (requestId !== state.imageRequest || !figure.isConnected) return;
          const url = checkedMediaUrl(source);
          if (!url) throw new Error('课程图片没有有效的授权地址。');
          image.src = url;
        } catch (error) {
          showError(error.message || '读取课程图片失败。');
        } finally {
          retry.disabled = false;
        }
      };
      image.addEventListener('load', () => {
        if (requestId !== state.imageRequest || !figure.isConnected) return;
        figure.setAttribute('aria-busy', 'false');
        status.remove();
        retry.hidden = true;
      });
      image.addEventListener('error', () => showError('课程图片加载失败，请重新读取授权资源。'));
      retry.addEventListener('click', () => { void load(); });
      void load();
    });

  }

  function mediaResource(activity, content) {
    const links = Array.isArray(activity.resources) ? activity.resources : [];
    const audio = activity.type === 'AUDIO';
    const requestedId = audio ? content.audioResourceId || content.resourceId : content.videoResourceId || content.resourceId;
    if (requestedId) return { id: requestedId };
    const link = links.find((candidate) => {
      const resource = candidate.resource || candidate;
      const kind = String(resource.kind || resource.type || '').toUpperCase();
      const mediaType = String(resource.mediaType || resource.mimeType || '').toLowerCase();
      return audio ? kind === 'AUDIO' || mediaType.startsWith('audio/') : kind === 'VIDEO' || mediaType.startsWith('video/');
    });
    return link ? link.resource || link : null;
  }

  function checkedMediaUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value, location.origin);
      return url.origin === location.origin || url.protocol === 'https:' || (location.protocol === 'http:' && url.protocol === 'http:') ? url.href : '';
    } catch {
      return '';
    }
  }

  function renderMedia(target, activity, content) {
    const resource = mediaResource(activity, content);
    const mediaUrl = activity.type === 'AUDIO'
      ? checkedMediaUrl(content.audioUrl || content.mediaUrl || activity.audioUrl)
      : checkedMediaUrl(content.videoUrl || content.mediaUrl || activity.videoUrl);
    if (!resource?.id && !mediaUrl) {
      state.activityAvailable = false;
      setContentMessage(target, activity.type === 'AUDIO' ? '此听力活动没有可访问的真实音频资源。' : '此视频活动没有可访问的授权视频资源。', 'error-copy');
      return;
    }

    const figure = document.createElement('figure');
    figure.className = `media-block media-${activity.type.toLowerCase()}`;
    const caption = document.createElement('figcaption');
    caption.textContent = activity.type === 'AUDIO'
      ? '听完完整音频后，可保存本活动进度。'
      : String(content.caption || content.description || '观看完整视频后，可保存本活动进度。');
    const player = document.createElement(activity.type === 'AUDIO' ? 'audio' : 'video');
    player.controls = true;
    player.preload = 'metadata';
    player.setAttribute('aria-label', activity.type === 'AUDIO' ? `播放：${activity.title || '课程音频'}` : `播放：${activity.title || '课程视频'}`);
    if (activity.type === 'VIDEO') player.playsInline = true;
    const stateText = document.createElement('p');
    stateText.className = 'media-state';
    stateText.setAttribute('role', 'status');
    stateText.setAttribute('aria-live', 'polite');
    stateText.textContent = resource?.id ? '正在读取授权媒体…' : '正在准备媒体…';
    figure.append(player, caption, stateText);
    target.appendChild(figure);
    state.mediaElement = player;
    player.addEventListener('loadedmetadata', () => {
      state.mediaReady = true;
      state.activityAvailable = true;
      stateText.textContent = '媒体已就绪';
      const position = Number(activity.progress?.position) || 0;
      if (!activity.progress?.completed && position > 0 && position < 1 && Number.isFinite(player.duration)) {
        try { player.currentTime = Math.min(player.duration * position, Math.max(0, player.duration - 0.25)); } catch {}
      }
      updateCompletionControl();
    });
    player.addEventListener('timeupdate', () => {
      if (!state.mediaReady || !Number.isFinite(player.duration) || player.duration <= 0) return;
      const now = Date.now();
      if (now - state.mediaLastSavedAt < 9000) return;
      state.mediaLastSavedAt = now;
      void saveMediaPosition(Math.max(0, Math.min(0.999, player.currentTime / player.duration)));
    });
    player.addEventListener('ended', () => {
      state.mediaEnded = true;
      stateText.textContent = '媒体播放完毕；请保存活动完成状态。';
      void saveMediaPosition(1);
      updateCompletionControl();
    });
    player.addEventListener('error', () => {
      state.mediaReady = false;
      stateText.textContent = '媒体加载失败，请重试授权资源。';
      stateText.dataset.tone = 'error';
      updateCompletionControl();
      let retry = figure.querySelector('.media-retry');
      if (!retry) {
        retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'quiet-button media-retry';
        retry.textContent = '重新加载媒体';
        retry.addEventListener('click', () => {
          retry.disabled = true;
          stateText.textContent = resource?.id ? '正在重新读取授权媒体…' : '正在重新加载媒体…';
          delete stateText.dataset.tone;
          if (resource?.id) loadResourcePlayback(resource.id, player, stateText, activity.id).finally(() => { retry.disabled = false; });
          else { player.load(); retry.disabled = false; }
        });
        figure.appendChild(retry);
      }
    });
    if (mediaUrl) {
      player.src = mediaUrl;
      player.load();
    } else {
      loadResourcePlayback(resource.id, player, stateText, activity.id);
    }
  }

  async function loadResourcePlayback(resourceId, player, status, activityId) {
    try {
      const playback = await YuzanApi.getResourcePlaybackUrl(resourceId);
      if (state.activityId !== activityId || player !== state.mediaElement) return;
      const url = checkedMediaUrl(playback?.url);
      if (!url) throw new Error('授权接口没有返回可播放的媒体地址。');
      player.src = url;
      player.load();
    } catch (error) {
      if (state.activityId !== activityId) return;
      status.textContent = error.message || '读取授权媒体失败。';
      status.dataset.tone = 'error';
      state.activityAvailable = false;
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'quiet-button media-retry';
      retry.textContent = '重新读取媒体';
      retry.addEventListener('click', () => {
        retry.disabled = true;
        status.textContent = '正在重新读取授权媒体…';
        delete status.dataset.tone;
        loadResourcePlayback(resourceId, player, status, activityId).finally(() => { retry.disabled = false; });
      });
      status.insertAdjacentElement('afterend', retry);
    }
  }

  function configureNavigation() {
    const index = state.activities.findIndex((item) => item.id === state.activityId);
    const previous = $('#previousActivity');
    previous.disabled = index <= 0;
    previous.onclick = () => { if (index > 0) void navigateToActivity(state.activities[index - 1].id); };
    const back = $('#backToCourse');
    back.addEventListener('click', (event) => {
      event.preventDefault();
      void navigateAway(courseUrl());
    });
    $('#chapterPath').addEventListener('click', (event) => {
      const link = event.target.closest('a.activity-link');
      if (!link) return;
      event.preventDefault();
      const nextId = decodeURIComponent(new URL(link.href).pathname.split('/').at(-1));
      if (nextId !== state.activityId) void navigateToActivity(nextId);
    });
  }

  function updateCompletionControl() {
    const button = $('#completeActivity');
    const activity = state.activity;
    if (!button || !activity) return;
    const index = state.activities.findIndex((item) => item.id === state.activityId);
    if (activity.practiceReference && activity.progress?.completed !== true) {
      button.hidden = true;
      return;
    }
    button.hidden = false;
    if (activity.progress?.completed === true) {
      button.disabled = false;
      button.textContent = index === state.activities.length - 1 ? '返回课程' : '下一个活动';
      button.onclick = () => void goNext(index);
      return;
    }
    button.textContent = activity.type === 'SPEECH' ? '上传录音并完成' : '保存完成状态';
    button.onclick = completeActivity;
    let ready = state.activityAvailable;
    if (activity.practiceReference) ready = false;
    if (activity.type === 'TEXT') ready = Boolean($('#textReadAcknowledged')?.checked);
    if (activity.type === 'CHOICE') ready = Boolean($('input[name="choice"]:checked'));
    if (activity.type === 'FILL_BLANK') ready = Boolean($('#writtenAnswer')?.value.trim());
    if (activity.type === 'AUDIO' || activity.type === 'VIDEO') ready = state.mediaReady && state.mediaEnded;
    if (activity.type === 'SPEECH') {
      const recorder = $('#courseRecorder')?.__voiceRecorder;
      ready = Boolean(recorder && (recorder.blob || ['recording', 'paused', 'recorded'].includes(recorder.state)));
    }
    button.disabled = !ready || state.completing;
  }

  function answerPayload() {
    const activity = state.activity;
    if (activity.type === 'TEXT') return { acknowledged: true };
    if (activity.type === 'CHOICE') {
      const selected = $('input[name="choice"]:checked');
      if (!selected) throw new Error('请先选择一个答案。');
      return { selectedIndex: Number(selected.value) };
    }
    if (activity.type === 'FILL_BLANK') {
      const answer = $('#writtenAnswer')?.value.trim();
      if (!answer) throw new Error('请先填写答案。');
      return { answers: [answer] };
    }
    if (activity.type === 'AUDIO' || activity.type === 'VIDEO') {
      if (!state.mediaEnded) throw new Error('请先播放完整媒体内容。');
      return { acknowledged: true, listenedToEnd: true };
    }
    return { acknowledged: true };
  }

  async function completeActivity() {
    if (state.completing) return;
    const activity = state.activity;
    if (activity.progress?.completed === true) {
      const index = state.activities.findIndex((item) => item.id === state.activityId);
      return goNext(index);
    }
    if (activity.practiceReference) return;
    state.completing = true;
    updateCompletionControl();
    try {
      setSync(activity.type === 'SPEECH' ? '正在确认录音和 MinIO 对象…' : '正在保存活动并确认服务器进度…');
      if (activity.type === 'SPEECH') {
        await uploadSpeech();
      } else {
        await waitForMediaSave();
        const result = await YuzanApi.saveCourseActivityAttempt(state.assignmentId, state.submissionId, activity.id, {
          kind: activity.type,
          value: answerPayload(),
          completed: true,
          ...(activity.type === 'AUDIO' || activity.type === 'VIDEO' ? { videoPosition: 1 } : {}),
          expectedProgressRevision: activity.progress?.revision ?? 0,
        });
        if (result?.progress) activity.progress = result.progress;
        if (result?.courseCompletion) state.detail.courseCompletion = result.courseCompletion;
      }
      await refreshCourseFromServer();
      if (state.activity.progress?.completed !== true) throw new Error('服务器尚未确认本活动完成，进度保持未完成。');
      renderPath();
      renderProgressSummary();
      setSync('服务器已保存：本活动已完成。', 'success');
    } catch (error) {
      if (error.status === 409) {
        try {
          await refreshCourseFromServer();
          setSync(state.activity.progress?.completed ? '服务器已记录完成状态。' : '检测到其他页面更新，已读取服务器进度；请核对后再试。', state.activity.progress?.completed ? 'success' : 'error');
        } catch (refreshError) {
          setSync('版本冲突，无法读取最新进度；没有覆盖服务器记录。', 'error');
          toast(refreshError.message || error.message || '读取最新学习进度失败。');
        }
      } else {
        setSync(activity.type === 'SPEECH'
          ? error.code === 'COURSE_RECORDING_LINK_FAILED'
            ? error.message
            : '上传失败，原录音仍保存在本机；重试会恢复同一 Recording。'
          : error.message || '保存失败，服务器尚未确认。', 'error');
        toast(error.message || '活动保存失败。');
      }
    } finally {
      state.completing = false;
      updateCompletionControl();
    }
  }

  async function refreshCourseFromServer() {
    const detail = await YuzanApi.getStudentCourse(state.assignmentId);
    if (detail?.existingSubmission?.id !== state.submissionId) {
      throw Object.assign(new Error('服务器当前课程提交已变化，请返回课程重新进入。'), { status: 409 });
    }
    state.detail = detail;
    state.activities = flattenActivities(detail);
    const latest = state.activities.find((item) => item.id === state.activityId);
    if (!latest) throw Object.assign(new Error('活动已不在当前课程版本中。'), { status: 404 });
    state.activity = latest;
    renderProgressSummary();
    renderPath();
  }

  async function saveMediaPosition(position) {
    if (!state.activity || state.activity.progress?.completed || !state.mediaReady) return;
    state.mediaPendingPosition = position;
    if (state.mediaSavePromise) return state.mediaSavePromise;
    state.mediaSavePromise = (async () => {
      while (state.mediaPendingPosition != null) {
        const nextPosition = state.mediaPendingPosition;
        state.mediaPendingPosition = null;
        try {
          const result = await YuzanApi.saveCourseActivityAttempt(state.assignmentId, state.submissionId, state.activity.id, {
            kind: state.activity.type,
            value: { position: nextPosition },
            completed: false,
            videoPosition: nextPosition,
            expectedProgressRevision: state.activity.progress?.revision ?? 0,
          });
          if (result?.progress) state.activity.progress = result.progress;
          if (result?.courseCompletion) state.detail.courseCompletion = result.courseCompletion;
          setSync('播放进度已保存到课程。', 'success');
        } catch (error) {
          if (error.status === 409) {
            try {
              await refreshCourseFromServer();
              setSync('播放进度发生版本冲突，已读取服务器状态。', 'error');
            } catch (refreshError) {
              setSync(refreshError.message || '无法读取最新播放进度。', 'error');
            }
          } else {
            setSync(error.message || '播放进度暂未保存。', 'error');
          }
          return;
        }
      }
    })().finally(() => { state.mediaSavePromise = null; });
    return state.mediaSavePromise;
  }

  async function waitForMediaSave() {
    if (state.mediaSavePromise) await state.mediaSavePromise;
  }

  async function uploadSpeech() {
    const recorder = $('#courseRecorder')?.__voiceRecorder;
    if (!recorder) throw new Error('录音组件尚未就绪。');
    if (!recorder.blob) {
      const recorded = await recorder.complete();
      if (!recorded) throw new Error('请先录制至少两秒；麦克风拒绝时可检查权限后重试。');
      await waitForRecorderBlob(recorder);
    }
    if (!state.enrollmentId) throw new Error('课程 Submission 缺少 Enrollment ID，无法安全关联录音。');

    const targetText = state.activity.content?.targetText || '';
    const idempotencyKey = `course:${state.submissionId}:${state.activity.id}`;
    let initialized = await YuzanApi.initSimpleRecording({
      enrollmentId: state.enrollmentId,
      submissionId: state.submissionId,
      mimeType: recorder.blob.type || 'audio/webm',
      idempotencyKey,
    });
    if (!initialized?.id || !initialized.uploadUrl?.objectKey) throw new Error('录音初始化未返回 Recording ID 或 objectKey。');
    const recordingId = initialized.id;
    const completePayload = { durationMs: Math.round(recorder.elapsedMs || 0), objectKey: initialized.uploadUrl.objectKey, targetText };
    let confirmed = terminalRecordingStates.has(initialized.status);

    if (!confirmed) {
      try {
        const completed = await YuzanApi.completeSimpleRecording(recordingId, completePayload);
        confirmed = terminalRecordingStates.has(completed?.status);
        if (!confirmed) throw new Error('服务器没有确认录音完成状态。');
      } catch (error) {
        if (!isMissingRecordingObject(error)) throw error;
        setSync('原录音记录已恢复；正在补传同一 Recording 对象…');
        try {
          await YuzanApi.uploadBlobToPresignedUrl(initialized.uploadUrl.url, recorder.blob, {
            mimeType: recorder.blob.type || 'audio/webm',
            onProgress: (percent) => setSync(`正在上传原录音 ${percent}%`),
          });
        } catch (uploadError) {
          if (uploadError.status !== 403) throw uploadError;
          initialized = await YuzanApi.initSimpleRecording({
            enrollmentId: state.enrollmentId,
            submissionId: state.submissionId,
            mimeType: recorder.blob.type || 'audio/webm',
            idempotencyKey,
          });
          if (initialized.id !== recordingId) throw new Error('录音重试返回了不同的 Recording ID，已停止以避免重复记录。');
          if (terminalRecordingStates.has(initialized.status)) {
            confirmed = true;
          } else {
            await YuzanApi.uploadBlobToPresignedUrl(initialized.uploadUrl.url, recorder.blob, {
              mimeType: recorder.blob.type || 'audio/webm',
              onProgress: (percent) => setSync(`正在重试原录音 ${percent}%`),
            });
          }
        }
        if (!confirmed) {
          const completed = await YuzanApi.completeSimpleRecording(recordingId, completePayload);
          confirmed = terminalRecordingStates.has(completed?.status);
        }
        if (!confirmed) throw new Error('MinIO 对象已上传，但服务器未确认 Recording 完成。请重试恢复原录音。');
      }
    } else {
      const completed = await YuzanApi.completeSimpleRecording(recordingId, completePayload);
      confirmed = terminalRecordingStates.has(completed?.status);
    }

    if (!confirmed) throw new Error('Recording 尚未进入可关联状态。');
    const persisted = await YuzanApi.getRecordingStatus(recordingId);
    if (!terminalRecordingStates.has(persisted?.status) || persisted?.objectKey !== completePayload.objectKey) {
      throw new Error('服务器 Recording 状态或 objectKey 与本次上传不一致，活动没有标记完成。');
    }
    let linked;
    try {
      linked = await YuzanApi.linkCourseRecording(state.assignmentId, state.submissionId, state.activity.id, recordingId);
    } catch (cause) {
      const error = new Error(`Recording ${recordingId} 已完成上传，但课程活动关联失败；重试会恢复同一 Recording。`);
      error.code = 'COURSE_RECORDING_LINK_FAILED';
      error.status = cause?.status || 0;
      throw error;
    }
    if (!linked?.synced) throw new Error('Recording 已完成，但课程活动关联尚未获服务器确认。请重试关联原录音。');
    $('#courseRecorder')?.__voiceRecorder?.setSync?.('synced');
  }

  async function waitForRecorderBlob(recorder) {
    const deadline = Date.now() + 8000;
    while (!recorder.blob && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 80));
    if (!recorder.blob) throw new Error('浏览器尚未生成录音文件；请保留录音并重试上传。');
  }

  function isMissingRecordingObject(error) {
    return [400, 409].includes(error?.status) && /上传文件不存在/.test(error.message || '');
  }

  async function launchPractice() {
    const button = $('#launchPractice');
    if (!button || button.disabled) return;
    button.disabled = true;
    button.textContent = '正在准备正式练习…';
    try {
      if (!state.activity.practiceReference?.practiceDefinitionId) throw new Error('课程活动缺少服务器 Practice Reference。');
      const result = await YuzanApi.createOrResumePractice(state.activity.practiceReference.practiceDefinitionId, {
        assignmentId: state.assignmentId,
        submissionId: state.submissionId,
        activityId: state.activity.id,
      });
      const attemptId = result?.attemptId || result?.id;
      if (!attemptId) throw new Error('练习 API 没有返回真实 Attempt ID。');
      const returnTo = courseUrl();
      localStorage.setItem(`yuzan-course-practice-context:${attemptId}`, JSON.stringify({
        assignmentId: state.assignmentId,
        submissionId: state.submissionId,
        activityId: state.activity.id,
        returnTo,
      }));
      location.href = `/student/practices/attempts/${encodeURIComponent(attemptId)}/prepare/?returnTo=${encodeURIComponent(returnTo)}`;
    } catch (error) {
      button.disabled = false;
      button.textContent = '重试进入课程练习';
      setSync(error.message || '正式练习启动失败。', 'error');
      toast(error.message || '课程练习准备失败。');
    }
  }

  async function loadNote() {
    const textarea = $('#noteContent');
    const label = $('#noteState');
    textarea.disabled = true;
    try {
      state.note = await YuzanApi.getStudentActivityNote(state.activityId);
      state.note = normalizeNote(state.note);
      state.noteLoaded = true;
      state.noteDraftVersion = 0;
      state.noteConfirmedVersion = 0;
      textarea.value = state.note.content;
      textarea.disabled = false;
      textarea.addEventListener('input', scheduleNoteSave);
      label.textContent = state.note.updatedAt ? '已从云端恢复' : '尚未记录';
      $('#useServerNote').addEventListener('click', useServerNote);
      $('#saveMyNote').addEventListener('click', saveMyNote);
      $('#retryNoteSave').addEventListener('click', () => { state.noteError = false; scheduleNoteSave(true); });
    } catch (error) {
      label.textContent = error.status === 403 || error.status === 404 ? '无权读取' : '读取失败';
      label.dataset.tone = 'error';
      textarea.placeholder = error.message || '笔记暂时无法读取';
      textarea.disabled = true;
    }
  }

  function normalizeNote(note) {
    return {
      ...(note || {}),
      content: typeof note?.content === 'string' ? note.content : '',
      revision: Number.isInteger(note?.revision) ? note.revision : 0,
    };
  }

  function noteIsCurrentAndSaved() {
    return noteContentConfirmed() && !state.noteSavePromise;
  }

  function noteContentConfirmed() {
    return state.noteLoaded && state.noteConfirmedVersion === state.noteDraftVersion
      && !state.noteNeedsSave && !state.noteConflict && !state.noteError
      && $('#noteContent').value === state.note?.content;
  }

  function setNoteState(message, tone = '') {
    const label = $('#noteState');
    label.textContent = message;
    label.dataset.tone = tone;
    const recovery = $('#noteRecovery');
    recovery.hidden = !state.noteConflict;
    $('#retryNoteSave').hidden = !state.noteError || Boolean(state.noteConflict);
  }

  function scheduleNoteSave(immediate = false) {
    if (!state.noteLoaded) return;
    state.noteDraftVersion += 1;
    state.noteNeedsSave = true;
    state.noteError = false;
    state.noteTimedOut = false;
    setNoteState('有未保存修改');
    clearTimeout(state.noteTimer);
    if (state.noteSavePromise) state.noteNeedsSave = true;
    state.noteTimer = setTimeout(() => { void saveNote(); }, immediate ? 0 : 700);
  }

  async function withNoteLock(callback) {
    if (!navigator.locks?.request || !state.noteScope) return callback(false);
    return navigator.locks.request(`yuzan-student-note:${state.noteScope}`, { mode: 'exclusive' }, () => callback(true));
  }

  async function saveNote() {
    clearTimeout(state.noteTimer);
    if (!state.noteLoaded || state.noteConflict || !state.noteNeedsSave) return noteIsCurrentAndSaved();
    if (state.noteSavePromise) return state.noteSavePromise;
    state.noteSavePromise = (async () => {
      while (state.noteNeedsSave && !state.noteConflict) {
        state.noteNeedsSave = false;
        const textarea = $('#noteContent');
        const content = textarea.value;
        const draftVersion = state.noteDraftVersion;
        state.noteSubmittedVersion = draftVersion;
        setNoteState(state.noteTimedOut ? '保存请求超时，正在核对服务器…' : '正在保存…');
        try {
          await withNoteLock(async () => {
            const latest = normalizeNote(await YuzanApi.getStudentActivityNote(state.activityId));
            if (latest.revision !== state.note.revision && latest.content !== state.note.content) {
              if (latest.content === textarea.value) {
                state.note = latest;
                state.noteConfirmedVersion = state.noteDraftVersion;
                state.noteNeedsSave = false;
                return;
              }
              setNoteConflict(latest, '云端笔记已在其他页面更新。本页草稿仍保留，请选择采用云端版本或明确保存本页草稿。');
              return;
            }
            state.note = latest;
            if (content === latest.content) {
              if (textarea.value === content) {
                state.noteConfirmedVersion = draftVersion;
                state.noteNeedsSave = false;
                state.noteError = false;
                setNoteState('已保存', 'success');
              } else {
                state.noteNeedsSave = true;
              }
              return;
            }

            let timedOut = false;
            const timeout = setTimeout(() => {
              timedOut = true;
              state.noteTimedOut = true;
              setNoteState('保存请求超时，正在核对服务器…', 'error');
              void reconcileUncertainNoteSave(content);
            }, 12000);
            try {
              const saved = normalizeNote(await YuzanApi.saveStudentActivityNote(state.activityId, content, latest.revision));
              state.noteTimedOut = false;
              state.noteError = false;
              if (saved.revision >= state.note.revision) state.note = saved;
              const visible = textarea.value;
              if (visible === saved.content) {
                state.noteConfirmedVersion = state.noteDraftVersion;
                state.noteNeedsSave = false;
                setNoteState('已保存', 'success');
              } else {
                state.noteNeedsSave = true;
                setNoteState('正在保存最新修改…');
              }
            } catch (error) {
              if (error.status === 409) {
                const current = normalizeNote(await YuzanApi.getStudentActivityNote(state.activityId));
                if (current.content === textarea.value) {
                  state.note = current;
                  state.noteConfirmedVersion = state.noteDraftVersion;
                  state.noteNeedsSave = false;
                  setNoteState('已保存', 'success');
                } else {
                  setNoteConflict(current, '笔记版本冲突。本页草稿仍保留，服务器内容已重新读取；请选择如何处理。');
                }
              } else {
                await reconcileUncertainNoteSave(content);
                if (!noteContentConfirmed()) {
                  state.noteError = true;
                  state.noteNeedsSave = true;
                  setNoteState(error.message || '保存失败；本页文字仍未确认写入服务器。', 'error');
                  toast(error.message || '笔记保存失败，请重试。');
                }
              }
            } finally {
              clearTimeout(timeout);
              if (timedOut && !noteContentConfirmed()) state.noteTimedOut = true;
            }
          });
        } catch (error) {
          state.noteError = true;
          state.noteNeedsSave = true;
          setNoteState(error.message || '笔记保存失败；本页文字尚未确认写入服务器。', 'error');
          toast(error.message || '笔记保存失败，请重试。');
          break;
        }
        if (state.noteConflict || state.noteError) break;
        if (state.noteNeedsSave && draftVersion === state.noteDraftVersion) break;
      }
      if (noteContentConfirmed()) setNoteState('已保存', 'success');
      else if (state.noteConflict) setNoteState('存在其他页面的更新', 'error');
      else if (state.noteError) setNoteState('保存失败；本页草稿未确认', 'error');
      return noteContentConfirmed();
    })().finally(() => { state.noteSavePromise = null; });
    return state.noteSavePromise;
  }

  async function reconcileUncertainNoteSave(requestedContent) {
    try {
      const current = normalizeNote(await YuzanApi.getStudentActivityNote(state.activityId));
      if (current.content === $('#noteContent').value) {
        state.note = current;
        state.noteConfirmedVersion = state.noteDraftVersion;
        state.noteNeedsSave = false;
        state.noteError = false;
        state.noteTimedOut = false;
        setNoteState('已保存', 'success');
      } else if (current.content !== state.note?.content && requestedContent !== $('#noteContent').value) {
        setNoteConflict(current, '服务器已有其他版本；本页新输入仍保留，未覆盖云端笔记。');
      } else {
        state.note = current;
        state.noteNeedsSave = true;
        state.noteError = true;
        setNoteState('服务器尚未确认本页文字；请重试保存。', 'error');
      }
    } catch {
      state.noteNeedsSave = true;
      state.noteError = true;
      setNoteState('无法核对服务器状态；本页文字仍未确认保存。', 'error');
    }
  }

  function setNoteConflict(serverNote, message) {
    state.noteConflict = normalizeNote(serverNote);
    state.note = normalizeNote(serverNote);
    state.noteNeedsSave = true;
    state.noteError = false;
    $('#noteConflictMessage').textContent = message;
    $('#noteRecovery').hidden = false;
    $('#retryNoteSave').hidden = true;
    setNoteState('云端已更新，保留本页草稿', 'error');
  }

  function useServerNote() {
    if (!state.noteConflict) return;
    const textarea = $('#noteContent');
    textarea.value = state.noteConflict.content;
    state.note = state.noteConflict;
    state.noteConflict = null;
    state.noteNeedsSave = false;
    state.noteError = false;
    state.noteDraftVersion += 1;
    state.noteConfirmedVersion = state.noteDraftVersion;
    $('#noteRecovery').hidden = true;
    setNoteState(state.note.updatedAt ? '已从云端恢复' : '尚未记录', state.note.updatedAt ? 'success' : '');
  }

  function saveMyNote() {
    if (!state.noteConflict) return;
    state.note = state.noteConflict;
    state.noteConflict = null;
    state.noteNeedsSave = true;
    state.noteError = false;
    $('#noteRecovery').hidden = true;
    setNoteState('正在用最新版本保存本页草稿…');
    setTimeout(() => { void saveNote(); }, 0);
  }

  async function flushNoteBeforeLeave() {
    if (!state.noteLoaded) return true;
    if (noteIsCurrentAndSaved()) return true;
    clearTimeout(state.noteTimer);
    if ((state.noteNeedsSave || state.noteSavePromise) && !state.noteConflict) {
      const saving = state.noteSavePromise || saveNote();
      const result = await Promise.race([saving, new Promise((resolve) => setTimeout(() => resolve(false), 14000))]);
      if (result && noteIsCurrentAndSaved()) return true;
    }
    return window.confirm('本活动笔记尚未确认保存。离开后本页草稿可能丢失，仍要离开吗？');
  }

  async function navigateToActivity(activityId) {
    if (activityId === state.activityId) return;
    if (await flushNoteBeforeLeave()) location.href = activityUrl(activityId);
  }

  async function navigateAway(url) {
    if (await flushNoteBeforeLeave()) location.href = url;
  }

  async function goNext(index) {
    if (index < state.activities.length - 1) return navigateToActivity(state.activities[index + 1].id);
    return navigateAway(courseUrl());
  }

  window.addEventListener('online', () => {
    if (state.noteError && state.noteNeedsSave) {
      state.noteError = false;
      scheduleNoteSave(true);
    }
  });
  window.addEventListener('focus', () => {
    if (!state.noteLoaded || state.noteSavePromise || state.noteNeedsSave) return;
    void YuzanApi.getStudentActivityNote(state.activityId).then((note) => {
      const latest = normalizeNote(note);
      if (latest.revision !== state.note.revision && latest.content !== state.note.content) {
        if ($('#noteContent').value === latest.content) {
          state.note = latest;
          state.noteConfirmedVersion = state.noteDraftVersion;
          setNoteState('已从其他页面同步', 'success');
        } else {
          setNoteConflict(latest, '云端笔记已在其他页面更新。本页文字保留，请选择采用云端版本或明确保存本页草稿。');
        }
      }
    }).catch(() => {});
  });
  window.addEventListener('beforeunload', (event) => {
    if (state.noteLoaded && !noteIsCurrentAndSaved()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  init();
})();
