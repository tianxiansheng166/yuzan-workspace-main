<script setup lang="ts">
import type {
  ReviewFilterOptions,
  ReviewFilterState,
} from "~/features/submission-review/adapters/review.adapter";

const props = defineProps<{
  filterOptions: ReviewFilterOptions;
  filters: ReviewFilterState;
}>();

const emit = defineEmits<{
  "update:filters": [value: ReviewFilterState];
}>();

function updateField<K extends keyof ReviewFilterState>(
  key: K,
  value: ReviewFilterState[K],
) {
  emit("update:filters", {
    ...props.filters,
    [key]: value,
  });
}
</script>

<template>
  <fieldset class="filter-bar">
    <legend class="yx-visually-hidden">复核列表筛选</legend>
    <label class="filter-bar__field">
      <span>按班级筛选</span>
      <select
        :value="filters.className"
        @change="
          updateField(
            'className',
            ($event.target as HTMLSelectElement)
              .value as ReviewFilterState['className'],
          )
        "
      >
        <option value="all">全部班级</option>
        <option
          v-for="item in filterOptions.classOptions"
          :key="item"
          :value="item"
        >
          {{ item }}
        </option>
      </select>
    </label>

    <label class="filter-bar__field">
      <span>按任务类型筛选</span>
      <select
        :value="filters.taskType"
        @change="
          updateField(
            'taskType',
            ($event.target as HTMLSelectElement)
              .value as ReviewFilterState['taskType'],
          )
        "
      >
        <option value="all">全部任务类型</option>
        <option
          v-for="item in filterOptions.taskOptions"
          :key="item"
          :value="item"
        >
          {{
            item === "initial-assessment"
              ? "首次测评"
              : item === "retest"
                ? "复测"
                : item === "reading-practice"
                  ? "朗读练习"
                  : item === "written-practice"
                    ? "书面练习"
                    : "综合任务"
          }}
        </option>
      </select>
    </label>

    <label class="filter-bar__field">
      <span>按提交时间排序</span>
      <select
        :value="filters.timeOrder"
        @change="
          updateField(
            'timeOrder',
            ($event.target as HTMLSelectElement)
              .value as ReviewFilterState['timeOrder'],
          )
        "
      >
        <option value="newest">优先级后按最新</option>
        <option value="oldest">优先级后按最早</option>
      </select>
    </label>

    <label class="filter-bar__field">
      <span>按状态筛选</span>
      <select
        :value="filters.status"
        @change="
          updateField(
            'status',
            ($event.target as HTMLSelectElement)
              .value as ReviewFilterState['status'],
          )
        "
      >
        <option
          v-for="item in filterOptions.statusOptions"
          :key="item"
          :value="item"
        >
          {{ item === "all" ? "全部状态" : item }}
        </option>
      </select>
    </label>
  </fieldset>
</template>

<style scoped>
.filter-bar {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.9rem;
  margin: 0;
  padding: 1rem 0 1.25rem;
  border: 0;
}

.filter-bar__field {
  display: grid;
  gap: 0.45rem;
  color: var(--yx-text-secondary);
  font-size: var(--yx-font-size-200);
}

.filter-bar__field span {
  font-weight: var(--yx-font-weight-semibold);
}

.filter-bar__field select {
  min-height: 2.75rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  padding: 0.75rem 0.9rem;
  background: var(--yx-surface-default);
  color: var(--yx-text-primary);
}

@media (max-width: 48rem) {
  .filter-bar {
    grid-template-columns: 1fr;
  }
}
</style>
