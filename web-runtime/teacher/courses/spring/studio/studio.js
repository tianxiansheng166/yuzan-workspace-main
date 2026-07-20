(() => {
  'use strict';

  let courseVersion = null;
  let selectedUnit = null;
  let selectedLesson = null;
  let selectedActivity = null;
  let dirty = false;

  const tabs = [...document.querySelectorAll('.tabs button')];
  const body = document.querySelector('.editor-body');
  const treeEl = document.querySelector('.tree');
  const titleEl = document.querySelector('.title-row h1');
  const crumbEl = document.querySelector('.crumb b');
  const draftEl = document.querySelector('.draft');

  const supportHtml = `<h3>教学支持</h3><div class="support-grid"><button><b>朗读示范音频</b><span>02:18 · 已缓存</span></button><button><b>停顿标记讲解</b><span>教师提示卡</span></button><button><b>课堂提问建议</b><span>6 个问题</span></button></div><div class="dash"></div><h3>差异化支持</h3><div class="inputbox" contenteditable="true">对朗读困难的学生，先进行短句跟读，再进入整段朗读。<span contenteditable="false">31/200</span></div><div class="dash"></div><h3>课堂观察点</h3><ul><li>是否能在标点处自然停顿。</li><li>是否能根据语境调整语调。</li><li>是否能用自己的话复述主要内容。</li></ul>`;
  const offlineHtml = `<h3>离线资源</h3><div class="offline-resource"><div><b>▣ 课文文本</b><span>1.2 MB · 已缓存</span><button>重新下载</button></div><div><b>〰 范读音频</b><span>8.4 MB · 已缓存</span><button>重新下载</button></div><div><b>♧ 学习提示</b><span>0.6 MB · 已缓存</span><button>重新下载</button></div></div><div class="dash"></div><p class="offline-note">离线包会随课程发布，学生在弱网环境下也能完成学习与录音，联网后自动同步。</p>`;

  function statusLabel(status) {
    const map = { DRAFT: '课程草稿', IN_REVIEW: '审核中', PUBLISHED: '已发布', CHANGES_REQUESTED: '需修改', RETIRED: '已归档' };
    return map[status] || status;
  }

  function activityTypeLabel(type) {
    const map = { TEXT: '文本学习', RECORDING: '朗读录音', QUIZ: '智能测评', DISCUSSION: '小组讨论', WORKSHEET: '书面练习' };
    return map[type] || (type || '综合活动');
  }

  function escapeHtml(text) {
    if (text == null) return '';
    return String(text).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function buildGoalEditor() {
    const activity = selectedActivity || {};
    const title = activity.title || '朗读与表达';
    const instruction = activity.instruction || '引导学生通过朗读课文，感受家乡春天的美好；结合生活经验，用自己的话描述春天的变化。';
    return `<h3>学习目标</h3><ul><li>能正确、流利地完成「${escapeHtml(title)}」，注意语气与情感的表达。</li><li>能结合课程材料和关键词，说出自己的理解与感受。</li></ul><div class="dash"></div><h3>核心问题</h3><div class="inputbox" contenteditable="true" role="textbox" aria-label="核心问题">${escapeHtml(instruction)}<span contenteditable="false">${String(instruction).length}/100</span></div><div class="dash"></div><h3>关键内容</h3><div class="rich"><div class="toolbar" role="toolbar">正文　⌄　　<b>B</b>　<i>I</i>　<u>U</u>　　☷　☰　　≡　🔗　▧　⌃</div><p contenteditable="true" role="textbox" aria-label="关键内容">引导学生通过朗读课文，感受家乡春天的美好；<br>结合生活经验，用自己的话描述春天的变化。</p><span>36/500</span></div><div class="dash"></div><div class="activity-title"><h3>学习活动设计</h3><span>▧ 复制　♲ 删除</span></div><div class="activity">活动一：${escapeHtml(title)} <span>⌄</span></div>`;
  }

  function renderEditorHead() {
    const unitTitle = selectedUnit?.title || '第 1 章';
    const lessonTitle = selectedLesson?.title || '课时';
    const activityTitle = selectedActivity?.title || '活动';
    const headEl = document.querySelector('.editor-head b');
    if (headEl) headEl.textContent = `${unitTitle} / ${lessonTitle} / ${activityTitle}`;
  }

  function setDirty(value) {
    dirty = value;
    if (draftEl) draftEl.textContent = dirty ? '未保存' : statusLabel(courseVersion?.status || 'DRAFT');
  }

  function updateCounter(el) {
    const span = el.querySelector('span');
    if (!span) return;
    const max = Number((span.textContent.match(/\/(\d+)/) || [])[1] || 200);
    const clone = el.cloneNode(true);
    clone.querySelector('span')?.remove();
    span.textContent = `${clone.textContent.trim().length}/${max}`;
  }

  function bindEditable() {
    body.querySelectorAll('[contenteditable="true"]').forEach(el => {
      el.addEventListener('input', () => { setDirty(true); updateCounter(el); });
    });
    body.querySelectorAll('.support-grid button').forEach(btn => {
      btn.disabled = true;
      btn.title = '该功能暂未开通';
      btn.style.opacity = '.55';
      btn.addEventListener('click', (e) => { e.preventDefault(); YuzanDemo.toast(`${btn.textContent.trim()}功能暂未开通`); });
    });
    body.querySelectorAll('.offline-resource button').forEach(btn => {
      btn.disabled = true;
      btn.title = '离线资源管理暂未开通';
      btn.style.opacity = '.55';
      btn.addEventListener('click', (e) => { e.preventDefault(); YuzanDemo.toast('离线资源重新下载功能暂未开通'); });
    });
  }

  function switchTab(index) {
    if (index === activeTab) return;
    activeTab = index;
    tabs.forEach(x => x.classList.remove('active'));
    tabs[index].classList.add('active');
    if (index === 0) body.innerHTML = buildGoalEditor();
    else if (index === 1) body.innerHTML = supportHtml;
    else body.innerHTML = offlineHtml;
    bindEditable();
  }

  let activeTab = 0;
  tabs.forEach((tab, i) => tab.addEventListener('click', () => switchTab(i)));

  function renderProperties() {
    const activity = selectedActivity || {};
    const typeLabel = activityTypeLabel(activity.type);
    const propType = document.querySelector('.prop-body .select');
    if (propType) propType.textContent = `${typeLabel}　⌄`;
  }

  function selectNode(unit, lesson, activity, element) {
    selectedUnit = unit;
    selectedLesson = lesson;
    selectedActivity = activity;
    treeEl.querySelectorAll('p').forEach(x => x.classList.remove('selected'));
    treeEl.querySelectorAll('.chapter').forEach(x => x.classList.remove('selected-chapter'));
    if (element) {
      element.classList.add('selected');
      const chapter = element.closest('.chapter');
      if (chapter) chapter.classList.add('selected-chapter');
    }
    renderEditorHead();
    switchTab(0);
    renderProperties();
  }

  function renderStructure() {
    if (!courseVersion) return;
    const units = courseVersion.units || [];
    if (units.length === 0) {
      treeEl.innerHTML = '<div class="chapter">⌄　<b>暂无章节</b></div>';
      return;
    }
    treeEl.innerHTML = units.map((unit, uIndex) => {
      const lessons = unit.lessons || [];
      return `<div class="chapter">⌄　<b>${unit.title || `第 ${uIndex + 1} 章`}</b></div>` +
        lessons.map((lesson, lIndex) => {
          const activities = lesson.activities || [];
          return `<p data-unit="${uIndex}" data-lesson="${lIndex}" data-activity="-1">○　${lesson.title || `课时 ${lIndex + 1}`}</p>` +
            activities.map((activity, aIndex) =>
              `<p class="activity" data-unit="${uIndex}" data-lesson="${lIndex}" data-activity="${aIndex}">△　${activity.title || '未命名活动'}</p>`
            ).join('');
        }).join('');
    }).join('');

    treeEl.querySelectorAll('p').forEach(p => {
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
    if (firstActivityP) firstActivityP.click();
    else {
      const firstP = treeEl.querySelector('p');
      if (firstP) firstP.click();
    }
  }

  async function loadCourseDetails(courseVersionId) {
    const schoolId = YuzanApi.getActiveSchoolId();
    if (!schoolId) {
      YuzanDemo.toast('请先选择学校', 'warning');
      return;
    }
    try {
      courseVersion = await YuzanApi.request(`/schools/${schoolId}/course-versions/${courseVersionId}`, { method: 'GET' });
      if (!courseVersion) throw new Error('课程版本为空');
      titleEl.textContent = courseVersion.title || '未命名课程';
      if (crumbEl) crumbEl.textContent = courseVersion.title || '课程详情';
      draftEl.textContent = statusLabel(courseVersion.status);
      renderStructure();
    } catch (err) {
      YuzanDemo.toast(err.message || '加载课程详情失败', 'error');
      console.error(err);
    }
  }

  async function init() {
    if (!YuzanApi.getToken()) {
      YuzanDemo.toast('请先登录', 'warning');
      location.href = '/login';
      return;
    }
    const schoolId = YuzanApi.getActiveSchoolId();
    if (!schoolId) {
      YuzanDemo.toast('请先选择学校', 'warning');
      location.href = '/select-school';
      return;
    }

    const params = new URLSearchParams(location.search);
    let courseVersionId = params.get('courseVersionId');

    if (!courseVersionId) {
      try {
        const list = await YuzanApi.request(`/schools/${schoolId}/course-versions?limit=20`, { method: 'GET' });
        const items = Array.isArray(list) ? list : (list?.items || []);
        const draft = items.find(v => v.status === 'DRAFT') || items[0];
        courseVersionId = draft?.id;
      } catch (err) {
        YuzanDemo.toast(err.message || '加载课程版本列表失败', 'error');
        return;
      }
    }

    if (!courseVersionId) {
      YuzanDemo.toast('当前学校暂无课程版本', 'warning');
      return;
    }

    await loadCourseDetails(courseVersionId);
  }

  // 原有交互：重命名、折叠章节、添加活动、教学模式、星级、预览、提交、保存快捷键
  document.querySelector('.edit')?.addEventListener('click', () => {
    const value = prompt('课程名称', titleEl.textContent);
    if (value?.trim()) {
      titleEl.textContent = value.trim();
      setDirty(true);
    }
  });

  document.querySelector('.add')?.addEventListener('click', () => {
    const p = document.createElement('p');
    p.textContent = '○　新活动（未命名）';
    treeEl.appendChild(p);
    setDirty(true);
    YuzanDemo.toast('已添加新活动，请编辑内容', 'success');
  });

  document.querySelectorAll('.modes button').forEach(b => b.addEventListener('click', () => b.classList.toggle('on')));

  document.querySelector('.stars')?.addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect();
    const value = Math.max(1, Math.min(5, Math.ceil((e.clientX - r.left) / r.width * 5)));
    e.currentTarget.textContent = '★ '.repeat(value) + '☆ '.repeat(5 - value);
    setDirty(true);
  });

  document.querySelector('.preview')?.addEventListener('click', () => {
    let dialog = document.querySelector('#coursePreview');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'coursePreview';
      dialog.innerHTML = '<button class="preview-close">×</button><h2>学生端预览</h2><div class="preview-card"><span>第二步 · 朗读</span><h3>高原上的春天</h3><p>朗读课文，注意语音语调和停顿。</p><button data-nav="/student/learn/spring-2">打开完整预览　›</button></div>';
      document.body.appendChild(dialog);
      dialog.querySelector('.preview-close').onclick = () => dialog.close();
    }
    dialog.showModal();
  });

  document.querySelector('.submit')?.addEventListener('click', async () => {
    const btn = document.querySelector('.submit');
    btn.disabled = true;
    btn.textContent = '正在提交…';
    try {
      const schoolId = YuzanApi.getActiveSchoolId();
      if (courseVersion?.id && schoolId) {
        await YuzanApi.submitForReview(courseVersion.id, courseVersion.updatedAt || new Date().toISOString());
      }
      btn.textContent = '已提交审核';
      draftEl.textContent = '审核中';
      document.querySelectorAll('.steps .step')[2]?.classList.add('active');
      setDirty(false);
      courseVersion.status = 'IN_REVIEW';
      YuzanDemo.toast('课程已提交教学审核', 'success');
    } catch (err) {
      btn.disabled = false;
      btn.textContent = '➤　提交审核';
      if (err.status === 503) {
        YuzanDemo.toast('审核服务暂不可用，请稍后重试', 'error');
      } else {
        YuzanDemo.toast(err.message || '提交审核失败', 'error');
      }
    }
  });

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (courseVersion?.id && !dirty) return;
      const schoolId = YuzanApi.getActiveSchoolId();
      if (courseVersion?.id && schoolId) {
        YuzanApi.request(`/schools/${schoolId}/course-versions/${courseVersion.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            expectedUpdatedAt: courseVersion.updatedAt || new Date().toISOString(),
            title: titleEl?.textContent || courseVersion.title,
          }),
        }).then(() => {
          setDirty(false);
          YuzanDemo.toast('课程草稿已保存', 'success');
        }).catch(() => {
          YuzanDemo.toast('保存失败，请检查网络', 'error');
        });
      } else {
        setDirty(false);
        YuzanDemo.toast('课程草稿已保存', 'success');
      }
    }
  });

  window.addEventListener('beforeunload', e => {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  init();

  // ── UNSUPPORTED: 侧栏 data-unsupported 链接 ──
  document.querySelectorAll('aside.sidebar [data-unsupported]').forEach(el => {
    el.style.opacity = '.55';
    el.style.cursor = 'not-allowed';
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      YuzanDemo.toast(el.dataset.unsupported || '该功能暂未开通');
    });
  });

  // ── UNSUPPORTED: 结构面板 header 操作（＋ ☷） ──
  document.querySelectorAll('.structure.panel header span').forEach(span => {
    span.style.cursor = 'not-allowed';
    span.title = '课程结构管理功能暂未开通';
    span.addEventListener('click', (e) => {
      e.preventDefault();
      YuzanDemo.toast('课程结构管理功能暂未开通');
    });
  });

  // ── UNSUPPORTED: 前后活动切换（〈 〉） ──
  document.querySelectorAll('.editor-head span').forEach(span => {
    span.style.cursor = 'not-allowed';
    span.title = '前后活动切换功能暂未开通';
    span.addEventListener('click', (e) => {
      e.preventDefault();
      YuzanDemo.toast('前后活动切换功能暂未开通');
    });
  });

  // ── UNSUPPORTED: 活动复制/删除（动态渲染后通过事件委托） ──
  body.addEventListener('click', (e) => {
    const target = e.target.closest('span');
    if (!target) return;
    const text = target.textContent.trim();
    if (text.includes('复制')) { e.preventDefault(); YuzanDemo.toast('活动复制功能暂未开通'); }
    else if (text.includes('删除')) { e.preventDefault(); YuzanDemo.toast('活动删除功能暂未开通'); }
  });

  // ── UNSUPPORTED: topbar 工具图标 ──
  document.querySelectorAll('.topbar .tools span, .topbar .tools .avatar').forEach(el => {
    el.style.cursor = 'not-allowed';
  });
})();
