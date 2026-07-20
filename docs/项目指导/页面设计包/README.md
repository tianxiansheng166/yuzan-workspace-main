# P0 学生端页面设计包

任务：`P0-STUDENT-DESIGN-PACKAGE-001`

本目录只交付学生端“古诗文朗读与理解训练”的产品规格、接口绑定、状态设计、低保真线框和视觉 AI 提示词。它不是正式页面，不接正式路由，不请求真实 API，也不表示拟议能力已实现。

## 开工记录

| 检查项 | 结果 |
| --- | --- |
| 工作目录 | `D:\program\test_program\yuzanxinsheng\three\workers\p0-student-design-package` |
| 当前分支 | `task/p0-student-design-package-001` |
| 基线 | `HEAD=5728016fcd0397ea62fa330790d91cb2d97f4297`，且 `git merge-base --is-ancestor 5728016... HEAD` 返回 0 |
| 初始状态 | `git status --porcelain=v1` 无输出 |
| clone 类型 | `.git` 为本 clone 内独立目录，`git-common-dir=.git`；不是 linked worktree |
| 禁区 | 未在原 `yuzan-next` 中写文件；只读参考未修改 |

## 事实源与边界

- 唯一故事数据：`../design-fixtures/古诗文朗读与理解训练-v1.json`。
- 线框运行时通过 `fetch("../../design-fixtures/古诗文朗读与理解训练-v1.json")` 读取，不含 fallback 业务数据。
- 接口状态以 `../执行产物/P0-设计准备集成报告.md`、`../执行产物/A-黄金闭环契约矩阵.md`、当前 OpenAPI 和生成类型为准。
- `CURRENT` 仅指现有 OpenAPI 与后端能完成同一原子动作；适配后的 Practice 语义不能继承该标签。
- `PROPOSED` 与 `BLOCKED` 仍保留产品目标，视觉可继续，正式实现必须先补契约、安全或评分正确性。

## UPSTREAM_ISSUE

1. `AGENTS.md` 要求的 `../orchestration/AI-COLLABORATION-PROTOCOL.md` 在本 clone 及其直接父目录不存在。
2. clone 中未找到本任务的独立 task JSON；本次以用户提供的完整任务附件作为任务事实与 `allowed_paths` 权威来源。
3. 任务要求 S04 覆盖 `LISTEN_ANSWER`、`FILL_BLANK`，统一 Fixture 没有这两类实例；Fixture 另有 `MULTIPLE_CHOICE`。本包保留两种执行壳并显示“Fixture 无实例”，不编造题目、答案或成绩。
4. 上游 06/07 对 390 视口存在冲突：06 只允许 S01/S07/S09 正式移动适配并让执行类页面显示设备提示，任务又要求全部 9 页 390 正常状态截图。本包以任务验收为准，全部 9 页提供信息架构级 390 重排；S03/S04/S05 在主体中保留“正式练习需电脑或平板”提示，不渲染可用录音控件。
5. 上游 06 把 S06 归入少数可移动查看页面，07 的响应式表也允许 S06；本包遵循这一较具体规则。
6. 上游 P0 Fixture 的人物与学校均为虚构设计数据；截图始终显示“设计原型 · 示例数据”水印。

## 使用方式

在仓库根目录运行：

```powershell
python -m http.server 4176
```

打开：

```text
http://127.0.0.1:4176/docs/项目指导/页面设计包/wireframes/index.html#/S01?state=normal
```

可用查询：

- 页面：`#/S01` 到 `#/S09`
- 状态：`?state=loading|normal|empty|error|offline|permission|processing|provider-unavailable`
- S04 题型：`?type=READ_ALOUD&state=recording`

## 迁移与回滚

- 本任务没有数据库、OpenAPI、路由或业务代码迁移。
- 后续前端实现应把线框中的 Fixture 读取替换为按接口状态分层的适配器，不能复制 Fixture 到 JavaScript。
- 回滚只需 `git revert <本任务提交>`；不使用 `reset --hard`，不影响业务运行。

## 视觉设计前确认

1. `LISTEN_ANSWER` 与 `FILL_BLANK` 的正式题目结构及 Fixture 实例。
2. 390 下 S02/S08 是否作为正式移动页开放，还是只用于视觉结构验证。
3. PracticeDefinition/Version/Delivery 的契约负责人和交付时间。
4. 学生录音列表与 playback URL 的权限模型。
5. 正式报告 RubricVersion/Section 加权接口的冻结时间。
6. 学生复测申请与教师审批的状态文案。
7. 巩固建议写入学习计划前的教师确认工作流。
8. 最终导航采用“今日学习/课程学习/练习与测评/成长档案”还是 07 中简化的“首页/练习/历史/我的”。

