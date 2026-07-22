# 测试真实性审计报告

> 审计日期：2026-07-18
> 扫描范围：web-runtime 下所有 JS 文件（排除 node_modules）
> 审计方法：静态模式扫描 + 代码路径追踪

---

## 一、真实性总览

| 分类 | 数量 | 占比 |
|------|------|------|
| LIVE (真实后端) | 38 | 37% |
| FAKE_SUCCESS | 22 | 21% |
| DEMO_ONLY | 18 | 17% |
| LOCAL_ONLY | 12 | 12% |
| LOCAL_STORAGE_ONLY | 13 | 13% |

**说明**：总计 103 个交互操作点。仅 37% 的操作具有真实后端连接，其余 63% 完全依赖前端模拟或本地存储。

---

## 二、setTimeout 模拟清单

| 页面 | JS文件 | setTimeout位置 | 模拟行为 | 伪装成 |
|------|--------|---------------|---------|--------|
| 志愿者端 | volunteer.js | L100 | 等待 iframe 加载后读取 contentDocument | 页面就绪检测 |
| 志愿者端 | volunteer.js | L116 | 点击重试后延迟恢复 `pageState='normal'` | 后端数据恢复 |
| 志愿者端 | volunteer.js | L140 | toast 2.6s 后隐藏 | 用户反馈 |
| 教师端 | teacher.js | L159 | 点击重试后延迟恢复 `state.ui.loading=false` | 后端数据恢复 |
| 教师端 | teacher.js | L201 | toast 2.4s 后隐藏 | 用户反馈 |
| 工具中心 | tools.js | L126 | 点击重试后延迟恢复 `pageState='normal'` | 后端数据恢复 |
| 工具中心 | tools.js | L150 | toast 隐藏 | 用户反馈 |
| 教研中心 | research.js | L58 | 点击重试后延迟恢复 `pageState='normal'`，toast"教研数据已恢复" | 后端数据恢复 |
| 方案页 | plans.js | L82 | toast 隐藏 | 用户反馈 |
| 方案页 | plans.js | L83 | 页面状态渲染延迟 | 加载效果 |
| 管理端 | admin.js | L6 | toast 3s 后移除 | 用户反馈 |
| 管理端 | admin-integration.js | L45 | iframe fit() 调用延迟(0ms, 500ms) | iframe 自适应 |
| 学生端 | student-integration.js | L49-50 | iframe fit() 延迟(0ms, 500ms) | iframe 自适应 |
| 学生端 | student-integration.js | L54 | resize 事件后 fit() 延迟(50ms) | iframe 自适应 |
| 录音器 | assets/recorder.js | L330 | 延迟设置 `syncState='synced'` | 录音同步完成 |
| 录音器 | assets/recorder.js | L408 | toast 2.4s 后隐藏 | 用户反馈 |
| 全局 | assets/app-core.js | L53 | 全局 toast 2.6s 后隐藏 | 用户反馈 |
| 书面测评 | assessment/written/written.js | L23 | 答案自动保存延迟 | 后端保存 |
| 书面测评 | assessment/written/written.js | L62 | 提交后延迟跳转 650ms | 后端处理 |
| 朗读测评 | assessment/reading/2/reading.js | L44 | UI 更新延迟 200ms | 后端响应 |
| 测评报告 | assessment/report/demo/report.js | L21 | 动画延迟 | 渲染效果 |
| 测评报告 | assessment/report/demo/report.js | L42 | 打印预览延迟 200ms | 打印处理 |
| 测评历史 | assessment/history/history.js | L18 | 动画延迟 | 渲染效果 |
| 登录 | login/login.js | L76, L85, L97, L186 | 登录后延迟跳转 260-280ms | 后端认证完成 |
| 选校 | select-school/select.js | L55, L66, L83 | 操作后延迟跳转 280-800ms | 后端操作完成 |

**合计**：25 处 setTimeout，其中 **8 处直接模拟后端操作**（重试恢复、同步完成、保存完成），其余为 UI 延迟/动画。

### 关键发现：录音"同步"完全是伪造的

`assets/recorder.js` L328-334：
```
scheduleSync() {
  if (!navigator.onLine) return this.setSync('local');
  this.setSync('syncing');
  setTimeout(() => {
    this.setSync('synced');               // <-- 伪装成同步完成
    localStorage.setItem(this.key, ...);   // <-- 仅写入 localStorage
    this.notify('录音已同步');             // <-- 用户看到"已安全同步"
  }, 900);                                // <-- 固定延迟模拟网络请求
}
```
用户看到的状态转换 `local -> syncing -> synced` 完全是前端延时模拟，没有任何后端 API 调用。

