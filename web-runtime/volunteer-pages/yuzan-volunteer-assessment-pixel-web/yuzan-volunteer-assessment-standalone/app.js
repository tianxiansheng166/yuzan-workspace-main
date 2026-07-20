(() => {
  const toast = document.getElementById('toast');
  let timer;
  const showToast = (msg) => {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(()=>toast.classList.remove('show'), 1800);
  };
  document.querySelectorAll('.option input').forEach(input => {
    input.addEventListener('change', () => {
      document.querySelectorAll('.option').forEach(el => el.classList.remove('checked'));
      input.closest('.option').classList.add('checked');
      document.querySelector('.q.current')?.classList.add('done');
      document.querySelector('.q.current')?.classList.remove('current');
      showToast(`已选择 ${input.value} 选项，系统已自动保存`);
    });
  });
  document.getElementById('flagBtn').addEventListener('click', () => {
    const btn = document.getElementById('flagBtn');
    btn.classList.toggle('active');
    showToast(btn.classList.contains('active') ? '本题已标记' : '已取消标记');
  });
  document.querySelectorAll('.q').forEach(btn => btn.addEventListener('click', ()=> showToast(`已跳转到第 ${btn.textContent.replace('✓','1')} 题`)));
  document.querySelectorAll('.ghost,.outline,.scene-pill,.top-icon,.switch-role,.nav-item,.profile-btn').forEach(btn => btn.addEventListener('click', ()=> showToast(btn.textContent.trim() || '操作已触发')));
  document.getElementById('submitBtn').addEventListener('click', ()=> showToast('当前为静态演示页：已模拟提交考核'));
})();
