(() => {
  const root = document.querySelector('.design');
  if (!root) return;

  // 如果页面已接入学生端统一导航，则由 student-nav.js 接管缩放，fit.js 不再干预
  const isManaged = () => document.body.classList.contains('student-has-nav') || root.dataset.fit === 'managed';

  const fit = () => {
    if (isManaged()) return;
    const dw = Number(root.dataset.width || root.offsetWidth);
    const dh = Number(root.dataset.height || root.offsetHeight);
    root.style.width = `${dw}px`;
    root.style.height = `${dh}px`;
    const scale = Math.min(innerWidth / dw, innerHeight / dh);
    root.style.transform = `translate(-50%, -50%) scale(${scale})`;
    root.style.setProperty('--viewport-scale', scale);
  };

  addEventListener('resize', fit, {passive:true});
  new MutationObserver(() => { if (!isManaged()) fit(); }).observe(root,{attributes:true,attributeFilter:['data-width','data-height','class']});
  fit();

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-nav]');
    if (el && !el.disabled && el.getAttribute('aria-disabled') !== 'true') {
      e.preventDefault();
      location.href = el.dataset.nav;
    }
  });
})();
