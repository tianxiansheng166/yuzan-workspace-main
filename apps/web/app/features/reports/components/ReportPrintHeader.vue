<script setup lang="ts">
defineProps<{
  title: string;
  studentName: string;
  generatedAt: string;
}>();
</script>

<template>
  <header class="print-header">
    <h1>{{ title }}</h1>
    <p>学生：{{ studentName }}</p>
    <p>生成时间：{{ generatedAt }}</p>
  </header>
</template>

<style scoped>
.print-header {
  display: none;
}
@media print {
  .print-header {
    display: block;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #000;
  }
  .print-header h1 {
    margin: 0 0 0.5rem;
    font-size: 1.5rem;
  }
  .print-header p {
    margin: 0.25rem 0 0;
    font-size: 0.9rem;
  }
}
</style>
