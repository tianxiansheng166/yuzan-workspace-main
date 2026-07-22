// School-cooperation page contact form (sections)
// 提交咨询表单：本地草稿 + 真实校验 + 不伪造在线提交成功
(() => {
  const toast = document.getElementById('toast');
  let timer;
  const show = (m) => {
    toast.textContent = m;
    toast.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => toast.classList.remove('show'), 2600);
  };
  document.querySelectorAll('[data-scroll]').forEach(b => b.addEventListener('click', () => {
    const target = document.querySelector(b.dataset.scroll);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  }));
  document.querySelectorAll('.detail-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.detail-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    const row = btn.closest('.solution-row');
    const name = row.querySelector('.solution-side b').textContent;
    show('已选择：' + name);
  }));
  document.querySelectorAll('.nav-item').forEach(a => a.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    a.classList.add('active');
  }));
  const form = document.getElementById('contactForm');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('.submit-btn');
    const label = btn.querySelector('.submit-label');
    const fd = new FormData(form);
    const values = Object.fromEntries(fd.entries());
    const phone = (values.phone || '').trim();
    const name = (values.name || '').trim();
    const fail = (msg, label2) => {
      btn.classList.remove('loading', 'success');
      btn.classList.add('error');
      label.textContent = label2;
      show(msg);
      setTimeout(() => { btn.classList.remove('error'); label.textContent = '提交咨询'; }, 2000);
    };
    if (!name || !phone) return fail('请完整填写姓名与联系电话。', '请完整填写');
    if (!/^1\d{10}$/.test(phone)) return fail('请输入有效的 11 位手机号码。', '电话格式不正确');
    btn.classList.remove('success', 'error');
    btn.classList.add('loading');
    label.textContent = '保存中…';
    try {
      const drafts = JSON.parse(localStorage.getItem('yuzan-cooperation-drafts') || '[]');
      drafts.push(Object.assign({}, values, { savedAt: new Date().toISOString(), page: location.pathname }));
      localStorage.setItem('yuzan-cooperation-drafts', JSON.stringify(drafts));
      btn.classList.remove('loading', 'error');
      btn.classList.add('success');
      label.textContent = '已保存到本机';
      show('咨询信息已保存到本机草稿。在线提交接口暂未开通，请直接致电 400-000-0000 或邮件至 contact@example.com 联系我们。');
      setTimeout(() => { btn.classList.remove('success'); label.textContent = '提交咨询'; }, 3200);
    } catch (err) {
      btn.classList.remove('loading', 'success');
      btn.classList.add('error');
      label.textContent = '保存失败';
      show('本地保存失败，请直接致电 400-000-0000 联系我们。');
      setTimeout(() => { btn.classList.remove('error'); label.textContent = '提交咨询'; }, 2600);
    }
  });
})();
