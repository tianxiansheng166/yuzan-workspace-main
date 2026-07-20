<script setup lang="ts">
import CurriculumStudioStatusPill from "./CurriculumStudioStatusPill.vue";
import type { CurriculumStudioDashboardData, GatewayResult } from "./model";
import {
  getChecklistMeta,
  getLibraryKindLabel,
  getResourceStateLabel,
  getVersionStatusMeta,
} from "./studio-copy";

defineProps<{
  pending: boolean;
  result: GatewayResult<CurriculumStudioDashboardData> | null;
}>();
</script>

<template>
  <div v-if="pending" class="studio-state" aria-live="polite">
    正在加载内容工作台框架……
  </div>

  <div v-else-if="!result" class="studio-state">等待工作台状态。</div>

  <div
    v-else-if="result.kind !== 'ready'"
    class="studio-state studio-state--box"
    :data-kind="result.kind"
  >
    <p class="yx-kicker">STUDIO STATE</p>
    <h2>{{ result.title }}</h2>
    <p>{{ result.detail }}</p>
  </div>

  <div v-else class="studio-dashboard">
    <section class="studio-hero">
      <div>
        <p class="yx-kicker">内容工作台 · demo gateway</p>
        <h2>课程版本、素材目录、关系视图和发布前检查都集中在同一条内容链。</h2>
        <p>{{ result.note }}</p>
      </div>
      <aside class="studio-note">
        <h3>边界说明</h3>
        <p>{{ result.data.introNote }}</p>
        <p>
          未接 CUR-001 时，统一使用
          <code>demo</code>、<code>pending</code>、<code>unavailable</code>。
        </p>
      </aside>
    </section>

    <section class="studio-grid">
      <article class="studio-card">
        <div class="section-heading">
          <div>
            <p class="yx-kicker">目录</p>
            <h3>课程 / 测评素材目录</h3>
          </div>
          <span>{{ result.data.libraryAssets.length }} 项</span>
        </div>
        <ul class="asset-list">
          <li v-for="asset in result.data.libraryAssets" :key="asset.id">
            <div>
              <strong>{{ asset.title }}</strong>
              <p>{{ asset.subtitle }}</p>
            </div>
            <div class="meta-row">
              <CurriculumStudioStatusPill
                :label="getLibraryKindLabel(asset.kind)"
              />
              <CurriculumStudioStatusPill
                :label="getResourceStateLabel(asset.resourceState)"
                :tone="
                  asset.resourceState === 'demo'
                    ? 'success'
                    : asset.resourceState === 'pending'
                      ? 'warning'
                      : 'danger'
                "
              />
            </div>
          </li>
        </ul>
      </article>

      <article class="studio-card">
        <div class="section-heading">
          <div>
            <p class="yx-kicker">版本状态</p>
            <h3>课程草稿与版本</h3>
          </div>
          <NuxtLink :to="`/studio/${result.data.highlightedDraftId}`"
            >进入草稿详情</NuxtLink
          >
        </div>
        <ul class="version-list">
          <li v-for="version in result.data.versions" :key="version.id">
            <div>
              <strong>{{ version.title }}</strong>
              <p>{{ version.subtitle }}</p>
            </div>
            <div class="meta-column">
              <CurriculumStudioStatusPill
                :label="getVersionStatusMeta(version.status).label"
                :tone="getVersionStatusMeta(version.status).tone"
              />
              <span>{{ version.updatedAt }}</span>
            </div>
            <p class="version-note">{{ version.note }}</p>
          </li>
        </ul>
      </article>
    </section>

    <section class="studio-grid studio-grid--balanced">
      <article class="studio-card">
        <div class="section-heading">
          <div>
            <p class="yx-kicker">内容关联</p>
            <h3>朗读测评、书面练习与推荐课程</h3>
          </div>
        </div>
        <ol class="association-list">
          <li
            v-for="association in result.data.associations"
            :key="association.id"
          >
            <div class="association-flow">
              <span>{{ association.readingTextTitle }}</span>
              <span aria-hidden="true">→</span>
              <span>{{ association.worksheetTitle }}</span>
              <span aria-hidden="true">→</span>
              <span>{{ association.recommendedCourseTitle }}</span>
            </div>
            <p>{{ association.relationNote }}</p>
            <CurriculumStudioStatusPill
              :label="getResourceStateLabel(association.resourceState)"
              :tone="
                association.resourceState === 'demo' ? 'success' : 'warning'
              "
            />
          </li>
        </ol>
      </article>

      <article class="studio-card">
        <div class="section-heading">
          <div>
            <p class="yx-kicker">发布前检查</p>
            <h3>双语、版权、素材完整度、可访问性</h3>
          </div>
        </div>
        <ul class="checklist">
          <li v-for="item in result.data.checklist" :key="item.id">
            <div class="meta-row">
              <strong>{{ item.label }}</strong>
              <CurriculumStudioStatusPill
                :label="getChecklistMeta(item.state).label"
                :tone="getChecklistMeta(item.state).tone"
              />
            </div>
            <p>{{ item.detail }}</p>
          </li>
        </ul>
      </article>
    </section>

    <section class="studio-card">
      <div class="section-heading">
        <div>
          <p class="yx-kicker">版权与引用</p>
          <h3>资源引用与版权状态</h3>
        </div>
      </div>
      <div class="rights-table" role="table" aria-label="资源引用与版权状态">
        <div class="rights-row rights-row--head" role="row">
          <span role="columnheader">资源</span>
          <span role="columnheader">权利人</span>
          <span role="columnheader">状态</span>
          <span role="columnheader">下一步</span>
        </div>
        <div
          v-for="item in result.data.copyrightReferences"
          :key="item.id"
          class="rights-row"
          role="row"
        >
          <span role="cell">{{ item.title }}</span>
          <span role="cell">{{ item.rightsOwner }}</span>
          <span role="cell">
            <CurriculumStudioStatusPill
              :label="item.status"
              :tone="
                item.status === 'cleared'
                  ? 'success'
                  : item.status === 'pending'
                    ? 'warning'
                    : 'danger'
              "
            />
          </span>
          <span role="cell">{{ item.nextAction }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.studio-state {
  min-height: 20rem;
  display: grid;
  align-content: center;
  max-width: 44rem;
}

.studio-state--box {
  padding: 2rem;
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-md);
  background: var(--yx-color-surface);
}

