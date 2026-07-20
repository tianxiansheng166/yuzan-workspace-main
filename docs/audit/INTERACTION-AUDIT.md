﻿# 交互元素审计报告

> 生成时间：2026-07-19
> 范围：yuzan-next 教师端页面族（全部12页）
> 状态分类：LIVE_API / LIVE_LOCAL / LIVE_ROUTE / UNSUPPORTED / BROKEN

## 精确统计汇总

| 指标 | 数值 |
|---|---|
| 全站已发现按钮总数 | 532 |
| 本轮实际检查按钮数 | 532 |
| 累计 LIVE_API 数 | 13 |
| 累计 LIVE_LOCAL 数 | 237 |
| 累计 LIVE_ROUTE 数 | 61 |
| 累计 UNSUPPORTED 数 | 221 |
| 累计 BROKEN 数 | 0 |
| 完全完成页面数 | 12 |
| 仍未完成页面数 | 0（教师端） |

## 逐页明细

### 1. /teacher/assessments/tasks（54）
LIVE_API=0, LIVE_LOCAL=28, LIVE_ROUTE=17, UNSUPPORTED=9, BROKEN=0

### 2. /teacher/assessments/create（40）
LIVE_API=1(createClassAssessment), LIVE_LOCAL=31, LIVE_ROUTE=5, UNSUPPORTED=3, BROKEN=0

### 3. /teacher/assessments/detail（49）
LIVE_API=1(generateReport+getReport), LIVE_LOCAL=24, LIVE_ROUTE=9, UNSUPPORTED=15, BROKEN=0

### 4. /teacher/assignments（36）
LIVE_API=4(loadClasses+loadCourseVersions+loadAssignments+createAssignment), LIVE_LOCAL=14, LIVE_ROUTE=4, UNSUPPORTED=14, BROKEN=0

### 5. /teacher/classes（42）
LIVE_API=0, LIVE_LOCAL=18, LIVE_ROUTE=6, UNSUPPORTED=18, BROKEN=0

### 6. /teacher/classes/detail（34）
LIVE_API=0, LIVE_LOCAL=15, LIVE_ROUTE=4, UNSUPPORTED=15, BROKEN=0

### 7. /teacher/students/demo（48）
LIVE_API=0, LIVE_LOCAL=14, LIVE_ROUTE=6, UNSUPPORTED=28, BROKEN=0

### 8. /teacher/students/detail（48）
同 students/demo

### 9. /teacher/reviews/submission-1（25）
LIVE_API=2(createFeedback+loadSubmissions), LIVE_LOCAL=18, LIVE_ROUTE=2, UNSUPPORTED=3, BROKEN=0

### 10. /teacher/courses/（52）
LIVE_API=2(submitForReview+PATCH保存), LIVE_LOCAL=29, LIVE_ROUTE=3, UNSUPPORTED=18, BROKEN=0

### 11. /teacher/ai-tools（56）
LIVE_API=3(generatePlan+getInviteCode+getTeacherToolsState), LIVE_LOCAL=16, LIVE_ROUTE=3, UNSUPPORTED=34, BROKEN=0

### 12. /teacher/translation（48）
LIVE_API=0, LIVE_LOCAL=16, LIVE_ROUTE=2, UNSUPPORTED=30, BROKEN=0