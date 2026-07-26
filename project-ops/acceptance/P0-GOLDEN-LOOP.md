# P0 黄金闭环独立验收合同

## 结论

Builder 的测试只能产生候选，不能产生 `VERIFIED`。跨角色 P0 只有在独立 Verifier 对同一
动态 runId 完成 L3、L4、L5，并在合入后的 exact runtime commit 重跑，才可被 Controller 接受。

## 证据等级

| 等级 | 证明 | 是否单独关闭闭环 |
| --- | --- | --- |
| L0 SOURCE_BUILD | 源码存在、类型与构建成立 | 否 |
| L1 UNIT | 局部规则成立 | 否 |
| L2 API_INTEGRATION | 后端接口、权限或数据规则成立 | 否 |
| L3 BROWSER | 用户从真实渲染页面完成动作 | 否，需与 L4/L5 同 runId |
| L4 PERSISTENCE | 浏览器动态 ID 对应 DB/对象存储真实记录 | 否，需与 L3/L5 同 runId |
| L5 FRESH_CONTEXT_NEGATIVE | 新会话、跨角色、恢复与越权负向成立 | 是，与 L3/L4 组合后 |

## 必须从 UI 发起的动作

- 教师登录、创建并发布任务；
- 学生登录、打开任务、录音、作答和提交；
- 教师重新登录、打开动态提交、播放证据并复核；
- 学生重新登录、查看报告并完成复测。

API 可以读取健康、对账对象和查询 DB，但不得直接完成上述业务写操作。Playwright 中使用
`page.evaluate` 调业务 API、`request.post` 代替点击、`route.fulfill` 或 fixture response 均拒收。

## 直接拒收条件

- `submission-1` 等固定业务 ID、固定分数、demo token 或 API 失败假成功；
- 截图来自静态 HTML 或截图没有 locator/URL/按钮状态/布局断言；
- 教师和学生复用同一 browser context/storage state；
- DB/对象不是本轮 runId 产生，或时间不在本轮窗口；
- 关键请求有意外 4xx/5xx，或存在未解释 console/page/request error；
- 390px 下横向溢出、文字重叠、按钮不可见/不可点击；
- manifest 的 commit 与运行 commit 不一致或工作树脏；
- evidence 文件缺失、哈希不一致或包含密钥/真实学生数据。

## 独立性

- 实现者身份不得等于 verifier 身份；
- verifier 不修改业务源码和验收标准；
- 首轮 candidate 验证在 task/integration 约定环境执行；
- 最终验收必须在合入后的 integration/main exact commit 重新运行；
- Verifier 失败后输出可复现 rejection，由 Controller 重新激活 Builder。

## Evidence run

每次运行使用不可变目录：

```text
runtime-local/control-plane/evidence/<task-id>/<attempt>/<run-id>/
  manifest.json
  browser-result.json
  network-summary.json
  database-result.json
  object-storage-result.json
  console-errors.json
  verifier-report.json
  screenshots/
  browser-trace.zip
```

截图和 trace 可因环境能力缺失而不产生，但 manifest 必须将该验收项标为未满足，不能降级通过。

## Verdict 状态机

```text
COMPLETE_CANDIDATE
→ VERIFYING
→ REJECTED → NEEDS_REWORK → 新 attempt
→ ENVIRONMENT_BLOCKED → 保留候选并等待资源
→ VERIFIED → INTEGRATION_QUEUE
→ INTEGRATED_REVERIFY
→ REJECTED / INTEGRATED_VERIFIED
```

只有 `INTEGRATED_VERIFIED` 能满足 Goal acceptance item。

