const modal=document.getElementById('taskModal');
const toast=document.getElementById('toast');
const taskPath=document.getElementById('taskPath');
const extraTasks=document.getElementById('extraTasks');
const expandBtn=document.getElementById('expandBtn');
let toastTimer;
function showToast(message){toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),1600)}
function openModal(){modal.classList.add('show');modal.setAttribute('aria-hidden','false')}
function closeModal(){modal.classList.remove('show');modal.setAttribute('aria-hidden','true')}
document.querySelectorAll('[data-action="start"],#primaryStartBtn').forEach(btn=>btn.addEventListener('click',openModal));
document.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click',closeModal));
document.getElementById('confirmStartBtn').addEventListener('click',()=>{closeModal();showToast('已进入阅读任务')});
document.getElementById('studentMenuBtn').addEventListener('click',()=>showToast('学生账户菜单'));
document.getElementById('goalDetailBtn').addEventListener('click',()=>showToast('本周目标：完成 4 项学习任务'));
document.getElementById('manageLocalBtn').addEventListener('click',()=>showToast('打开本地任务管理'));
document.getElementById('refreshLocalBtn').addEventListener('click',()=>showToast('本地任务状态已刷新'));
document.querySelector('.download-resource').addEventListener('click',()=>showToast('任务资源已加入下载队列'));
document.querySelector('.offline-manage').addEventListener('click',()=>showToast('打开离线管理'));
expandBtn.addEventListener('click',()=>{const open=extraTasks.hasAttribute('hidden');extraTasks.toggleAttribute('hidden',!open);expandBtn.firstChild.textContent=open?'收起任务 ':'展开更多 ';expandBtn.querySelector('svg').style.transform=open?'rotate(-90deg)':'rotate(90deg)'});
const filterButtons=document.querySelectorAll('.side-nav button[data-filter]');
filterButtons.forEach(button=>button.addEventListener('click',()=>{filterButtons.forEach(b=>b.classList.remove('active'));button.classList.add('active');const filter=button.dataset.filter;const cards=[...document.querySelectorAll('[data-type][data-state]')];let visible=0;cards.forEach(card=>{const matches=filter==='all'||card.dataset.type===filter||card.dataset.state===filter;card.style.display=matches?'':'none';if(matches)visible++});document.querySelectorAll('.path-section').forEach(section=>{const shown=[...section.querySelectorAll('[data-type][data-state]')].some(card=>card.style.display!=='none');section.style.display=shown?'':'none'});let empty=document.getElementById('emptyMessage');if(!visible){if(!empty){empty=document.createElement('div');empty.id='emptyMessage';empty.className='empty-message';empty.textContent='当前筛选下暂无任务';taskPath.appendChild(empty)}}else if(empty){empty.remove()}}));
