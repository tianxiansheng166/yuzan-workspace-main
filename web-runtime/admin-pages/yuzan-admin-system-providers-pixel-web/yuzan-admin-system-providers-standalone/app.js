(() => {
  const toast = document.getElementById('toast');
  let timer;
  const show = (message) => { toast.textContent = message; toast.classList.add('show'); clearTimeout(timer); timer = setTimeout(() => toast.classList.remove('show'), 1800); };
  const cards = [...document.querySelectorAll('.provider-card')];
  const byCategory = (category) => cards.filter((card) => card.dataset.type === category);

  document.querySelectorAll('.category').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('.category').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    const filter = button.dataset.filter;
    cards.forEach((card) => card.classList.toggle('dim', filter !== 'all' && card.dataset.type !== filter));
    show(`已筛选：${button.textContent.trim()}`);
  }));

  const modal = document.getElementById('modal');
  const title = document.getElementById('modalTitle');
  const desc = document.getElementById('modalDesc');
  cards.forEach((card) => card.querySelectorAll('.provider-actions button').forEach((button) => button.addEventListener('click', async () => {
    const name = card.querySelector('h3').textContent.trim();
    const providerId = card.dataset.providerId;
    if (button.dataset.action === 'test') {
      if (!providerId || !window.YuzanApi?.checkAdminProviderHealth) { show(`${name}：尚未加载真实供应商配置`); return; }
      button.disabled = true; card.classList.add('testing'); show(`${name}：正在测试连接…`);
      try { const result = await window.YuzanApi.checkAdminProviderHealth(providerId); show(`${name}：${result.status === 'HEALTHY' ? '服务可用' : '配置需要检查'}`); }
      catch (error) { show(`${name}：${error.message || '测试失败'}`); }
      finally { button.disabled = false; card.classList.remove('testing'); }
      return;
    }
    title.textContent = button.dataset.action === 'config' ? `${name}配置` : `切换${name}提供商`;
    desc.textContent = button.dataset.action === 'config' ? '密钥只显示配置状态，不会回显原始密钥。保存配置后由服务端记录审计。' : '切换供应商需要后端配置接口和健康检查通过后才会生效。';
    modal.classList.add('show');
  })));
  modal.querySelector('.close').onclick = modal.querySelector('.cancel').onclick = () => modal.classList.remove('show');
  modal.querySelector('.confirm').onclick = () => { modal.classList.remove('show'); show('当前页面仅支持健康检查；供应商配置写入接口待接入'); };
  document.getElementById('refreshBtn').onclick = async () => { await loadProviders(); show('供应商目录已刷新'); };
  document.getElementById('endMaintenance').onclick = (event) => { event.currentTarget.closest('.maintenance-banner').style.display = 'none'; show('维护模式已结束'); };
  document.getElementById('startTest').onclick = async (event) => {
    const provider = cards.find((card) => card.dataset.providerId);
    if (!provider) { show('请先登录并加载供应商目录'); return; }
    const button = event.currentTarget; button.disabled = true; button.textContent = '测试中';
    try { const result = await window.YuzanApi.checkAdminProviderHealth(provider.dataset.providerId); show(result.status === 'HEALTHY' ? '连通性测试完成：服务可用' : '连通性测试完成：配置需要检查'); }
    catch (error) { show(error.message || '连通性测试失败'); }
    finally { button.disabled = false; button.textContent = '开始测试'; }
  };

  async function loadProviders() {
    if (!window.YuzanApi?.listAdminProviders) return;
    try {
      const result = await window.YuzanApi.listAdminProviders({ limit: 100 });
      (result.items || []).forEach((item, index) => {
        const card = cards.find((candidate) => candidate.querySelector('h3')?.textContent.includes(item.name)) || cards[index];
        if (!card) return;
        card.dataset.providerId = item.id;
        const status = card.querySelector('.healthy');
        if (status) { status.textContent = item.status === 'ACTIVE' ? '● 已启用' : `● ${item.status}`; status.className = item.status === 'ACTIVE' ? 'healthy' : 'warning'; }
        const providerName = card.querySelector('.provider-title p');
        if (providerName) providerName.textContent = `提供商：${item.name}`;
      });
    } catch (error) { show(error.message || '供应商目录加载失败'); }
  }
  loadProviders();
})();
