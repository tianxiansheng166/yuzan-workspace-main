(function(){
  const list = document.querySelector('.package-list');
  const footerCount = document.querySelector('.catalog-footer .muted');
  const editorTitle = document.querySelector('.editor-title-row h2');
  const editorStatus = document.querySelector('.editor-title-row .status-pill');
  const cards = [...document.querySelectorAll('.pkg-card')];
  const renderPlans = (items) => {
    if (!list) return;
    list.innerHTML = items.length ? items.map((plan, index) => {
      const price = Number(plan.priceCents || 0).toLocaleString('zh-CN');
      const term = plan.trialDays ? `${plan.trialDays} 天试用` : '按订阅周期';
      return `<article class="pkg-card${index === 0 ? ' selected' : ''}" data-plan-id="${plan.id}">
        <div class="pkg-head"><strong>${escapeHtml(plan.name)}</strong><span class="tag sky">${escapeHtml(plan.code)}</span></div>
        <p>${plan.entitlements?.length || 0} 项已启用权益</p>
        <div class="pkg-meta"><div class="price">¥ <b>${price}</b> / ${term}</div><div class="school-count"><span>权益项</span><b>${plan.entitlements?.length || 0}</b><em class="status-dot">已发布</em></div></div>
      </article>`;
    }).join('') : '<div class="empty-state">暂无已发布套餐</div>';
    if (footerCount) footerCount.textContent = `共 ${items.length} 项`;
    bindCards(items);
  };
  const bindCards = (items) => {
    [...document.querySelectorAll('.pkg-card')].forEach((card, index) => card.addEventListener('click', () => {
      [...document.querySelectorAll('.pkg-card')].forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const plan = items[index];
      if (plan && editorTitle) editorTitle.textContent = plan.name;
      if (plan && editorStatus) editorStatus.textContent = plan.status === 'ACTIVE' ? '● 已发布' : `● ${plan.status}`;
    }));
  };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  bindCards([]);
  if (window.YuzanApi?.listAdminProductPlans) {
    window.YuzanApi.listAdminProductPlans({ status: 'ACTIVE', limit: 100 }).then(result => renderPlans(result?.items || [])).catch(() => {
      if (footerCount) footerCount.textContent = '套餐数据加载失败';
    });
  }
  const tabs = [...document.querySelectorAll('.vtab')];
  tabs.forEach(tab=>tab.addEventListener('click', ()=>{
    tabs.forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
  }));
})();
