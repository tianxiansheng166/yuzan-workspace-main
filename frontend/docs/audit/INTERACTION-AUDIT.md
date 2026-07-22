# 逐页交互审计报告

> 审计日期：2026-07-18
> 审计范围：学生端5页 + 教师端9页 = 14页
> 总交互元素：约97个

## 一、学生端

### 1. 今日学习 `/student/today`（6个交互）

| # | 控件 | 选择器 | 处理方式 | 后端接口 | 结论 |
|---|---|---|---|---|---|
| T1 | ▶ 播放范读 | `#previewAudio` | 切换DOM class + YuzanDemo.toast | 无 | **DEMO_ONLY** |
| T2-T4 | 资源缓存项 | `.resource-item` | toggle .cached class + YuzanDemo.toast | 无 | **DEMO_ONLY** |
| T5 | ◉ 进入朗读 | `.enter` | 跳转(assignmentId来自API) | init: GET /student/today | **LIVE_WRAPPED** + ROUTE_ONLY |
| T6 | 网络状态 | `#networkStatus` | toast显示在线/离线 | 无 | **DEMO_ONLY** |

**初始化**: `YuzanApi.getStudentToday()` → 回退 `YuzanApi.request('/learning/tasks')` — **LIVE_WRAPPED**

### 2. 课程中心 `/student/courses`（5个交互）

| # | 控件 | 选择器 | 处理方式 | 后端接口 | 结论 |
|---|---|---|---|---|---|
| C1-C4 | 筛选按钮 | `.filter-btn[data-filter]` | 修改currentFilter+重新渲染 | 无 | **LOCAL_ONLY** |
| C5 | 课程卡片 | `.course-card a` | 跳转学习页 | 无 | **ROUTE_ONLY** |

**初始化**: `YuzanApi.getStudentCoursesDashboard()` → 回退 `YuzanApi.request('/learning/tasks')` — **LIVE_WRAPPED**

### 3. 成长报告 `/student/growth`（4个交互）

| # | 控件 | 选择器 | 处理方式 | 后端接口 | 结论 |
|---|---|---|---|---|---|
| G1 | 视角切换 | `.switch button` | 切换DOM文案 + YuzanDemo.toast | 无 | **DEMO_ONLY** |
| G2 | 阶段卡片 | `.stage` | toggle focused class + toast | 无 | **DEMO_ONLY** |
| G3 | 下一阶段计划 | `.next>div` | toggle planned class + toast | 无 | **DEMO_ONLY** |
| G4 | ⇩ 导出报告 | `#exportGrowth` | 生成JSON Blob下载 | 无 | **LOCAL_ONLY** |

**初始化**: 3个API并行 — `YuzanApi.request('/submissions/me')` + `YuzanApi.request('/learning/tasks')` + `YuzanApi.getStudentTeacherAdvice()` — **LIVE_WRAPPED** + LIVE_DIRECT

### 4. 学习播放器 `/student/learn/spring-2`（1个核心交互 + 录音流程）

| # | 控件 | 选择器 | 处理方式 | 后端接口 | 结论 |
|---|---|---|---|---|---|
| P1 | 完成并继续 | `#desktopComplete` | 录音→上传→跳转 | 见下方录音流程 | **LIVE_WRAPPED** + DEMO_ONLY |

**录音上传流程（核心闭环）**：
1. `YuzanApi.initRecording()` → `POST /schools/:id/recordings` — **LIVE_WRAPPED**
2. `fetch(uploadUrl, {PUT, body:blob})` → 直传预签名URL — **LIVE_DIRECT**
3. 回退: `YuzanApi.getRecordingPartUploadUrl()` → `POST /recordings/:id/parts/:n/upload-url` — **LIVE_WRAPPED**
4. `YuzanApi.completeRecording()` → `POST /recordings/:id/complete` — **LIVE_WRAPPED**
5. 成功后: `YuzanDemo.set('student.completedSteps', [1,2])` — **DEMO_ONLY**（进度仅存本地）
6. 失败回退: `recorder.setSync('local')` — 本地保存

### 5. 个人中心 `/student/profile`（5个交互）

| # | 控件 | 选择器 | 处理方式 | 后端接口 | 结论 |
|---|---|---|---|---|---|
| PR1-PR3 | 导航链接 | `<a>` 标签 | 页面跳转 | 无 | **ROUTE_ONLY** |
| PR4 | 离线资源管理 | `#offlineBtn` | alert("开发中") | 无 | **BROKEN** |
| PR5 | 退出登录 | `#logoutBtn` | YuzanApi.logout() + 清空token + 跳转 | POST /auth/logout | **LIVE_WRAPPED** |

