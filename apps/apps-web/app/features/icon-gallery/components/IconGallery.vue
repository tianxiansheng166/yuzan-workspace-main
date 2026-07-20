<script setup lang="ts">
import { ICON_NAMES, YxIcon } from "@yuzan/ui";
</script>

<template>
  <div class="icon-gallery">
    <header class="icon-gallery__header">
      <h1 class="icon-gallery__title">核心图标系统</h1>
      <p class="icon-gallery__note">
        设计系统展示页，非正式业务入口。以下图标均为本地原创
        SVG，未引入第三方图标包。
      </p>
    </header>

    <section aria-labelledby="icon-list-title">
      <h2 id="icon-list-title" class="icon-gallery__section-title">
        图标列表（{{ ICON_NAMES.length }}）
      </h2>
      <ul class="icon-gallery__grid">
        <li v-for="name in ICON_NAMES" :key="name" class="icon-gallery__item">
          <span class="icon-gallery__preview">
            <YxIcon :name="name" :size="24" :title="name" />
          </span>
          <span class="icon-gallery__label">{{ name }}</span>
        </li>
      </ul>
    </section>

    <section aria-labelledby="usage-title" class="icon-gallery__usage">
      <h2 id="usage-title" class="icon-gallery__section-title">使用说明</h2>
      <ul>
        <li>装饰性图标设置 <code>aria-hidden="true"</code>。</li>
        <li>
          语义性图标通过 <code>title</code> 提供可访问名称，或在外部按钮使用
          <code>YxIconButton</code> 的 <code>label</code>。
        </li>
        <li>
          所有图标支持 <code>size</code> 数字（px）或字符串（如 1.5rem）。
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.icon-gallery {
  padding-block: var(--yx-space-800);
}

.icon-gallery__header {
  margin-bottom: var(--yx-space-700);
}

.icon-gallery__title {
  margin: 0 0 var(--yx-space-300);
  font: var(--yx-font-size-700) / var(--yx-line-height-tight)
    var(--yx-font-display);
}

.icon-gallery__note {
  margin: 0;
  color: var(--yx-text-secondary);
  font-size: var(--yx-font-size-300);
}

.icon-gallery__section-title {
  margin: var(--yx-space-700) 0 var(--yx-space-400);
  font: var(--yx-font-size-500) / var(--yx-line-height-tight)
    var(--yx-font-display);
}

.icon-gallery__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
  gap: var(--yx-space-300);
  list-style: none;
  margin: 0;
  padding: 0;
}

.icon-gallery__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--yx-space-200);
  padding: var(--yx-space-400);
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  background: var(--yx-surface-raised);
}

.icon-gallery__preview {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  color: var(--yx-text-primary);
}

.icon-gallery__label {
  font-size: var(--yx-font-size-200);
  color: var(--yx-text-secondary);
  text-align: center;
  word-break: break-word;
}

.icon-gallery__usage {
  margin-top: var(--yx-space-800);
  padding: var(--yx-space-500);
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  background: var(--yx-surface-raised);
}

.icon-gallery__usage ul {
  margin: var(--yx-space-300) 0 0;
  padding-left: var(--yx-space-500);
}

.icon-gallery__usage li {
  margin-bottom: var(--yx-space-200);
}

.icon-gallery__usage code {
  font-family: var(--yx-font-mono, monospace);
  font-size: var(--yx-font-size-200);
  background: var(--yx-bg-canvas-strong);
  padding: 0.1rem 0.3rem;
  border-radius: var(--yx-radius-sm);
}
</style>
