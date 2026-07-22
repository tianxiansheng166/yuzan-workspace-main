const header = document.querySelector('.site-header');
const menu = document.querySelector('.menu-toggle');
menu?.addEventListener('click', () => {
  const open = header.classList.toggle('menu-open');
  menu.setAttribute('aria-expanded', String(open));
});

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', () => header.classList.remove('menu-open'));
});

const hero = document.querySelector('.hero');
if (hero && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  hero.addEventListener('pointermove', (event) => {
    const rect = hero.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - .5) * -10;
    const y = ((event.clientY - rect.top) / rect.height - .5) * -5;
    hero.style.setProperty('--mx', `${x}px`);
    hero.style.setProperty('--my', `${y}px`);
  });
  hero.addEventListener('pointerleave', () => {
    hero.style.setProperty('--mx', '0px');
    hero.style.setProperty('--my', '0px');
  });
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => entry.target.classList.toggle('is-visible', entry.isIntersecting));
}, { threshold: .18 });
document.querySelectorAll('.reveal').forEach((node) => observer.observe(node));

const sections = [...document.querySelectorAll('main > section[id]')];
const navLinks = [...document.querySelectorAll('.primary-nav a')];
const navObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((link) => link.classList.toggle('is-active', link.getAttribute('href') === `#${entry.target.id}`));
  });
}, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
sections.forEach((section) => navObserver.observe(section));

window.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'yuzan-section-height' || !data.id || !Number.isFinite(data.height)) return;
  const frame = document.querySelector(`iframe[data-frame-id="${CSS.escape(data.id)}"]`);
  if (frame) frame.style.height = `${Math.max(520, data.height)}px`;
});

document.querySelectorAll('.embedded-section iframe').forEach((frame, index) => {
  const id = `frame-${index + 1}`;
  frame.dataset.frameId = id;
  const separator = frame.src.includes('?') ? '&' : '?';
  frame.src += `${separator}frameId=${encodeURIComponent(id)}`;
});
