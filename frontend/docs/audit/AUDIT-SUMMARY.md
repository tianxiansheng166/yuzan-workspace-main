# 语赞心声 — 只读审计汇总

> 审计日期：2026-07-18
> 审计范围：frontend（前端，端口4175）+ backend/api（后端，端口4000）
> 审计模式：只读，未修改任何业务代码
> 审计员：AI Agent

---

## 数字摘要

| 维度 | 数值 |
|------|------|
| **前端HTML页面** | 66（36独立路由 + 30嵌入子页面） |
| **路由映射** | 59条（server.mjs） |
| **后端Controller** | 41个@Controller装饰器 |
| **后端模块** | 33个 |
| **有Prisma持久化** | 16个Service |
| **无Prisma(纯stub)** | 11个Service |
| **前端API封装** | 95个方法（api-client.js） |
| **交互元素审计** | 97个（14页） |
| **LIVE（真实后端）** | 13个 = **13.4%** |
| **FAKE_SUCCESS** | 22个 = **22.7%** |
| **DEMO_ONLY** | 25个 = **25.8%** |
| **LOCAL_ONLY** | 28个 = **28.9%** |
| **LOCAL_STORAGE_ONLY** | 1个 = **1.0%** |
| **ROUTE_ONLY** | 7个 = **7.2%** |
| **BROKEN** | 1个 = **1.0%** |
| **高风险整合问题** | 8个 |
| **中风险整合问题** | 6个 |
| **P0阻断问题** | 3个 |
| **P1严重问题** | 8个 |
| **P2中等问题** | 10个 |
| **P3轻微问题** | 7个 |
| **P4优化项** | 6个 |
| **问题总数** | **34个** |
| **预计修复总工期** | **15天** |

---

## 一、页面完成度

### 按端分类

| 端 | 独立页面数 | 真实API调用 | 纯Demo/本地 | 完成度评估 |
|---|-----------|------------|------------|-----------|
| 登录/选择学校 | 2 | 2 (100%) | 0 | ✅ 完成 |
| 教师端 | 12 | 3 (25%) | 9 | ⚠️ 严重不足 |
| 学生端 | 8 | 5 (62.5%) | 3 | ⚠️ 部分完成 |
| 管理端 | 11 | 4 (36%) | 7 | ⚠️ 不足 |
| 测评端 | 5 | 0 (0%) | 5 | ❌ 未完成 |
| 志愿者端 | 9 | 1 (11%) | 8 | ❌ 基本未完成 |
| 公共端 | 6 | 0 (0%) | 6 | ⚠️ 纯展示 |

### 页面状态分布

```
READY（可直接使用）        ██░░░░░░░░░░░░░░░░ 2个  (3.4%)
FUNCTION_PARTIAL（部分功能）████░░░░░░░░░░░░░░ 8个  (13.6%)
VISUAL_ONLY（仅展示）      ██░░░░░░░░░░░░░░░░ 2个  (3.4%)
LOCAL_DEMO（纯演示）       ███░░░░░░░░░░░░░░░ 4个  (6.8%)
DUPLICATE_ROUTE（重复路由）████████████░░░░░░ 15个 (25.4%)
ROUTE_ONLY（仅有路由）     █░░░░░░░░░░░░░░░░░ 1个  (1.7%)
UNKNOWN（待验证）          ███████████████░░░ 27个 (45.8%)
```

---

## 二、按钮可用度

### 交互真实性分布

```
LIVE_WRAPPED（封装后调后端）    █░░░░░░░░░  8个   8.2%
LIVE_DIRECT（直接调后端）        █░░░░░░░░░  5个   5.2%
ROUTE_ONLY（仅页面跳转）         ██░░░░░░░░  7个   7.2%
LOCAL_ONLY（仅本地DOM操作）      ████████░░ 28个  28.9%
LOCAL_STORAGE_ONLY（仅本地存储）  █░░░░░░░░░  1个   1.0%
DEMO_ONLY（演示/提示）           ███████░░░ 25个  25.8%
FAKE_SUCCESS（假成功提示）       ██████░░░░ 22个  22.7%
BROKEN（功能损坏）               █░░░░░░░░░  1个   1.0%
```

### 最严重的FAKE_SUCCESS按钮

| 按钮 | 页面 | 用户看到 | 实际行为 |
|------|------|---------|---------|
| 发布反馈 | 教师复核 | "反馈已发布" | 修改本地数组+setTimeout |
| 同步 | 学生学习 | "同步成功" | setTimeout 900ms |
| 发布测评 | 创建测评 | "已确认" | 无API调用 |
| 保存草稿 | 创建测评 | "已保存" | 无API调用 |
| 暂停/继续 | 测评详情 | 状态切换 | 仅修改DOM |
| 生成报告 | 测评详情 | toast提示 | 无报告生成 |
| 导出数据 | 测评任务 | toast提示 | 无文件导出 |
| 复制链接 | 测评任务 | clipboard写入 | 写入假URL |

---

## 三、后端接口状态

### 持久化状态

