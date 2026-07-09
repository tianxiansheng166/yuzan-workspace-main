<script setup lang="ts">
import CurriculumStudioStatusPill from "./CurriculumStudioStatusPill.vue";
import type { CurriculumDraftDetail, GatewayResult } from "./model";
import {
  getChecklistMeta,
  getResourceStateLabel,
  getVersionStatusMeta,
} from "./studio-copy";

defineProps<{
  pending: boolean;
  result: GatewayResult<CurriculumDraftDetail> | null;
}>();
</script>

<template>
  <div v-if="pending" class="detail-state" aria-live="polite">
    正在读取课程草稿详情……
  </div>

  <div v-else-if="!result" class="detail-state">等待草稿详情状态。</div>

  <div
    v-else-if="result.kind !== 'ready'"
    class="detail-state detail-state--box"
    :data-kind="result.kind"
  >
    <p class="yx-kicker">DRAFT STATE</p>
    <h2>{{ result.title }}</h2>
    <p>{{ result.detail }}</p>
  </div>

  <div v-else class="draft-detail">
    <section class="draft-detail__hero">
      <div>
        <NuxtLink to="/studio">返回工作台</NuxtLink>
        <p class="yx-kicker">课程草稿详情</p>
        <h2>{{ result.data.version.title }}</h2>
        <p>{{ result.data.summary }}</p>
      </div>
      <aside class="draft-detail__meta">
        <CurriculumStudioStatusPill
          :label="getVersionStatusMeta(result.data.version.status).label"
          :tone="getVersionStatusMeta(result.data.version.status).tone"
        />
        <dl>
          <div>
            <dt>更新时间</dt>
            <dd>{{ result.data.version.updatedAt }}</dd>
          </div>
          <div>
            <dt>负责人</dt>
            <dd>{{ result.data.version.owner }}</dd>
          </div>
          <div>
            <dt>素材完整度</dt>
            <dd>{{ result.data.version.materialCompleteness }}%</dd>
          </div>
        </dl>
      </aside>
    </section>

    <section class="draft-detail__note">
      <p class="yx-kicker">发布边界</p>
      <p>{{ result.data.releaseBoundary }}</p>
    </section>

    <section class="draft-detail__grid">
      <article class="detail-card">
        <p class="yx-kicker">朗读测评文本</p>
        <h3>阅读素材与评分依赖</h3>
        <ul>
          <li v-for="item in result.data.readingAssessments" :key="item.id">
            <div class="meta-row">
              <strong>{{ item.title }}</strong>
              <CurriculumStudioStatusPill
                :label="getResourceStateLabel(item.textState)"
                :tone="item.textState === 'demo' ? 'success' : 'warning'"
              />
            </div>
            <p>{{ item.note }}</p>
          </li>
        </ul>
      </article>

      <article class="detail-card">
        <p class="yx-kicker">书面练习题</p>
        <h3>结构化练习与回填说明</h3>
        <ul>
          <li v-for="item in result.data.writtenExercises" :key="item.id">
            <div class="meta-row">
              <strong>{{ item.title }}</strong>
              <CurriculumStudioStatusPill
                :label="item.mode"
                :tone="item.mode === 'demo' ? 'success' : 'warning'"
              />
            </div>
            <p>{{ item.note }}</p>
          </li>
        </ul>
      </article>
    </section>

    <section class="detail-card">
      <p class="yx-kicker">推荐课程</p>
      <h3>内容关联落点</h3>
      <ul>
        <li v-for="item in result.data.recommendedCourses" :key="item.id">
          <div class="meta-row">
            <strong>{{ item.title }}</strong>
            <CurriculumStudioStatusPill
              :label="getResourceStateLabel(item.state)"
              :tone="item.state === 'demo' ? 'success' : 'warning'"
            />
          </div>
          <p>{{ item.fit }}</p>
        </li>
      </ul>
    </section>

    <section class="draft-detail__grid">
      <article class="detail-card">
        <p class="yx-kicker">发布前检查</p>
        <h3>必须人工复核的项目</h3>
        <ul>
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

      <article class="detail-card">
        <p class="yx-kicker">引用与版权</p>
        <h3>资源状态清单</h3>
        <ul>
          <li v-for="item in result.data.copyrightReferences" :key="item.id">
            <div class="meta-row">
              <strong>{{ item.title }}</strong>
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
            </div>
            <p>{{ item.proof }}</p>
            <p>{{ item.nextAction }}</p>
          </li>
        </ul>
      </article>
    </section>
  </div>
</template>

<style scoped>
.detail-state {
  min-height: 20rem;
  display: grid;
  align-content: center;
  max-width: 44rem;
}

.detail-state--box,
.detail-card,
.draft-detail__meta,
.draft-detail__note {
  padding: 1.5rem;
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-md);
  background: var(--yx-color-surface);
}

.draft-detail {
  display: grid;
  gap: 1.5rem;
}

.draft-detail__hero,
.draft-detail__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(18rem, 0.8fr);
  gap: 1.5rem;
}

.draft-detail__hero h2,
.detail-card h3 {
  margin: 0.4rem 0 0;
  font: 600 var(--yx-text-xl)/1.15 var(--yx-font-display);
}

.draft-detail p,
.detail-card p,
dd {
  color: var(--yx-color-ink-soft);
  line-height: 1.7;
}

.draft-detail__meta dl,
.detail-card ul {
  display: grid;
  gap: 1rem;
  margin: 1rem 0 0;
  padding: 0;
}

.draft-detail__meta div,
.detail-card li {
  list-style: none;
  padding-top: 1rem;
  border-top: 1px solid var(--yx-color-line);
}

.meta-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: start;
}

@media (max-width: 56rem) {
  .draft-detail__hero,
  .draft-detail__grid {
    grid-template-columns: 1fr;
  }
}
</style>
