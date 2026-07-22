(() => {
  const integratedPath = /^\/admin\/(assessment-content|assessment-links|content-review|curriculum|privacy|product-plans|schools|system-providers|users-roles|school-operation)(?:\/|$)/.test(location.pathname);
  if (!integratedPath) return;
  const routes = {
    '/admin/assessment-content':'/admin-pages/yuzan-admin-assessment-content-ui/yuzan-admin-assessment-content-ui/index.html',
    '/admin/assessment-links':'/admin-pages/yuzan-admin-assessment-links-ui/yuzan-admin-assessment-links-ui/index.html',
    '/admin/content-review':'/admin-pages/yuzan-admin-content-review/yuzan-admin-content-review/index.html',
    '/admin/curriculum':'/admin-pages/yuzan-admin-curriculum-ui/yuzan-admin-curriculum-ui/index.html',
    '/admin/privacy':'/admin-pages/yuzan-admin-privacy-ui/yuzan-admin-privacy-ui/index.html',
    '/admin/product-plans':'/admin-pages/yuzan-admin-product-plans-pixel/yuzan-admin-product-plans-pixel/index.html',
    '/admin/schools':'/admin-pages/yuzan-admin-schools-pixel-web/yuzan-admin-schools-standalone/index.html',
    '/admin/system-providers':'/admin-pages/yuzan-admin-system-providers-pixel-web/yuzan-admin-system-providers-standalone/index.html',
    '/admin/users-roles':'/admin-pages/yuzan-admin-users-roles-pixel-web/yuzan-admin-users-roles-standalone/index.html',
    '/admin/school-operation':'/admin-pages/yuzan-school-operation-detail-standalone-v1/yuzan-school-operation-detail-standalone-v1/index.html'
  };
  const root = document.getElementById('admin-integrated-root');
  if (root) {
    root.hidden = false;
    root.innerHTML = '<main class="admin-main-shell"><div class="admin-embed-scroll"><iframe id="admin-integrated-frame" class="admin-content-frame" title="管理端页面" loading="eager"></iframe></div></main>';
    document.getElementById('admin-app')?.setAttribute('hidden', '');
    document.getElementById('admin-toast')?.setAttribute('hidden', '');
  }
  const frame = document.getElementById('admin-integrated-frame');
  if (!frame) return;
  const routeKey = Object.keys(routes).find(key => location.pathname === key || location.pathname.startsWith(key + '/')) || '/admin/curriculum';
  frame.src = routes[routeKey];
  function fit(){
    try{
      const doc=frame.contentDocument;if(!doc?.head)return;
      let style=doc.getElementById('yuzan-admin-integration-reset');
      if(!style){
        style=doc.createElement('style');style.id='yuzan-admin-integration-reset';
        style.textContent=`
          html,body{width:100%!important;min-width:0!important;overflow-x:hidden!important;background:#f7f4ed!important}
          .sidebar,.topbar,.main-nav,.side-nav,.sidebar-nav,.nav-list,.nav,.collapse-sidebar,.collapse-btn,.mobile-sidebar-button,.mobile-sidebar-backdrop{display:none!important}
          .modal-backdrop[hidden],.drawer-backdrop[hidden],[data-modal-backdrop][hidden]{display:none!important}
          .app-shell,.admin-app,.app,.page-shell,.body-shell{display:block!important;width:100%!important;min-width:0!important;max-width:none!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important}
          main,.main,.main-content,.workspace,.content,.content-shell,.main-shell,.page-grid,.layout,.body{width:100%!important;min-width:0!important;max-width:none!important;margin:0!important;padding-left:0!important;padding-right:0!important;box-sizing:border-box!important;grid-template-columns:minmax(0,1fr)!important}
          .content-grid,.workspace-grid,.dashboard-grid,.columns,.two-column{min-width:0!important;max-width:none!important;box-sizing:border-box!important}
        `;doc.head.appendChild(style);
      }
      requestAnimationFrame(()=>{frame.style.height=Math.max(doc.documentElement.scrollHeight,doc.body.scrollHeight,760)+'px'});
    }catch(_){}
  }
  frame.addEventListener('load',fit);setTimeout(fit,0);setTimeout(fit,500);window.addEventListener('resize',fit,{passive:true});
})();
