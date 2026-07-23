# <TASK-ID> Handoff

- Owner:
- Reviewer:
- Branch:
- Base commit:
- Status: `READY_FOR_REVIEW`

## 用户结果与方向

- 已完成的唯一用户结果：
- 推进黄金闭环的环节：
- 明确未做：

## 实现与修改范围

- 实现摘要：
- 主要文件：
- 复用的现有模型/契约/组件：
- 共享事实或 CCR：

## 实际验证

| 检查 | 命令 | 结果 |
|---|---|---|
| 最小测试 |  | `PASS` / `FAIL` / `BLOCKED` |

不要省略失败、跳过数量或环境限制。UI 证据记录页面、尺寸、截图及
console/page errors；纵向证据记录动态 ID 和真实状态转换。

## 自审

- [ ] 差异只服务任务结果且均在 `allowed_paths`
- [ ] 无固定 ID、静态业务数据、假成功或 demo fallback
- [ ] 相关失败/权限/offline/provider 状态真实
- [ ] 最高风险有直接测试，未把 0 测试写成通过
- [ ] 无密钥、真实学生数据或来源不明资产
- [ ] `task-gate.ps1 -Mode review` 通过

## 风险、限制与回滚

- 已知风险：
- 已知限制：
- 假设：
- 回滚步骤：

## 集成说明

- 依赖与合并顺序：
- Integration Lead 需要复验：
- 推送分支/commit：
