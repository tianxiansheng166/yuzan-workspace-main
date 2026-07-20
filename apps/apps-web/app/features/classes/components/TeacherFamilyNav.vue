<script setup lang="ts">
defineProps<{ active: "classes" | "students" | "assessments" }>();

const links = [
  {
    label: "首页",
    to: "/teacher",
    key: "home",
    icon: "M3 11 12 3l9 8v10h-6v-6H9v6H3z",
  },
  {
    label: "课程",
    to: "/studio",
    key: "courses",
    icon: "M5 4h14v16H5zM9 4v16",
  },
  {
    label: "任务",
    to: "/teacher/assignments",
    key: "tasks",
    icon: "M6 3h12v18H6zM9 8h6M9 12h6",
  },
  {
    label: "测评",
    to: "/teacher/assessments",
    key: "assessments",
    icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm-4-10 3 3 5-6",
  },
  {
    label: "班级",
    to: "/teacher/classes",
    key: "classes",
    icon: "M4 5h16v14H4zM8 9h8M8 13h5",
  },
  {
    label: "学生",
    to: "/reports",
    key: "students",
    icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
  },
  {
    label: "教学资源",
    to: "/resources",
    key: "resources",
    icon: "M4 6h6l2 2h8v11H4z",
  },
  {
    label: "学情分析",
    to: "/teacher/review",
    key: "analysis",
    icon: "M4 20V10h4v10m4 0V4h4v16m4 0v-7h4v7",
  },
  {
    label: "公益活动",
    to: "/volunteer",
    key: "public",
    icon: "M12 21s-8-4.8-8-11a4 4 0 0 1 7-2.6A4 4 0 0 1 20 10c0 6.2-8 11-8 11Z",
  },
];
</script>

<template>
  <aside class="teacher-family-nav" aria-label="教师端页面族导航">
    <NuxtLink class="teacher-family-nav__brand" to="/teacher">
      <span aria-hidden="true">语</span
      ><strong>语赞心声<small>智教融合公益平台</small></strong>
    </NuxtLink>
    <nav>
      <NuxtLink
        v-for="link in links"
        :key="link.key"
        :to="link.to"
        :class="{ active: active === link.key }"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="link.icon" /></svg
        >{{ link.label }}
      </NuxtLink>
    </nav>
    <div class="teacher-family-nav__landscape" aria-hidden="true" />
  </aside>
</template>

<style scoped>
.teacher-family-nav {
  position: relative;
  min-height: 100svh;
  padding: 19px 17px 170px;
  border-right: 1px solid #e7ded3;
  background: #fbf7ef;
  overflow: hidden;
}
.teacher-family-nav__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 9px 20px;
  border-bottom: 1px solid #eadfd2;
  color: #c9141d;
  text-decoration: none;
}
.teacher-family-nav__brand > span {
  display: grid;
  place-items: center;
  width: 43px;
  height: 43px;
  border: 3px solid currentColor;
  border-radius: 50%;
  font: 700 19px serif;
}
.teacher-family-nav__brand strong {
  font: 700 20px serif;
  letter-spacing: 0.1em;
}
.teacher-family-nav__brand small {
  display: block;
  font: 10px sans-serif;
  letter-spacing: 0;
  margin-top: 3px;
}
.teacher-family-nav nav {
  display: grid;
  gap: 2px;
  margin-top: 12px;
}
.teacher-family-nav nav a {
  display: flex;
  align-items: center;
  gap: 13px;
  min-height: 42px;
  padding: 0 12px;
  border-radius: 7px;
  color: #202b33;
  text-decoration: none;
  font-size: 14px;
}
.teacher-family-nav nav a.active {
  background: #c9141d;
  color: #fff;
  font-weight: 700;
}
.teacher-family-nav svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.teacher-family-nav__landscape {
  position: absolute;
  inset: auto 0 0;
  height: 180px;
  background: url("/restoration-assets/teacher/shared/teacher-sidebar-landscape-v01.png")
    bottom center/cover no-repeat;
}
@media (max-width: 760px) {
  .teacher-family-nav {
    min-height: auto;
    padding: 9px 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: auto;
  }
  .teacher-family-nav__brand {
    padding: 0;
    border: 0;
    min-width: max-content;
  }
  .teacher-family-nav__brand small,
  .teacher-family-nav__landscape {
    display: none;
  }
  .teacher-family-nav nav {
    display: flex;
    margin: 0;
  }
  .teacher-family-nav nav a {
    display: none;
    min-width: max-content;
  }
  .teacher-family-nav nav a.active {
    display: flex;
  }
}
</style>
