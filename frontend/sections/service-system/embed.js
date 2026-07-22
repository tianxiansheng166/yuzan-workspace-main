(() => {
  const params = new URLSearchParams(location.search);
  const frameId = params.get('frameId') || location.pathname;
  document.documentElement.classList.add('is-embedded');
  const report = () => {
    const body = document.body;
    const root = document.documentElement;
    const height = Math.ceil(Math.max(body.scrollHeight, body.offsetHeight, root.scrollHeight, root.offsetHeight));
    parent.postMessage({ type: 'yuzan-section-height', id: frameId, height }, '*');
  };
  addEventListener('load', () => { report(); setTimeout(report, 250); setTimeout(report, 900); });
  addEventListener('resize', report);
  new ResizeObserver(report).observe(document.body);
})();
