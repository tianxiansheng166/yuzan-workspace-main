# 推荐修复顺序

> 审计日期：2026-07-18
> 基于：P0-P4-ISSUE-LIST.md, INTERACTION-AUDIT.md, INTEGRATION-RISK-AUDIT.md

## 修复原则

1. **先通核心闭环，再补功能**：确保"教师发布→学生完成→教师复核→发布反馈"核心链路可用
2. **先修阻断，再修体验**：P0优先于P1，假操作优先于UI问题
3. **先统一基础设施，再逐页对接**：api-client补齐、鉴权修复在前，页面改造在后
4. **先高频页面，后低频页面**：教师端/学生端核心页面优先，管理员端/志愿者端靠后

---

## 第一阶段：基础设施修复（预计2天）

> 目标：消除鉴权断裂、补齐API封装、修复后端重复路由

### 步骤 1.1: 修复后端重复路由 P1-08
- **问题**: teacher-tools被两个Controller注册
- **操作**: 合并 `tools/teacher-tools.controller.ts` 和 `teacher-tools/teacher-tools.controller.ts`，保留一个，删除另一个
- **验证**: `npm run build` + 手动调用 `GET /schools/:id/teacher-tools` 确认路由正确
- **风险**: 低

### 步骤 1.2: 补齐api-client.js缺失封装 P2-09
- **问题**: 缺少 classes/assignments/submissions/learning/feedback/assessment-sessions 封装
- **操作**: 在api-client.js中添加以下方法：
  ```
  getClasses(schoolId)           → GET /schools/:schoolId/classes
  getClassDetail(schoolId, id)   → GET /schools/:schoolId/classes/:id
  createAssignment(...)          → POST /schools/:schoolId/assignments
  getSubmissions(...)            → GET /schools/:schoolId/submissions
  createFeedback(...)            → POST /schools/:schoolId/submissions/:id/feedback
  createAssessmentSession(...)   → POST /schools/:schoolId/assessments/sessions
  getAssessmentSession(...)      → GET /schools/:schoolId/assessments/sessions/:id
  ```
- **验证**: 在浏览器console中调用每个新方法确认返回值
- **风险**: 低

### 步骤 1.3: 修复iframe鉴权断裂 P1-01
- **问题**: iframe内子页面无法访问YuzanApi
- **操作**: 在所有admin-pages和student-pages的index.html中添加 `<script src="/assets/api-client.js">` 引入
- **验证**: 在iframe子页面console中确认 `window.YuzanApi` 可用且token有效
- **风险**: 低

### 步骤 1.4: 修复localStorage跨角色共享 P1-07
- **问题**: clearSession()清除所有角色凭证
- **操作**: 按角色添加key前缀：`yuzan-student-access-token`, `yuzan-teacher-access-token`，clearSession只清当前角色
- **验证**: 多角色登录后，单角色登出不影响其他角色
- **风险**: 中（需确保所有页面读取token的代码同步修改）

### 步骤 1.5: 修复api-client.js Content-Type问题 P3-04
- **操作**: 允许request()方法的options.headers覆盖默认Content-Type
- **验证**: 录音上传可正常使用multipart/form-data
- **风险**: 低

---

## 第二阶段：核心闭环修复（预计3天）

> 目标：教师复核→发布反馈、学生录音→同步、测评创建→发布 三个核心闭环可用

### 步骤 2.1: 教师复核"发布反馈"接入后端 P0-01
- **操作**: 在teacher/reviews/submission-1/app.js中：
  1. "发布反馈"按钮点击时调用 `YuzanApi.createFeedback(schoolId, submissionId, { score, text })`
  2. 成功后更新UI状态
  3. 失败显示错误toast
- **验证**: 创建真实反馈→学生端可查看
- **风险**: 中（需确认后端feedback API参数格式）

### 步骤 2.2: 学生录音"同步"接入后端 P0-02
- **操作**: 在student/learn/spring-2/player.js中：
  1. 移除setTimeout 900ms伪造
  2. 调用 `YuzanApi.completeRecording()` 
  3. 添加进度同步API调用
- **验证**: 录音→同步→刷新后进度保持
- **风险**: 中

### 步骤 2.3: 创建测评"发布测评""保存草稿"接入后端 P1-02, P1-03
- **操作**: 在teacher/assessments/create/的JS中：
  1. "保存草稿"调用 `YuzanApi.createDraft(...)`
  2. "发布测评"调用 `YuzanApi.createAssessmentSession(...)`
- **验证**: 创建的测评在任务列表中可见
- **风险**: 中

### 步骤 2.4: 测评详情"暂停/继续/生成报告"接入后端 P1-04
- **操作**: 在teacher/assessments/detail/的JS中：
  1. "暂停/继续"调用 `PATCH /schools/:id/assessments/sessions/:id`
  2. "生成报告"调用 `GET /schools/:id/assessments/sessions/:id/report`
  3. "延长时间"调用对应PATCH接口
- **验证**: 操作后状态持久化
- **风险**: 中

---

## 第三阶段：教师端功能完善（预计3天）

> 目标：教师工作台、班级管理、测评任务可正常使用

