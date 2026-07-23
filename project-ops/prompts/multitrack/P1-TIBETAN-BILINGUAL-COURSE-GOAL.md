# Goal：课程网页消费已批准藏汉译文

```text
你负责 P1-TIBETAN-BILINGUAL-COURSE-001。

前置条件：
- P0-TIBETAN-TRANSLATION-TOOL-001 已真实完成并被接受；
- P0-STUDENT-COURSE-VIDEO-NOTE-001 已被接受；
- 当前课程核心文件没有其他 writer。

运行：
& D:/program/test_program/yuzanxinsheng/three/worktrees/p0-multitrack-integration-001/project-ops/scripts/resolve-multitrack-task.ps1 `
  -TaskId P1-TIBETAN-BILINGUAL-COURSE-001 -CreateWorktree
脚本只接受同时包含 Translation Tool 与 Video Note accepted commits 的 registry
checkpoint；不得任选一个父分支。创建或恢复：
branch: task/p1-tibetan-bilingual-course-001
worktree: D:/program/test_program/yuzanxinsheng/three/worktrees/p1-tibetan-bilingual-course-001

先提交 task JSON；若课程契约需变更，先 CCR/共享 owner，再运行 task-context。

唯一结果：
一名真实学生打开一门真实课程的一种内容类型，服务端返回原文和已经人工批准的译文；
页面支持“原文/双语”切换并在刷新后保留偏好。没有批准译文时只显示原文和“译文待
复核”；翻译 provider 不可用不影响原文学习。

只做一种内容类型，不做全站自动替换、浏览器现场调用模型或批量翻译所有课程。译文
必须带 translationJobId/revision/reviewStatus=APPROVED 和审核来源；机器草稿、
REJECTED、跨学校译文均不可见。

本任务的共享写入范围已经冻结为课程详情 consumer、student-courses、translations
读取接口和 OpenAPI；task JSON 必须把这些范围细化为实际文件，不能扩到全站或根
依赖。必须有：
- 动态 course/activity/translation ID；
- APPROVED 与未批准负向用例；
- provider offline 时原文正常；
- 刷新和新上下文；
- 1440/1024/390；
- API/DB 交叉证据和 console/page/request/HTTP 审计；
- focused tests、contract validate、typecheck/build、task-gate。

完成后提交、推送、remote HEAD/Git clean，不合并。
```
