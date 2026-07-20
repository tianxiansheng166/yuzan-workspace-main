const treeData = [
  { id:'primary', label:'小学', count:312, icon:'book-small', open:true, children:[
    { id:'chinese', label:'语文', count:68, icon:'folder-open', open:true, children:[
      { id:'reading-appreciation', label:'阅读与鉴赏', count:12, icon:'folder-open', active:true, open:true, children:[
        { id:'poetry', label:'诗歌阅读', count:4, icon:'folder' },
        { id:'narrative', label:'记叙文阅读', count:5, icon:'folder' },
        { id:'exposition', label:'说明文阅读', count:3, icon:'folder' },
      ]},
      { id:'writing', label:'写作', count:9, icon:'folder' },
      { id:'literacy', label:'识字与写字', count:10, icon:'folder' },
      { id:'oral', label:'口语交际', count:6, icon:'folder' },
    ]},
    { id:'math', label:'数学', count:56, icon:'book-small' },
    { id:'english', label:'英语', count:48, icon:'book-small' },
    { id:'morality', label:'道德与法治', count:32, icon:'book-small' },
    { id:'science', label:'科学', count:28, icon:'book-small' },
    { id:'arts', label:'艺术', count:26, icon:'book-small' },
    { id:'pe', label:'体育与健康', count:24, icon:'book-small' },
    { id:'it', label:'信息科技', count:14, icon:'book-small' },
  ]},
  { id:'junior', label:'初中', count:256, icon:'book-small' },
  { id:'senior', label:'高中', count:198, icon:'book-small' },
];

