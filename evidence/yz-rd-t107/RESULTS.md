# YZ-RD-T107 — T106 五服务资源上限

## 结论

- **STATUS: PASS** — T106 五个指定容器均保持运行；CPU、内存、PID 的 Docker 配置与有效 cgroup 上限一致且有限。
- **EXACT_BASE:** `9b0276810e7cc5dd96acf16070ab3a751824daec`
- **OUTPUT_BRANCH:** `ops/yz-rd-t107-t106-five-service-resource-bounds`
- **OWNER_ACK: YES** — 本卡明确授权接收方 Owner 手动派发 Codex 仅处理 YZ-RD-T106。
- **VERIFIED_BOUNDARY: YES** — 更新前逐个核实 `com.docker.compose.project=yz-rd-t106` 和对应 service 标签；只对以下五个完整 ID 执行 `docker update`。
- **READY_TO_MERGE: NO**；未合并、未部署。历史 L4 事件仍打开。

详细逐容器 before/after Docker inspect、cgroup 用量、CPU 采样、Compose 限额摘要和跨项目快照见 [`resource-receipt.json`](resource-receipt.json)。

## 五服务限额

| 服务 | 完整容器 ID | CPU | RAM | 总 memory+swap | PID | 有效 cgroup 上限 |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| frontend | `a2a31f67ca2dcfca6e949c6cd4d4dfcd1c86c76dc1efdbe05c04c1afc445ea20` | 0.5 | 384 MiB | 768 MiB | 128 | `50000 100000` / `402653184` / `128` |
| api | `69e1519eef2d8145c463fb9b76816bcb2b93e06f93343591b2f0dc8d23f3870a` | 1.0 | 768 MiB | 1536 MiB | 192 | `100000 100000` / `805306368` / `192` |
| postgres | `9b3182528732f3a9af0049db44223863225883ae8e455761ab0095285c87704e` | 1.5 | 1024 MiB | 2048 MiB | 256 | `150000 100000` / `1073741824` / `256` |
| redis | `c130375c6aa9868383c2075b7125b95bb17f5c85513c4b97bc5fddc3d66a2605` | 0.5 | 128 MiB | 256 MiB | 64 | `50000 100000` / `134217728` / `64` |
| minio | `69d3a264bc8b12c22afc06451d8e677d9f505a60143a868b92dbc4aa7ad6bd58` | 1.0 | 768 MiB | 1536 MiB | 192 | `100000 100000` / `805306368` / `192` |

顺序为 `cpu.max / memory.max / pids.max`。总预算为 **4.5 CPU、3 GiB RAM、832 PIDs**，另有有限的 3 GiB aggregate swap ceiling。Compose `cpus` 映射到 Docker inspect 的有限 `NanoCpus`；`CpuQuota`/`CpuPeriod` 字段保持 0，`cpu.max` 实测为有限配额。

## 依据和执行

- 更新前五个容器完整 ID、T106 project/service 标签、启动时间和数据挂载均核实。初始 Docker inspect 对五个服务均为 `NanoCpus=0, Memory=0, PidsLimit=null`；有效 `cpu.max=max 100000`、`memory.max=max`，`pids.max=38022`（该 PID 值是继承上限，不是服务 HostConfig 限额）。
- 启动后的 cgroup 内存峰值分别为 frontend 34.9 MB、API 185.4 MB、PostgreSQL 73.4 MB、Redis 11.5 MB、MinIO 94.2 MB。最终 RAM 限额约为这些观测峰值的 4.3–14.6 倍；PID 限额约为全程观测峰值的 4.9–12.8 倍。
- 基线短采样的 CPU 峰值分别为 0.07%、20.77%、1.62%、0.45%、0.85%。采样覆盖 readiness 和只读媒体读取，不代表压力测试。
- `docker update` 第一次仅传 RAM 限额时被 Engine 拒绝，提示必须同时提供 memory-swap；事后 inspect 确认 frontend 仍运行且原状态未变。随后为每个服务在 Compose 中显式持久化 `memswap_limit=2×mem_limit`，逐个对完整 ID 执行 in-place `docker update`，每个服务后立即检查健康和 cgroup。
- 资源决策时 T106 有约 147 MiB 当前 swap 页；最终采样约 142.5 MiB。因此保留非零、有限 swap。最终每个 `memory.swap.max` 等于该服务 RAM cap，没有压低到观测使用量以下。
- 所有容器 `StartedAt` 保持不变、`RestartCount=0`、`OOMKilled=false`，cgroup `memory.events` 中 OOM 计数为 0。PostgreSQL/Redis 原健康检查正常；frontend/API/MinIO 分别返回 HTTP 200。