---

## 三、FAKE_SUCCESS 清单

| 页面 | 按钮/操作 | 用户看到的效果 | 实际行为 | 影响 |
|------|----------|--------------|---------|------|
| 教师端 | 点击重试 | "数据已恢复" | setTimeout 恢复 pageState | 用户以为数据刷新，实际未请求后端 |
| 志愿者端 | 点击重试 | "数据已恢复" | setTimeout 恢复 pageState | 同上 |
| 工具中心 | 点击重试 | "工具数据已恢复" | setTimeout 恢复 pageState | 同上 |
| 教研中心 | 点击重试 | "教研数据已恢复" | setTimeout 恢复 pageState | 同上 |
| 教师端 | "发布任务"按钮 | 打开表单弹窗 | 仅前端状态变更，无后端调用 | 任务未真正发布 |
| 教师端 | "发起测评"按钮 | 打开表单弹窗 | 仅前端状态变更 | 测评未真正发起 |
| 教师端 | "发布课程"按钮 | toast 提示 | 仅前端状态变更 | 课程未真正发布 |
| 教师端 | 资源预览按钮 | "资源预览已打开" toast | 无后端调用 | 资源未真正加载 |
| 教师端 | 通知中心 | "3条新通知"弹窗 | 硬编码通知内容 | 非真实通知数据 |
| 工具中心 | 邀请码复制 | "邀请码已复制" | clipboard API + 硬编码码值 | 邀请码非后端生成 |
| 工具中心 | 通知中心 | "3条新消息"弹窗 | 硬编码 | 非真实通知 |
| 教研中心 | 创建课题 | 打开表单 | 无后端提交 | 课题未创建 |
| 教研中心 | 搜索 | toast"请输入关键词" / 过滤结果 | 前端内存过滤 | 非后端搜索 |
| 志愿者端 | 发消息给教师 | 打开表单弹窗 | 无后端发送 | 消息未发送 |
| 志愿者端 | 风险上报 | 打开表单弹窗 | 无后端提交 | 风险未上报 |
| 志愿者端 | 进入服务 | toast"功能开发中" | 直接提示 | 功能未实现 |
| 志愿者端 | 切换语言 | toast"当前演示使用简体中文" | 无切换操作 | 语言未切换 |
| 学生端 | 离线缓存操作 | toast"已缓存/已移出" | 仅前端状态 | 缓存非真实 |
| 书面测评 | 提交答案 | toast"答案已提交，正在生成测评报告" + 650ms 后跳转 | 无后端提交 | 答案未提交 |
| 测评报告 | 打印报告 | toast"正在打开打印预览" + 200ms window.print() | 仅浏览器打印 | 无后端导出 |
| 登录 | 演示模式登录 | "演示模式登录成功" toast | localStorage 写入 demo token | 非真实认证 |
| 方案页 | 提交咨询 | toast 成功/失败 | 前端验证 | 咨询未发送 |

---

## 四、硬编码演示数据清单

