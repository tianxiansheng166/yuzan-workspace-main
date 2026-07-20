const qs=(s,r=document)=>r.querySelector(s);const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
const map=qs('#learningMap');const toast=qs('#toast');const modal=qs('#modalBackdrop');const pop=qs('#filterPopover');
function showToast(text){toast.textContent=text;toast.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.remove('show'),1800)}
function showModal(title,text){qs('#modalTitle').textContent=title;qs('#modalText').textContent=text;modal.hidden=false}
qsa('.topnav-item').forEach(btn=>btn.addEventListener('click',()=>{qsa('.topnav-item').forEach(x=>x.classList.remove('active'));btn.classList.add('active');showToast(`已切换到“${btn.innerText.trim()}”`)}));
qsa('.side-item').forEach(btn=>btn.addEventListener('click',()=>{qsa('.side-item').forEach(x=>x.classList.remove('active'));btn.classList.add('active');showToast(btn.innerText.trim())}));
qsa('.category-tab').forEach(btn=>btn.addEventListener('click',()=>{qsa('.category-tab').forEach(x=>x.classList.remove('active'));btn.classList.add('active');map.dataset.tab=btn.dataset.tab;const tab=btn.dataset.tab;qsa('.course-card').forEach(c=>c.classList.toggle('hidden-card',tab!=='school'&&c.dataset.kind!==tab));if(tab==='school')qsa('.course-card').forEach(c=>c.classList.remove('hidden-card'));}));
const options={grade:['六年级','五年级','四年级'],type:['全部','学校课程','AI 推荐','朗读技巧'],language:['全部','普通话','藏汉双语']};
qsa('.filter').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();const rect=btn.getBoundingClientRect();pop.innerHTML=options[btn.dataset.filter].map(x=>`<button>${x}</button>`).join('');pop.style.left=`${rect.left}px`;pop.style.top=`${rect.bottom+7}px`;pop.hidden=false;qsa('button',pop).forEach(o=>o.onclick=()=>{btn.querySelector('b').textContent=o.textContent;pop.hidden=true;showToast(`筛选条件已更新：${o.textContent}`)})}));
document.addEventListener('click',()=>pop.hidden=true);
qsa('[data-weak]').forEach(btn=>{if(btn.tagName==='BUTTON')btn.addEventListener('click',()=>{qsa('.weakness button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');qsa('.course-card').forEach(c=>c.classList.toggle('highlight',c.dataset.weakness===btn.dataset.weak));showToast('相关课程路径已高亮')})});
qsa('.course-card').forEach(c=>c.addEventListener('click',()=>showModal(c.querySelector('h4').textContent,'课程详情将由真实课程数据加载。当前演示保留了可接入后端的交互边界。')));
qsa('[data-action]').forEach(btn=>btn.addEventListener('click',e=>{const a=btn.dataset.action;if(a==='close'){modal.hidden=true;return}if(a==='continue')showModal('继续学习','将继续打开《高原上的春天》第 3 节课程。');else if(a==='offline')showModal('离线内容','这里可管理已下载课程、本地空间和下载状态。');else if(a==='feedback'||a==='details')showModal('教师建议','继续加强语调变化和情感表达，让朗读更有感染力。');else if(a==='recommend')showToast('完成当前课程后会生成新的推荐');else if(a==='profile')showToast('个人菜单已打开')}));
modal.addEventListener('click',e=>{if(e.target===modal)modal.hidden=true});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){modal.hidden=true;pop.hidden=true}});