## 持久化配置和数据

- 仅在 `/home/tian/.devspace/runtime/yz-rd-t106/compose.yaml` 五个服务 stanza 中持久化 `cpus`、`mem_limit`、`memswap_limit`、`pids_limit`。该外部 runtime 文件未纳入 Git。
- `docker compose config` 解析结果与运行容器一致。网络、loopback 端口、PostgreSQL/MinIO 命名卷、env 文件声明和现有健康检查保持不变。
- PostgreSQL 命名卷 `yz-rd-t106-postgres-data` 仍挂载，前后只读计数一致：1 school、2 courses、3 course versions、3 assignments、4 activity progress、1 resource、1 active membership。
- MinIO 命名卷 `yz-rd-t106-minio-data` 仍挂载；bucket `yz-rd-t106-media` 存在。通过 API 容器凭据进行只读直连 S3 对象读取，得到 1,128,375 bytes，SHA-256 `0cd83d944a6ca7822b4a8306cecc60a36e859b041f6702c6a1ad9ead78924451`，与 T106 接受记录一致。
- 只做了无损 readiness、数据计数和对象读取；**没有重跑 T106 原生 E2E**。没有读取或输出学生密码、token、对象 key 或环境变量值。

## 宿主机和跨项目边界

- 宿主机为 16 CPU、约 31.2 GiB RAM。最终采样时 `MemAvailable=12,146,328 KiB`、`SwapFree=6,153,936 KiB`、`pid_max=4,194,304`；T106 的 cgroup RAM 当前合计约 229 MB，RAM 硬上限合计 3 GiB。
- 同一时段观察到两个独立的非 T106 容器，各自 RAM cap 为 4 GiB；它们的当前 cgroup RAM 合计约 2.75 GiB。若这两个容器和 T106 同时达到配置上限，估算仍约有 3.5 GiB 主机 RAM available。该估算使用 cgroup `memory.current`，不把 `docker stats` 的缓存扣减值当作硬占用。
- T106 CPU 上限合计 4.5 核；当时另外两个运行容器的 CPU 配置合计 2.5 核。宿主机负载在观察期间变化较大，曾见明显 I/O wait；此处报告的是上限预算，不声称预留了即时 CPU 空闲。
- **未修改任何 AutoAim 容器、其他开发容器、Docker daemon 全局配置或共享服务。** 观察期间非 T106 容器 ID 有外部生命周期变化；初始 `rm-test` 容器后来消失，出现过同镜像短暂容器，之后 T062 AutoAim ID 也变化。T107 没有针对任何非 T106 ID 发出 update/stop/restart/remove；变化原因未知，完整快照在 `resource-receipt.json`。

## 边界状态

- T040/T031 没有由 T107 重新申请或执行；AutoAim Owner 收到五服务实证后应独立申请新准入。未修改 AutoAim repo。
- `L4_SOURCE_READ=NO`；`L4_IMPORT_APPLIED=NO`；`L4_RUNTIME_OPENED=NO`。
- **ISSUE_3_COMMENT_URL:** https://github.com/tianxiansheng166/yuzan-workspace-main/issues/3#issuecomment-6321908178。Issue #3 已收到五服务收据，保持 OPEN。
- 没有发现 published T106 端口上的已建立 host TCP 客户端，T106 网络只有五个服务容器；早期 PostgreSQL 只读快照没有其他 client session。此前接受的 T106 课程播放 E2E 是该服务先前的测试消费者证据；本任务不声称当前有用户流量。按本卡保留在线。
- `CURRENT_HANDOFF.md` 仅追加本任务事实 checkpoint；无业务源码更改。