.studio-dashboard {
  display: grid;
  gap: clamp(1.5rem, 4vw, 2.5rem);
}

.studio-hero,
.studio-grid {
  display: grid;
  gap: 1.5rem;
}

.studio-hero {
  grid-template-columns: minmax(0, 1.5fr) minmax(18rem, 0.85fr);
}

.studio-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.studio-grid--balanced {
  align-items: start;
}

.studio-card,
.studio-note {
  padding: 1.5rem;
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-md);
  background: var(--yx-color-surface);
}

.studio-hero h2,
.section-heading h3 {
  margin: 0.35rem 0 0;
  font: 600 var(--yx-text-xl)/1.15 var(--yx-font-display);
}

.studio-hero p,
.studio-note p,
.studio-card p,
.rights-row {
  color: var(--yx-color-ink-soft);
  line-height: 1.7;
}

.section-heading,
.meta-row,
.association-flow,
.rights-row {
  display: flex;
  gap: 0.75rem;
}

.section-heading,
.meta-row {
  justify-content: space-between;
  align-items: start;
}

.asset-list,
.version-list,
.association-list,
.checklist {
  list-style: none;
  padding: 0;
  margin: 1.5rem 0 0;
  display: grid;
  gap: 1rem;
}

.asset-list li,
.version-list li,
.association-list li,
.checklist li {
  padding-top: 1rem;
  border-top: 1px solid var(--yx-color-line);
}

.meta-column {
  display: grid;
  justify-items: end;
  gap: 0.35rem;
  font-size: var(--yx-text-sm);
  color: var(--yx-color-ink-soft);
}

.version-note {
  margin: 0.75rem 0 0;
}

.association-flow {
  flex-wrap: wrap;
  align-items: center;
  color: var(--yx-color-ink);
  font-weight: 600;
}

.rights-table {
  margin-top: 1.5rem;
  display: grid;
}

.rights-row {
  display: grid;
  grid-template-columns: 1.2fr 1fr auto 1.1fr;
  gap: 1rem;
  padding: 1rem 0;
  border-top: 1px solid var(--yx-color-line);
  align-items: start;
}

.rights-row--head {
  color: var(--yx-color-ink);
  font-weight: 600;
}

@media (max-width: 56rem) {
  .studio-hero,
  .studio-grid,
  .rights-row {
    grid-template-columns: 1fr;
  }

  .meta-column {
    justify-items: start;
  }
}
</style>
