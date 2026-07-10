<script setup lang="ts">
import type { TestComparison } from "../types";

defineProps<{
  comparisons: TestComparison[];
}>();

function formatScore(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("zh-CN") : "—";
}
</script>

<template>
  <section aria-labelledby="comparison-title">
    <h2 id="comparison-title" class="section-title">首测 / 复测对比</h2>

    <div class="comparison-chart" aria-hidden="true">
      <div
        v-for="item in comparisons"
        :key="item.domain"
        class="comparison-bar"
      >
        <span class="comparison-bar__label">{{ item.domain }}</span>
        <div class="comparison-bar__tracks">
          <div
            class="comparison-bar__first"
            :style="{ width: item.firstScore ? `${item.firstScore}%` : '0%' }"
          />
          <div
            class="comparison-bar__retest"
            :style="{ width: item.retestScore ? `${item.retestScore}%` : '0%' }"
          />
        </div>
      </div>
    </div>

    <table class="comparison-table">
      <caption>
        首测与复测分数对比表（文本替代）
      </caption>
      <thead>
        <tr>
          <th scope="col">维度</th>
          <th scope="col">首测分数</th>
          <th scope="col">首测日期</th>
          <th scope="col">复测分数</th>
          <th scope="col">复测日期</th>
          <th scope="col">变化说明</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in comparisons" :key="item.domain">
          <th scope="row">{{ item.domain }}</th>
          <td>{{ formatScore(item.firstScore) }}</td>
          <td>{{ formatDate(item.firstAt) }}</td>
          <td>{{ formatScore(item.retestScore) }}</td>
          <td>{{ formatDate(item.retestAt) }}</td>
          <td>{{ item.changeText ?? "—" }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.section-title {
  font: 500 var(--yx-text-xl) / 1.2 var(--yx-font-display);
  margin: 0 0 1.25rem;
}
.comparison-chart {
  display: grid;
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}
.comparison-bar {
  display: grid;
  gap: 0.5rem;
}
.comparison-bar__label {
  font-size: var(--yx-text-sm);
  color: var(--yx-color-ink-soft);
}
.comparison-bar__tracks {
  display: grid;
  gap: 0.35rem;
}
.comparison-bar__first,
.comparison-bar__retest {
  height: 0.6rem;
  border-radius: var(--yx-radius-pill);
  min-width: 0.25rem;
}
.comparison-bar__first {
  background: var(--yx-color-ink-soft);
  opacity: 0.45;
}
.comparison-bar__retest {
  background: var(--yx-color-wine);
}
.comparison-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--yx-text-sm);
}
.comparison-table caption {
  text-align: left;
  margin-bottom: 0.75rem;
  font-size: var(--yx-text-sm);
  color: var(--yx-color-ink-soft);
}
.comparison-table th,
.comparison-table td {
  padding: 0.75rem 0.5rem;
  border-bottom: 1px solid var(--yx-color-line);
  text-align: left;
}
.comparison-table th {
  font-weight: 500;
}
</style>