const courses = [
  { id:'CHN-X-YY-0001', title:'现代文阅读入门', version:'v2.3.0', versionState:'published', versionLabel:'已发布', editor:'张老师', duration:'34 分钟', license:'CC BY-NC 4.0', publishState:'published', publishLabel:'已发布', updated:'2024-06-01 12:30', detailStatus:'published', assets:18,
    outline:[['导入：什么是现代文阅读','06:12'],['理解文章主旨与结构','10:48'],['词句理解与语境分析','08:36'],['细节信息定位与概括','07:54'],['推理判断与观点理解','09:27']],
    schools:[['那曲市第二中学','初中','1,456 名学生','2024-05-10 关联'],['班戈县中学','初中','892 名学生','2024-04-28 关联'],['色尼区小学','小学','1,123 名学生','2024-04-15 关联']],
    history:[['v2.3.0','已发布','张老师','2024-06-01 12:30','优化了第2、4节内容，更新练习题'],['v2.2.0','已发布','张老师','2024-05-10 09:15','修正了部分知识点表述，更新课件'],['v2.1.0','已发布','陈老师','2024-04-20 16:40','调整课程结构，新增拓展阅读资源'],['v2.0.0','已发布','张老师','2024-03-18 11:05','首次正式发布'],['v1.0.0','已停用','王老师','2024-02-10 10:20','初始版本（已停用）']],
    validation:[['ok','版权证据完整','封面、课文音频、插图授权已上传并通过复核。'],['ok','资源完整性通过','18 个资源链接可用，离线包索引正常。'],['warn','双语审核待补充说明','第 3 节存在藏文辅助说明建议，已附审核意见。']]
  },
  { id:'CHN-X-YY-0002', title:'记叙文阅读方法', version:'v1.5.2', versionState:'review', versionLabel:'待审核', editor:'李老师', duration:'42 分钟', license:'CC BY-NC 4.0', publishState:'review', publishLabel:'待审核', updated:'2024-05-29 17:10', detailStatus:'review', assets:16,
    outline:[['场景导入：记叙文是什么','04:48'],['把握六要素与线索','09:20'],['人物描写与情感变化','08:10'],['叙事顺序和段落结构','07:35'],['综合练习','10:12']],
    schools:[['拉萨市实验小学','小学','1,024 名学生','2024-05-02 关联'],['日喀则第三小学','小学','908 名学生','2024-04-25 关联']],
    history:[['v1.5.2','待审核','李老师','2024-05-29 17:10','补充第 4 节示例与课后题'],['v1.5.1','草稿','李老师','2024-05-27 14:33','修订阅读活动顺序']],
    validation:[['ok','课程树定位正确','学段、学科、模块映射已通过。'],['warn','音频转写需补充','第 2 节朗读音频缺少文本转写。'],['warn','双语审校建议','藏语辅助词汇建议更新。']]
  },
  { id:'CHN-X-YY-0003', title:'说明文阅读方法', version:'v1.2.0', versionState:'draft', versionLabel:'草稿', editor:'王老师', duration:'36 分钟', license:'CC BY 4.0', publishState:'draft', publishLabel:'草稿', updated:'2024-05-20 15:12', detailStatus:'draft', assets:12,
    outline:[['认识说明文','05:10'],['说明顺序与方法','09:20'],['图表与数据阅读','07:00'],['提炼关键信息','08:30']],
    schools:[['城关区第六小学','小学','754 名学生','2024-04-18 关联']],
    history:[['v1.2.0','草稿','王老师','2024-05-20 15:12','新增图表阅读活动']],
    validation:[['warn','版权待补充','有 2 张示意图尚未上传授权说明。'],['ok','目录映射通过','单元与课次顺序正确。']]
  },
  { id:'CHN-X-YY-0004', title:'诗歌阅读方法', version:'v3.0.1', versionState:'published', versionLabel:'已发布', editor:'张老师', duration:'38 分钟', license:'CC BY-NC 4.0', publishState:'published', publishLabel:'已发布', updated:'2024-05-18 09:14', detailStatus:'published', assets:20,
    outline:[['感受诗歌节奏','06:14'],['意象与情感','08:42'],['押韵与语言表达','07:36'],['朗读与创作','09:50']],
    schools:[['那曲市第一小学','小学','1,356 名学生','2024-05-08 关联']],
    history:[['v3.0.1','已发布','张老师','2024-05-18 09:14','修复了活动 3 的资源引用']],
    validation:[['ok','发布通过','课程可正常供学生端使用。'],['ok','资源完整','20 个资源均可用。']]
  },
  { id:'CHN-X-YY-0005', title:'文言文初探', version:'v2.1.0', versionState:'published', versionLabel:'已发布', editor:'陈老师', duration:'45 分钟', license:'CC BY-NC 4.0', publishState:'published', publishLabel:'已发布', updated:'2024-05-12 13:11', detailStatus:'published', assets:22,
    outline:[['文言字词基础','06:30'],['句式理解','09:00'],['译读训练','10:30'],['文本赏析','08:40']], schools:[['拉萨市实验中学','初中','1,862 名学生','2024-05-01 关联']], history:[['v2.1.0','已发布','陈老师','2024-05-12 13:11','补充译读示例']], validation:[['ok','版权证据完整','文本和音频授权齐全。']] },
  { id:'CHN-X-YY-0006', title:'阅读策略与技巧', version:'v1.0.0', versionState:'review', versionLabel:'待审核', editor:'李老师', duration:'40 分钟', license:'CC BY 4.0', publishState:'review', publishLabel:'待审核', updated:'2024-05-09 18:20', detailStatus:'review', assets:14,
    outline:[['整体感知','05:12'],['信息筛选','08:10'],['推理判断','09:12'],['观点表达','07:05']], schools:[['林周县中学','初中','654 名学生','2024-04-10 关联']], history:[['v1.0.0','待审核','李老师','2024-05-09 18:20','首次提交审核']], validation:[['warn','资源命名待统一','存在 3 个附件命名不规范。']] },
  { id:'CHN-X-YY-0007', title:'非连续文本阅读', version:'v1.1.0', versionState:'draft', versionLabel:'草稿', editor:'周老师', duration:'32 分钟', license:'CC BY-NC 4.0', publishState:'draft', publishLabel:'草稿', updated:'2024-05-02 11:20', detailStatus:'draft', assets:11,
    outline:[['图表与海报阅读','04:40'],['多源信息整合','07:20'],['观点判断','08:10']], schools:[], history:[['v1.1.0','草稿','周老师','2024-05-02 11:20','新增图表活动']], validation:[['warn','关联学校为空','发布前至少关联一个学校范围。']] },
  { id:'CHN-X-YY-0008', title:'整本书阅读指导', version:'v2.0.0', versionState:'published', versionLabel:'已发布', editor:'张老师', duration:'50 分钟', license:'CC BY-NC 4.0', publishState:'published', publishLabel:'已发布', updated:'2024-04-28 16:20', detailStatus:'published', assets:24,
    outline:[['导读计划','05:50'],['角色与主题','08:44'],['章节追踪','09:26'],['阅读分享','08:33']], schools:[['拉萨市第八小学','小学','786 名学生','2024-04-02 关联']], history:[['v2.0.0','已发布','张老师','2024-04-28 16:20','新增整本书阅读单']], validation:[['ok','发布通过','版本稳定。']] },
  { id:'CHN-X-YY-0009', title:'经典诵读赏析', version:'v1.3.2', versionState:'rejected', versionLabel:'授权缺失', editor:'吴老师', duration:'28 分钟', license:'—', publishState:'archived', publishLabel:'已停用', updated:'2024-04-19 09:18', detailStatus:'rejected', assets:9,
    outline:[['诵读热身','03:40'],['经典片段赏析','07:20'],['朗读示范','06:18']], schools:[['达孜区小学','小学','532 名学生','2024-03-30 关联']], history:[['v1.3.2','授权缺失','吴老师','2024-04-19 09:18','版权证据失效，暂停发布']], validation:[['fail','版权证据失效','配图授权到期，需更换或续签。'],['warn','资源已下线','学生端预览已禁用。']] },
  { id:'CHN-X-YY-0010', title:'阅读与写作融合', version:'v1.0.0', versionState:'draft', versionLabel:'草稿', editor:'王老师', duration:'35 分钟', license:'CC BY 4.0', publishState:'draft', publishLabel:'草稿', updated:'2024-04-12 10:28', detailStatus:'draft', assets:15,
    outline:[['阅读激活写作','05:18'],['仿写训练','08:36'],['同伴互评','09:04']], schools:[], history:[['v1.0.0','草稿','王老师','2024-04-12 10:28','起草完成']], validation:[['warn','待补全资源','需补充示例范文。']] },
  { id:'CHN-X-YY-0011', title:'跨学科主题阅读', version:'v1.0.0', versionState:'review', versionLabel:'待审核', editor:'李老师', duration:'44 分钟', license:'CC BY-NC 4.0', publishState:'review', publishLabel:'待审核', updated:'2024-04-08 11:50', detailStatus:'review', assets:13,
    outline:[['主题导读','05:22'],['跨学科材料整合','10:12'],['任务实践','08:30']], schools:[['堆龙德庆中学','初中','1,003 名学生','2024-03-21 关联']], history:[['v1.0.0','待审核','李老师','2024-04-08 11:50','首次提交审核']], validation:[['warn','需补充审核意见','第 2 节需说明资源来源。']] },
  { id:'CHN-X-YY-0012', title:'阅读测评与反思', version:'v1.2.1', versionState:'published', versionLabel:'已发布', editor:'陈老师', duration:'30 分钟', license:'CC BY 4.0', publishState:'published', publishLabel:'已发布', updated:'2024-04-01 15:22', detailStatus:'published', assets:10,
    outline:[['测评规则说明','04:30'],['自评与互评','06:40'],['反思记录','08:30']], schools:[['当雄县中学','初中','640 名学生','2024-03-16 关联']], history:[['v1.2.1','已发布','陈老师','2024-04-01 15:22','更新反思模板']], validation:[['ok','校验通过','内容和资源符合规范。']] },
];

