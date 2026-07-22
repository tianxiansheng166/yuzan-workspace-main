# 迁入现有 Nuxt 前端

本交付包保持零依赖静态运行，便于视觉与交互验收。迁入现有项目时建议保留视觉基准，逐步替换运行层。

## 页面映射

```text
/                                      -> app/pages/index.vue
/login                                 -> app/pages/login.vue
/select-school                         -> app/pages/select-school.vue
/teacher/courses/spring/studio         -> app/pages/teacher/courses/[course]/studio.vue
/teacher/assignments                   -> app/pages/teacher/assignments.vue
/teacher/reviews/submission-1          -> app/pages/teacher/reviews/[submission].vue
/student/today                         -> app/pages/student/today.vue
/student/learn/spring-2                -> app/pages/student/learn/[lesson].vue
/student/growth                        -> app/pages/student/growth.vue
/assessment                            -> app/pages/assessment/index.vue
/assessment/reading/2                  -> app/pages/assessment/reading/[step].vue
/assessment/written                    -> app/pages/assessment/written.vue
/assessment/report/demo                -> app/pages/assessment/report/[id].vue
/assessment/history                    -> app/pages/assessment/history.vue
```

## 推荐组件与 composable

```text
app/features/yuzan-ui/
  components/
    BrandLogo.vue
    VoiceRecorder.vue
    AudioEvidencePlayer.vue
    SyncStatus.vue
    AssessmentProgress.vue
    TeacherSidebar.vue
  composables/
    useMicrophoneRecorder.ts
    useRecordingCache.ts
    useRecordingUpload.ts
    useAssessmentDraft.ts
    useUiState.ts
  types/
    recording.ts
    assessment.ts
    report.ts
```

## 迁移顺序

1. 将艺术素材放入 `public/art/yuzan/`，样式变量迁入应用 CSS。
2. 用 `NuxtLink` / `navigateTo` 替换 `data-nav`。
3. 将 `VoiceRecorder` 改造成 Vue 组件，保持状态机和 Canvas 绘制逻辑。
4. 将 IndexedDB 封装为客户端 composable，并处理 SSR 边界。
5. 登录和学校选择接入 session gateway 与 RBAC。
6. 教学任务、提交复核、课程工作台接入后端 DTO。
7. 录音接入上传初始化、分片、完成和处理状态轮询。
8. 报告页直接消费服务端返回的 report contract。
9. 用 Playwright 保留参考视口的视觉回归和交互回归。

## 生产调整

- `fit.js` 适合验收固定画布；生产版应逐步转换为真正的响应式 Grid/Flex。
- 不要在 SSR 阶段访问 `navigator`、`MediaRecorder`、`AudioContext` 或 IndexedDB。
- 录音组件应使用 `<ClientOnly>` 或 `onMounted` 初始化。
- 录音上传必须提供幂等、断点续传、失败重试和本地清理策略。
