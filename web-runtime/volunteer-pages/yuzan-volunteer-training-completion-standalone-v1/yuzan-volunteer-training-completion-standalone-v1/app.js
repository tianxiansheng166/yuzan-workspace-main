(() => {
  const modal = document.querySelector('#modal');
  const title = document.querySelector('#modal-title');
  const text = document.querySelector('#modal-text');
  const toast = document.querySelector('#toast');
  const content = {
    switch: ['切换身份', '该独立演示将打开身份选择流程。'],
    certificate: ['资格证书', '证书页面将展示真实资格编号、服务范围与有效期。'],
    tasks: ['服务任务', '将跳转至符合当前资格范围的志愿服务任务。'],
    workbench: ['服务工作台', '将进入志愿者服务工作台。'],
    review: ['复习课程', '将返回培训课程列表，可重新查看学习材料。']
  };
  function showModal(action) {
    const value = content[action] || ['操作提示', '当前功能已连接到本地交互演示。'];
    title.textContent = value[0]; text.textContent = value[1]; modal.hidden = false;
  }
  function closeModal(){ modal.hidden = true; }
  function showToast(message){ toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200); }
  document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.action;
    if(action === 'download'){
      const blob = new Blob(['语赞心声｜志愿者培训记录\n培训完成度：100%\n服务资格：已获得\n有效期：2026-07-10'], {type:'text/plain;charset=utf-8'});
      const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;a.download='志愿者培训记录.txt';a.click();URL.revokeObjectURL(url);showToast('培训记录已生成');return;
    }
    showModal(action);
  }));
  document.querySelector('.modal-close').addEventListener('click',closeModal);
  document.querySelector('.modal-ok').addEventListener('click',closeModal);
  modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
  document.querySelectorAll('.nav-item').forEach(item=>item.addEventListener('click',e=>{e.preventDefault();document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));item.classList.add('active')}));
})();
