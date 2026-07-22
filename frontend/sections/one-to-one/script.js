(() => {
  const navItems = [...document.querySelectorAll('.nav-item')];
  navItems.forEach(item => item.addEventListener('click', () => {
    navItems.forEach(n => n.classList.remove('active'));
    item.classList.add('active');
  }));

  document.querySelectorAll('.flow-step').forEach(step => {
    step.addEventListener('click', () => {
      document.querySelectorAll('.flow-step').forEach(s => s.classList.remove('selected'));
      step.classList.add('selected');
    });
  });

  const modals = {
    login: document.getElementById('login-modal'),
    apply: document.getElementById('apply-modal')
  };
  document.querySelectorAll('[data-modal]').forEach(button => {
    button.addEventListener('click', () => modals[button.dataset.modal]?.showModal());
  });
  document.querySelectorAll('.modal-close').forEach(button => {
    button.addEventListener('click', () => button.closest('dialog').close());
  });
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (outside) dialog.close();
    });
  });
})();