const stateClassMap = { published:'published', review:'review', draft:'draft', rejected:'rejected', archived:'archived' };
let currentCourse = courses[0];
let searchKeyword = '';

function iconUse(id){ return `<svg><use href="#i-${id}"></use></svg>`; }
function statusHTML(type,label){ return `<span class="status ${type}"><i></i>${label}</span>`; }

function renderTreeNode(node, depth=0){
  const hasChildren = node.children && node.children.length;
  const twisty = hasChildren ? (node.open ? '⌄' : '›') : '';
  const childHTML = hasChildren && node.open ? `<ul>${node.children.map(c => renderTreeNode(c, depth+1)).join('')}</ul>` : '';
  return `<li><div class="tree-item ${node.active ? 'active' : ''} tree-depth-${depth}" data-tree-id="${node.id}"><span class="twisty">${twisty}</span><span class="icon">${iconUse(node.icon || 'folder')}</span><span class="label">${node.label}</span><span class="count">${node.count||0}门课程</span></div>${childHTML}</li>`;
}

function renderTree(){
  document.getElementById('treeList').innerHTML = treeData.map(node => renderTreeNode(node)).join('');
  document.querySelectorAll('.tree-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.tree-item.active').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      showToast('已切换目录：' + item.querySelector('.label').textContent);
    });
  });
}

function matchesSearch(course){
  if(!searchKeyword) return true;
  const s = searchKeyword.toLowerCase();
  return course.title.toLowerCase().includes(s) || course.id.toLowerCase().includes(s);
}

