const navItems=[
  ['i-home','驾驶舱'],['i-school','学校管理'],['i-users','用户管理'],['i-book','课程管理'],['i-assess','测评管理','active'],['i-heart','志愿者管理'],['i-kit','套餐管理'],['i-review','内容审核','',5],['i-shield','隐私与合规'],['i-settings','系统运维'],['i-log','审计日志'],['i-export','数据导出'],['i-settings','设置']
];
const libraryItems=[
  {title:'高原生态保护的生物多样性',meta:'小学高年级 · 难度 ★★★ ☆',type:'阅读理解 · 题目 6 题',status:'已发布'},
  {title:'守护三江源',meta:'小学中年级 · 难度 ★★★ ☆',type:'阅读理解 · 题目 5 题',status:'草稿'},
  {title:'阅读理解 · 高原生态保护主题',meta:'小学高年级 · 难度 ★★★ ☆',type:'阅读理解 · 题目 8 题',status:'待审核',active:true},
  {title:'冰川的消融与影响',meta:'初中阶段 · 难度 ★★★ ☆',type:'阅读理解 · 题目 7 题',status:'已停用'},
  {title:'高原植被恢复的实践',meta:'初中阶段 · 难度 ★★★ ☆',type:'阅读理解 · 题目 6 题',status:'版权缺失'}
];
const questions=[['选择题（单选）','4 题 ｜ 每题 5 分'],['判断题','2 题 ｜ 每题 5 分'],['简答题','1 题 ｜ 10 分'],['材料分析题','1 题 ｜ 10 分']];
const abilities=['信息提取','推理判断','主旨理解','词汇理解','应用表达'];
const related=[['2024年春季 学业质量监测（小学高年级）','已关联','计划时间：2024-06-15 ~ 2024-06-20'],['高原生态主题阅读训练营 第2期','待关联','计划时间：2024-07-01 ~ 2024-07-31']];
const versions=[['v1.2.0','待审核','优化题目表述、调整分值分配','2024-06-05 10:24','张老师','查看'],['v1.1.0','已发布','调整写作题要求，新增材料分析题','2024-05-28 14:30','李老师','预览'],['v1.0.0','已停用','初始版本','2024-05-20 09:15','王老师','查看']];