| 页面 | 数据类型 | 硬编码值 | 应来自 |
|------|---------|---------|--------|
| 全局(app-core.js) | 学生课程进度 | `courseProgress: 42` | `/student/today` API |
| 全局(app-core.js) | 学生完成步骤 | `completedSteps: [1]` | `/student/today` API |
| 全局(app-core.js) | 学生当前步骤 | `currentStep: 2` | `/student/today` API |
| 全局(app-core.js) | 教师待复核数 | `reviewsPending: 12` | `/teacher/dashboard` API |
| 全局(app-core.js) | 用户角色 | `role: 'student'` | `/auth/me` API |
| 全局(app-core.js) | 用户学校 | `school: '青海省海南州示范学校（演示）'` | `/auth/me` API |
| 全局(app-core.js) | 测评朗读状态 | `readingStatus: 'not_started'` | `/assessment/status` API |
| 全局(app-core.js) | 书面答案 | `writtenAnswers: {}` | `/assessment/written` API |
| 全局(app-core.js) | 当前题目 | `currentQuestion: 3` | `/assessment/written` API |
| 教师端(teacher.js) | 网络状态 | `status:'synced', lastSync:'2 分钟前'` | 心跳 API |
| 教师端(teacher.js) | 待发布课程 | `count:2, title:'待发布课程'` | `/teacher/dashboard` API |
| 教师端(teacher.js) | 通知内容 | "朗读任务即将截止、2名学生离线..." | `/notifications` API |
| 工具中心(tools.js) | 邀请码 | `TCH-7Q1A-B9K2` | `/teacher-tools/invite-code` API |
| 工具中心(tools.js) | 通知内容 | "3条新消息：服务配置提醒..." | `/notifications` API |
| 教研中心(research.js) | 课题计数 | `进行中:3, 待评审:5, 试用中:2, 即将发布:1, 已发布:8, 已归档:12` | `/research/dashboard` API |
| 志愿者端(volunteer.js) | 网络状态 | `online:true, synced:true` | 心跳 API |
| 志愿者端(volunteer.js) | 课程进度 | 各课程 progress 百分比 | `/volunteer/courses` API |
| 志愿者端(volunteer.js) | 旅程步骤 | 6 步固定名称 | `/volunteer/journey` API |
| 学生端(today.js) | 课程进度默认 | `YuzanDemo.get('student.courseProgress') \|\| 42` | `/student/today` API |
| 登录(login.js) | 演示 token | `'demo-token-' + identifier` | `/auth/login` API |
| 登录(login.js) | 演示学校 ID | `'11111111-1111-4111-8111-111111111111'` | `/auth/me` API |
| 测评报告(report.js) | 报告数据 | `fallback` 对象（分数、建议、证据） | `/assessment/report` API |
| 测评报告(report.js) | 教师反馈 | `localStorage.getItem('review-feedback-0')` | `/assessment/feedback` API |

---

## 五、数据真实性风险矩阵

| 功能 | 前端状态 | 后端状态 | 差距 | 修复难度 |
|------|---------|---------|------|---------|
| 用户认证 | 本地 localStorage token | API 存在(api-client.js L114) | 演示模式绕过 API | 低 |
| 学校选择 | localStorage 存储 | API 存在(api-client.js L327) | 选校页可对接 | 低 |
| 教师仪表盘 | 全部硬编码 | API 存在(api-client.js L177) | 已有 loadBackendState() 钩子 | 中 |
| 志愿者仪表盘 | 全部硬编码 | API 存在(api-client.js L177) | 已有 loadBackendState() 钩子 | 中 |
| 工具中心 | 全部硬编码 | API 存在(api-client.js L489) | 已有 loadBackendState() 钩子 | 中 |
| 教研中心 | 全部硬编码 | 无专用 API | 需新建 API | 高 |
| 方案页 | 全部硬编码 | 无专用 API | 需新建 API | 高 |
| 录音同步 | setTimeout 伪装 | API 存在(api-client.js L540-569) | recorder.js 未调用 | 中 |
| 测评流程 | localStorage 存储 | API 存在(assessment links) | 未对接 | 中 |
| 测评报告 | localStorage + fallback | 无报告 API | 需新建 API | 高 |
| 教师发布任务 | 仅表单弹窗 | API 存在(api-client.js L466) | 未对接提交 | 低 |
| 教师复核发布 | FAKE_SUCCESS | API 存在(api-client.js L466) | 未对接 | 低 |
| 风险上报 | 仅表单弹窗 | 无专用 API | 需新建 API | 高 |
| 消息发送 | 仅表单弹窗 | 无专用 API | 需新建 API | 高 |
| 管理端仪表盘 | 全部硬编码 | API 存在(api-client.js L180) | 已有 hydrate 钩子 | 中 |
| 课程管理 | 硬编码 | API 存在(api-client.js L191-271) | admin-pages 已对接部分 | 低-中 |
| 用户管理 | 硬编码 | API 存在(api-client.js L345) | admin-pages 已对接部分 | 低-中 |
| 学校管理 | 硬编码 | API 存在(api-client.js L327) | admin-pages 已对接部分 | 低-中 |
| 隐私管理 | 硬编码 | API 存在(api-client.js L396-411) | admin-pages 已对接部分 | 低-中 |

---

## 六、关键风险

### 风险 1：录音"同步"完全是伪造的（严重）

- **位置**：`assets/recorder.js` L327-334
- **现状**：`scheduleSync()` 使用 `setTimeout` 900ms 后将状态设为 `synced`，仅写入 localStorage
- **用户影响**：用户看到"已安全同步"提示，但录音数据从未离开浏览器。清除浏览器数据即丢失。
- **已有后端**：`api-client.js` L540-569 包含完整的录音上传 API（创建录音、获取上传URL、完成上传、获取证据）
- **修复路径**：将 `scheduleSync()` 改为调用 `YuzanApi.createRecording()` -> `uploadUrl` -> `completeRecording()` 流程

