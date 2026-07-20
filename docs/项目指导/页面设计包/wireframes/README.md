# 低保真功能线框

本目录用于验证信息架构、页面连续性、状态、按钮去向和响应式重排，不代表接口已实现，也不是最终视觉稿。

## 启动

在仓库根目录：

```powershell
python -m http.server 4176
```

打开：

```text
http://127.0.0.1:4176/docs/项目指导/页面设计包/wireframes/index.html#/S01?state=normal
```

不能用 `file://` 直接打开，因为页面必须通过 `fetch` 读取 `../../design-fixtures/古诗文朗读与理解训练-v1.json`。

## 路由示例

- `#/S03?state=normal&mode=SELF_PRACTICE`（S02 创建/恢复 Attempt 并取得 `attemptId` 后，对应正式路由 `/student/practices/attempts/:attemptId/prepare`）
- `#/S03?state=error&mode=SELF_PRACTICE`
- `#/S04?type=READ_ALOUD&state=recording&mode=SELF_PRACTICE`
- `#/S05?state=normal&mode=SELF_PRACTICE`
- `#/S04?type=READ_ALOUD&state=normal&mode=STAGE_ASSESSMENT`
- `#/S04?type=READ_ALOUD&state=normal&mode=ASSIGNMENT&mobilePolicy=BLOCK`
- `#/S04?type=LISTEN_REPEAT&state=saved-local`
- `#/S04?type=READ_ALOUD&state=upload-failed`
- `#/S06?state=provider-unavailable`
- `#/S07?state=empty`

## 验收边界

- 不请求真实 API。
- 不复制 Fixture 业务数据到 JavaScript。
- Fixture 加载失败显示“设计Fixture加载失败”。
- 不通过 `setTimeout` 模拟上传、评分或报告完成。
- `LISTEN_ANSWER`、`FILL_BLANK` 保持 `NO_FIXTURE_INSTANCE`，只展示空结构和组件规则，不生成题目、答案、分数或时长。
- 正式一级导航固定为“今日学习 / 课程学习 / 练习与测评 / 成长档案”，全页族激活“练习与测评”。
- 390 的 S03/S04/S05 按 Delivery 模式与 `mobilePolicy` 改变；SELF_PRACTICE 可执行，STAGE_ASSESSMENT 固定阻塞正式手机作答。
