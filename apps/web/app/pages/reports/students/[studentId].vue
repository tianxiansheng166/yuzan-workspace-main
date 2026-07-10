<script setup lang="ts">
import { onMounted } from "vue";
import { useRoute } from "vue-router";
import { useStudentReport } from "~/features/reports/composables/useStudentReport";
import ReportStateMessage from "~/features/reports/components/ReportStateMessage.vue";
import ReportPrintHeader from "~/features/reports/components/ReportPrintHeader.vue";
import DemoNotice from "~/features/reports/components/DemoNotice.vue";
import StudentGrowthTimeline from "~/features/reports/components/StudentGrowthTimeline.vue";
import TestComparisonSection from "~/features/reports/components/TestComparisonSection.vue";
import EvidenceSection from "~/features/reports/components/EvidenceSection.vue";
import InterventionPanel from "~/features/reports/components/InterventionPanel.vue";

const route = useRoute();
const studentId = route.params.studentId as string;
const { state, load } = useStudentReport();

useSeoMeta({
  title: "学生成长报告｜语赞心声",
});

onMounted(() => {
  load(studentId, "demo-school-001");
});

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("zh-CN") : "—";
}
</script>

<template>
  <article class="report yx-shell">
    <ReportStateMessage
      v-if="state.status !== 'ready'"
      :status="state.status"
      :message="state.message"
    />

    <template v-else-if="state.report">
      <ReportPrintHeader
        title="学生成长报告"
        :student-name="state.report.summary.displayName"
        :generated-at="new Date().toLocaleDateString('zh-CN')"
      />

      <header class="report__header">
        <div>
          <p class="yx-kicker">学生成长档案</p>
          <h1>{{ state.report.summary.displayName }}</h1>
          <p class="report__meta">
            {{ state.report.summary.className }} · 最近评估：{{
              formatDate(state.report.summary.lastAssessedAt)
            }}
          </p>
        </div>
        <NuxtLink class="report__back" to="/reports">返回列表</NuxtLink>
      </header>

      <DemoNotice
        v-if="state.report.demoNotice"
        :notice="state.report.demoNotice"
      />

      <div class="report__grid">
        <div class="report__main">
          <StudentGrowthTimeline :events="state.report.timeline" />
          <TestComparisonSection :comparisons="state.report.comparisons" />
          <EvidenceSection
            v-for="section in state.report.evidenceSections"
            :key="section.kind"
            :section="section"
          />
        </div>
        <div class="report__aside">
          <InterventionPanel :suggestion="state.report.intervention" />
        </div>
      </div>
    </template>
  </article>
</template>

<style scoped>
.report {
  padding-block: clamp(3rem, 7vw, 6rem);
}
.report__header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--yx-color-line);
  margin-bottom: 1.5rem;
}
.report h1 {
  max-width: 20ch;
  margin: 0.8rem 0;
  font: 600 clamp(2rem, 5vw, 3.5rem) / 1 var(--yx-font-display);
}
.report__meta {
  margin: 0;
  color: var(--yx-color-ink-soft);
}
.report__back {
  padding: 0.5rem 1rem;
  border-radius: var(--yx-radius-pill);
  border: 1px solid var(--yx-color-line);
  color: var(--yx-color-ink);
  text-decoration: none;
  font-size: var(--yx-text-sm);
}
.report__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(18rem, 0.6fr);
  gap: clamp(2rem, 6vw, 5rem);
  align-items: start;
}
.report__main {
  display: grid;
  gap: 2rem;
}
.report__aside {
  position: sticky;
  top: 5rem;
}
@media (max-width: 64rem) {
  .report__grid {
    grid-template-columns: 1fr;
  }
  .report__aside {
    position: static;
  }
}
@media print {
  .report__header {
    border-bottom-color: #000;
  }
  .report__back {
    display: none;
  }
  .report__aside {
    position: static;
  }
}
</style>
