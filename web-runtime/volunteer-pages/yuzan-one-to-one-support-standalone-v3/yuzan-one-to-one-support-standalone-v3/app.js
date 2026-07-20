(() => {
  const modal = document.querySelector('#modalBackdrop');
  const modalTitle = document.querySelector('#modalTitle');
  const modalText = document.querySelector('#modalText');
  const toast = document.querySelector('#toast');
  let toastTimer;
  const messages = {
    identity:['切换身份','可切换志愿者、负责教师或平台工作人员身份。'],
    add:['添加帮扶对象','选择经过授权的学生并发起新的帮扶关系。'],
    edit:['编辑帮扶目标','目标调整后将保留版本记录，并通知负责教师确认。'],
    teacher:['联系教师','将打开与负责教师的安全沟通通道。'],
    reschedule:['调整沟通时间','可重新选择双方可用时段，并发送预约通知。'],
    meeting:['发起沟通','将进入受保护的线上沟通空间。'],
    risk:['标记风险','风险标记会立即通知负责教师并进入处理流程。'],
    end:['结束帮扶关系','结束后记录将归档，无法继续新增沟通记录。']
  };
  function showToast(text){
    clearTimeout(toastTimer);toast.textContent=text;toast.classList.add('show');
    toastTimer=setTimeout(()=>toast.classList.remove('show'),1800);
  }
  function openModal(action){
    const [title,text]=messages[action]||['操作说明','该功能已连接到交互演示。'];
    modalTitle.textContent=title;modalText.textContent=text;modal.hidden=false;document.body.style.overflow='hidden';
  }
  function closeModal(){modal.hidden=true;document.body.style.overflow='';}
  document.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',()=>openModal(el.dataset.action)));
  document.querySelector('#modalClose').addEventListener('click',closeModal);
  document.querySelector('#modalCancel').addEventListener('click',closeModal);
  document.querySelector('#modalConfirm').addEventListener('click',()=>{closeModal();showToast('操作已确认');});
  modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)closeModal();});
  document.querySelectorAll('.student-card').forEach(card=>card.addEventListener('click',()=>{
    document.querySelectorAll('.student-card').forEach(x=>x.classList.remove('selected'));
    card.classList.add('selected');showToast(`已切换到${card.dataset.student}`);
  }));
  document.querySelectorAll('.workflow-step').forEach(step=>step.addEventListener('click',()=>{
    document.querySelectorAll('.workflow-step').forEach(x=>x.classList.remove('current'));
    step.classList.add('current');showToast(`已切换到第 ${step.dataset.step} 阶段`);
  }));
  document.querySelectorAll('.nav-item').forEach(item=>item.addEventListener('click',e=>{
    e.preventDefault();document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));item.classList.add('active');
  }));
})();