### 步骤 3.1: 教师工作台首页接入Dashboard API P1-05
- **操作**: 在teacher.js中：
  1. 用 `YuzanApi.getDashboard()` 数据渲染待办、课程、任务
  2. 用 `YuzanApi.getNotifications()` 渲染通知
  3. 移除FAKE_SUCCESS按钮，替换为真实API调用或跳转
- **验证**: 首页显示真实数据，按钮操作有效
- **风险**: 高（页面JS较复杂，需仔细改写）

### 步骤 3.2: 我的班级/班级详情接入后端 P1-06
- **操作**: 在teacher/classes/和teacher/classes/detail/的JS中：
  1. 用 `YuzanApi.getClasses(schoolId)` 渲染班级列表
  2. 用 `YuzanApi.getClassDetail(schoolId, classId)` 渲染班级详情
  3. 替换所有硬编码数据
- **验证**: 班级数据来自后端
- **风险**: 高

### 步骤 3.3: 测评任务"导出数据""复制链接"接入后端 P2-08
- **操作**: 在teacher/assessments/tasks/的JS中：
  1. "导出数据"调用导出API生成CSV下载
  2. "复制链接"生成真实测评链接
- **验证**: 导出的CSV有真实数据，链接可访问
- **风险**: 中

---

## 第四阶段：测评端全流程（预计3天）

> 目标：测评全流程从入口到报告全部接入后端

### 步骤 4.1: 测评入口页接入后端 P0-03（部分）
- **操作**: assessment/assessment.js中：
  1. 调用 `YuzanApi.getAssessmentSessions()` 获取历史记录
  2. "继续未完成"使用真实session ID跳转

### 步骤 4.2: 朗读测评/书面练习接入后端 P0-03（部分）
- **操作**: 
  1. reading.js: 录音完成后调用 `YuzanApi.createAssessmentSession()` + 录音上传
  2. written.js: 提交答案调用后端保存

### 步骤 4.3: 测评报告接入后端 P0-03（部分）
- **操作**: report.js中：
  1. 从URL参数获取session ID
  2. 调用 `YuzanApi.getAssessmentSession(sessionId)` 获取真实报告
  3. 移除所有硬编码数据

### 步骤 4.4: 历史复测接入后端 P0-03（部分）
- **操作**: history.js中：
  1. 调用 `YuzanApi.getAssessmentSessions()` 获取历史列表
  2. 维度/趋势数据从后端计算

---

## 第五阶段：整合体验修复（预计2天）

> 目标：消除导航问题、修复视觉闪烁、统一设计

### 步骤 5.1: 修复global-nav双导航 P2-03
- **操作**: 在global-nav.js排除规则中添加 `/student` 路径
- **风险**: 低

### 步骤 5.2: 修复student-nav与fit.js缩放冲突 P2-05
- **操作**: 统一缩放策略，移除reFit覆盖
- **风险**: 中

### 步骤 5.3: 首页iframe改为直接DOM嵌入 P2-01
- **操作**: 移除5个iframe，改为直接DOM结构
- **风险**: 高（需重新设计首页布局）

### 步骤 5.4: 统一导航组件设计 P2-02
- **操作**: 统一教师端/学生端/管理端导航栏样式
- **风险**: 中

---

## 第六阶段：收尾优化（预计2天）

> 目标：清理硬编码、添加404、修复移动端

### 步骤 6.1: 固定演示ID参数化 P3-01
- **操作**: server.mjs路由参数化，JS动态加载

### 步骤 6.2: 硬编码演示数据替换 P3-02
- **操作**: 所有硬编码ID改为从API获取

### 步骤 6.3: 添加404页面 P2-07
- **操作**: 在server.mjs中添加404路由

### 步骤 6.4: 移动端适配 P3-06
- **操作**: 移除teacher-shell min-width:900px，添加响应式断点

### 步骤 6.5: 清理废弃文件 P4-06
- **操作**: 移动_old-home到归档目录

---

## 时间线总览

| 阶段 | 预计天数 | 关键交付物 |
|------|---------|-----------|
| 第一阶段：基础设施 | 2天 | 鉴权修复、API封装补齐、后端重复路由修复 |
| 第二阶段：核心闭环 | 3天 | 教师发布反馈可用、学生录音同步可用、测评创建发布可用 |
| 第三阶段：教师端 | 3天 | 工作台真实数据、班级管理可用、测评任务可用 |
| 第四阶段：测评端 | 3天 | 测评全流程接入后端 |
| 第五阶段：整合体验 | 2天 | 导航统一、首页重构、缩放冲突修复 |
| 第六阶段：收尾 | 2天 | 硬编码清理、404、移动端适配 |
| **总计** | **15天** | — |

---

## 关键路径

```
步骤1.2 ─→ 步骤2.1 ─→ 步骤3.1
                    ─→ 步骤2.3 ─→ 步骤3.3
步骤1.3 ─→ 步骤2.2
步骤1.1 ─→ 步骤2.3
        ─→ 步骤4.1 ─→ 步骤4.2 ─→ 步骤4.3
步骤5.x 可与步骤3-4并行
步骤6.x 在所有功能修复完成后执行
```