function renderTable(){
  const body = document.getElementById('courseTableBody');
  const list = courses.filter(matchesSearch);
  body.innerHTML = list.map(course => {
    const selected = currentCourse.id === course.id;
    return `<tr class="${selected ? 'selected' : ''}" data-course-id="${course.id}">
      <td><input type="checkbox" aria-label="选择 ${course.title}"></td>
      <td data-label="课程/模块"><div class="row-main"><span class="drag-handle">${iconUse('drag')}</span><div class="row-title"><strong>${course.title}</strong><small>${course.id}</small></div></div></td>
      <td data-label="当前版本">${course.version}</td>
      <td data-label="版本状态">${statusHTML(course.versionState, course.versionLabel)}</td>
      <td data-label="更新人">${course.editor}</td>
      <td data-label="时长">${course.duration}</td>
      <td data-label="许可证">${course.license}</td>
      <td data-label="发布状态">${statusHTML(course.publishState, course.publishLabel)}</td>
      <td><button class="ops-btn" aria-label="更多操作">${iconUse('dots')}</button></td>
    </tr>`;
  }).join('');
  body.querySelectorAll('tr').forEach(row => row.addEventListener('click', e => {
    if(e.target.closest('input') || e.target.closest('button')) return;
    const course = courses.find(c => c.id === row.dataset.courseId);
    if(course){ currentCourse = course; renderTable(); renderDetail(); }
  }));
}

function renderDetail(){
  const c = currentCourse;
  document.getElementById('detailTitle').textContent = c.title;
  const pill = document.getElementById('detailStatusPill');
  pill.className = `status-pill ${stateClassMap[c.detailStatus] || 'draft'}`;
  pill.textContent = c.versionLabel;
  document.getElementById('detailCode').textContent = c.id;
  document.getElementById('detailVersion').textContent = c.version;
  document.getElementById('detailUpdated').textContent = c.updated;
  document.getElementById('previewDuration').textContent = c.duration;
  document.getElementById('previewAssets').textContent = `${c.assets} 个`;
  document.getElementById('schoolCount').textContent = c.schools.length;
  document.getElementById('outlineList').innerHTML = c.outline.map(item => `<li><b>${item[0]}</b><time>${item[1]}</time></li>`).join('');
  document.getElementById('schoolList').innerHTML = c.schools.length ? c.schools.map(s => `<li><i></i><div><strong>${s[0]}</strong><span>${s[1]}　${s[2]}</span></div><small>${s[3]}</small></li>`).join('') : '<li><i style="background:#d9dde1"></i><div><strong>暂无关联学校</strong><span>发布前请配置可见学校范围</span></div><small>待设置</small></li>';
  document.getElementById('versionHistory').innerHTML = c.history.map(v => `<li><span class="version-pill">● <strong>${v[0]}</strong> <b>${v[1]}</b></span><div><strong>${v[2]}</strong><small>${v[3]}　${v[4]}</small></div></li>`).join('');
  document.getElementById('validationList').innerHTML = c.validation.map(v => `<li class="${v[0] === 'ok' ? '' : (v[0] === 'warn' ? 'warn' : 'fail')}"><i></i><div><strong>${v[1]}</strong><p>${v[2]}</p></div></li>`).join('');
}

let toastTimer;
function showToast(text){
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function bindUI(){
  document.getElementById('searchInput').addEventListener('input', e => { searchKeyword = e.target.value.trim(); renderTable(); });
  const modal = document.getElementById('modalBackdrop');
  const closeModal = () => { modal.hidden = true; };
  document.getElementById('publishBtn').addEventListener('click', () => { modal.hidden = false; });
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  document.getElementById('modalClose').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if(e.target === modal) closeModal(); });
  document.getElementById('modalConfirm').addEventListener('click', () => {
    currentCourse.versionState = 'published';
    currentCourse.publishState = 'published';
    currentCourse.publishLabel = '已发布';
    currentCourse.versionLabel = '已发布';
    currentCourse.detailStatus = 'published';
    renderTable(); renderDetail(); closeModal(); showToast(`已发布：${currentCourse.title}`);
  });
  document.getElementById('previewBtn').addEventListener('click', () => showToast('已打开课程预览窗口'));
  document.getElementById('archiveBtn').addEventListener('click', () => {
    currentCourse.publishState = 'archived';
    currentCourse.publishLabel = '已停用';
    currentCourse.detailStatus = currentCourse.detailStatus === 'rejected' ? 'rejected' : 'draft';
    renderTable(); renderDetail(); showToast(`已下线：${currentCourse.title}`);
  });
  document.getElementById('createCourseBtn').addEventListener('click', () => showToast('已进入课程创建流程'));
  document.getElementById('newVersionBtn').addEventListener('click', () => showToast('已复制当前课程并创建新版本'));
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  document.getElementById('mobileSidebarButton').addEventListener('click', () => { sidebar.classList.add('open'); backdrop.hidden = false; });
  backdrop.addEventListener('click', () => { sidebar.classList.remove('open'); backdrop.hidden = true; });
  document.querySelector('.collapse-sidebar').addEventListener('click', () => showToast('此压缩包演示版不切换布局，仅展示交互意图'));
}

renderTree();
renderTable();
renderDetail();
bindUI();
