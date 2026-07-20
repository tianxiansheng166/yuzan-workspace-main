(() => {
  const toast = document.getElementById('toast');
  const modal = document.getElementById('modal');
  let toastTimer;
  const showToast = (message) => {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('show');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
  };

  const directionData = {
    reading: {name:'阅读陪伴', training:'总时长约 1–2 小时，支持随时学习', session:'单次服务建议 60 分钟', month:'每月至少服务 1 次'},
    quality: {name:'素养拓展', training:'总时长约 2 小时，包含活动设计基础', session:'单次服务建议 60–90 分钟', month:'每月至少服务 1 次'},
    activity: {name:'主题活动', training:'总时长约 2–3 小时，包含组织与安全规范', session:'单次活动约 90 分钟', month:'按主题活动排期参与'},
    growth: {name:'成长记录', training:'总时长约 1 小时，包含记录与隐私规范', session:'每次记录建议 20–30 分钟', month:'每月至少完成 2 次记录'}
  };

  document.querySelectorAll('.service-item').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.service-item').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      const data = directionData[button.dataset.direction];
      document.getElementById('trainingTime').textContent = data.training;
      document.getElementById('sessionTime').textContent = data.session;
      document.getElementById('monthFrequency').textContent = data.month;
      showToast(`已选择${data.name}方向`);
    });
  });

  const openModal = () => {
    const current = document.querySelector('.service-item.active strong')?.textContent || '阅读陪伴';
    const select = modal.querySelector('select[name="direction"]');
    [...select.options].forEach(option => option.selected = option.textContent === current);
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  };
  const closeModal = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
  };

  document.getElementById('applyButton').addEventListener('click', openModal);
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.hidden) closeModal(); });
  document.getElementById('applicationForm').addEventListener('submit', event => {
    event.preventDefault();
    const submit = event.submitter;
    submit.disabled = true;
    submit.textContent = '提交中…';
    setTimeout(() => {
      closeModal();
      event.target.reset();
      submit.disabled = false;
      submit.textContent = '提交申请';
      showToast('申请已提交，平台将通知后续培训安排');
    }, 650);
  });
  document.querySelector('.policy-link').addEventListener('click', () => showToast('已打开未成年人保护政策说明'));
  document.querySelector('.more-link').addEventListener('click', () => showToast('更多问题页面已进入演示状态'));
  document.querySelector('.switch-role').addEventListener('click', () => showToast('身份切换入口已触发'));
})();