(() => {
  'use strict';

  /* ── 状态 ── */
  const STATUS_MAP = {
    DRAFT:            { cls: 'draft',     label: '草稿' },
    IN_REVIEW:        { cls: 'review',    label: '待审核' },
    CHANGES_REQUESTED:{ cls: 'rejected',  label: '需修改' },
    APPROVED:         { cls: 'review',    label: '已批准' },
    PUBLISHED:        { cls: 'published', label: '已发布' },
    RETIRED:          { cls: 'archived',  label: '已停用' },
  };

  let courseList = [];       // 当前页课程版本摘要
  let currentCourse = null;  // 当前选中课程的完整详情
  let searchKeyword = '';
  let nextCursor = null;
  let prevCursor = null;
  let isLoading = false;
  let totalCount = 0;

  /* ── 工具 ── */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  function iconUse(id) { return `<svg><use href="#i-${id}"></use></svg>`; }
  function statusHTML(statusKey) {
    const m = STATUS_MAP[statusKey] || STATUS_MAP.DRAFT;
    return `<span class="status ${m.cls}"><i></i>${m.label}</span>`;
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fmtMinutes(m) { return m ? `${m} 分钟` : '—'; }

  let toastTimer;
  function showToast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ── 树形目录构建 ── */
  function buildTreeFromCourses(list) {
    // 按 gradeBand → capabilityTheme 聚合
    const gradeOrder = ['小学低段','小学中段','小学高段','初中','高中'];
    const grades = {};
    list.forEach(cv => {
      const g = cv.gradeBand || '未分类';
      if (!grades[g]) grades[g] = { label: g, themes: {} };
      const t = cv.capabilityTheme || '未分类';
      if (!grades[g].themes[t]) grades[g].themes[t] = 0;
      grades[g].themes[t]++;
    });
    return gradeOrder
      .filter(g => grades[g])
      .map(g => {
        const grade = grades[g];
        const themeKeys = Object.keys(grade.themes);
        const children = themeKeys.map(t => ({
          id: `${g}-${t}`,
          label: t,
          count: grade.themes[t],
          icon: 'folder',
        }));
        return {
          id: g,
          label: g,
          count: themeKeys.reduce((s, t) => s + grade.themes[t], 0),
          icon: 'book-small',
          open: false,
          children,
        };
      });
  }

  let treeData = [];

  function renderTreeNode(node, depth = 0) {
    const hasChildren = node.children && node.children.length;
    const twisty = hasChildren ? (node.open ? '⌄' : '›') : '';
    const childHTML = hasChildren && node.open
      ? `<ul>${node.children.map(c => renderTreeNode(c, depth+1)).join('')}</ul>`
      : '';
    return `<li><div class="tree-item ${node.active ? 'active' : ''} tree-depth-${depth}" data-tree-id="${node.id}"><span class="twisty">${twisty}</span><span class="icon">${iconUse(node.icon || 'folder')}</span><span class="label">${node.label}</span><span class="count">${node.count||0}门课程</span></div>${childHTML}</li>`;
  }

  function renderTree() {
    $('#treeList').innerHTML = treeData.map(node => renderTreeNode(node)).join('');
    $$('.tree-item').forEach(item => {
      item.addEventListener('click', () => {
        $$('.tree-item.active').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        // 按树节点筛选：用 gradeBand + capabilityTheme 过滤
        const treeId = item.dataset.treeId;
        filterByTree(treeId);
      });
    });
  }

  let activeTreeFilter = null;

  function filterByTree(treeId) {
    activeTreeFilter = treeId;
    renderTable();
  }

  function matchesFilter(cv) {
    if (!activeTreeFilter) return true;
    if (cv.gradeBand === activeTreeFilter) return true;
    if (`${cv.gradeBand}-${cv.capabilityTheme}` === activeTreeFilter) return true;
    return false;
  }

  /* ── 课程列表 ── */
  function matchesSearch(cv) {
    if (!searchKeyword) return true;
    const s = searchKeyword.toLowerCase();
    return (cv.title || '').toLowerCase().includes(s) || (cv.id || '').toLowerCase().includes(s);
  }

  async function loadCourseVersions(status) {
    if (isLoading) return;
    isLoading = true;
    $('#courseTableBody').innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:#888">加载中…</td></tr>`;
    try {
      const result = await YuzanApi.listCourseVersions({ status, limit: 20 });
      courseList = Array.isArray(result) ? result : (result.items || result.data || []);
      totalCount = result.total || courseList.length;
      nextCursor = result.nextCursor || null;
      prevCursor = result.prevCursor || null;
      // 构建树
      treeData = buildTreeFromCourses(courseList);
      renderTree();
      renderTable();
      $('#tableTotal').textContent = `共 ${totalCount} 条`;
    } catch (err) {
      showToast('加载课程失败：' + (err.message || '未知错误'));
      $('#courseTableBody').innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:#c45c3e">加载失败</td></tr>`;
    } finally {
      isLoading = false;
    }
  }

  function renderTable() {
    const body = $('#courseTableBody');
    const filtered = courseList.filter(cv => matchesSearch(cv) && matchesFilter(cv));
    if (filtered.length === 0) {
      body.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:#888">暂无课程</td></tr>`;
      $('#tableCount').textContent = '0 门课程';
      return;
    }
    $('#tableCount').textContent = `${filtered.length} 门课程`;
    body.innerHTML = filtered.map(cv => {
      const sm = STATUS_MAP[cv.status] || STATUS_MAP.DRAFT;
      const selected = currentCourse && currentCourse.id === cv.id;
      return `<tr class="${selected ? 'selected' : ''}" data-course-id="${cv.id}">
        <td><input type="checkbox" aria-label="选择 ${cv.title}"></td>
        <td data-label="课程/模块"><div class="row-main"><span class="drag-handle">${iconUse('drag')}</span><div class="row-title"><strong>${cv.title || '无标题'}</strong><small>${cv.id ? cv.id.slice(0,12) : ''}</small></div></div></td>
        <td data-label="当前版本">v${cv.version || 1}</td>
        <td data-label="版本状态">${statusHTML(cv.status)}</td>
        <td data-label="更新人">${cv.authorUserId ? cv.authorUserId.slice(0,8) : '—'}</td>
        <td data-label="时长">${fmtMinutes(cv.estimatedMinutes)}</td>
        <td data-label="学段">${cv.gradeBand || '—'}</td>
        <td data-label="发布状态">${statusHTML(cv.status)}</td>
        <td><button class="ops-btn" aria-label="更多操作">${iconUse('dots')}</button></td>
      </tr>`;
    }).join('');

    body.querySelectorAll('tr[data-course-id]').forEach(row => {
      row.addEventListener('click', async (e) => {
        if (e.target.closest('input') || e.target.closest('button')) return;
        const id = row.dataset.courseId;
        await selectCourse(id);
      });
    });
  }

  /* ── 课程详情 ── */
  async function selectCourse(id) {
    try {
      const detail = await YuzanApi.getCourseVersionDetail(id);
      currentCourse = detail;
      renderTable(); // 更新选中态
      renderDetail();
    } catch (err) {
      showToast('加载详情失败：' + (err.message || '未知错误'));
    }
  }

  function renderDetail() {
    const cv = currentCourse;
    if (!cv) return;

    const sm = STATUS_MAP[cv.status] || STATUS_MAP.DRAFT;

    $('#detailTitle').textContent = cv.title || '无标题';
    const pill = $('#detailStatusPill');
    pill.className = `status-pill ${sm.cls}`;
    pill.textContent = sm.label;
    $('#detailCode').textContent = cv.id || '—';
    $('#detailVersion').textContent = `v${cv.version || 1}`;
    $('#detailUpdated').textContent = fmtDate(cv.updatedAt);
    $('#previewDuration').textContent = fmtMinutes(cv.estimatedMinutes);

    // 资源数
    const resourceCount = countResources(cv);
    $('#previewAssets').textContent = `${resourceCount} 个`;

    // 按钮显示逻辑
    const isDraft = cv.status === 'DRAFT';
    const isInReview = cv.status === 'IN_REVIEW';
    const isApproved = cv.status === 'APPROVED';
    const isPublished = cv.status === 'PUBLISHED';

    $('#submitReviewBtn').style.display = isDraft ? '' : 'none';
    $('#publishBtn').style.display = (isApproved || isInReview) ? '' : 'none';
    $('#archiveBtn').style.display = isPublished ? '' : 'none';
    // 上传资源对所有非停用课程可用；分配仅对已发布课程可用
    $('#uploadResourceBtn').style.display = cv.status !== 'RETIRED' ? '' : 'none';
    $('#assignBtn').style.display = isPublished ? '' : 'none';

    // 课程大纲
    const outline = buildOutline(cv);
    $('#outlineList').innerHTML = outline.length
      ? outline.map(item => `<li><b>${item.title}</b><time>${item.duration}</time></li>`).join('')
      : '<li><b>暂无大纲</b></li>';

    // 关联学校 — 简化显示，从 assignments 加载太复杂，暂时显示为空
    $('#schoolCount').textContent = '0';
    $('#schoolList').innerHTML = '<li><i style="background:#d9dde1"></i><div><strong>暂无关联学校</strong><span>发布后通过"分配"关联学校</span></div><small>待设置</small></li>';

    // 版本历史 — API 不返回历史版本，显示当前版本信息
    $('#versionHistory').innerHTML = `<li><span class="version-pill">● <strong>v${cv.version || 1}</strong> <b>${sm.label}</b></span><div><small>${fmtDate(cv.updatedAt)}　${cv.title}</small></div></li>`;

    // 发布校验 — 根据数据推导
    const validation = deriveValidation(cv);
    $('#validationList').innerHTML = validation.map(v =>
      `<li class="${v.type === 'ok' ? '' : (v.type === 'warn' ? 'warn' : 'fail')}"><i></i><div><strong>${v.title}</strong><p>${v.detail}</p></div></li>`
    ).join('');

    // 更新发布弹窗内容
    $('#modalTitle').textContent = '发布课程版本';
    const modalP = document.querySelector('#modalBackdrop .modal p');
    if (modalP) modalP.textContent = `即将发布"${cv.title}"当前版本。系统将检查课程内容完整性和资源状态。`;
  }

  function countResources(cv) {
    let count = 0;
    (cv.units || []).forEach(u => {
      (u.lessons || []).forEach(l => {
        (l.activities || []).forEach(a => {
          count += (a.resources || []).length;
        });
      });
    });
    return count;
  }

  function buildOutline(cv) {
    const items = [];
    (cv.units || []).forEach(u => {
      items.push({ title: `📦 ${u.title || '未命名单元'}`, duration: '' });
      (u.lessons || []).forEach(l => {
        items.push({ title: `  📖 ${l.title || '未命名课次'}`, duration: '' });
        (l.activities || []).forEach(a => {
          items.push({ title: `    ▸ ${a.title || '未命名活动'}`, duration: a.type || '' });
        });
      });
    });
    return items;
  }

  function deriveValidation(cv) {
    const results = [];
    if (cv.title) {
      results.push({ type: 'ok', title: '标题已填写', detail: cv.title });
    } else {
      results.push({ type: 'fail', title: '标题缺失', detail: '课程必须有标题' });
    }
    if (cv.gradeBand) {
      results.push({ type: 'ok', title: '学段已设置', detail: cv.gradeBand });
    } else {
      results.push({ type: 'warn', title: '学段未设置', detail: '建议设置学段以便课程发现' });
    }
    const unitCount = (cv.units || []).length;
    if (unitCount > 0) {
      results.push({ type: 'ok', title: '课程结构已创建', detail: `${unitCount} 个单元` });
    } else {
      results.push({ type: 'warn', title: '课程结构为空', detail: '请添加至少一个单元和课次' });
    }
    const resCount = countResources(cv);
    if (resCount > 0) {
      results.push({ type: 'ok', title: '资源已绑定', detail: `${resCount} 个资源` });
    } else {
      results.push({ type: 'warn', title: '暂无资源', detail: '请上传视频、封面等资源' });
    }
    return results;
  }

  /* ── 创建课程 ── */
  function openCreateModal() {
    $('#createModalBackdrop').hidden = false;
    $('#createTitle').focus();
  }

  function closeCreateModal() {
    $('#createModalBackdrop').hidden = true;
    $('#createForm').reset();
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    const title = $('#createTitle').value.trim();
    if (!title) { showToast('请输入课程名称'); return; }

    const payload = { title };
    const desc = $('#createDesc').value.trim();
    if (desc) payload.description = desc;
    const gradeBand = $('#createGradeBand').value;
    if (gradeBand) payload.gradeBand = gradeBand;
    const difficulty = $('#createDifficulty').value;
    if (difficulty) payload.difficulty = difficulty;
    const theme = $('#createTheme').value.trim();
    if (theme) payload.capabilityTheme = theme;
    const tg = $('#createTaskGroups').value.trim();
    if (tg) payload.taskGroups = tg.split(/[,，]/).map(s => s.trim()).filter(Boolean);
    const ce = $('#createCultural').value.trim();
    if (ce) payload.culturalElements = ce.split(/[,，]/).map(s => s.trim()).filter(Boolean);

    const submitBtn = $('#createModalSubmit');
    submitBtn.disabled = true;
    submitBtn.textContent = '创建中…';

    try {
      const created = await YuzanApi.createCourseDraft(payload);
      showToast(`课程"${title}"已创建`);
      closeCreateModal();
      // 刷新列表并选中新课程
      await loadCourseVersions();
      if (created && created.id) {
        await selectCourse(created.id);
      }
    } catch (err) {
      showToast('创建失败：' + (err.message || '未知错误'));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '创建草稿';
    }
  }

  /* ── 发布 ── */
  function openPublishModal() {
    if (!currentCourse) { showToast('请先选择课程'); return; }
    if (currentCourse.status !== 'APPROVED' && currentCourse.status !== 'IN_REVIEW') {
      showToast('仅已批准或待审核的课程可发布');
      return;
    }
    $('#modalBackdrop').hidden = false;
  }

  async function confirmPublish() {
    if (!currentCourse) return;
    const confirmBtn = $('#modalConfirm');
    confirmBtn.disabled = true;
    confirmBtn.textContent = '发布中…';
    try {
      await YuzanApi.publishCourseVersion(currentCourse.id);
      showToast(`已发布：${currentCourse.title}`);
      $('#modalBackdrop').hidden = true;
      await selectCourse(currentCourse.id);
      await loadCourseVersions();
    } catch (err) {
      showToast('发布失败：' + (err.message || '未知错误'));
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = '确认发布';
    }
  }

  /* ── 提交审核 ── */
  async function submitReview() {
    if (!currentCourse || currentCourse.status !== 'DRAFT') {
      showToast('仅草稿状态可提交审核');
      return;
    }
    try {
      const expectedUpdatedAt = currentCourse.updatedAt || new Date().toISOString();
      await YuzanApi.submitForReview(currentCourse.id, expectedUpdatedAt);
      showToast(`已提交审核：${currentCourse.title}`);
      await selectCourse(currentCourse.id);
      await loadCourseVersions();
    } catch (err) {
      showToast('提交审核失败：' + (err.message || '未知错误'));
    }
  }

  /* ── 资源上传 ── */
  function openUploadModal() {
    if (!currentCourse) { showToast('请先选择课程'); return; }
    $('#uploadModalBackdrop').hidden = false;
  }

  function closeUploadModal() {
    $('#uploadModalBackdrop').hidden = true;
    $('#uploadForm').reset();
    $('#uploadProgress').style.display = 'none';
  }

  async function handleUploadSubmit(e) {
    e.preventDefault();
    if (!currentCourse) return;

    const fileInput = $('#uploadFile');
    const file = fileInput.files[0];
    if (!file) { showToast('请选择文件'); return; }

    const kind = $('#uploadKind').value;
    const purpose = $('#uploadPurpose').value;
    const submitBtn = $('#uploadModalSubmit');
    const progressEl = $('#uploadProgress');
    submitBtn.disabled = true;
    submitBtn.textContent = '上传中…';
    progressEl.style.display = 'block';
    progressEl.textContent = '1/3 获取上传凭证…';

    try {
      // Step 1: Presign
      const presign = await YuzanApi.presignUpload({
        fileName: file.name,
        kind,
        contentType: file.type || 'application/octet-stream',
        byteSize: file.size,
      });

      progressEl.textContent = '2/3 上传文件至存储…';

      // Step 2: Upload to presigned URL
      const uploadUrl = presign.uploadUrl || presign.url || presign.presignedUrl;
      const objectKey = presign.objectKey || presign.key || '';
      const resourceId = presign.resourceId || presign.id || '';

      if (!uploadUrl) throw new Error('未获取到上传地址');

      const uploadResp = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!uploadResp.ok) throw new Error(`文件上传失败: ${uploadResp.status}`);

      progressEl.textContent = '3/3 确认上传并绑定资源…';

      // Step 3: Confirm upload
      if (resourceId) {
        await YuzanApi.confirmUpload(resourceId, {
          objectKey,
          checksumSha256: undefined,
        });
      }

      // Step 4: Attach resource to course version
      if (resourceId && currentCourse.id) {
        await YuzanApi.attachResource(currentCourse.id, resourceId, purpose);
      }

      showToast(`资源"${file.name}"已上传并绑定`);
      closeUploadModal();
      // 刷新详情
      await selectCourse(currentCourse.id);
    } catch (err) {
      showToast('上传失败：' + (err.message || '未知错误'));
      progressEl.textContent = '上传出错';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '上传并绑定';
    }
  }

  /* ── 课程分配 ── */
  function openAssignModal() {
    if (!currentCourse) { showToast('请先选择课程'); return; }
    if (currentCourse.status !== 'PUBLISHED') {
      showToast('仅已发布课程可分配');
      return;
    }
    // 预填标题
    $('#assignTitle').value = currentCourse.title || '';
    // 预填当前时间为开始时间，7天后为截止时间
    const now = new Date();
    const later = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const toLocal = (d) => {
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    $('#assignStart').value = toLocal(now);
    $('#assignDue').value = toLocal(later);
    $('#assignModalBackdrop').hidden = false;
  }

  function closeAssignModal() {
    $('#assignModalBackdrop').hidden = true;
    $('#assignForm').reset();
  }

  async function handleAssignSubmit(e) {
    e.preventDefault();
    if (!currentCourse) return;

    const title = $('#assignTitle').value.trim();
    const startsAt = $('#assignStart').value;
    const dueAt = $('#assignDue').value;
    const classId = $('#assignClassId').value.trim();
    const offlineRequired = $('#assignOffline').checked;

    if (!title || !startsAt || !dueAt || !classId) {
      showToast('请填写所有必填项');
      return;
    }

    const submitBtn = $('#assignModalSubmit');
    submitBtn.disabled = true;
    submitBtn.textContent = '分配中…';

    try {
      await YuzanApi.createAssignment({
        title,
        courseVersionId: currentCourse.id,
        startsAt: new Date(startsAt).toISOString(),
        dueAt: new Date(dueAt).toISOString(),
        offlineRequired,
        targets: [{ targetType: 'CLASS', classId }],
      });
      showToast(`课程已分配到班级`);
      closeAssignModal();
      // 刷新详情以更新关联学校
      await selectCourse(currentCourse.id);
    } catch (err) {
      showToast('分配失败：' + (err.message || '未知错误'));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '确认分配';
    }
  }

  /* ── 绑定事件 ── */
  function bindUI() {
    // 搜索
    $('#searchInput').addEventListener('input', (e) => {
      searchKeyword = e.target.value.trim();
      renderTable();
    });

    // 发布弹窗
    const modal = $('#modalBackdrop');
    const closeModal = () => { modal.hidden = true; };
    $('#publishBtn').addEventListener('click', openPublishModal);
    $('#modalCancel').addEventListener('click', closeModal);
    $('#modalClose').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    $('#modalConfirm').addEventListener('click', confirmPublish);

    // 提交审核
    $('#submitReviewBtn').addEventListener('click', submitReview);

    // 上传资源弹窗
    const uploadModal = $('#uploadModalBackdrop');
    $('#uploadResourceBtn').addEventListener('click', openUploadModal);
    $('#uploadModalClose').addEventListener('click', closeUploadModal);
    $('#uploadModalCancel').addEventListener('click', closeUploadModal);
    uploadModal.addEventListener('click', (e) => { if (e.target === uploadModal) closeUploadModal(); });
    $('#uploadForm').addEventListener('submit', handleUploadSubmit);

    // 课程分配弹窗
    const assignModal = $('#assignModalBackdrop');
    $('#assignBtn').addEventListener('click', openAssignModal);
    $('#assignModalClose').addEventListener('click', closeAssignModal);
    $('#assignModalCancel').addEventListener('click', closeAssignModal);
    assignModal.addEventListener('click', (e) => { if (e.target === assignModal) closeAssignModal(); });
    $('#assignForm').addEventListener('submit', handleAssignSubmit);

    // 创建课程弹窗
    const createModal = $('#createModalBackdrop');
    const closeCreate = () => closeCreateModal();
    $('#createCourseBtn').addEventListener('click', openCreateModal);
    $('#createModalClose').addEventListener('click', closeCreate);
    $('#createModalCancel').addEventListener('click', closeCreate);
    createModal.addEventListener('click', (e) => { if (e.target === createModal) closeCreate(); });
    $('#createForm').addEventListener('submit', handleCreateSubmit);

    // 其他按钮
    $('#previewBtn').addEventListener('click', () => {
      if (currentCourse) showToast('课程预览功能开发中');
    });
    $('#archiveBtn').addEventListener('click', async () => {
      if (!currentCourse || currentCourse.status !== 'PUBLISHED') {
        showToast('仅已发布课程可下线');
        return;
      }
      try {
        // 使用 updateCourseDraft 更新状态为 RETIRED
        await YuzanApi.updateCourseDraft(currentCourse.id, {
          expectedUpdatedAt: currentCourse.updatedAt,
          status: 'RETIRED',
        });
        showToast(`已下线：${currentCourse.title}`);
        await selectCourse(currentCourse.id);
        await loadCourseVersions();
      } catch (err) {
        showToast('下线失败：' + (err.message || '未知错误'));
      }
    });

    $('#newVersionBtn').addEventListener('click', () => {
      if (!currentCourse) { showToast('请先选择课程'); return; }
      showToast('新建版本功能开发中');
    });

    // 移动端侧边栏
    const sidebar = $('#sidebar');
    const backdrop = $('#sidebarBackdrop');
    $('#mobileSidebarButton').addEventListener('click', () => {
      sidebar.classList.add('open');
      backdrop.hidden = false;
    });
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.hidden = true;
    });

    $('.collapse-sidebar').addEventListener('click', () => {
      showToast('侧边栏折叠功能开发中');
    });

    // 学段筛选
    const gradeSelect = document.querySelector('.toolbar-left .select-btn');
    if (gradeSelect) {
      gradeSelect.addEventListener('click', () => {
        showToast('学段筛选功能开发中');
      });
    }
  }

  /* ── 初始化 ── */
  async function init() {
    bindUI();
    // 检查登录状态
    if (!YuzanApi.requireAuth('/login')) return;
    // 加载课程列表
    await loadCourseVersions();
  }

  init();
})();
