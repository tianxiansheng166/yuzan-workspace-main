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
  let coursePracticeOptions = [];
  const unsavedActivityIds = new Set();

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
  const panelsEl = $('.panels');
  const mindViewEl = $('[data-bind="mind-view"]');
  const mindTitleEl = $('[data-bind="mind-title"]');
  const mindEdgesEl = $('[data-bind="mind-edges"]');
  const mindNodesEl = $('[data-bind="mind-nodes"]');
  const mindEmptyEl = $('[data-bind="mind-empty"]');
  const mindDetailEl = $('[data-bind="mind-detail"]');
  const createCourseDialog = $('#createCourseDialog');
  const createCourseForm = $('#createCourseForm');
  const createActivityDialog = $('#createActivityDialog');
  const createActivityForm = $('#createActivityForm');

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

  const STUDIO_ACTIVITY_CONTENT_FIELDS = [
    'duration', 'difficulty', 'gradeLevel', 'teachingMode', 'objectives',
    'keyPoints', 'coreQuestion', 'keyContent', 'teacherSummary', 'aiSummary',
    'videoUrl', 'posterUrl', 'subtitleZhUrl', 'subtitleBoUrl', 'timelineMarkers',
    'exercises', 'oralDemoUrl', 'oralDemoText', 'supportAudioUrl', 'pauseGuide',
    'classQuestions', 'differentiation', 'observationPoints', 'offlineResources',
    'tags', 'note'
  ];

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

  function canEditCourse() {
    return ['DRAFT', 'CHANGES_REQUESTED'].includes(courseVersion?.status);
  }

  function toBilingual(text) {
    return {
      originalText: text.trim(),
      locale: courseVersion?.locale || 'zh-CN',
      translationSource: 'NONE',
      reviewStatus: 'REVIEWED',
    };
  }

  function createId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
      const random = Math.random() * 16 | 0;
      return (character === 'x' ? random : (random & 0x3 | 0x8)).toString(16);
    });
  }

  function hydrateStudioActivityFields(version) {
    (version?.units || []).forEach((unit) => (unit.lessons || []).forEach((lesson) =>
      (lesson.activities || []).forEach((activity) => {
        const content = activity.content && typeof activity.content === 'object' && !Array.isArray(activity.content)
          ? activity.content
          : {};
        STUDIO_ACTIVITY_CONTENT_FIELDS.forEach((field) => {
          if (activity[field] === undefined && content[field] !== undefined) {
            activity[field] = content[field];
          }
        });
      }),
    ));
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
    const publishButton = $('[data-action="publish-course-version"]');
    const submitButton = $('.submit');
    if (publishButton) publishButton.disabled = !canEditCourse();
    if (submitButton) submitButton.disabled = !canEditCourse();
  }

  // ── 课程结构渲染 ──
  function renderStructure(preferredActivityId) {
    if (!courseVersion || !treeEl) return;
    const selectedActivityId = preferredActivityId || selectedActivity?.id || '';
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
          `<p class="activity" data-unit="${uIndex}" data-lesson="${lIndex}" data-activity="${aIndex}" data-activity-id="${escapeHtml(activity.id)}">△　${escapeHtml(activity.title || '未命名活动')}</p>`
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

    // Keep the authored activity selected after structure changes and saves.
    const preferredActivity = selectedActivityId
      ? [...treeEl.querySelectorAll('p.activity')].find((item) => item.dataset.activityId === selectedActivityId)
      : null;
    const firstActivityP = preferredActivity || treeEl.querySelector('p.activity');
    if (firstActivityP) {
      firstActivityP.click();
    } else {
      const firstP = treeEl.querySelector('p[data-unit]');
      if (firstP) firstP.click();
    }
  }

  function addUnitToCourse() {
    if (!canEditCourse()) {
      toast('已发布或审核中的课程不能修改结构', 'warning');
      return null;
    }
    if (!Array.isArray(courseVersion.units)) courseVersion.units = [];
    const unit = {
      id: createId(),
      title: `听说单元 ${courseVersion.units.length + 1}`,
      sortOrder: courseVersion.units.length,
      lessons: [],
    };
    const lesson = {
      id: createId(),
      title: '课时 1',
      sortOrder: 0,
      activities: [],
    };
    unit.lessons.push(lesson);
    courseVersion.units.push(unit);
    selectedUnit = unit;
    selectedLesson = lesson;
    selectedActivity = null;
    setDirty(true);
    renderStructure();
    const unitIndex = courseVersion.units.indexOf(unit);
    const lessonNode = treeEl?.querySelector(`p[data-unit="${unitIndex}"][data-lesson="0"][data-activity="-1"]`);
    selectNode(unit, lesson, null, lessonNode);
    return { unit, lesson };
  }

  function ensureSelectedLesson() {
    if (!Array.isArray(courseVersion.units)) courseVersion.units = [];
    if (selectedUnit && selectedLesson && selectedUnit.lessons?.includes(selectedLesson)) {
      return { unit: selectedUnit, lesson: selectedLesson };
    }
    let unit = courseVersion.units[0];
    if (!unit) return addUnitToCourse();
    if (!Array.isArray(unit.lessons)) unit.lessons = [];
    let lesson = unit.lessons[0];
    if (!lesson) {
      lesson = { id: createId(), title: '课时 1', sortOrder: 0, activities: [] };
      unit.lessons.push(lesson);
      selectedUnit = unit;
      selectedLesson = lesson;
      setDirty(true);
    }
    return { unit, lesson };
  }

  function addActivityToSelectedLesson(values) {
    if (!canEditCourse()) {
      toast('已发布或审核中的课程不能添加活动', 'warning');
      return null;
    }
    const target = ensureSelectedLesson();
    if (!target) return null;
    const { unit, lesson } = target;
    if (!Array.isArray(lesson.activities)) lesson.activities = [];
    const type = values.type;
    const instruction = values.instruction.trim();
    let content = {};
    if (type === 'SPEECH') content = { targetText: values.targetText.trim() };
    else if (type === 'CHOICE') content = { prompt: instruction, options: ['开始正式听说练习'] };
    else if (type === 'TEXT') content = { paragraphs: [instruction] };
    else if (type === 'AUDIO') content = { audioUrl: '' };
    else if (type === 'VIDEO') content = { videoUrl: '' };
    else if (type === 'FILL_BLANK') content = { prompt: instruction, placeholder: '填写你的回答' };

    const activity = {
      id: createId(),
      type,
      title: values.title.trim(),
      instruction: toBilingual(instruction),
      sortOrder: lesson.activities.length,
      required: true,
      content,
      resources: [],
      teacherNotes: toBilingual(values.teacherNotes),
      studentNotes: toBilingual(values.studentNotes),
    };
    lesson.activities.push(activity);
    unsavedActivityIds.add(activity.id);
    selectedUnit = unit;
    selectedLesson = lesson;
    selectedActivity = activity;
    setDirty(true);
    renderStructure(activity.id);
    return activity;
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

  // ── MIND 结构图：只从当前 CourseVersion 组装，不声明 AI 推理 ──
  const MIND_TYPE_LABEL = {
    root: '课程版本',
    objective: '课程目标',
    unit: '教学单元',
    lesson: '课时',
    activity: '教学活动',
    practice: '练习闭环',
    resource: '课程资源'
  };

  const RESOURCE_KIND_LABEL = {
    VIDEO: '视频',
    DOCUMENT: '课件',
    AUDIO: '音频',
    IMAGE: '图片',
    OTHER: '资源'
  };

  function contentText(value) {
    if (typeof value === 'string') return value.trim();
    if (!value || typeof value !== 'object') return '';
    return String(value.originalText || value.text || value.title || value.label || '').trim();
  }

  function shortMindText(value, max = 44) {
    const text = contentText(value).replace(/\s+/g, ' ');
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function ordered(items) {
    return (Array.isArray(items) ? items : []).slice().sort((a, b) =>
      Number(a?.sortOrder ?? 0) - Number(b?.sortOrder ?? 0)
    );
  }

  function practiceFor(activity) {
    const content = activity?.content && typeof activity.content === 'object' ? activity.content : {};
    const reference = activity?.practiceReference || content.practiceReference;
    const label = contentText(
      reference?.title || reference?.label || activity?.practiceTitle || content.practiceLabel
    );
    const type = String(activity?.type || '').toUpperCase();
    if (!reference && !label && type !== 'PRACTICE') return null;
    return {
      label: label || contentText(activity?.title) || '本课能力练习',
      reference,
      source: reference ? 'Activity.practiceReference' : (label ? 'Activity.content.practiceLabel' : 'Activity.type'),
    };
  }

  function activityPoints(activity) {
    const points = [];
    const instruction = contentText(activity?.instruction);
    const studentNotes = contentText(activity?.studentNotes);
    const content = activity?.content && typeof activity.content === 'object' ? activity.content : {};
    [
      ...(Array.isArray(activity?.keyPoints) ? activity.keyPoints : []),
      ...(instruction ? [instruction] : []),
      ...(contentText(activity?.coreQuestion) ? [contentText(activity.coreQuestion)] : []),
      ...(studentNotes ? [studentNotes] : [])
    ].forEach((value) => {
      const text = shortMindText(value, 28);
      if (text && !points.includes(text) && points.length < 3) points.push(text);
    });
    return points;
  }

  function buildMindGraph(version) {
    const nodes = [];
    const edges = [];
    const units = ordered(version.units);
    const objectives = ordered(version.objectives);
    if (units.length === 0 && objectives.length === 0) return { nodes, edges };
    const addNode = (node) => {
      nodes.push({ ...node, typeLabel: MIND_TYPE_LABEL[node.kind] || '课程内容' });
      return node.id;
    };
    const addEdge = (from, to) => {
      if (from && to) edges.push({ from, to });
    };

    const root = {
      id: 'course', kind: 'root', branch: 'root', x: 12, y: 46,
      title: shortMindText(version.title || '未命名课程', 30),
      subtitle: '真实 CourseVersion',
      source: `CourseVersion · ${version.id || '当前课程版本'}`,
      content: version.title || '未命名课程'
    };
    addNode(root);

    objectives.slice(0, 2).forEach((objective, index) => {
      const id = `objective-${index}`;
      addNode({
        id, kind: 'objective', branch: 'goal', x: 35, y: index ? 25 : 9,
        title: shortMindText(objective, 30) || `目标 ${index + 1}`,
        subtitle: '来自课程目标',
        source: `CourseVersion.objectives[${index}]`,
        content: contentText(objective)
      });
      addEdge(root.id, id);
    });

    const unit = units[0];
    const lessons = ordered(unit?.lessons);
    const lesson = lessons.find((item) => ordered(item?.activities).length > 0) || lessons[0];

    if (unit) {
      addNode({
        id: 'unit', kind: 'unit', branch: 'goal', x: 35, y: 51,
        title: shortMindText(unit.title, 30) || '未命名单元',
        subtitle: units.length > 1 ? `真实单元 · 共 ${units.length} 个` : '真实教学单元',
        source: `CourseVersion.units[${units.indexOf(unit)}]`,
        content: unit.title || '未命名单元'
      });
      addEdge(root.id, 'unit');
    }

    if (lesson) {
      addNode({
        id: 'lesson', kind: 'lesson', branch: 'goal', x: 35, y: 76,
        title: shortMindText(lesson.title, 30) || '未命名课时',
        subtitle: '真实课时标题',
        source: `CourseVersion.units[${units.indexOf(unit)}].lessons[${lessons.indexOf(lesson)}]`,
        content: lesson.title || '未命名课时'
      });
      addEdge(unit ? 'unit' : root.id, 'lesson');
    }

    const activities = ordered(lesson?.activities);
    const practiceActivity = activities.find((activity) => practiceFor(activity));
    const selectedActivities = activities.slice(0, 3);
    if (practiceActivity && !selectedActivities.includes(practiceActivity)) selectedActivities.push(practiceActivity);
    for (const activity of activities) {
      if (selectedActivities.length >= 4) break;
      if (!selectedActivities.includes(activity)) selectedActivities.push(activity);
    }

    selectedActivities.forEach((activity, index) => {
      const activityIndex = activities.indexOf(activity);
      const id = `activity-${activityIndex}`;
      addNode({
        id, kind: 'activity', branch: 'activity', x: 61, y: 9 + index * 21,
        title: shortMindText(activity.title, 31) || `活动 ${activityIndex + 1}`,
        subtitle: `${activity.type || '活动'}${activity.required ? ' · 必做' : ''}`,
        source: `...activities[${activityIndex}]`,
        content: contentText(activity.title),
        points: activityPoints(activity),
        activity
      });
      addEdge(lesson ? 'lesson' : (unit ? 'unit' : root.id), id);
    });

    const resourceSeen = new Set();
    const resourceCandidates = selectedActivities.flatMap((activity) => {
      return (Array.isArray(activity?.resources) ? activity.resources : []).map((resource) => ({ resource, activity }));
    });
    resourceCandidates.forEach(({ resource, activity }) => {
      const key = resource?.id || `${resource?.kind || 'OTHER'}:${resource?.mediaType || ''}`;
      if (resourceSeen.has(key) || resourceSeen.size >= 2) return;
      resourceSeen.add(key);
      const sourceActivity = selectedActivities.find((item) => item === activity);
      const resourceIndex = resourceCandidates.findIndex((item) => item.resource === resource);
      const kind = RESOURCE_KIND_LABEL[resource?.kind] || resource?.kind || '资源';
      const id = `resource-${resourceSeen.size}`;
      addNode({
        id, kind: 'resource', branch: 'activity', x: 84, y: 19 + (resourceSeen.size - 1) * 23,
        title: kind,
        subtitle: resource?.mediaType || '真实资源类型',
        source: `activities[${activities.indexOf(activity)}].resources[${resourceIndex}]`,
        content: `${kind}${resource?.altText ? ` · ${shortMindText(resource.altText, 20)}` : ''}`,
        resource
      });
      addEdge(sourceActivity ? `activity-${activities.indexOf(activity)}` : null, id);
    });

    if (practiceActivity) {
      const practice = practiceFor(practiceActivity);
      const practiceIndex = activities.indexOf(practiceActivity);
      addNode({
        id: 'practice', kind: 'practice', branch: 'practice', x: 84, y: 76,
        title: shortMindText(practice.label, 30),
        subtitle: '真实练习引用',
        source: `...activities[${practiceIndex}] · ${practice.source}`,
        content: practice.label,
        practice
      });
      addEdge(`activity-${practiceIndex}`, 'practice');
    }

    return { nodes: nodes.slice(0, 12), edges };
  }

  function renderMindDetail(node) {
    if (!mindDetailEl || !node) return;
    mindNodesEl?.querySelectorAll('.mind-node').forEach((element) => {
      element.classList.toggle('is-selected', element.dataset.mindId === node.id);
    });
    const points = Array.isArray(node.points) ? node.points : [];
    const pointMarkup = points.length ? `<div class="mind-detail-section"><span>教学要点</span><ul>${points.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul></div>` : '';
    mindDetailEl.innerHTML = `
      <span class="mind-detail-kicker">${escapeHtml(node.typeLabel)}</span>
      <h3>${escapeHtml(node.title)}</h3>
      <p class="mind-detail-subtitle">${escapeHtml(node.subtitle || '')}</p>
      <div class="mind-detail-section"><span>来源</span><strong>${escapeHtml(node.source || '当前课程数据')}</strong></div>
      <div class="mind-detail-section"><span>当前内容</span><p>${escapeHtml(node.content || '暂无可展示文本')}</p></div>
      ${pointMarkup}
    `;
  }

  function renderMindView() {
    if (!mindViewEl || !courseVersion || !mindNodesEl || !mindEdgesEl) return;
    if (mindTitleEl) mindTitleEl.textContent = courseVersion.title || '未命名课程';
    const graph = buildMindGraph(courseVersion);
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const point = (node) => ({ x: (node.x / 100) * 760, y: (node.y / 100) * 520 });
    mindEdgesEl.innerHTML = graph.edges.map(({ from, to }) => {
      const a = nodeById.get(from); const b = nodeById.get(to);
      if (!a || !b) return '';
      const start = point(a); const end = point(b); const bend = Math.max(36, Math.abs(end.x - start.x) * 0.35);
      return `<path d="M ${start.x} ${start.y} C ${start.x + bend} ${start.y}, ${end.x - bend} ${end.y}, ${end.x} ${end.y}" />`;
    }).join('');
    mindNodesEl.innerHTML = graph.nodes.map((node) => `
      <button type="button" class="mind-node mind-node-${escapeHtml(node.kind)}" data-mind-id="${escapeHtml(node.id)}" style="left:${node.x}%;top:${node.y}%">
        <span class="mind-node-type">${escapeHtml(node.typeLabel)}</span>
        <strong>${escapeHtml(node.title)}</strong>
        <small>${escapeHtml(node.subtitle || '')}</small>
      </button>
    `).join('');
    mindEmptyEl.hidden = graph.nodes.length > 0;
    mindNodesEl.querySelectorAll('[data-mind-id]').forEach((element) => {
      element.addEventListener('click', () => renderMindDetail(nodeById.get(element.dataset.mindId)));
    });
    renderMindDetail(nodeById.get(graph.nodes.find((node) => node.kind === 'practice')?.id) || graph.nodes[0]);
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

    const isMind = tabName === 'mind';
    panelsEl?.classList.toggle('mind-mode', isMind);
    if (mindViewEl) mindViewEl.hidden = !isMind;
    if (isMind) {
      renderMindView();
      return;
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
      bindCoursePracticeEditor();
    }
  }

  function bindCoursePracticeEditor() {
    const select = editorBodyEl?.querySelector('[data-course-practice-definition]');
    const required = editorBodyEl?.querySelector('[data-course-practice-required]');
    const saveButton = editorBodyEl?.querySelector('[data-action="save-course-practice"]');
    const status = editorBodyEl?.querySelector('[data-bind="course-practice-current"]');
    if (!select || !required || !saveButton || !selectedActivity?.id) return;

    saveButton.addEventListener('click', async (event) => {
      event.preventDefault();
      if (!courseVersion?.id || !['DRAFT', 'CHANGES_REQUESTED'].includes(courseVersion.status)) {
        toast('只有可编辑课程草稿才能保存练习关联', 'warning');
        return;
      }
      const practiceDefinitionId = select.value;
      if (!practiceDefinitionId) {
        toast('请选择一个已发布练习', 'warning');
        return;
      }
      const schoolId = getActiveSchoolId();
      if (!schoolId) {
        toast('请先选择学校', 'warning');
        return;
      }

      saveButton.disabled = true;
      saveButton.textContent = '正在保存…';
      try {
        const saved = await apiRequest(
          `/schools/${schoolId}/course-versions/${courseVersion.id}/activities/${selectedActivity.id}/practice`,
          {
            method: 'PUT',
            body: JSON.stringify({
              practiceDefinitionId,
              required: required.checked,
              expectedUpdatedAt: courseVersion.updatedAt,
            }),
          },
        );
        selectedActivity.practiceReference = {
          practiceDefinitionId: saved.practiceDefinitionId,
          title: saved.title,
          required: saved.required,
        };
        courseVersion.updatedAt = saved.courseVersionUpdatedAt;
        if (status) status.textContent = `当前关联：${saved.title}`;
        saveButton.textContent = '已保存';
        toast('课程练习关联已保存', 'success');
      } catch (err) {
        saveButton.textContent = '保存练习关联';
        toast(err.message || '练习关联保存失败，请重新载入课程后重试', 'error');
      } finally {
        saveButton.disabled = false;
      }
    });
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
    const practiceReference = a.practiceReference || null;
    const currentPracticeId = practiceReference?.practiceDefinitionId || '';
    const availablePractices = coursePracticeOptions.slice();
    if (practiceReference && !availablePractices.some((option) => option.id === currentPracticeId)) {
      availablePractices.unshift({
        id: currentPracticeId,
        title: practiceReference.title,
        summary: '当前活动已关联的练习',
        requiresRecording: false,
      });
    }
    const editablePractice = canEditCourse() && !unsavedActivityIds.has(a.id);

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

      <h3>课程练习关联</h3>
      <p class="form-hint">选择本校已发布的正式练习。学生进入已开放的课程后，会从当前活动启动该练习。</p>
      <label class="form-row">
        <span>已发布练习</span>
        <select data-course-practice-definition ${editablePractice ? '' : 'disabled'}>
          <option value="">${availablePractices.length ? '选择练习' : '没有可关联的已发布练习'}</option>
          ${availablePractices.map((option) => `<option value="${escapeHtml(option.id)}" ${option.id === currentPracticeId ? 'selected' : ''}>${escapeHtml(option.title)}${option.requiresRecording ? ' · 含录音题' : ''}</option>`).join('')}
        </select>
      </label>
      <label class="form-row practice-required-row">
        <input type="checkbox" data-course-practice-required ${practiceReference?.required !== false ? 'checked' : ''} ${editablePractice ? '' : 'disabled'}>
        <span>完成课程时要求提交此练习</span>
      </label>
      <p class="form-hint" data-bind="course-practice-current">${practiceReference ? `当前关联：${escapeHtml(practiceReference.title)}` : '当前活动尚未关联正式练习。'}</p>
      <button class="btn-add-item" data-action="save-course-practice" ${editablePractice && availablePractices.length ? '' : 'disabled'}>保存练习关联</button>
      ${unsavedActivityIds.has(a.id)
        ? '<p class="form-hint">请先保存新活动，再绑定正式练习。</p>'
        : editablePractice ? '' : '<p class="form-hint">已发布或审核中的课程版本不可直接修改。请创建新的草稿版本后编辑。</p>'}
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
      selectedUnit = null;
      selectedLesson = null;
      selectedActivity = null;
      unsavedActivityIds.clear();
      const optionsResult = await apiRequest(
        `/schools/${schoolId}/course-versions/${courseVersionId}/practice-options`,
        { method: 'GET' },
      );
      coursePracticeOptions = Array.isArray(optionsResult)
        ? optionsResult
        : Array.isArray(optionsResult?.items)
          ? optionsResult.items
          : [];
      hydrateStudioActivityFields(courseVersion);

      // 渲染标题
      if (titleEl) titleEl.textContent = courseVersion.title || '未命名课程';
      if (crumbEl) crumbEl.textContent = courseVersion.title || '课程详情';
      if (draftEl) draftEl.textContent = STATUS_LABEL[courseVersion.status || 'DRAFT'];

      renderSteps();
      renderStructure();
      if (new URLSearchParams(location.search).get('tab') === 'mind') switchTab('mind');
    } catch (err) {
      console.error('[studio] 加载课程详情失败:', err);
      toast(err.message || '加载课程详情失败', 'error');
      if (titleEl) titleEl.textContent = '加载失败';
      if (draftEl) draftEl.textContent = '错误';
    }
  }

  // ── 保存（通过正式 CourseVersion PATCH 持久化课程树与元数据）──
  async function saveCourse() {
    if (!courseVersion?.id) {
      toast('课程版本未加载', 'warning');
      return false;
    }
    if (!canEditCourse()) {
      toast('当前课程版本不可编辑', 'warning');
      return false;
    }
    const schoolId = getActiveSchoolId();
    if (!schoolId) {
      toast('请先选择学校', 'warning');
      return false;
    }

    try {
      const units = (courseVersion.units || []).map((unit) => ({
        ...unit,
        lessons: (unit.lessons || []).map((lesson) => ({
          ...lesson,
          activities: (lesson.activities || []).map((activity) => {
            const content = activity.content && typeof activity.content === 'object' && !Array.isArray(activity.content)
              ? { ...activity.content }
              : {};
            STUDIO_ACTIVITY_CONTENT_FIELDS.forEach((field) => {
              if (activity[field] !== undefined) content[field] = activity[field];
            });
            return {
              id: activity.id,
              type: activity.type,
              title: activity.title,
              instruction: activity.instruction,
              sortOrder: activity.sortOrder,
              required: activity.required,
              completionRule: activity.completionRule,
              content,
              teacherNotes: activity.teacherNotes,
              studentNotes: activity.studentNotes,
              resources: activity.resources || [],
              practiceReference: activity.practiceReference || null,
            };
          }),
        })),
      }));

      const savedVersion = await apiRequest(`/schools/${schoolId}/course-versions/${courseVersion.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          expectedUpdatedAt: courseVersion.updatedAt || new Date().toISOString(),
          title: titleEl?.textContent || courseVersion.title,
          units,
        })
      });
      courseVersion = savedVersion;
      unsavedActivityIds.clear();
      if (titleEl) titleEl.textContent = courseVersion.title || '未命名课程';
      if (crumbEl) crumbEl.textContent = courseVersion.title || '课程详情';
      renderSteps();
      renderStructure(selectedActivity?.id);
      setDirty(false);
      toast('课程草稿已保存', 'success');
      return true;
    } catch (err) {
      console.error('[studio] 保存失败:', err);
      toast(err.message || '保存失败，请检查网络', 'error');
      return false;
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

  // ── 教师课程草稿与活动结构创建 ──
  $('[data-action="new-course"]')?.addEventListener('click', () => {
    if (dirty) {
      toast('请先保存当前课程草稿，再创建新课程', 'warning');
      return;
    }
    createCourseForm?.reset();
    createCourseForm?.querySelector('.dialog-error')?.replaceChildren();
    createCourseDialog?.showModal();
    createCourseForm?.elements.namedItem('title')?.focus();
  });

  createCourseForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!createCourseForm.reportValidity()) return;
    const schoolId = getActiveSchoolId();
    if (!schoolId) {
      toast('请先选择学校', 'warning');
      return;
    }
    const submit = createCourseForm.querySelector('[type="submit"]');
    const error = createCourseForm.querySelector('.dialog-error');
    const title = createCourseForm.elements.namedItem('title').value.trim();
    const objective = createCourseForm.elements.namedItem('objective').value.trim();
    submit.disabled = true;
    submit.textContent = '正在创建…';
    error.textContent = '';
    try {
      const created = await apiRequest(`/schools/${schoolId}/course-versions`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          description: `由教师工作台创建：${title}`,
          gradeBand: createCourseForm.elements.namedItem('gradeBand').value.trim(),
          objectives: [{
            originalText: objective,
            locale: 'zh-CN',
            translationSource: 'NONE',
            reviewStatus: 'REVIEWED',
          }],
        }),
      });
      if (!created?.id) throw new Error('服务端未返回课程版本 ID');
      const url = new URL(location.href);
      url.searchParams.set('courseVersionId', created.id);
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      createCourseDialog.close();
      await loadCourseDetails(created.id);
      toast('课程草稿已创建', 'success');
    } catch (err) {
      error.textContent = err.message || '创建课程失败，请检查网络后重试';
    } finally {
      submit.disabled = false;
      submit.textContent = '创建课程';
    }
  });

  $('[data-action="add-unit"]')?.addEventListener('click', () => {
    const result = addUnitToCourse();
    if (result) toast('已添加单元和首个课时，请添加课程活动', 'success');
  });

  $('[data-action="add-activity"]')?.addEventListener('click', () => {
    if (!courseVersion?.id) {
      toast('请先创建或打开一门课程', 'warning');
      return;
    }
    if (!canEditCourse()) {
      toast('已发布或审核中的课程不能添加活动', 'warning');
      return;
    }
    createActivityForm?.reset();
    createActivityForm.elements.namedItem('type').value = 'SPEECH';
    createActivityForm.querySelector('.dialog-error').textContent = '';
    const targetLabel = createActivityForm.querySelector('[data-speech-target-label]');
    targetLabel.hidden = false;
    createActivityForm.elements.namedItem('targetText').required = true;
    createActivityDialog?.showModal();
    createActivityForm.elements.namedItem('title')?.focus();
  });

  createActivityForm?.elements.namedItem('type')?.addEventListener('change', (event) => {
    const isSpeech = event.currentTarget.value === 'SPEECH';
    const targetLabel = createActivityForm.querySelector('[data-speech-target-label]');
    targetLabel.hidden = !isSpeech;
    createActivityForm.elements.namedItem('targetText').required = isSpeech;
  });

  createActivityForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!createActivityForm.reportValidity()) return;
    const form = createActivityForm.elements;
    const values = {
      type: form.namedItem('type').value,
      title: form.namedItem('title').value,
      instruction: form.namedItem('instruction').value,
      targetText: form.namedItem('targetText').value,
      teacherNotes: form.namedItem('teacherNotes').value,
      studentNotes: form.namedItem('studentNotes').value,
    };
    const activity = addActivityToSelectedLesson(values);
    if (!activity) return;
    createActivityDialog.close();
    toast('活动已加入课程草稿，请保存后再绑定正式练习', 'success');
  });

  document.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => document.getElementById(button.dataset.closeDialog)?.close());
  });

  [createCourseDialog, createActivityDialog].forEach((dialog) => {
    dialog?.addEventListener('click', (event) => {
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
  });

  $('[data-action="publish-course-version"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    if (!courseVersion?.id || !canEditCourse()) {
      toast('只有可编辑的课程草稿可以发布', 'warning');
      return;
    }
    if (dirty && !(await saveCourse())) return;
    const schoolId = getActiveSchoolId();
    button.disabled = true;
    button.textContent = '正在发布…';
    try {
      const published = await apiRequest(`/schools/${schoolId}/course-versions/${courseVersion.id}/publish`, { method: 'POST' });
      courseVersion.status = published.status;
      courseVersion.version = published.version;
      courseVersion.updatedAt = published.updatedAt || courseVersion.updatedAt;
      if (draftEl) draftEl.textContent = STATUS_LABEL[courseVersion.status] || '已发布';
      renderSteps();
      switchTab(activeTab);
      toast('课程版本已发布，可在教学任务中投放给授权班级', 'success');
    } catch (err) {
      toast(err.message || '课程发布失败，请根据校验提示完善课程后重试', 'error');
    } finally {
      button.textContent = '发布课程';
      button.disabled = !canEditCourse();
    }
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
