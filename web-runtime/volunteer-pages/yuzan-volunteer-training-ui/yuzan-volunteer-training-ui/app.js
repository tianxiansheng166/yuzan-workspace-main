const courses=[
  {title:'跨文化沟通：建立理解与信任',time:'35 分钟',progress:60,img:'assets/book-valley.png'},
  {title:'未成年人保护与风险识别',time:'40 分钟',progress:75,img:'assets/learning-tree.png'},
  {title:'课堂协作：高效配合与支持',time:'30 分钟',progress:45,img:'assets/teacher-book.png'},
  {title:'突发情况处理与应急预案',time:'30 分钟',progress:30,img:'assets/network-valley.png'}
];
const resources=[
  {title:'语言辅助教学指南（通用版）',meta:'PDF · 2.1MB',date:'2024-11-20'},
  {title:'跨文化沟通技巧速查手册',meta:'PDF · 1.8MB',date:'2024-11-15'},
  {title:'未成年人保护知识手册',meta:'PDF · 2.5MB',date:'2024-11-10'},
  {title:'课堂活动设计模板',meta:'DOCX · 1.2MB',date:'2024-11-08',blue:true},
  {title:'突发情况应对流程图',meta:'PDF · 1.6MB',date:'2024-11-05'}
];
const $=s=>document.querySelector(s);
$('#courseList').innerHTML=courses.map((c,i)=>`<article class="course-item"><img class="course-thumb" src="${c.img}" alt=""><div class="course-info"><h3>${c.title}</h3><div class="course-meta">课程 · ${c.time}</div><div class="course-progress"><span class="bar"><i style="width:${c.progress}%"></i></span><span>${c.progress}%</span></div></div><button class="continue-btn" data-course="${i}">继续学习</button></article>`).join('');
$('#resourceList').innerHTML=resources.map((r,i)=>`<article class="resource-item"><span class="doc-icon ${r.blue?'blue':''}"><svg><use href="#i-file"/></svg></span><div class="doc-copy"><h3>${r.title}</h3><p>${r.meta}</p></div><time class="resource-date">${r.date}</time><button class="download-btn" aria-label="下载 ${r.title}" data-resource="${i}"><svg><use href="#i-download"/></svg></button></article>`).join('');
const toast=(text)=>{const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove('show'),1800)};
document.addEventListener('click',e=>{const c=e.target.closest('.continue-btn');if(c)toast(`已定位到「${courses[+c.dataset.course].title}」`);const d=e.target.closest('.download-btn');if(d)toast(`已加入下载队列：${resources[+d.dataset.resource].title}`)});
$('#continueMain').addEventListener('click',()=>toast('继续学习：跨文化沟通'));
$('#identityBtn').addEventListener('click',()=>toast('身份切换面板已打开'));
$('#profileBtn').addEventListener('click',()=>toast('个人菜单已打开'));
const modal=$('#rulesModal');$('#rulesBtn').addEventListener('click',()=>{modal.classList.add('show');modal.setAttribute('aria-hidden','false')});modal.addEventListener('click',e=>{if(e.target.matches('[data-close]')){modal.classList.remove('show');modal.setAttribute('aria-hidden','true')}});document.addEventListener('keydown',e=>{if(e.key==='Escape')modal.classList.remove('show')});
document.querySelectorAll('.segmented button,.resource-tabs button').forEach(btn=>btn.addEventListener('click',()=>{btn.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected')}));