| 状态 | Service数量 | 说明 |
|------|-----------|------|
| 有Prisma真实持久化 | 16 | assignments, assessment, operations, tools, teacher-tools, learning, teacher, sync, identity, submissions, feedback, student-dashboard, speech-job, reporting, recordings, classes |
| 有Repository但无Prisma | 9 | community, cooperation, curriculum, offline, organizations, support-pairings, training, translations, volunteers |
| 纯接口文件无持久化 | 2 | identity/adapters, identity/ports |
| 返回空数组[] | 2 | feedback.service.ts:102, learning.service.ts:149/173 |
| PROVIDER_NOT_CONFIGURED | 1 | teacher-tools.service.ts (mindgraph, translation, generatePlan) |
| PERSISTENCE_PENDING | 1 | research-stub.controller.ts (4个端点) |

### 重复路由

| 路由 | Controller 1 | Controller 2 | 状态 |
|------|-------------|-------------|------|
| `schools/:schoolId/teacher-tools` | tools/teacher-tools.controller.ts | teacher-tools/teacher-tools.controller.ts | ⚠️ 冲突 |

---

## 四、整合风险

| 等级 | 数量 | 关键风险 |
|------|------|---------|
| 🔴 高 | 8 | teacher-shell DOM移动、iframe鉴权断裂、localStorage跨角色共享、固定演示ID、CSS !important污染 |
| 🟡 中 | 6 | global-nav双导航、401全局登出、缩放冲突、路由回退、路由匹配不精确、移动端横向滚动 |

### 最危险的整合风险

1. **teacher-shell移动DOM** — 将页面内容根节点移入#ts-page-root并删除旧导航，破坏页面脚本对DOM的依赖
2. **iframe鉴权断裂** — 子页面无法访问父页面YuzanApi，6个学生+10个管理子页面受影响
3. **localStorage key冲突** — iframe与父页面共享同一域，单角色登出清除全部凭证
4. **CSS !important污染** — iframe注入大面积!important覆盖通用类名

---

## 五、视觉审计关键发现

| 问题 | 严重度 | 影响范围 |
|------|--------|---------|
| 首页iframe嵌套滚动 | 🔴 高 | 所有用户首次访问 |
| 导航栏设计不统一 | 🟡 中 | 4个端 |
| teacher-shell min-width:900px | 🟡 中 | 移动端教师 |
| student-nav与fit.js缩放冲突 | 🟡 中 | 学生端页面 |
| global-nav与学生导航重叠 | 🟡 中 | 学生端页面 |

---

## 六、关键数据流真实度

### 核心闭环审计

| 闭环 | 步骤1 | 步骤2 | 步骤3 | 步骤4 | 整体评估 |
|------|-------|-------|-------|-------|---------|
| 教师发布→学生完成 | ✅ LIVE | ⚠️ LIVE | ✅ LIVE | ❌ FAKE | **75%** |
| 学生录音→同步 | ✅ LIVE | ✅ LIVE | ❌ FAKE | — | **67%** |
| 测评创建→报告 | ❌ FAKE | ❌ FAKE | ❌ FAKE | ❌ FAKE | **0%** |
| 班级管理 | ❌ FAKE | ❌ FAKE | — | — | **0%** |

---

## 七、已生成审计报告清单

| # | 文件名 | 内容 | 状态 |
|---|--------|------|------|
| 1 | CURRENT-PAGE-INVENTORY.md | 59条路由完整页面清单 | ✅ 已完成 |
| 2 | API-CLIENT-AUDIT.md | 95个API方法+缺失接口+风险 | ✅ 已完成 |
| 3 | INTERACTION-AUDIT.md | 14页97个交互逐按钮审计 | ✅ 已完成 |
| 4 | INTEGRATION-RISK-AUDIT.md | 8高+6中整合风险 | ✅ 已完成 |
| 5 | BACKEND-ENDPOINT-INVENTORY.md | 后端Controller全量对表（41个Controller, 180+端点） | ✅ 已完成 |
| 6 | FRONTEND-BACKEND-MAP.md | 前端按钮→后端路由映射（24/95实际调用） | ✅ 已完成 |
| 7 | VISUAL-AUDIT.md | 视觉审计（29个问题：9严重+12中等+8轻微） | ✅ 已完成 |
| 8 | TEST-VALIDITY-AUDIT.md | 测试真实性审计（25处setTimeout, 22处FAKE_SUCCESS） | ✅ 已完成 |
| 9 | P0-P4-ISSUE-LIST.md | 问题优先级清单 | ✅ 已完成 |
| 10 | RECOMMENDED-FIX-ORDER.md | 推荐修复顺序 | ✅ 已完成 |
| 11 | AUDIT-SUMMARY.md | 本文件 | ✅ 已完成 |

---

## 八、一句话结论

> **语赞心声项目前端页面"看起来完成"但"实际不可用"：13.4%的按钮真正连接后端，48.5%的按钮是假成功或纯演示，核心闭环（教师复核发布反馈、学生录音同步、测评全流程）均有致命的FAKE_SUCCESS问题。建议按6阶段15天计划修复，优先解决P0的3个阻断问题。**
