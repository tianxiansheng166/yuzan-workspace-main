# 上下文治理：规范必须能纠偏，而不能淹没开发

## 判断

控制面可以保存很多资料，但普通任务不能读取很多资料。长期知识与单轮启动上下文分离：

```text
稳定层：Goal、短契约、FeatureChain、journey、文档注册表
动态层：work order、lease/epoch、latest failure、next action
证据层：exact commit、浏览器/API/DB/对象存储 manifest
参考层：docs、旧 prompt、CURRENT、看板和历史报告
```

参考层默认不进入上下文。它只服务 discovery、迁移或某个未决事实，读取后也只能形成
带证据的假设，不能直接改变 Goal 或宣告功能完成。

## 各角色的最小读取集

| 角色 | 必读 | 按需 | 禁止默认读取 |
| --- | --- | --- | --- |
| Controller | Goal、policy、runtime state/actions、Git 事实 | 最新 verdict、冲突 task | 全 docs、业务源码、旧 prompt |
| Builder | work order、短契约、当前 task、FeatureChain、latest failure | 目标源码及 direct import/caller | 其他任务 handoff、看板、CURRENT、全 docs |
| Verifier | exact SHA、FeatureChain、journey、evidence schema | 失败后的 reproduction/artifact | Builder 的结论性报告、静态截图 |
| Integration | Goal revision、verdict/manifest/hash、remote SHA、changed paths | 冲突源文件 | 产品历史和无关任务 |
| Discovery | ticket 指定的单个历史材料 | 直接事实来源 | 用历史结论覆盖当前 Goal |

## Capsule 预算

- 推荐总量不超过 32 KiB，硬上限 48 KiB；
- `AGENTS.md + 短契约` 推荐不超过 14 KiB；
- work order 不超过 8 KiB；task + FeatureChain 不超过 18 KiB；
- latest failure/handoff delta 不超过 8 KiB；
- 源码不复制进 capsule，执行时增量读取；
- 上下文压缩后重建 capsule，只恢复当前差异与最新失败，不重放聊天和旧 prompt。

每个 work order 的 `context_manifest` 必须记录 `path / sha256 / purpose / scope`。Worker 在
首次 CHECKPOINT 前确认 digest；Goal revision、文件 hash、lease 或 epoch 不一致时进入
`REPLAN_REQUIRED`，不得在旧语义上继续。

## 反馈闭环

Verifier 的 `REJECTED` 至少写明：`failed_acceptance_id`、`journey_step_id`、expected、
observed、reproduction、artifact hashes、failure class 和 required repair outcome。
Controller 只更新当前 ticket 的 attempt、latest failure 和 next action，并重新计算可运行
DAG。稳定 prompt 不按分钟重写。

若失败说明规范本身错误，不能由 Builder 或 Verifier降低标准；发出 `AUTHORITY_REQUIRED`，
由产品负责人批准新 Goal/journey revision。旧 revision 的工作单随后全部 `REPLAN_REQUIRED`。

## 旧文档处置

当前不批量移动或删除旧文档，避免大规模 Git 变动和丢失有价值事实。第一阶段通过
`document-registry.json` 逻辑隔离：未登记 `docs/**` 一律 `REFERENCE_NO_AUTOLOAD`，旧调度
prompt 和看板退出权威。第二阶段另开只读引用图审计，再把确认废止且无活动引用的材料移动
到 archive。归档是整理任务，不能与功能开发并发修改同一入口。
