/**
 * 教师课程工作台 —— studio.js
 * 完全动态化：从后端加载 CourseVersion 及关联 Units/Lessons/Activities/Resources
 * 所有字段与播放器页面（course-detail）1:1 对应，支持编辑与保存
 */
(() => {
  'use strict';

  // ── 状态 ──
  let courseVersion = null;
  let selectedUnit = null;
  let selectedLesson = null;
  let selectedActivity = null;
  let dirty = false;
  let activeTab = 'goals';

  // ── DOM 引用 ──
  const $ = (sel) => document.querySelector(sel);
  const treeEl = $('[data-bind="structure-tree"]');
  const titleEl = $('[data-bind="course-title"]');
  const crumbEl = $('[data-bind="crumb-title"]');
  const draftEl = $('[data-bind="status-label"]');
  const editorHeadEl = $('[data-bind="editor-head"]');
  const editorBodyEl = $('[data-bind="editor-body"]');
  const propBodyEl = $('[data-bind="prop-body"]');
  const tabsEl = $('.tabs');
  const stepsEl = $('[data-bind="steps"]');

  // ── 常量映射 ──
  const STATUS_LABEL = {
    DRAFT: '课程草稿',
    IN_REVIEW: '审核中',
    APPROVED: '已通过',
    PUBLISHED: '已发布',
    CHANGES_REQUESTED: '需修改',
    RETIRED: '已归档'
  };

  const ACTIVITY_TYPE_LABEL = {
    TEXT: '文本学习',
    VIDEO: '视频学习',
    RECORDING: '朗读录音',
    QUIZ: '智能测评',
    DISCUSSION: '小组讨论',
    WORKSHEET: '书面练习',
    ORAL: '口语练习'
  };

  const DIFFICULTY_LABEL = {
    EASY: '简单',
    MEDIUM: '中等',
    HARD: '困难'
  };

  const GRADE_LABEL = {
    PRIMARY_LOW: '小学低年级',
    PRIMARY_MID: '小学中年级',
    PRIMARY_HIGH: '小学高年级',
    JUNIOR_HIGH: '初中',
    SENIOR_HIGH: '高中'
  };

  const TEACHING_MODE = {
    CLASSROOM: '课堂教学',
    GROUP: '小组活动',
    SELF_STUDY: '自主学习'
  };

  // ── 工具函数 ──
  function escapeHtml(text) {
    if (text == null) return '';
    return String(text).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  function toast(msg, type) {
    if (window.YuzanDemo?.toast) {
      YuzanDemo.toast(msg, type || 'info');
    } else {
      console.log(`[toast:${type || 'info'}] ${msg}`);
    }
  }

  function getActiveSchoolId() {
    return window.YuzanApi?.getActiveSchoolId?.() || null;
  }

  function getToken() {
    return window.YuzanApi?.getToken?.() || null;
  }

  async function apiRequest(path, options) {
    if (!window.YuzanApi?.request) {
      throw new Error('API 客户端未加载');
    }
    return YuzanApi.request(path, options || {});
  }

  // ── 状态管理 ──
  function setDirty(value) {
    dirty = value;
    if (draftEl) {
      draftEl.textContent = dirty ? '未保存' : STATUS_LABEL[courseVersion?.status || 'DRAFT'];
    }
  }

  function renderSteps() {
    if (!stepsEl || !courseVersion) return;
    const status = courseVersion.status || 'DRAFT';
    const stepOrder = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED'];
    const currentIndex = stepOrder.indexOf(status);
    stepsEl.querySelectorAll('.step').forEach((step, i) => {
      step.classList.toggle('active', i <= currentIndex);
    });
    stepsEl.querySelectorAll('.line').forEach((line, i) => {
      line.classList.toggle('active', i < currentIndex);
    });
  }

  // ── 课程结构渲染 ──
  function renderStructure() {
    if (!courseVersion || !treeEl) return;
    const units = courseVersion.units || [];
    if (units.length === 0) {
      treeEl.innerHTML = '<div class="tree-empty">暂无章节，点击右上角 ＋ 添加</div>';
      return;
    }

    treeEl.innerHTML = units.map((unit, uIndex) => {
      const lessons = unit.lessons || [];
      const lessonsHtml = lessons.length ? lessons.map((lesson, lIndex) => {
        const activities = lesson.activities || [];
        const activitiesHtml = activities.map((activity, aIndex) =>
          `<p class="activity" data-unit="${uIndex}" data-lesson="${lIndex}" data-activity="${aIndex}">△　${escapeHtml(activity.title || '未命名活动')}</p>`
        ).join('');
        return `<p data-unit="${uIndex}" data-lesson="${lIndex}" data-activity="-1">○　${escapeHtml(lesson.title || `课时 ${lIndex + 1}`)}</p>` + activitiesHtml;
      }).join('') : '<p class="tree-empty-lesson">（暂无课时）</p>';

      return `<div class="chapter" data-unit="${uIndex}">⌄　<b>${escapeHtml(unit.title || `第 ${uIndex + 1} 章`)}</b></div>` + lessonsHtml;
    }).join('');

    // 绑定点击事件
    treeEl.querySelectorAll('p[data-unit]').forEach(p => {
      p.addEventListener('click', () => {
        const uIndex = Number(p.dataset.unit);
        const lIndex = Number(p.dataset.lesson);
        const aIndex = Number(p.dataset.activity);
        const unit = units[uIndex];
        const lesson = unit?.lessons?.[lIndex];
        const activity = aIndex >= 0 ? lesson?.activities?.[aIndex] : null;
        selectNode(unit, lesson, activity, p);
      });
    });

    // 默认选中第一个活动
    const firstActivityP = treeEl.querySelector('p.activity');
    if (firstActivityP) {
      firstActivityP.click();
    } else {
      const firstP = treeEl.querySelector('p[data-unit]');
      if (firstP) firstP.click();
    }
  }

  // ── 选中节点 ──
  function selectNode(unit, lesson, activity, element) {
    selectedUnit = unit;
    selectedLesson = lesson;
    selectedActivity = activity;

    // 高亮选中
    treeEl.querySelectorAll('p').forEach(x => x.classList.remove('selected'));
    treeEl.querySelectorAll('.chapter').forEach(x => x.classList.remove('selected-chapter'));
    if (element) {
      element.classList.add('selected');
      const chapter = element.closest('.chapter') || treeEl.querySelectorAll('.chapter')[unit ? Array.from(courseVersion.units).indexOf(unit) : 0];
      if (chapter) chapter.classList.add('selected-chapter');
    }

    renderEditorHead();
    switchTab(activeTab);
    renderProperties();
  }

  function renderEditorHead() {
    const unitTitle = selectedUnit?.title || '未选择章节';
    const lessonTitle = selectedLesson?.title || '';
    const activityTitle = selectedActivity?.title || '';
    let head = unitTitle;
    if (lessonTitle) head += ' / ' + lessonTitle;
    if (activityTitle) head += ' / ' + activityTitle;
    if (editorHeadEl) editorHeadEl.textContent = head;
  }

  // ── Tab 切换 ──
  function switchTab(tabName) {
    activeTab = tabName;
    if (tabsEl) {
      tabsEl.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
      });
    }

    if (!selectedActivity) {
      if (editorBodyEl) {
        editorBodyEl.innerHTML = '<div class="editor-placeholder">请从左侧选择一个活动进行编辑</div>';
      }
      return;
    }

    let html = '';
    if (tabName === 'goals') html = buildGoalsEditor();
    else if (tabName === 'media') html = buildMediaEditor();
    else if (tabName === 'interaction') html = buildInteractionEditor();
    else if (tabName === 'support') html = buildSupportEditor();
    else if (tabName === 'offline') html = buildOfflineEditor();

    if (editorBodyEl) {
      editorBodyEl.innerHTML = html;
      bindEditorEvents();
    }
  }

  // ── Tab 1: 本节目标（学习目标 + 核心问题 + 关键内容 + 教师总结 + AI 摘要）──
  function buildGoalsEditor() {
    const a = selectedActivity || {};
    const objectives = Array.isArray(a.objectives) ? a.objectives : [];
    const keyPoints = Array.isArray(a.keyPoints) ? a.keyPoints : [];
    const coreQuestion = a.coreQuestion || '';
    const keyContent = a.keyContent || a.content || '';
    const teacherSummary = a.teacherSummary || '';
    const aiSummary = a.aiSummary || '';

    return `
      <h3>学习目标</h3>
      <ul class="goals-list" data-field="objectives">
        ${objectives.map((o, i) => `<li contenteditable="true" data-index="${i}">${escapeHtml(o)}</li>`).join('')}
        ${objectives.length === 0 ? '<li contenteditable="true" data-index="0" class="placeholder">点击添加学习目标…</li>' : ''}
      </ul>
      <button class="btn-add-item" data-action="add-objective">＋ 添加目标</button>

      <div class="dash"></div>

      <h3>知识要点</h3>
      <ul class="goals-list" data-field="keyPoints">
        ${keyPoints.map((k, i) => `<li contenteditable="true" data-index="${i}">${escapeHtml(k)}</li>`).join('')}
        ${keyPoints.length === 0 ? '<li contenteditable="true" data-index="0" class="placeholder">点击添加知识要点…</li>' : ''}
      </ul>
      <button class="btn-add-item" data-action="add-keypoint">＋ 添加要点</button>

      <div class="dash"></div>

      <h3>核心问题</h3>
      <div class="inputbox" contenteditable="true" role="textbox" aria-label="核心问题" data-field="coreQuestion">${escapeHtml(coreQuestion)}<span contenteditable="false">${coreQuestion.length}/200</span></div>

      <div class="dash"></div>

      <h3>关键内容</h3>
      <div class="rich">
        <div class="toolbar" role="toolbar">正文　⌄　　<b>B</b>　<i>I</i>　<u>U</u>　　☷　☰</div>
        <p contenteditable="true" role="textbox" aria-label="关键内容" data-field="keyContent">${escapeHtml(keyContent)}</p>
        <span>${keyContent.length}/2000</span>
      </div>

      <div class="dash"></div>

      <h3>教师总结</h3>
      <div class="inputbox" contenteditable="true" role="textbox" aria-label="教师总结" data-field="teacherSummary">${escapeHtml(teacherSummary)}<span contenteditable="false">${teacherSummary.length}/500</span></div>

      <div class="dash"></div>

      <h3>AI 摘要</h3>
      <div class="inputbox" contenteditable="true" role="textbox" aria-label="AI 摘要" data-field="aiSummary">${escapeHtml(aiSummary)}<span contenteditable="false">${aiSummary.length}/500</span></div>
    `;
  }

  // ── Tab 2: 视频与字幕（视频URL + 海报 + 中文字幕 + 藏文字幕 + 时间线知识点）──
  function buildMediaEditor() {
    const a = selectedActivity || {};
    const videoUrl = a.videoUrl || '';
    const posterUrl = a.posterUrl || '';
    const subtitleZhUrl = a.subtitleZhUrl || '';
    const subtitleBoUrl = a.subtitleBoUrl || '';
    const timelineMarkers = Array.isArray(a.timelineMarkers) ? a.timelineMarkers : [];

    return `
      <h3>视频资源</h3>
      <label class="form-row">
        <span>视频文件 URL</span>
        <input type="text" data-field="videoUrl" value="${escapeHtml(videoUrl)}" placeholder="例如：/assets/media/video.mp4 或预签名URL">
      </label>
      <div class="form-hint">支持 MP4 格式。可上传至资源中心后填入预签名 URL，或使用相对路径。</div>

      <div class="dash"></div>

      <label class="form-row">
        <span>视频封面（Poster）URL</span>
        <input type="text" data-field="posterUrl" value="${escapeHtml(posterUrl)}" placeholder="例如：/assets/covers/spring.jpg">
      </label>
      <div class="form-hint">学生端播放器在视频开始前显示的封面图。</div>

      <div class="dash"></div>

      <h3>字幕文件</h3>
      <label class="form-row">
        <span>中文字幕（VTT）</span>
        <input type="text" data-field="subtitleZhUrl" value="${escapeHtml(subtitleZhUrl)}" placeholder="例如：/assets/subtitles/spring-zh.vtt">
      </label>
      <label class="form-row">
        <span>藏文字幕（VTT）</span>
        <input type="text" data-field="subtitleBoUrl" value="${escapeHtml(subtitleBoUrl)}" placeholder="例如：/assets/subtitles/spring-bo.vtt">
      </label>
      <div class="form-hint">字幕文件需为 WebVTT 格式（.vtt）。学生端播放器支持中/藏双语切换。</div>

      <div class="dash"></div>

      <h3>时间线知识点</h3>
      <p class="form-hint">在视频时间轴上标记知识点，学生悬停可预览，点击可跳转。</p>
      <div class="timeline-list" data-field="timelineMarkers">
        ${timelineMarkers.map((m, i) => `
          <div class="timeline-row" data-index="${i}">
            <input type="text" class="time-input" data-subfield="timestamp" value="${escapeHtml(m.timestamp || '0:00')}" placeholder="0:00">
            <input type="text" class="title-input" data-subfield="title" value="${escapeHtml(m.title || '')}" placeholder="知识点标题">
            <button class="btn-remove" data-action="remove-timeline" data-index="${i}" title="删除">×</button>
          </div>
        `).join('')}
        ${timelineMarkers.length === 0 ? '<div class="form-hint">暂无时间线知识点</div>' : ''}
      </div>
      <button class="btn-add-item" data-action="add-timeline">＋ 添加知识点</button>
    `;
  }

  // ── Tab 3: 互动与练习（视频互动题 + 口语跟读 + 课后练习引用）──
  function buildInteractionEditor() {
    const a = selectedActivity || {};
    const exercises = Array.isArray(a.exercises) ? a.exercises : [];
    const oralDemoUrl = a.oralDemoUrl || '';
    const oralDemoText = a.oralDemoText || '';
    const practiceTitle = a.practiceTitle || '';
    const practiceDescription = a.practiceDescription || '';
    const practiceId = a.practiceId || '';

    return `
      <h3>视频中互动题</h3>
      <p class="form-hint">学生在观看视频时弹出的轻量级题目（CHOICE 选择题 / FILL_BLANK 填空题）。</p>
      <div class="exercises-list" data-field="exercises">
        ${exercises.map((ex, i) => `
          <div class="exercise-card" data-index="${i}">
            <div class="exercise-head">
              <select class="ex-type" data-subfield="type">
                <option value="CHOICE" ${ex.type === 'CHOICE' ? 'selected' : ''}>选择题</option>
                <option value="FILL_BLANK" ${ex.type === 'FILL_BLANK' ? 'selected' : ''}>填空题</option>
              </select>
              <input type="text" class="ex-time" data-subfield="timestamp" value="${escapeHtml(ex.timestamp || '0:00')}" placeholder="弹出时间 0:00">
              <button class="btn-remove" data-action="remove-exercise" data-index="${i}" title="删除">×</button>
            </div>
            <textarea class="ex-question" data-subfield="question" placeholder="题干">${escapeHtml(ex.question || '')}</textarea>
            <input type="text" class="ex-answer" data-subfield="answer" value="${escapeHtml(ex.answer || '')}" placeholder="正确答案">
            <input type="text" class="ex-options" data-subfield="options" value="${escapeHtml(Array.isArray(ex.options) ? ex.options.join('|') : '')}" placeholder="选项（用 | 分隔，仅选择题）">
          </div>
        `).join('')}
        ${exercises.length === 0 ? '<div class="form-hint">暂无互动题</div>' : ''}
      </div>
      <button class="btn-add-item" data-action="add-exercise">＋ 添加互动题</button>

      <div class="dash"></div>

      <h3>口语跟读练习</h3>
      <p class="form-hint">学生端播放器内置简单口语互动：示范音频 + 学生录音。</p>
      <label class="form-row">
        <span>示范音频 URL</span>
        <input type="text" data-field="oralDemoUrl" value="${escapeHtml(oralDemoUrl)}" placeholder="例如：/assets/audio/spring-demo.mp3">
      </label>
      <label class="form-row">
        <span>示范文本</span>
        <textarea data-field="oralDemoText" placeholder="学生看到的跟读文本" rows="3">${escapeHtml(oralDemoText)}</textarea>
      </label>

      <div class="dash"></div>

      <h3>课后练习（P0 Practice 引用）</h3>
      <p class="form-hint">关联正式练习执行器中的多题练习。学生完成视频学习后点击"开始练习"进入。</p>
      <label class="form-row">
        <span>练习 ID</span>
        <input type="text" data-field="practiceId" value="${escapeHtml(practiceId)}" placeholder="Practice ID">
      </label>
      <label class="form-row">
        <span>练习标题</span>
        <input type="text" data-field="practiceTitle" value="${escapeHtml(practiceTitle)}" placeholder="例如：高原上的春天 · 课后练习">
      </label>
      <label class="form-row">
        <span>练习描述</span>
        <textarea data-field="practiceDescription" placeholder="练习简介" rows="2">${escapeHtml(practiceDescription)}</textarea>
      </label>
    `;
  }

  // ── Tab 4: 教学支持（朗读示范、停顿标记、课堂提问、差异化支持、课堂观察点）──
  function buildSupportEditor() {
    const a = selectedActivity || {};
    const supportAudioUrl = a.supportAudioUrl || '';
    const pauseGuide = a.pauseGuide || '';
    const classQuestions = Array.isArray(a.classQuestions) ? a.classQuestions : [];
    const differentiation = a.differentiation || '';
    const observationPoints = Array.isArray(a.observationPoints) ? a.observationPoints : [];

    return `
      <h3>朗读示范音频</h3>
      <label class="form-row">
        <span>示范音频 URL</span>
        <input type="text" data-field="supportAudioUrl" value="${escapeHtml(supportAudioUrl)}" placeholder="例如：/assets/audio/spring-read.mp3">
      </label>

      <div class="dash"></div>

      <h3>停顿标记讲解</h3>
      <div class="inputbox" contenteditable="true" role="textbox" aria-label="停顿标记" data-field="pauseGuide">${escapeHtml(pauseGuide)}<span contenteditable="false">${pauseGuide.length}/300</span></div>

      <div class="dash"></div>

      <h3>课堂提问建议</h3>
      <ul class="goals-list" data-field="classQuestions">
        ${classQuestions.map((q, i) => `<li contenteditable="true" data-index="${i}">${escapeHtml(q)}</li>`).join('')}
        ${classQuestions.length === 0 ? '<li contenteditable="true" data-index="0" class="placeholder">点击添加课堂提问…</li>' : ''}
      </ul>
      <button class="btn-add-item" data-action="add-question">＋ 添加提问</button>

      <div class="dash"></div>

      <h3>差异化支持</h3>
      <div class="inputbox" contenteditable="true" role="textbox" aria-label="差异化支持" data-field="differentiation">${escapeHtml(differentiation)}<span contenteditable="false">${differentiation.length}/500</span></div>

      <div class="dash"></div>

      <h3>课堂观察点</h3>
      <ul class="goals-list" data-field="observationPoints">
        ${observationPoints.map((o, i) => `<li contenteditable="true" data-index="${i}">${escapeHtml(o)}</li>`).join('')}
        ${observationPoints.length === 0 ? '<li contenteditable="true" data-index="0" class="placeholder">点击添加观察点…</li>' : ''}
      </ul>
      <button class="btn-add-item" data-action="add-observation">＋ 添加观察点</button>
    `;
  }

  // ── Tab 5: 离线资源 ──
  function buildOfflineEditor() {
    const a = selectedActivity || {};
    const offlineResources = Array.isArray(a.offlineResources) ? a.offlineResources : [];

    return `
      <h3>离线资源</h3>
      <p class="form-hint">随课程发布的离线资源，学生在弱网环境下也能完成学习与录音，联网后自动同步。</p>
      <div class="offline-list" data-field="offlineResources">
        ${offlineResources.map((r, i) => `
          <div class="offline-row" data-index="${i}">
            <input type="text" class="off-name" data-subfield="name" value="${escapeHtml(r.name || '')}" placeholder="资源名称">
            <input type="text" class="off-url" data-subfield="url" value="${escapeHtml(r.url || '')}" placeholder="资源URL">
            <input type="text" class="off-size" data-subfield="size" value="${escapeHtml(r.size || '')}" placeholder="大小">
            <button class="btn-remove" data-action="remove-offline" data-index="${i}" title="删除">×</button>
          </div>
        `).join('')}
        ${offlineResources.length === 0 ? '<div class="form-hint">暂无离线资源</div>' : ''}
      </div>
      <button class="btn-add-item" data-action="add-offline">＋ 添加资源</button>
    `;
  }

  // ── 属性面板渲染（活动类型、时长、难度、学段、教学模式、标签、备注）──
  function renderProperties() {
    if (!propBodyEl) return;
    if (!selectedActivity) {
      propBodyEl.innerHTML = '<div class="prop-placeholder">请从左侧选择一个活动</div>';
      return;
    }

    const a = selectedActivity;
    const typeLabel = ACTIVITY_TYPE_LABEL[a.type] || a.type || '未设置';
    const duration = a.duration || 15;
    const difficulty = a.difficulty || 'MEDIUM';
    const gradeLevel = a.gradeLevel || 'PRIMARY_HIGH';
    const teachingMode = a.teachingMode || 'CLASSROOM';
    const tags = Array.isArray(a.tags) ? a.tags : [];
    const note = a.note || '';
    const resources = Array.isArray(a.resources) ? a.resources : [];

    propBodyEl.innerHTML = `
      <label>活动类型</label>
      <div class="select" data-field="type">${typeLabel}　⌄</div>

      <label>建议时长</label>
      <div class="duration">
        <input type="number" class="select small" data-field="duration" value="${duration}" min="1" max="120">
        <span>分钟</span>
      </div>

      <label>难度等级</label>
      <select class="prop-select" data-field="difficulty">
        ${Object.keys(DIFFICULTY_LABEL).map(k => `<option value="${k}" ${k === difficulty ? 'selected' : ''}>${DIFFICULTY_LABEL[k]}</option>`).join('')}
      </select>

      <label>适用学段</label>
      <select class="prop-select" data-field="gradeLevel">
        ${Object.keys(GRADE_LABEL).map(k => `<option value="${k}" ${k === gradeLevel ? 'selected' : ''}>${GRADE_LABEL[k]}</option>`).join('')}
      </select>

      <label>教学模式</label>
      <div class="modes">
        ${Object.keys(TEACHING_MODE).map(k => `<button class="${k === teachingMode ? 'on' : ''}" data-field="teachingMode" data-value="${k}">${TEACHING_MODE[k]}</button>`).join('')}
      </div>

      <label>资源关联</label>
      <div class="resource-list">
        ${resources.map(r => `<div class="file">▣　${escapeHtml(r.name || r.url || '资源')} <span class="btn-remove" data-action="remove-resource" data-id="${escapeHtml(r.id || r.url || '')}">×</span></div>`).join('')}
        ${resources.length === 0 ? '<div class="form-hint">暂无关联资源</div>' : ''}
      </div>

      <label>标签</label>
      <div class="tags">
        ${tags.map(t => `<span>${escapeHtml(t)} ×</span>`).join('')}
        ${tags.length === 0 ? '<span class="form-hint">暂无标签</span>' : ''}
        <input type="text" class="tag-input" data-field="tagInput" placeholder="添加标签后回车">
      </div>

      <label>备注</label>
      <div class="note" contenteditable="true" role="textbox" aria-label="教学备注" data-field="note">${escapeHtml(note)}<span contenteditable="false">${note.length}/200</span></div>
    `;

    bindPropertyEvents();
  }

  // ── 事件绑定 ──
  function bindEditorEvents() {
    if (!editorBodyEl) return;

    // contenteditable 输入 → 标记 dirty + 计数
    editorBodyEl.querySelectorAll('[contenteditable="true"]').forEach(el => {
      el.addEventListener('input', () => {
        setDirty(true);
        updateCounter(el);
        syncFieldFromElement(el);
      });
    });

    // input/textarea/select 输入
    editorBodyEl.querySelectorAll('input[data-field], textarea[data-field], select[data-field]').forEach(el => {
      const evt = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, () => {
        setDirty(true);
        syncFieldFromElement(el);
      });
    });

    // 子字段（timeline/exercise/offline 的 subfield）
    editorBodyEl.querySelectorAll('[data-subfield]').forEach(el => {
      const evt = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, () => {
        setDirty(true);
        syncSubfieldFromElement(el);
      });
    });

    // 添加项按钮
    editorBodyEl.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        handleAddAction(btn.dataset.action, btn.dataset.index);
      });
    });
  }

  function bindPropertyEvents() {
    if (!propBodyEl) return;

    propBodyEl.querySelectorAll('input[data-field], select[data-field], textarea[data-field]').forEach(el => {
      const evt = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, () => {
        setDirty(true);
        syncFieldFromElement(el);
      });
    });

    propBodyEl.querySelectorAll('[contenteditable="true"]').forEach(el => {
      el.addEventListener('input', () => {
        setDirty(true);
        updateCounter(el);
        syncFieldFromElement(el);
      });
    });

    // 教学模式按钮
    propBodyEl.querySelectorAll('.modes button[data-field="teachingMode"]').forEach(btn => {
      btn.addEventListener('click', () => {
        propBodyEl.querySelectorAll('.modes button').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        if (selectedActivity) {
          selectedActivity.teachingMode = btn.dataset.value;
          setDirty(true);
        }
      });
    });

    // 标签输入
    const tagInput = propBodyEl.querySelector('.tag-input');
    if (tagInput) {
      tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const value = tagInput.value.trim();
          if (value && selectedActivity) {
            if (!Array.isArray(selectedActivity.tags)) selectedActivity.tags = [];
            selectedActivity.tags.push(value);
            setDirty(true);
            renderProperties();
            propBodyEl.querySelector('.tag-input')?.focus();
          }
        }
      });
    }

    // 删除标签
    propBodyEl.querySelectorAll('.tags span:not(.form-hint)').forEach(span => {
      span.addEventListener('click', () => {
        if (!selectedActivity || !Array.isArray(selectedActivity.tags)) return;
        const text = span.textContent.replace(/\s*×$/, '').trim();
        selectedActivity.tags = selectedActivity.tags.filter(t => t !== text);
        setDirty(true);
        renderProperties();
      });
    });

    // 删除资源
    propBodyEl.querySelectorAll('[data-action="remove-resource"]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!selectedActivity || !Array.isArray(selectedActivity.resources)) return;
        const id = btn.dataset.id;
        selectedActivity.resources = selectedActivity.resources.filter(r => (r.id || r.url) !== id);
        setDirty(true);
        renderProperties();
      });
    });
  }

  function updateCounter(el) {
    const span = el.querySelector('span[contenteditable="false"]');
    if (!span) return;
    const max = Number((span.textContent.match(/\/(\d+)/) || [])[1] || 200);
    const clone = el.cloneNode(true);
    clone.querySelector('span[contenteditable="false"]')?.remove();
    span.textContent = `${clone.textContent.trim().length}/${max}`;
  }

  function syncFieldFromElement(el) {
    if (!selectedActivity) return;
    const field = el.dataset.field;
    if (!field) return;

    // 提取文本（contenteditable 时去掉计数 span）
    let value;
    if (el.isContentEditable) {
      const clone = el.cloneNode(true);
      clone.querySelector('span[contenteditable="false"]')?.remove();
      value = clone.textContent.trim();
    } else {
      value = el.value;
    }

    // 数值转换
    if (field === 'duration') {
      selectedActivity[field] = Number(value) || 0;
    } else if (field === 'objectives' || field === 'keyPoints' || field === 'classQuestions' || field === 'observationPoints') {
      // 这些是列表，由专门的添加/删除按钮管理
      const items = [];
      el.querySelectorAll('li').forEach(li => {
        const text = li.textContent.trim();
        if (text && !li.classList.contains('placeholder')) items.push(text);
      });
      selectedActivity[field] = items;
    } else {
      selectedActivity[field] = value;
    }
  }

  function syncSubfieldFromElement(el) {
    if (!selectedActivity) return;
    const field = el.closest('[data-field]')?.dataset.field;
    const subfield = el.dataset.subfield;
    const index = Number(el.closest('[data-index]')?.dataset.index || 0);
    if (!field || !subfield) return;

    if (!Array.isArray(selectedActivity[field])) selectedActivity[field] = [];
    if (!selectedActivity[field][index]) selectedActivity[field][index] = {};

    let value = el.value;
    if (subfield === 'options') {
      // 选项用 | 分隔
      value = value.split('|').map(s => s.trim()).filter(Boolean);
    } else if (subfield === 'timestamp') {
      // 保持字符串格式 0:00
      value = value;
    }
    selectedActivity[field][index][subfield] = value;
  }

  function handleAddAction(action, index) {
    if (!selectedActivity) {
      toast('请先选择一个活动', 'warning');
      return;
    }

    if (action === 'add-objective') {
      if (!Array.isArray(selectedActivity.objectives)) selectedActivity.objectives = [];
      selectedActivity.objectives.push('新学习目标');
      setDirty(true);
      switchTab('goals');
    } else if (action === 'add-keypoint') {
      if (!Array.isArray(selectedActivity.keyPoints)) selectedActivity.keyPoints = [];
      selectedActivity.keyPoints.push('新知识要点');
      setDirty(true);
      switchTab('goals');
    } else if (action === 'add-timeline') {
      if (!Array.isArray(selectedActivity.timelineMarkers)) selectedActivity.timelineMarkers = [];
      selectedActivity.timelineMarkers.push({ timestamp: '0:00', title: '' });
      setDirty(true);
      switchTab('media');
    } else if (action === 'remove-timeline') {
      selectedActivity.timelineMarkers.splice(Number(index), 1);
      setDirty(true);
      switchTab('media');
    } else if (action === 'add-exercise') {
      if (!Array.isArray(selectedActivity.exercises)) selectedActivity.exercises = [];
      selectedActivity.exercises.push({ type: 'CHOICE', timestamp: '0:00', question: '', answer: '', options: [] });
      setDirty(true);
      switchTab('interaction');
    } else if (action === 'remove-exercise') {
      selectedActivity.exercises.splice(Number(index), 1);
      setDirty(true);
      switchTab('interaction');
    } else if (action === 'add-question') {
      if (!Array.isArray(selectedActivity.classQuestions)) selectedActivity.classQuestions = [];
      selectedActivity.classQuestions.push('新课堂提问');
      setDirty(true);
      switchTab('support');
    } else if (action === 'add-observation') {
      if (!Array.isArray(selectedActivity.observationPoints)) selectedActivity.observationPoints = [];
      selectedActivity.observationPoints.push('新观察点');
      setDirty(true);
      switchTab('support');
    } else if (action === 'add-offline') {
      if (!Array.isArray(selectedActivity.offlineResources)) selectedActivity.offlineResources = [];
      selectedActivity.offlineResources.push({ name: '', url: '', size: '' });
      setDirty(true);
      switchTab('offline');
    } else if (action === 'remove-offline') {
      selectedActivity.offlineResources.splice(Number(index), 1);
      setDirty(true);
      switchTab('offline');
    }
  }

  // ── 课程详情加载 ──
  async function loadCourseDetails(courseVersionId) {
    const schoolId = getActiveSchoolId();
    if (!schoolId) {
      toast('请先选择学校', 'warning');
      return;
    }

    try {
      // 加载课程版本，包含 units/lessons/activities/resources
      courseVersion = await apiRequest(`/schools/${schoolId}/course-versions/${courseVersionId}`, { method: 'GET' });
      if (!courseVersion) throw new Error('课程版本为空');

      // 渲染标题
      if (titleEl) titleEl.textContent = courseVersion.title || '未命名课程';
      if (crumbEl) crumbEl.textContent = courseVersion.title || '课程详情';
      if (draftEl) draftEl.textContent = STATUS_LABEL[courseVersion.status || 'DRAFT'];

      renderSteps();
      renderStructure();
    } catch (err) {
      console.error('[studio] 加载课程详情失败:', err);
      toast(err.message || '加载课程详情失败', 'error');
      if (titleEl) titleEl.textContent = '加载失败';
      if (draftEl) draftEl.textContent = '错误';
    }
  }

  // ── 保存（PATCH 活动内容 + 课程版本元数据）──
  async function saveCourse() {
    if (!courseVersion?.id) {
      toast('课程版本未加载', 'warning');
      return;
    }
    const schoolId = getActiveSchoolId();
    if (!schoolId) {
      toast('请先选择学校', 'warning');
      return;
    }

    try {
      // 1. 保存课程版本元数据（标题、状态）
      await apiRequest(`/schools/${schoolId}/course-versions/${courseVersion.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          expectedUpdatedAt: courseVersion.updatedAt || new Date().toISOString(),
          title: titleEl?.textContent || courseVersion.title
        })
      });

      // 2. 保存当前活动内容（如果有选中的活动）
      if (selectedActivity?.id) {
        await apiRequest(`/schools/${schoolId}/course-versions/${courseVersion.id}/activities/${selectedActivity.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            expectedUpdatedAt: selectedActivity.updatedAt || new Date().toISOString(),
            title: selectedActivity.title,
            type: selectedActivity.type,
            duration: selectedActivity.duration,
            difficulty: selectedActivity.difficulty,
            gradeLevel: selectedActivity.gradeLevel,
            teachingMode: selectedActivity.teachingMode,
            objectives: selectedActivity.objectives,
            keyPoints: selectedActivity.keyPoints,
            coreQuestion: selectedActivity.coreQuestion,
            keyContent: selectedActivity.keyContent,
            teacherSummary: selectedActivity.teacherSummary,
            aiSummary: selectedActivity.aiSummary,
            videoUrl: selectedActivity.videoUrl,
            posterUrl: selectedActivity.posterUrl,
            subtitleZhUrl: selectedActivity.subtitleZhUrl,
            subtitleBoUrl: selectedActivity.subtitleBoUrl,
            timelineMarkers: selectedActivity.timelineMarkers,
            exercises: selectedActivity.exercises,
            oralDemoUrl: selectedActivity.oralDemoUrl,
            oralDemoText: selectedActivity.oralDemoText,
            practiceId: selectedActivity.practiceId,
            practiceTitle: selectedActivity.practiceTitle,
            practiceDescription: selectedActivity.practiceDescription,
            supportAudioUrl: selectedActivity.supportAudioUrl,
            pauseGuide: selectedActivity.pauseGuide,
            classQuestions: selectedActivity.classQuestions,
            differentiation: selectedActivity.differentiation,
            observationPoints: selectedActivity.observationPoints,
            offlineResources: selectedActivity.offlineResources,
            tags: selectedActivity.tags,
            note: selectedActivity.note
          })
        });
      }

      setDirty(false);
      toast('课程草稿已保存', 'success');
    } catch (err) {
      console.error('[studio] 保存失败:', err);
      toast(err.message || '保存失败，请检查网络', 'error');
    }
  }

  // ── 初始化 ──
  async function init() {
    if (!getToken()) {
      toast('请先登录', 'warning');
      location.href = '/login';
      return;
    }
    const schoolId = getActiveSchoolId();
    if (!schoolId) {
      toast('请先选择学校', 'warning');
      location.href = '/select-school';
      return;
    }

    const params = new URLSearchParams(location.search);
    let courseVersionId = params.get('courseVersionId');

    // 没有 ID 时，获取列表取第一个 DRAFT
    if (!courseVersionId) {
      try {
        const list = await apiRequest(`/schools/${schoolId}/course-versions?limit=20`, { method: 'GET' });
        const items = Array.isArray(list) ? list : (list?.items || []);
        const draft = items.find(v => v.status === 'DRAFT') || items[0];
        courseVersionId = draft?.id;
      } catch (err) {
        toast(err.message || '加载课程版本列表失败', 'error');
        return;
      }
    }

    if (!courseVersionId) {
      toast('当前学校暂无课程版本', 'warning');
      if (titleEl) titleEl.textContent = '暂无课程';
      if (draftEl) draftEl.textContent = '—';
      return;
    }

    await loadCourseDetails(courseVersionId);
  }

  // ── Tab 按钮事件 ──
  if (tabsEl) {
    tabsEl.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  }

  // ── 重命名 ──
  document.querySelector('.edit')?.addEventListener('click', () => {
    if (!courseVersion) return;
    const value = prompt('课程名称', titleEl?.textContent || courseVersion.title);
    if (value?.trim()) {
      if (titleEl) titleEl.textContent = value.trim();
      if (crumbEl) crumbEl.textContent = value.trim();
      courseVersion.title = value.trim();
      setDirty(true);
    }
  });

  // ── 添加活动（暂未开通，符合现有约定）──
  $('[data-action="add-activity"]')?.addEventListener('click', () => {
    toast('课程结构管理功能暂未开通');
  });

  $('[data-action="add-unit"]')?.addEventListener('click', () => {
    toast('课程结构管理功能暂未开通');
  });

  $('[data-action="switch-activity"]')?.addEventListener('click', () => {
    toast('前后活动切换功能暂未开通');
  });

  // ── 预览 ──
  document.querySelector('.preview')?.addEventListener('click', () => {
    if (!courseVersion?.id) {
      toast('请先加载课程', 'warning');
      return;
    }
    let dialog = document.querySelector('#coursePreview');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'coursePreview';
      dialog.innerHTML = `
        <button class="preview-close" aria-label="关闭">×</button>
        <h2>学生端预览</h2>
        <div class="preview-card">
          <span>课程：${escapeHtml(courseVersion.title || '未命名')}</span>
          <h3>${escapeHtml(selectedActivity?.title || '请选择活动')}</h3>
          <p>点击下方按钮在新标签页中打开学生端播放器预览。</p>
          <a href="/student/courses/course-detail/?id=${encodeURIComponent(courseVersion.id)}" target="_blank" rel="noopener">打开学生端预览　›</a>
        </div>
      `;
      document.body.appendChild(dialog);
      dialog.querySelector('.preview-close').onclick = () => dialog.close();
    }
    dialog.showModal();
  });

  // ── 提交审核 ──
  document.querySelector('.submit')?.addEventListener('click', async () => {
    const btn = document.querySelector('.submit');
    if (!courseVersion?.id) {
      toast('请先加载课程', 'warning');
      return;
    }
    btn.disabled = true;
    btn.textContent = '正在提交…';
    try {
      const schoolId = getActiveSchoolId();
      if (schoolId && window.YuzanApi?.submitForReview) {
        await YuzanApi.submitForReview(courseVersion.id, courseVersion.updatedAt || new Date().toISOString());
      } else {
        await apiRequest(`/schools/${schoolId}/course-versions/${courseVersion.id}/submit`, { method: 'POST' });
      }
      btn.textContent = '已提交审核';
      if (draftEl) draftEl.textContent = '审核中';
      courseVersion.status = 'IN_REVIEW';
      renderSteps();
      setDirty(false);
      toast('课程已提交教学审核', 'success');
    } catch (err) {
      btn.disabled = false;
      btn.textContent = '➤　提交审核';
      if (err.status === 503) {
        toast('审核服务暂不可用，请稍后重试', 'error');
      } else {
        toast(err.message || '提交审核失败', 'error');
      }
    }
  });

  // ── 快捷键保存（Ctrl/Cmd + S）──
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (courseVersion?.id && !dirty) return;
      saveCourse();
    }
  });

  // ── 离开提醒 ──
  window.addEventListener('beforeunload', e => {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  // ── 侧栏未开通链接 ──
  document.querySelectorAll('aside.sidebar [data-unsupported]').forEach(el => {
    el.style.opacity = '.55';
    el.style.cursor = 'not-allowed';
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toast(el.dataset.unsupported || '该功能暂未开通');
    });
  });

  // ── 结构面板 header 操作 ──
  document.querySelectorAll('.structure.panel header span').forEach(span => {
    span.style.cursor = 'not-allowed';
    span.title = '课程结构管理功能暂未开通';
    span.addEventListener('click', (e) => {
      e.preventDefault();
      toast('课程结构管理功能暂未开通');
    });
  });

  // ── 启动 ──
  init();
})();
