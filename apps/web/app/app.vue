<template>
  <NuxtRouteAnnouncer />
  <a class="skip-link" href="#main">跳到主要内容</a>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<style>
.skip-link {
  position: fixed;
  inset: 0.75rem auto auto 0.75rem;
  z-index: 1000;
  transform: translateY(-200%);
  background: var(--yx-color-ink);
  color: white;
  padding: 0.75rem 1rem;
}
.skip-link:focus {
  transform: translateY(0);
}
</style>
