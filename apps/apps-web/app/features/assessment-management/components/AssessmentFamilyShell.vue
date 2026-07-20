<script setup lang="ts">
import TeacherFamilyNav from "~/features/classes/components/TeacherFamilyNav.vue";
import { describeLiveFailure } from "~/features/live-core/gateway";

defineProps<{ title?: string }>();

const gateway = useLiveCoreGateway();
const schoolName = ref("当前学校");
const roleLabel = ref("教师工作区");
const contextMessage = ref("");

try {
  const context = await gateway.context();
  schoolName.value = context.schoolName;
  roleLabel.value = context.role === "TEACHER" ? "教师" : "学校管理员";
} catch (error) {
  contextMessage.value = describeLiveFailure(error).message;
}
</script>
<template>
  <main class="assessment-family">
    <TeacherFamilyNav active="assessments" />
    <section class="assessment-family__workspace">
      <header class="assessment-family__top">
        <div>
          <strong>{{ schoolName }}</strong>
          <small v-if="contextMessage"> · {{ contextMessage }}</small>
        </div>
        <div><span>师</span>　<strong>{{ roleLabel }}</strong></div>
      </header>
      <slot />
    </section>
  </main>
</template>
<style scoped>
.assessment-family {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  min-height: 100svh;
  background: #f8f5ef;
  color: #1b2730;
  font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif;
}
.assessment-family__workspace {
  min-width: 0;
}
.assessment-family__top {
  height: 66px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 28px;
  border-bottom: 1px solid #e5dbcf;
  background: #fff;
  font-size: 12px;
}
.assessment-family__top span {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #8c2631;
  color: #fff;
}
@media (max-width: 760px) {
  .assessment-family {
    display: block;
  }
  .assessment-family__top {
    height: 52px;
    padding: 0 13px;
  }
  .assessment-family__top > div:last-child {
    display: none;
  }
}
</style>