**初始化**: `YuzanApi.getStudentProfile()` — **LIVE_WRAPPED**

## 二、教师端

### 6. 教师工作台 `/teacher`（23个交互）

| # | 控件 | 处理方式 | 后端接口 | 结论 |
|---|---|---|---|---|
| TH1 | 侧栏导航 | /teacher路由pushState, 其他toast提示 | 无 | ROUTE_ONLY + DEMO_ONLY |
| TH2 | 创建课程 | unshift到本地state.courses | 无 | **LOCAL_ONLY** |
| TH3 | 发布任务 | unshift到本地state.tasks | 无 | **LOCAL_ONLY** |
| TH4 | 发起测评 | 仅toast无数据变更 | 无 | **FAKE_SUCCESS** |
| TH5 | 去处理 | 弹出modal文字 | 无 | DEMO_ONLY |
| TH6 | 工作轨道 | 更新state+toast | 无 | LOCAL_ONLY |
| TH7-TH10 | 待处理行 | 弹出modal文字 | 无 | DEMO_ONLY |
| TH11 | AI工具 | modal文字 | 无 | DEMO_ONLY |
| TH12 | 资源推荐 | toast("已打开") | 无 | **FAKE_SUCCESS** |
| TH13-TH15 | 切换学校/学期/班级 | 修改本地state | 无 | LOCAL_ONLY |
| TH16 | 通知 | YuzanApi.getNotifications() | GET /notifications | **LIVE_WRAPPED** |
| TH17-TH20 | 帮助/信息 | modal文字 | 无 | DEMO_ONLY |
| TH21 | 重新加载 | setTimeout模拟 | 无 | **FAKE_SUCCESS** |
| TH22-TH23 | 全部查看 | modal"预留路由"文字 | 无 | DEMO_ONLY |

**初始化**: `YuzanApi.getDashboard()` + `YuzanApi.getPronunciationClusters()` — **LIVE_WRAPPED**

### 7. 教学任务 `/teacher/assignments`（9个交互）

| # | 控件 | 处理方式 | 后端接口 | 结论 |
|---|---|---|---|---|
| A1-A2 | 新建/保存任务 | YuzanApi.request POST | POST /assignments | **LIVE_DIRECT** |
| A3-A5 | 筛选按钮 | 修改DOM显示 | 无 | LOCAL_ONLY |
| A6 | 行展开 | toggle detail行 | 无 | LOCAL_ONLY |
| A7 | 行菜单(...) | YuzanDemo.toast | 无 | **FAKE_SUCCESS** |
| A8 | 关注项 | toggle highlight | 无 | LOCAL_ONLY |
| A9 | 查看待反馈 | 跳转复核页 | 无 | ROUTE_ONLY |

**初始化**: `YuzanApi.request('/classes/teachers/me')` + `YuzanApi.request('/course-versions')` + `YuzanApi.request('/assignments')` — **LIVE_DIRECT**

### 8. 我的班级 `/teacher/classes`（5个交互）

全部 **DEMO_ONLY** 或 **FAKE_SUCCESS**。无API调用，所有数据硬编码。

### 9. 班级详情 `/teacher/classes/detail`（5个交互）

全部 **DEMO_ONLY** 或 **FAKE_SUCCESS**。无API调用，所有数据硬编码。

### 10. 课程工作室 `/teacher/courses/spring/studio`（11个交互）

| # | 控件 | 处理方式 | 后端接口 | 结论 |
|---|---|---|---|---|
| S3 | 提交审核 | YuzanApi.submitForReview() | POST /submit-review | **LIVE_WRAPPED** |
| S11 | Ctrl+S保存 | YuzanApi.request PATCH | PATCH /course-versions/:id | **LIVE_DIRECT** |
| 其余 | 编辑/预览/添加等 | 修改DOM+local变量 | 无 | LOCAL_ONLY/DEMO_ONLY/FAKE_SUCCESS |

**初始化**: `YuzanApi.request('/course-versions')` + `YuzanApi.request('/course-versions/:id')` — **LIVE_DIRECT**

### 11. 提交复核 `/teacher/reviews/submission-1`（7个交互）

