(() => {
  "use strict";

  const paths = {
    arrow: '<path d="M4 12h15M13 5l7 7-7 7"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    headphones:
      '<path d="M4 13v-2a8 8 0 0 1 16 0v2"/><path d="M4 12h3v7H6a2 2 0 0 1-2-2zM20 12h-3v7h1a2 2 0 0 0 2-2z"/>',
    list: '<path d="M9 6h10M9 12h10M9 18h10"/><path d="M5 6h.01M5 12h.01M5 18h.01"/>',
    mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    play: '<path d="m8 5 11 7-11 7z"/>',
    retry: '<path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 1-2-5"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.4"/><path d="m16 16 4.2 4.2"/>',
    star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    filledStar:
      '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="currentColor"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    upload: '<path d="M12 16V4m-4 4 4-4 4 4"/><path d="M5 14v5h14v-5"/>',
    wave: '<path d="M3 12h2l2-5 4 10 3-7 2 4 2-2h3"/>',
    book: '<path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21z"/><path d="M5 4.5V21M9 6h7M9 10h7"/>',
    listen:
      '<path d="M4 13v-2a8 8 0 0 1 16 0v2"/><path d="M4 12h3v7H6a2 2 0 0 1-2-2zM20 12h-3v7h1a2 2 0 0 0 2-2zM12 20v1"/>',
    speak:
      '<path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4 4v-4.5a2.5 2.5 0 0 1-2-2.5z"/><path d="M9 9h6M9 12h4"/>',
    read: '<path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21z"/><path d="M5 4.5V21M9 6h7M9 10h7M9 14h5"/>',
    write:
      '<path d="m4 17 9-9 4 4-9 9H4zM12 9l4-4a2.1 2.1 0 0 1 3 3l-4 4M4 21h16"/>',
    ear: '<path d="M5 10a7 7 0 0 1 14 0c0 3-2 4-3 5s-1 2-1 3a3 3 0 0 1-6 0"/><path d="M9 11a3 3 0 0 1 6 0c0 1.6-1 2-2 3"/>',
    spark:
      '<path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z"/>',
    filter: '<path d="M4 5h16M7 12h10m-7 7h4"/>',
  };

  const abilityIcon = (label) => {
    const text = String(label || "");
    if (/听|辨/.test(text)) return "ear";
    if (/读|朗读|古诗/.test(text)) return "read";
    if (/说|复述|交际|跟读/.test(text)) return "speak";
    if (/写|表达/.test(text)) return "write";
    return "spark";
  };

  function icon(name, className = "") {
    const body = paths[name] || paths.spark;
    return `<svg class="yz-icon ${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
  }

  function waveform({ bars = 22, className = "", kind = "input" } = {}) {
    const width = 120;
    const gap = 2;
    const barWidth = (width - gap * (bars - 1)) / bars;
    const rects = Array.from({ length: bars }, (_, index) => {
      const center = Math.abs((index - (bars - 1) / 2) / ((bars - 1) / 2));
      const height = Math.round(4 + (1 - center) * 10);
      const y = Math.round((24 - height) / 2);
      const x = Number((index * (barWidth + gap)).toFixed(2));
      return `<rect data-wave-bar="${index}" x="${x}" y="${y}" width="${barWidth.toFixed(2)}" height="${height}" rx="${Math.min(2, barWidth / 2).toFixed(1)}"/>`;
    }).join("");
    return `<svg class="yz-waveform ${className}" data-waveform="${kind}" viewBox="0 0 ${width} 24" aria-hidden="true" focusable="false">${rects}</svg>`;
  }

  window.YuzanPracticeVisuals = { abilityIcon, icon, waveform };
})();
