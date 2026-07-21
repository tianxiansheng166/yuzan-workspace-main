# 学生课程学习闭环实施计划

## 当前结论

- 页面 ID：student-course-learning
- 当前状态：`MAIN_DEMO` + `PLACEHOLDER`
- 目标状态：`MAIN_LIVE`
- 复用决策：保留顶部导航；迁移历史课程中心构图；复用 Submission、Recording、SpeechJob 和 Practice 引擎；删除固定内容依赖。
- 是否需要新资产：否。
- 是否存在后端阻塞：需要按已提交 CCR 扩展共享契约与 Prisma。

## 修改范围

允许路径以 `docs/09-operations/p0-course-learning-closure-001/task.json` 为准。禁止修改原 `yuzan-next`、`source-materials`、全局 UI tokens、根配置和 CI。

## 实施步骤

1. 建立聚合服务、租户范围校验、published-only 查询和幂等 bootstrap。
2. 完成课程中心和正式 URL 详情覆盖层。
3. 完成六类活动执行器、ActivityAttempt、进度、私人笔记和录音链路。
4. 将课程 Practice 上下文传入现有通用执行器，完成后回写 ActivityProgress。
5. 验证登录、4 课程、筛选、提交、PENDING 达标、跨学生/跨学校拒绝及响应式截图。

## 验证命令

```text
pnpm --filter @yuzan/database validate
pnpm --filter @yuzan/api typecheck
pnpm --filter @yuzan/api test -- student-courses
node --test tests/e2e/course-learning/*.test.mjs
python <webapp-testing helper> -- 课程浏览器脚本
```

## 完成条件

- [ ] 真实聚合与 published-only
- [ ] 六类动态活动
- [ ] Submission/ActivityAttempt/Recording/SpeechJob 正确关联
- [ ] 私人笔记 revision 冲突
- [ ] Practice 复用与回写
- [ ] 完成度和达标度分离
- [ ] 1440/1024/390 截图与控制台证据
- [ ] 五个指定提交且工作区干净
