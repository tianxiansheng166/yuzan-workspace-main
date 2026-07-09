<script setup lang="ts">
useSeoMeta({
  title: "语赞心声｜教师工作台",
});

const entries = [
  { to: "/teacher/assessments", label: "测评任务" },
  { to: "/teacher/students/demo/assessment-reports", label: "学生报告" },
  { to: "/teacher-tools/mindmate", label: "MindMate" },
  { to: "/teacher-tools/mindgraph", label: "MindGraph" },
  { to: "/tools/tibetan-translation", label: "翻译入口" },
];
</script>

<template>
  <section class="yx-shell teacher-hub">
    <header class="teacher-hub__header">
      <p class="yx-kicker">TEACHER WORKSPACE</p>
      <h1>教师工作台</h1>
      <p>
        整合测评任务、学生报告与教学辅助工具。以下内容来自各 MVP
        任务入口，未接入真实数据的功能已标注状态。
      </p>
    </header>

    <nav aria-label="教师工作台导航" class="teacher-hub__nav">
      <ul>
        <li v-for="entry in entries" :key="entry.to">
          <NuxtLink :to="entry.to">{{ entry.label }}</NuxtLink>
        </li>
      </ul>
    </nav>

    <div class="teacher-hub__note">
      <p>完整班级统计、待复核队列与同步异常提醒将在后续迭代中接入真实数据。</p>
    </div>
  </section>
</template>

<style scoped>
.teacher-hub {
  padding-block: clamp(3rem, 7vw, 7rem);
}
.teacher-hub__header {
  max-width: 52rem;
  margin-bottom: 2.5rem;
}
.teacher-hub h1 {
  margin: 0.8rem 0;
  font: 600 clamp(2.2rem, 6vw, 5.2rem) / 1 var(--yx-font-display);
}
.teacher-hub__header p {
  color: var(--yx-color-ink-soft);
  line-height: 1.8;
}
.teacher-hub__nav ul {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 1rem;
  list-style: none;
  padding: 0;
  margin: 0 0 2.5rem;
}
.teacher-hub__nav a {
  display: flex;
  align-items: center;
  min-height: 4rem;
  padding: 0.75rem 1.25rem;
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-md);
  background: var(--yx-color-surface);
  text-decoration: none;
  color: var(--yx-color-ink);
}
.teacher-hub__nav a:hover {
  border-color: var(--yx-color-wine);
}
.teacher-hub__note {
  max-width: 52rem;
  padding: 1.25rem;
  border-radius: var(--yx-radius-md);
  background: var(--yx-color-surface);
  color: var(--yx-color-ink-soft);
  font-size: var(--yx-text-sm);
  line-height: 1.7;
}
.teacher-hub__note p {
  margin: 0;
}
</style>
