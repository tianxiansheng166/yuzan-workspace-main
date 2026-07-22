(() => {
  'use strict';
  const app = document.getElementById('admin-app');
  const toastRoot = document.getElementById('admin-toast');
  function toast(message, type='info') {
    const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=message;toastRoot.appendChild(el);setTimeout(()=>el.remove(),3000);
  }
  app.innerHTML = `
    <main class="admin-dashboard-content">
      <header class="admin-dashboard-header"><div><p class="eyebrow">平台治理 · 今日概览</p><h1>平台管理驾驶舱</h1><p class="admin-subtitle">集中查看学校、账号、课程与内容治理状态。</p></div><button class="dashboard-refresh" type="button">↻ 刷新数据</button></header>
      <section class="admin-cards" aria-label="关键指标">
        <article class="admin-card"><span class="label">在册学校</span><strong class="value" data-admin-metric="schools">—</strong><span class="trend">等待接口数据</span></article>
        <article class="admin-card"><span class="label">活跃账号</span><strong class="value" data-admin-metric="users">—</strong><span class="trend">等待接口数据</span></article>
        <article class="admin-card"><span class="label">学生人数</span><strong class="value" data-admin-metric="students">—</strong><span class="trend">等待接口数据</span></article>
        <article class="admin-card"><span class="label">已验收提交</span><strong class="value" data-admin-metric="completedAssessments">—</strong><span class="trend">等待接口数据</span></article>
      </section>
      <section class="admin-section"><div class="section-heading"><div><p class="eyebrow">组织状态</p><h2>最近活跃学校</h2></div><a href="/admin/schools">查看学校管理 →</a></div><div class="table-scroll"><table class="admin-table"><thead><tr><th>学校</th><th>角色</th><th>最近同步</th><th>状态</th></tr></thead><tbody><tr><td>学校一（已脱敏）</td><td>教师 / 学生 / 管理员</td><td>今天 08:40</td><td><span class="status ok">正常</span></td></tr><tr><td>学校二（已脱敏）</td><td>志愿者</td><td>今天 08:40</td><td><span class="status ok">正常</span></td></tr><tr><td>学校三（已脱敏）</td><td>学生</td><td>昨天 18:12</td><td><span class="status warn">待同步</span></td></tr></tbody></table></div></section>
      <section class="admin-section admin-notice"><div class="section-heading"><div><p class="eyebrow">使用提示</p><h2>管理端导航已统一</h2></div><span class="notice-badge">演示数据</span></div><p>左侧导航可收起为图标栏；窄屏会进入抽屉模式，内容保持桌面排版并支持左右滚动，不会把卡片强行挤到下一行。</p><div class="quick-links"><a href="/admin/users-roles">用户与角色</a><a href="/admin/content-review">内容审核</a><a href="/admin/privacy">隐私与合规</a><a href="/admin/system-providers">系统运维</a></div></section>
    </main>`;
  async function hydrateDashboard() {
    if (typeof YuzanApi === 'undefined' || !YuzanApi.getToken()) {
      toast('当前为未登录预览模式，指标等待真实接口','warning');
      return;
    }
    try {
      const data = await YuzanApi.getAdminDashboard();
      const metrics = data?.metrics || {};
      app.querySelectorAll('[data-admin-metric]').forEach((node) => {
        const key = node.dataset.adminMetric;
        if (key && metrics[key] != null) node.textContent = Number(metrics[key]).toLocaleString('zh-CN');
      });
      app.querySelectorAll('.admin-card .trend').forEach((node) => { node.textContent = '来自后端聚合'; });
      toast('管理指标已更新','success');
    } catch (error) {
      toast(error?.message || '管理指标接口暂不可用','warning');
    }
  }
  app.querySelector('.dashboard-refresh').addEventListener('click', hydrateDashboard);
  hydrateDashboard();
})();