### 风险 2：YuzanDemo 默认值掩盖了无数据状态（严重）

- **位置**：`assets/app-core.js` L4-9
- **现状**：`defaults` 对象提供完整的演示数据，页面初始化时通过 `deepMerge(structuredClone(defaults), parseStored())` 合并。当后端不可用时，页面仍显示"有数据"的状态。
- **用户影响**：用户无法区分"真实数据"和"演示数据"。进度 42%、待复核 12 条均为虚构。
- **修复路径**：默认值应为空/null，由 `loadBackendState()` 填充真实数据。演示数据仅在 URL 含 `?demo=1` 时注入。

### 风险 3：登录演示模式创建假会话（严重）

- **位置**：`login/login.js` L74-97, L183
- **现状**：当后端不可用时，直接向 localStorage 写入 `yuzan-demo-session` 和 `demo-token-xxx`，然后跳转。整个"会话"无后端验证。
- **用户影响**：演示模式下所有操作都是本地的，用户以为已登录。
- **修复路径**：明确区分演示模式和真实模式，UI 上持续标注"演示模式"。

### 风险 4：测评报告数据为硬编码 fallback（高）

- **位置**：`assessment/report/demo/report.js` L5-8
- **现状**：数据来源优先级为 `window.__YUZAN_REPORT__` > `localStorage('yuzan-demo-report')` > `fallback` 硬编码对象。三项均非真实 API 数据。
- **用户影响**：所有学生看到相同的测评报告。
- **修复路径**：通过 `YuzanApi` 调用后端获取真实报告数据。

### 风险 5：各端"重试"按钮均为伪刷新（中）

- **位置**：volunteer.js L116, teacher.js L159, tools.js L126, research.js L58
- **现状**：点击重试后 `setTimeout(()=>{state.ui.pageState='normal'; render(); toast('数据已恢复')})` -- 无任何 fetch 调用。
- **用户影响**：用户以为数据刷新了，实际看到的是旧数据。
- **修复路径**：重试应调用 `loadBackendState()` 或对应 API。

### 风险 6：localStorage 作为唯一数据源（中）

- **位置**：app-core.js L21-25, recorder.js L134/253/282/333, report.js L5, login.js L74/82/91-93
- **现状**：至少 13 处使用 localStorage 作为数据持久化手段。清除浏览器数据 = 丢失所有进度。
- **修复路径**：将 localStorage 用途限定为临时缓存，所有持久化数据必须通过 API 同步到后端。

---

## 七、setTimeout 文件分布

共 **59 个 JS 文件** 使用 setTimeout（排除 node_modules）：

| 目录 | 文件数 | setTimeout 总数 |
|------|--------|----------------|
| 根目录 | 8 | 21 |
| assessment/ | 4 | 5 |
| assets/ | 3 | 4 |
| login/ | 2 | 8 |
| select-school/ | 1 | 3 |
| admin-pages/ | 7 | 7 |
| student-pages/ | 7 | 8 |
| volunteer-pages/ | 8 | 9 |
| teacher/ | 10 | 11 |
| shared/ | 1 | 1 |
| sections/ | 5 | 5 |
| public-materials/ | 3 | 3 |

其中 **模拟后端操作** 的 setTimeout 约 8 处，其余为 UI 动画/toast 消失/iframe 调整，属于合理用途。

---

## 八、修复路线图

### 阶段 1 -- 数据真实性（2 周）

1. 录音同步：recorder.js `scheduleSync()` 对接 `YuzanApi.createRecording/completeRecording`
2. 各端重试：替换 setTimeout 为 `loadBackendState()` 实际调用
3. 教师发布/复核：对接 `submitReview` API

### 阶段 2 -- 演示数据隔离（1 周）

4. YuzanDemo defaults 改为空值，演示数据仅在 `?demo=1` 模式注入
5. 登录演示模式 UI 持续显示"演示模式"横幅
6. 测评报告对接后端 API

### 阶段 3 -- 本地存储迁移（2 周）

7. recorder.js：localStorage -> IndexedDB + 后端同步
8. 评估答案保存：localStorage -> 后端 API
9. 测评报告缓存：localStorage -> API 缓存

### 阶段 4 -- 缺失 API 建设（3 周）


10. 教研中心 API
11. 方案页咨询 API
12. 风险上报 API
13. 消息系统 API
