const icons={
 home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5M9.5 20v-6h5v6"/></svg>',
 book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22zM20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22z"/></svg>',
 sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></svg>',
 spark:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m12 2 2.1 5.9L20 10l-5.9 2.1L12 18l-2.1-5.9L4 10l5.9-2.1z"/><path d="m19 16 .9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9z"/></svg>',
 user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="7" r="4"/><path d="M4 21a8 8 0 0 1 16 0z"/></svg>',
 download:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 19h16"/></svg>',
 like:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 21H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h4zm2 0V9l3-6a2 2 0 0 1 2 2v4h3a2 2 0 0 1 2 2l-1 8a2 2 0 0 1-2 2z"/></svg>',
 document:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></svg>',
 smile:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 20 3 22l.5-4A9 9 0 1 1 5 20z"/><circle cx="9" cy="10" r=".7" fill="currentColor"/><circle cx="15" cy="10" r=".7" fill="currentColor"/><path d="M8.5 14a4.2 4.2 0 0 0 7 0"/></svg>',
 flag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 22V4M5 5c4-3 7 3 12 0v9c-5 3-8-3-12 0"/></svg>',
 clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
 report:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5h16v14H4zM7 15l3-3 2 2 4-5 2 2"/></svg>',
 star:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.5 2.8 5.7 6.3.9-4.5 4.4 1 6.3-5.6-3-5.6 3 1-6.3-4.5-4.4 6.3-.9z"/></svg>',
 award:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="9" r="5"/><path d="m9 13-1 8 4-2 4 2-1-8"/></svg>'
};
document.querySelectorAll('[data-icon]').forEach(el=>{const name=el.dataset.icon;if(icons[name])el.innerHTML=icons[name]});

const toast=document.querySelector('.toast');let toastTimer;
function showToast(text){toast.textContent=text;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),1800)}

document.querySelectorAll('.topnav-item').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.topnav-item').forEach(x=>x.classList.remove('active'));btn.classList.add('active');
  if(btn.dataset.nav!=='recommend')showToast(`${btn.textContent.trim()}页面为演示导航`)
}));

document.querySelectorAll('.issue').forEach((btn,index)=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.issue').forEach(x=>x.classList.remove('active'));btn.classList.add('active');
  document.querySelectorAll('.course-card').forEach(x=>x.classList.remove('selected'));
  const card=document.querySelector(`[data-course-card="${btn.dataset.course}"]`);if(card){card.classList.add('selected');card.scrollIntoView({behavior:'smooth',block:'center'})}
}));

let completed=0;
document.querySelectorAll('.start-course').forEach((btn,index)=>btn.addEventListener('click',()=>{
  if(btn.dataset.done==='1'){showToast('已进入学习内容');return}
  btn.dataset.done='1';btn.textContent='继续学习';completed=Math.min(3,completed+1);
  const pct=Math.round(completed/3*100);document.querySelector('#progressFill').style.width=pct+'%';document.querySelector('#progressText').textContent=pct+'%';
  const item=document.querySelectorAll('.progress-path li')[index];item.querySelector('em').textContent='学习中';item.querySelector('em').style.color='#287d58';item.querySelector('em').style.borderColor='#cce1d5';
  showToast('学习进度已更新')
}));

document.querySelectorAll('.save-course').forEach(btn=>btn.addEventListener('click',()=>{
  const saved=btn.dataset.saved==='1';btn.dataset.saved=saved?'0':'1';btn.textContent=saved?'保存到计划':'已保存';btn.classList.toggle('saved',!saved);showToast(saved?'已从计划移除':'已保存到本周计划')
}));

const dialog=document.querySelector('#planDialog');document.querySelector('#adjustPlan').addEventListener('click',()=>dialog.showModal());
document.querySelector('#confirmPlan').addEventListener('click',()=>{
  const count=[...dialog.querySelectorAll('input')].filter(x=>x.checked).length;const mins=[15,10,12].slice(0,count).reduce((a,b)=>a+b,0);document.querySelector('#totalMinutes').textContent=mins;showToast('本周计划已保存')
});
