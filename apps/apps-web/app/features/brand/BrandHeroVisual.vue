<template>
  <figure class="brand-visual">
    <svg
      viewBox="0 0 760 760"
      role="img"
      aria-labelledby="brand-visual-title brand-visual-desc"
    >
      <title id="brand-visual-title">语赞心声品牌主视觉</title>
      <desc id="brand-visual-desc">
        由山形路径、学习节点与信号波纹构成的原创 SVG，表示弱网环境中的连续学习。
      </desc>
      <defs>
        <linearGradient id="brandGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f2e1c3" />
          <stop offset="100%" stop-color="#d7e4d2" />
        </linearGradient>
      </defs>
      <circle class="brand-visual__halo" cx="565" cy="166" r="118" />
      <path
        class="brand-visual__terrain brand-visual__terrain--far"
        d="M20 602C118 470 166 704 286 528S496 248 742 350"
      />
      <path
        class="brand-visual__terrain"
        d="M-20 652C94 520 178 750 330 554S544 342 766 454"
      />
      <path
        class="brand-visual__route"
        d="M88 610c74-38 124 34 198-20 66-48 116-10 178-84 44-52 88-70 154-108"
      />
      <path
        class="brand-visual__wave"
        d="M164 300c42-66 76 78 122 0s76 76 122 0 78 72 124 0"
      />
      <path
        class="brand-visual__wave brand-visual__wave--light"
        d="M170 354c34-52 64 58 102 0s68 58 106 0 66 54 108 0"
      />
      <g class="brand-visual__cards">
        <rect x="56" y="82" width="208" height="122" rx="28" />
        <rect x="456" y="494" width="228" height="138" rx="32" />
        <rect x="486" y="92" width="172" height="88" rx="24" />
      </g>
      <g class="brand-visual__lines">
        <path d="M90 118h90" />
        <path d="M90 146h138" />
        <path d="M90 174h116" />
        <path d="M520 126h94" />
        <path d="M520 150h72" />
        <path d="M490 534h130" />
        <path d="M490 564h156" />
        <path d="M490 594h108" />
      </g>
      <g class="brand-visual__points">
        <circle cx="120" cy="592" r="15" />
        <circle cx="300" cy="580" r="12" />
        <circle cx="470" cy="486" r="14" />
        <circle cx="640" cy="362" r="18" />
      </g>
    </svg>
    <figcaption>
      品牌图形为本地原创
      SVG，不引用第三方版权图片；路径、节点和波纹共同表示测评、学习与支持的连续关系。
    </figcaption>
  </figure>
</template>

<style scoped>
.brand-visual {
  position: relative;
  margin: 0;
}

svg {
  width: min(100%, 44rem);
  margin-inline: auto;
}

.brand-visual__halo {
  fill: url(#brandGlow);
  opacity: 0.72;
}

.brand-visual__terrain {
  fill: none;
  stroke: color-mix(in srgb, var(--yx-color-sage-strong) 88%, white);
  stroke-width: 2;
  opacity: 0.48;
}

.brand-visual__terrain--far {
  opacity: 0.25;
}

.brand-visual__route {
  fill: none;
  stroke: var(--yx-color-ink);
  stroke-width: 3;
  stroke-dasharray: 8 12;
  stroke-linecap: round;
}

.brand-visual__wave {
  fill: none;
  stroke: var(--yx-color-wine);
  stroke-width: 6;
  stroke-linecap: round;
}

.brand-visual__wave--light {
  stroke: color-mix(in srgb, var(--yx-color-gold) 78%, white);
  stroke-width: 4;
}

.brand-visual__cards rect {
  fill: color-mix(in srgb, white 84%, var(--yx-color-paper));
  stroke: color-mix(in srgb, var(--yx-color-ink) 12%, transparent);
  stroke-width: 1.5;
}

.brand-visual__lines path {
  fill: none;
  stroke: color-mix(in srgb, var(--yx-color-ink) 42%, transparent);
  stroke-width: 9;
  stroke-linecap: round;
}

.brand-visual__points circle {
  fill: var(--yx-color-wine);
  stroke: var(--yx-color-paper);
  stroke-width: 8;
}

figcaption {
  max-width: 24rem;
  margin-top: 1rem;
  margin-left: auto;
  font-size: var(--yx-text-sm);
  line-height: 1.7;
  color: var(--yx-color-ink-soft);
}
</style>
