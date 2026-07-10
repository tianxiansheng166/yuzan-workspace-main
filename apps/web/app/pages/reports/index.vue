<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { StudentReportSummary } from "~/features/reports/types";
import { reportGateway } from "~/features/reports/gateways/report.gateway";
import ReportStateMessage from "~/features/reports/components/ReportStateMessage.vue";

useSeoMeta({
  title: "成长报告｜语赞心声",
});

const status = ref<"loading" | "ready" | "empty" | "error" | "permission">(
  "loading",
);
const message = ref("正在读取学生列表……");
const students = ref<StudentReportSummary[]>([]);

onMounted(async () => {
  try {
    const result = await reportGateway.listStudents("demo-school-001");
    status.value = result.status as typeof status.value;
    students.value = result.students;
    message.value = result.message;
  } catch {
    status.value = "error";
    message.value = "读取学生列表时发生错误，请稍后重试。";
  }
});
</script>

<template>
  <section class="reports yx-shell">
    <header class="reports__header">
      <div>
        <p class="yx-kicker">教师报告</p>
        <h1>学生成长报告</h1>
        <p>查看学生的学习轨迹、测评对比与教师干预建议。</p>
      </div>
    </header>

    <ReportStateMessage
      v-if="status !== 'ready'"
      :status="status"
      :message="message"
    />

    <div v-else class="reports__body">
      <p v-if="message" class="reports__notice">{{ message }}</p>

      <div v-if="students.length === 0" class="reports__empty">
        暂无学生记录。
      </div>

      <ul v-else class="student-list">
        <li
          v-for="student in students"
          :key="student.studentId"
          class="student-card"
        >
          <div class="student-card__main">
            <h2 class="student-card__name">
              <NuxtLink :to="`/reports/students/${student.studentId}`">
                {{ student.displayName }}
              </NuxtLink>
            </h2>
            <p class="student-card__class">{{ student.className }}</p>
          </div>
          <div class="student-card__status">
            <span
              class="status-dot"
              :data-status="student.overallStatus"
              aria-hidden="true"
            />
            <span class="status-label">{{ student.overallStatus }}</span>
          </div>
          <NuxtLink
            class="student-card__link"
            :to="`/reports/students/${student.studentId}`"
          >
            查看报告
          </NuxtLink>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.reports {
  padding-block: clamp(3rem, 7vw, 6rem);
}
.reports__header {
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--yx-color-line);
  margin-bottom: 2rem;
}
.reports h1 {
  max-width: 15ch;
  margin: 0.8rem 0;
  font: 600 clamp(2.2rem, 6vw, 4rem) / 1 var(--yx-font-display);
}
.reports__header p {
  max-width: 46rem;
  color: var(--yx-color-ink-soft);
  line-height: 1.7;
}
.reports__notice {
  margin: 0 0 1.5rem;
  padding: 0.75rem 1rem;
  border: 1px dashed var(--yx-color-line);
  border-radius: var(--yx-radius-md);
  font-size: var(--yx-text-sm);
  color: var(--yx-color-ink-soft);
}
.student-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 1rem;
}
.student-card {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 1.5rem;
  align-items: center;
  padding: 1.25rem;
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-md);
  background: var(--yx-color-surface);
}
.student-card__name {
  margin: 0;
  font: 500 var(--yx-text-lg) / 1.3 var(--yx-font-display);
}
.student-card__name a {
  color: inherit;
  text-decoration: none;
}
.student-card__name a:hover {
  text-decoration: underline;
}
.student-card__class {
  margin: 0.25rem 0 0;
  font-size: var(--yx-text-sm);
  color: var(--yx-color-ink-soft);
}
.student-card__status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--yx-text-sm);
  text-transform: capitalize;
}
.status-dot {
  width: 0.55rem;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--yx-color-ink-soft);
}
.status-dot[data-status="available"] {
  background: var(--yx-color-sage-strong);
}
.status-dot[data-status="pending"] {
  background: var(--yx-color-gold);
}
.student-card__link {
  padding: 0.5rem 1rem;
  border-radius: var(--yx-radius-pill);
  background: var(--yx-color-wine);
  color: white;
  text-decoration: none;
  font-size: var(--yx-text-sm);
}
.reports__empty {
  padding: 2rem;
  border: 1px dashed var(--yx-color-line);
  border-radius: var(--yx-radius-md);
  color: var(--yx-color-ink-soft);
}
@media (max-width: 40rem) {
  .student-card {
    grid-template-columns: 1fr;
  }
}
@media print {
  .reports__header {
    border-bottom-color: #000;
  }
  .student-card__link {
    display: none;
  }
}
</style>
