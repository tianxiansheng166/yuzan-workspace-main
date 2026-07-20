(() => {
  'use strict';

  const toast = document.getElementById('toast');
  let timer;
  const showToast = (msg) => {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => toast.classList.remove('show'), 1800);
  };

  // ── LIVE_LOCAL: Tab 切换 ──
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showToast(`已切换到${btn.textContent}`);
    });
  });

  // ── LIVE_LOCAL: 播放按钮 ──
  document.querySelectorAll('.play-btn').forEach(btn => btn.addEventListener('click', () => {
    btn.classList.toggle('playing');
    btn.textContent = btn.classList.contains('playing') ? '❚❚' : '▶';
    showToast(btn.classList.contains('playing') ? '开始播放录音' : '暂停播放录音');
  }));

  // ── UNSUPPORTED: 编辑信息、更多操作 ──
  document.querySelectorAll('.outline-btn').forEach(btn => {
    const txt = btn.textContent.trim();
    btn.style.opacity = '.55';
    btn.style.cursor = 'not-allowed';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (txt.includes('编辑')) showToast('编辑学生信息功能暂未开通');
      else if (txt.includes('更多')) showToast('更多操作菜单暂未开通');
      else showToast('该功能暂未开通');
    });
  });

  // ── UNSUPPORTED: 各种操作按钮（联系家长、制定计划等） ──
  const unsupportedButtons = '.ghost-btn,.link-btn,.comm-row button,.resource-row button,.chip-row button,.action-card button';
  document.querySelectorAll(unsupportedButtons).forEach(btn => {
    const txt = btn.textContent.replace(/\s+/g, ' ').trim();
    // 一些按钮可以路由到真实页面
    if (txt.includes('查看学习轨迹')) {
      btn.addEventListener('click', () => { location.href = '/teacher/students/demo/'; });
      return;
    }
    if (txt.includes('查看全部')) {
      btn.addEventListener('click', () => showToast('详情列表功能暂未开通'));
      return;
    }
    // 其余全部 UNSUPPORTED
    btn.addEventListener('click', () => showToast(`${txt}功能暂未开通`));
  });

  // ── UNSUPPORTED: add-shot (＋) 按钮 ──
  document.querySelectorAll('.add-shot').forEach(btn => {
    btn.addEventListener('click', () => showToast('添加成长记录功能暂未开通'));
  });

  // ── LIVE_LOCAL: mini-info (i) 按钮 → 显示提示 ──
  document.querySelectorAll('.mini-info').forEach(btn => {
    btn.addEventListener('click', () => showToast('此处显示学习路径的详细说明'));
  });

  // ── LIVE_ROUTE: 侧栏导航修复 ──
  const navRoutes = {
    '首页': '/teacher/assignments',
    '课程': '/teacher/courses/',
    '任务': '/teacher/assignments',
    '测评': '/teacher/assessments',
    '复核': '/teacher/reviews/submission-1/',
    '报告': '/teacher/assessments/detail/',
  };
  document.querySelectorAll('.nav .nav-item').forEach(link => {
    const label = link.querySelector('span')?.textContent.trim() || '';
    if (navRoutes[label]) {
      link.href = navRoutes[label];
    } else if (label === '班级' || link.classList.contains('active')) {
      // 当前页面或班级导航，保持不变
      return;
    } else {
      // 无对应页面
      link.removeAttribute('href');
      link.style.cursor = 'not-allowed';
      link.style.opacity = '.55';
      link.addEventListener('click', (e) => {
        e.preventDefault();
        showToast(`${label}功能暂未开通`);
      });
    }
  });

  // ── LIVE_ROUTE: 面包屑修复 ──
  document.querySelectorAll('.crumbs a').forEach(link => {
    const txt = link.textContent.trim();
    if (txt === '班级') link.href = '/teacher/classes/';
    else if (txt.includes('五年级')) link.href = '/teacher/classes/detail/';
  });

  // ── UNSUPPORTED: 侧栏子导航 ──
  document.querySelectorAll('.subnav a').forEach(link => {
    const txt = link.textContent.trim();
    if (txt === '学生' || link.classList.contains('current')) return;
    link.removeAttribute('href');
    link.style.cursor = 'not-allowed';
    link.style.opacity = '.55';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showToast(`${txt}功能暂未开通`);
    });
  });

  // ── UNSUPPORTED: 公益与支持 ──
  const supportBox = document.querySelector('.support-box');
  if (supportBox) {
    supportBox.style.cursor = 'not-allowed';
    supportBox.style.opacity = '.55';
    supportBox.addEventListener('click', () => showToast('公益与支持页面暂未开通'));
  }
})();