const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
function renderNav(){ $('#mainNav').innerHTML=navItems.map(([icon,text,state,badge])=>`<button class="nav-item ${state||''}"><svg><use href="#${icon}"/></svg><span>${text}</span>${badge?`<b class="badge">${badge}</b>`:''}</button>`).join(''); }
function renderLibrary(items=libraryItems){$('#libraryList').innerHTML=items.map((x,i)=>`<button class="library-item ${x.active?'active':''}" data-index="${i}"><span class="item-status ${x.status==='草稿'?'draft':x.status==='已停用'?'disabled':x.status==='版权缺失'?'missing':''}">${x.status}</span><h4>${x.title}</h4><p>${x.meta.replace('★★★','<span class="stars">★★★</span>')}</p><p>${x.type}</p></button>`).join('');$$('.library-item').forEach(b=>b.onclick=()=>selectLibrary(Number(b.dataset.index)));}
function selectLibrary(i){libraryItems.forEach((x,j)=>x.active=j===i);renderLibrary();const x=libraryItems[i];$('.title-info h1').textContent=x.title.includes('主题')?x.title+'（小学高年级）':x.title;showToast('已切换内容条目');}
function renderQuestions(){$('#questionTable').innerHTML=questions.map((q,i)=>`<div class="question-row"><strong><span class="question-icon"><svg><use href="#${i===0?'i-file':i===1?'i-check':'i-edit'}"/></svg></span>${q[0]}</strong><span>${q[1]}</span></div>`).join('');}
function renderAbilities(){$('#abilityTags').innerHTML=abilities.map(x=>`<button class="tag" draggable="true">${x}</button>`).join('');$$('.tag').forEach(t=>{t.ondragstart=e=>e.dataTransfer.setData('text/plain',t.textContent);});$('#readingCopy').ondragover=e=>e.preventDefault();$('#readingCopy').ondrop=e=>{e.preventDefault();showToast(`已将“${e.dataTransfer.getData('text/plain')}”映射到材料片段`);};}
function renderRelated(){$('#relatedList').innerHTML=related.map((r,i)=>`<div class="related-row"><strong>${r[0]}</strong><span class="rel-status ${i?'pending':''}">${r[1]}</span><span class="date">${r[2]}</span></div>`).join('');}
function renderVersions(){$('#versionRows').innerHTML=versions.map(v=>`<tr><td>${v[0]}</td><td><span class="table-status ${v[1]==='待审核'?'wait':v[1]==='已发布'?'done':'off'}">${v[1]}</span></td><td>${v[2]}</td><td>${v[3]}</td><td>${v[4]}</td><td>${v[5]}</td></tr>`).join('');}
function showToast(text){const t=$('#toast');t.textContent=text;t.classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>t.classList.remove('show'),1700);}
function openModal(html){$('#modalBody').innerHTML=html;$('#modal').classList.add('show');$('#modal').setAttribute('aria-hidden','false');$$('[data-close]').forEach(x=>x.onclick=closeModal);}
function closeModal(){$('#modal').classList.remove('show');$('#modal').setAttribute('aria-hidden','true');}
function bind(){
 $('#searchInput').oninput=e=>{const q=e.target.value.trim();renderLibrary(libraryItems.filter(x=>!q||x.title.includes(q)||x.type.includes(q)));};
 $('#resetBtn').onclick=()=>{$('#searchInput').value='';renderLibrary();showToast('筛选已重置');};
 $('#editBtn').onclick=()=>{document.body.classList.toggle('editing');const editing=document.body.classList.contains('editing');$('#readingCopy').contentEditable=editing?'true':'false';$('#editBtn').innerHTML=`<svg><use href="#i-edit"/></svg>${editing?'完成编辑':'编辑'}`;showToast(editing?'已进入编辑模式':'修改已保存');};
 $('#previewBtn').onclick=()=>openModal(`<h2>内容预览</h2><div class="preview-page"><div class="preview-hero"><h3>高原上的守护者</h3><p>阅读材料、理解题与写作表达将按学生端顺序展示。</p></div></div><div class="modal-actions"><button data-close>关闭</button></div>`);
 $('#publishBtn').onclick=()=>openModal(`<h2>发布新版本</h2><p>发布后当前版本将保持不可变，并自动创建下一草稿版本。请确认内容、评分规则与版权信息均已完成检查。</p><div class="modal-actions"><button data-close>取消</button><button class="confirm" id="confirmPublish">确认发布</button></div>`);
 $('#linkBtn').onclick=$('#bottomLinkBtn').onclick=()=>openModal(`<h2>关联测评任务</h2><p>选择需要使用当前内容版本的测评任务。</p><div class="modal-list"><label><input type="checkbox" checked>2024年春季 学业质量监测（小学高年级）</label><label><input type="checkbox">高原生态主题阅读训练营 第2期</label><label><input type="checkbox">小学阅读能力阶段测评</label></div><div class="modal-actions"><button data-close>取消</button><button class="confirm" id="confirmLink">确认关联</button></div>`);
 $('#addSectionBtn').onclick=()=>showToast('已添加空白评测环节');
 $$('.flow-plus').forEach(b=>b.onclick=()=>showToast('已在当前位置插入新环节'));
 $('#modal').onclick=e=>{if(e.target.matches('[data-close]'))closeModal();};
 document.addEventListener('click',e=>{if(e.target.id==='confirmPublish'){closeModal();$('.status.waiting').textContent='已发布';$('.status.waiting').style.background='#e8f2e8';$('.status.waiting').style.color='#4e875f';showToast('新版本已发布');}if(e.target.id==='confirmLink'){closeModal();showToast('关联任务已更新');}});
}
renderNav();renderLibrary();renderQuestions();renderAbilities();renderRelated();renderVersions();bind();