| # | 控件 | 处理方式 | 后端接口 | 结论 |
|---|---|---|---|---|
| R1 | 切换学生 | 修改本地selected | 无 | LOCAL_ONLY |
| R2 | 评分星级 | 修改本地students数组 | 无 | LOCAL_ONLY |
| R3 | 保存草稿 | localStorage.setItem | 无 | **LOCAL_STORAGE_ONLY** |
| **R4** | **发布反馈** | **修改本地status+setTimeout+toast** | **无** | **🔴 FAKE_SUCCESS** |
| R5-R6 | 文本定位/展开 | DOM操作 | 无 | LOCAL_ONLY |
| R7 | 下一步练习 | YuzanDemo.toast | 无 | FAKE_SUCCESS |

**⚠️ 关键发现**: "发布反馈"按钮(R4)是本页最严重问题。Toast显示"反馈已发布，学生端将显示练习建议"，但**从未调用任何后端API**，仅修改本地数组状态+setTimeout模拟延迟。

**初始化**: `YuzanApi.request('/assignments/:id/submissions')` — **LIVE_DIRECT**

### 12. 创建测评 `/teacher/assessments/create`（12个交互）

全部 **LOCAL_ONLY** 或 **FAKE_SUCCESS**。无API调用。
- "保存草稿" → toast但无实际保存 — **FAKE_SUCCESS**
- "发布测评" → toast但无API调用 — **FAKE_SUCCESS**

### 13. 测评任务 `/teacher/assessments/tasks`（10个交互）

全部 **LOCAL_ONLY** 或 **FAKE_SUCCESS**。无API调用，所有数据硬编码。
- "导出数据" → toast但无文件生成 — **FAKE_SUCCESS**
- "复制链接" → clipboard写入假URL — **FAKE_SUCCESS**

### 14. 测评详情 `/teacher/assessments/detail`（15个交互）

全部 **LOCAL_ONLY** 或 **FAKE_SUCCESS**。无API调用，所有数据硬编码。
- "暂停/继续" → 仅修改本地DOM — **FAKE_SUCCESS**
- "下载二维码" → toast但无二维码 — **FAKE_SUCCESS**
- "生成报告" → toast但无报告 — **FAKE_SUCCESS**
- "延长时间" → toast但无API — **FAKE_SUCCESS**

## 三、统计汇总

| 结论类型 | 数量 | 占比 |
|---------|------|------|
| LIVE_WRAPPED | 8 | 8.2% |
| LIVE_DIRECT | 5 | 5.2% |
| ROUTE_ONLY | 7 | 7.2% |
| LOCAL_ONLY | 28 | 28.9% |
| LOCAL_STORAGE_ONLY | 1 | 1.0% |
| DEMO_ONLY | 25 | 25.8% |
| FAKE_SUCCESS | 22 | 22.7% |
| BROKEN | 1 | 1.0% |

**关键数据**:
- 真实连接后端的交互：13个（LIVE_WRAPPED + LIVE_DIRECT）= **13.4%**
- 假成功/无实际功能的交互：47个（DEMO_ONLY + FAKE_SUCCESS）= **48.5%**
- 仅本地操作：29个（LOCAL_ONLY + LOCAL_STORAGE_ONLY）= **29.9%**

## 四、最高优先级FAKE_SUCCESS问题

| 优先级 | 页面 | 按钮 | 当前行为 | 应有行为 |
|--------|------|------|---------|---------|
| **P0** | 教师复核 | 发布反馈 | 修改本地数组+toast | 应调用 `POST /schools/:id/submissions/:id/feedback` |
| **P1** | 创建测评 | 发布测评 | toast"已确认" | 应调用 `POST /schools/:id/assessments/sessions` |
| **P1** | 创建测评 | 保存草稿 | toast"已保存" | 应调用 `POST /schools/:id/teacher-tools/drafts` |
| **P1** | 测评详情 | 暂停/继续 | 修改DOM状态 | 应调用 `PATCH /schools/:id/assignments/:id` |
| **P1** | 测评详情 | 生成报告 | toast | 应调用 `GET /schools/:id/assessments/sessions/:id/report` |
| **P2** | 测评任务 | 导出数据 | toast | 应调用导出API |
| **P2** | 教师首页 | 发起测评 | toast | 应跳转创建页 |
| **P2** | 教师首页 | 资源推荐 | toast"已打开" | 应调用资源API |
