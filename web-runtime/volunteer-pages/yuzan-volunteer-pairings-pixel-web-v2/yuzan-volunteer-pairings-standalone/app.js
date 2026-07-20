(() => {
  const toast = document.getElementById('toast');
  let timer;
  function showToast(msg){toast.textContent=msg;toast.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove('show'),1900)}
  const modal=document.getElementById('modal'), title=document.getElementById('modalTitle'), text=document.getElementById('modalText');
  let confirmAction=null;
  function openModal(t,m,action){title.textContent=t;text.textContent=m;confirmAction=action||null;modal.hidden=false;document.body.style.overflow='hidden'}
  function closeModal(){modal.hidden=true;document.body.style.overflow='';confirmAction=null}
  document.getElementById('modalClose').onclick=closeModal;
  document.getElementById('modalCancel').onclick=closeModal;
  modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
  document.getElementById('modalConfirm').onclick=()=>{if(confirmAction)confirmAction();closeModal();showToast('操作已确认')};

  const students={A:{goal:'提升阅读理解能力和学习兴趣，培养良好学习习惯'},B:{goal:'提升课堂专注与作业计划执行能力，建立稳定学习节奏'},C:{goal:'帮扶关系已结束，阶段目标与沟通记录已归档'}};
  document.querySelectorAll('.student-card').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('.student-card').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');
    document.getElementById('goalText').textContent=students[btn.dataset.student].goal;
    showToast(`已切换至${btn.dataset.name}`);
  }));
  document.querySelectorAll('.flow-step').forEach((btn,i)=>btn.addEventListener('click',()=>{
    document.querySelectorAll('.flow-step').forEach(b=>b.classList.remove('active'));btn.classList.add('active');showToast(`已查看${btn.querySelector('strong').textContent}阶段`)
  }));
  document.getElementById('addStudentBtn').onclick=()=>openModal('添加帮扶对象','选择新的帮扶对象前，请确认教师授权、隐私范围与可见字段。当前演示页不会写入真实数据。',()=>{});
  document.getElementById('editGoalBtn').onclick=()=>openModal('编辑帮扶目标','可以围绕阅读兴趣、学习方法和阶段性习惯重新调整目标。',()=>{document.getElementById('goalText').textContent='提升阅读理解、任务规划与持续学习习惯';});
  document.getElementById('filterBtn').onclick=()=>showToast('已打开状态筛选');
  document.getElementById('contactTeacherBtn').onclick=()=>showToast('正在打开教师沟通通道');
  document.getElementById('adjustTimeBtn').onclick=()=>openModal('调整预约时间','当前预约为 2024-12-04（周三）16:30。确认后将模拟顺延 30 分钟。',()=>{document.querySelector('.appointment-card>strong').textContent='2024-12-04（周三）17:00';});
  document.getElementById('startCallBtn').onclick=()=>showToast('已模拟发起线上沟通');
  document.getElementById('riskBtn').onclick=()=>openModal('标记风险','风险标记将立即进入教师处理通道，并记录操作时间。',()=>{document.querySelector('.risk-title p').innerHTML='已标记：需教师关注<br/>等待教师确认与处理';});
  document.getElementById('endPairingBtn').onclick=()=>openModal('结束帮扶关系','结束后记录将归档，无法继续沟通。该操作应在教师确认后执行。',()=>{document.getElementById('endPairingBtn').textContent='已结束并归档';document.getElementById('endPairingBtn').disabled=true;});
  document.querySelectorAll('.history-list button,.all-history,.outline-wide,.switch-role,.nav-item,.top-icon,.profile-btn').forEach(btn=>btn.addEventListener('click',()=>showToast(btn.textContent.trim()||'操作已触发')));
})();
