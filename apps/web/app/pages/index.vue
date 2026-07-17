<script setup lang="ts">
definePageMeta({ layout: "landing" });

useSeoMeta({
  title: "语赞心声｜沿着高原的学习路径被听见",
  description: "从能力诊断出发，连接课程、教师支持、练习反馈与持续复测。",
});

const learningSteps = [
  ["01", "能力诊断", "找到清楚的学习起点"],
  ["02", "课程学习", "沿着课程持续练习"],
  ["03", "练习反馈", "把下一步说清楚"],
  ["04", "教师支持", "让教学支持回到现场"],
  ["05", "复测对比", "等待真实结果，再看成长"],
];
</script>

<template>
  <div class="pixel-home">
    <header class="site-header" aria-label="网站主导航">
      <div class="header-shell">
        <NuxtLink class="brand" to="/" aria-label="语赞心声首页">
          <img src="/art/pixel-v3/brand-logo.png" alt="语赞心声" />
        </NuxtLink>
        <nav class="main-nav" aria-label="公共入口">
          <NuxtLink to="/student/today">学习课程</NuxtLink>
          <NuxtLink to="/assessment">智能测评</NuxtLink>
          <NuxtLink to="/teacher">教师资源</NuxtLink>
          <NuxtLink to="/volunteer">公益与志愿</NuxtLink>
        </nav>
        <div class="header-actions">
          <NuxtLink class="btn btn-teacher" to="/teacher">教师工作台</NuxtLink>
          <NuxtLink class="btn btn-start" to="/login">开始学习</NuxtLink>
        </div>
      </div>
    </header>

    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-scene" aria-hidden="true" />
      <div class="hero-shade" aria-hidden="true" />
      <div class="hero-content">
        <p class="eyebrow">语赞心声 · 学习支持平台</p>
        <h1 id="hero-title">
          <span>让每一次发声，</span>
          <strong>沿着高原的学习路径被听见</strong>
        </h1>
        <p>从能力诊断出发，连接课程、教师支持、练习反馈与持续复测。</p>
        <div class="hero-actions">
          <NuxtLink class="btn btn-start hero-start" to="/login">开始学习 <span aria-hidden="true">→</span></NuxtLink>
          <a class="btn btn-path" href="#learning-path">查看学习路径 <span aria-hidden="true">↓</span></a>
        </div>
      </div>
    </section>

    <section id="learning-path" class="roadmap" aria-labelledby="roadmap-title">
      <div class="roadmap-inner">
        <div class="roadmap-heading">
          <p class="eyebrow">从第一步开始，持续成长</p>
          <h2 id="roadmap-title">学习路径</h2>
          <p>每一个入口都进入真实身份、学校和学习上下文；尚未接通的能力会如实说明状态。</p>
        </div>
        <ol class="steps">
          <li v-for="([index, title, description], position) in learningSteps" :key="title" :class="{ active: position === 0 }">
            <span>{{ index }}</span>
            <h3>{{ title }}</h3>
            <p>{{ description }}</p>
          </li>
        </ol>
      </div>
    </section>

    <section class="entry-band" aria-labelledby="entry-title">
      <div>
        <p class="eyebrow">开始你的路径</p>
        <h2 id="entry-title">用真实登录进入对应的学习、教学或支持端。</h2>
      </div>
      <div class="entry-actions">
        <NuxtLink to="/login">登录并选择学校</NuxtLink>
        <NuxtLink to="/plans">查看产品方案</NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.pixel-home { min-height: 100svh; color: #1d292c; background: #faf7f0; font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif; }
.site-header { position: relative; z-index: 10; background: rgba(255,255,255,.98); border-bottom: 1px solid #e7e5e1; }
.header-shell { min-height: 6.2rem; max-width: 88rem; margin: auto; padding: 0 3rem; display: grid; grid-template-columns: 12rem 1fr auto; align-items: center; gap: 2rem; }
.brand img { width: 9.8rem; display: block; }
.main-nav { display: flex; justify-content: center; gap: clamp(1rem, 2.5vw, 2.8rem); }
.main-nav a { color: #39413c; text-decoration: none; font-weight: 650; font-size: .98rem; }
.main-nav a:hover { color: #b90003; }
.header-actions,.hero-actions,.entry-actions { display:flex; align-items:center; gap: .85rem; }
.btn { display: inline-flex; justify-content: center; align-items:center; gap:.55rem; border-radius: .28rem; text-decoration: none; font-weight: 750; transition: transform 160ms ease, box-shadow 160ms ease; }
.btn:hover { transform: translateY(-2px); }
.btn:focus-visible,.main-nav a:focus-visible,.entry-actions a:focus-visible { outline: 3px solid #d99b2f; outline-offset: 4px; }
.btn-teacher { min-height: 3rem; padding: 0 1.1rem; color:#286640; border: 1px solid #286640; background: white; }
.btn-start { min-height: 3rem; padding: 0 1.25rem; color:white; background: linear-gradient(180deg,#cc1013,#b90003); box-shadow: 0 7px 18px rgba(159,0,0,.14); }
.hero { position:relative; min-height: 39rem; overflow:hidden; isolation:isolate; }
.hero-scene { position:absolute; inset:0; z-index:-2; background: url('/art/pixel-v3/hero-scene-clean.jpg') center top/cover no-repeat; }
.hero-shade { position:absolute; inset:0; z-index:-1; background: linear-gradient(90deg, rgba(250,247,240,.97) 0%, rgba(250,247,240,.81) 38%, rgba(250,247,240,.15) 72%); }
.hero-content { max-width: 88rem; margin: auto; padding: clamp(6rem,12vw,10rem) 3rem 5rem; }
.eyebrow { margin:0; color:#a56c17; font-size:.75rem; font-weight:800; letter-spacing:.16em; }
h1 { max-width: 44rem; margin:1rem 0 1.5rem; font-family: "Noto Serif SC", "Songti SC", serif; font-size: clamp(3.1rem,6vw,6rem); line-height:1.06; letter-spacing:-.055em; }
h1 span { display:block; color:#1d292c; } h1 strong { display:block; color:#b90003; font-weight:700; }
.hero-content > p:not(.eyebrow) { max-width: 38rem; color:#4f564f; font-size: clamp(1.02rem,1.4vw,1.28rem); line-height:1.85; }
.hero-actions { margin-top:2.2rem; }.hero-start,.btn-path { min-height:3.6rem; padding:0 1.55rem; }.btn-path { color:#286640; background:rgba(255,255,255,.74); border:1px solid #4a7660; }
.roadmap { background:#fff; border-top:1px solid #e7e5e1; }.roadmap-inner { max-width:88rem; margin:auto; padding:clamp(4rem,8vw,7rem) 3rem; display:grid; grid-template-columns:minmax(14rem,.7fr) minmax(0,1.3fr); gap:clamp(3rem,8vw,9rem); }
.roadmap-heading h2,.entry-band h2 { font-family:"Noto Serif SC", "Songti SC", serif; margin:.6rem 0 1rem; font-size:clamp(2.1rem,3.6vw,3.7rem); line-height:1.18; letter-spacing:-.04em; }.roadmap-heading > p:last-child { color:#626960; line-height:1.8; }
.steps { list-style:none; margin:0; padding:0; position:relative; }.steps:before { content:""; position:absolute; top:1.25rem; left:1.25rem; right:1.25rem; height:1px; background:#d5d9d2; }.steps li { position:relative; display:grid; grid-template-columns:3rem 1fr; column-gap:1rem; padding:0 0 2.25rem; }.steps li span { grid-row:span 2; z-index:1; width:2.5rem; height:2.5rem; display:grid; place-items:center; border-radius:50%; color:#fff; background:#56755d; border:5px solid #fff; font-size:.72rem; font-weight:800; }.steps li.active span { background:#b90003; }.steps h3 { margin:.18rem 0 .25rem; font-family:"Noto Serif SC", "Songti SC", serif; font-size:1.35rem; }.steps p { margin:0; color:#6a706b; line-height:1.6; }
.entry-band { max-width:88rem; margin:auto; padding:clamp(3rem,7vw,6rem) 3rem; display:flex; justify-content:space-between; gap:2rem; align-items:end; }.entry-band h2 { max-width:40rem; }.entry-actions { flex-wrap:wrap; }.entry-actions a { border-bottom:2px solid #b90003; padding:.7rem .1rem; color:#1d292c; text-decoration:none; font-weight:750; }
@media (max-width: 52rem) { .header-shell { min-height:5.1rem; padding:0 1.25rem; grid-template-columns:1fr auto; }.main-nav,.btn-teacher { display:none; }.brand img{width:8.6rem;}.hero { min-height:42rem; }.hero-scene { background-position:63% center; }.hero-shade { background:linear-gradient(180deg,rgba(250,247,240,.98) 0%,rgba(250,247,240,.84) 55%,rgba(250,247,240,.12) 100%); }.hero-content { padding:4.8rem 1.25rem 3rem; }.roadmap-inner { padding:3.8rem 1.25rem; grid-template-columns:1fr; gap:2.8rem; }.entry-band { padding:3.5rem 1.25rem; display:grid; align-items:start; }.header-actions { gap:.4rem; }.btn-start { padding:0 .9rem; }.hero-actions { align-items:stretch; }.hero-actions .btn { flex:1; text-align:center; padding:0 .7rem; } }
@media (prefers-reduced-motion: reduce) { .btn { transition:none; } }
</style>
