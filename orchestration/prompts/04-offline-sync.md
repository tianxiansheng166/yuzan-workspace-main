# Offline/Sync AI 提示词

离线不是简单 Service Worker 缓存。实现前读取状态机和同步架构。

必须覆盖：

- 账号和学校隔离；
- IndexedDB schema/version migration；
- 客户端 operationId；
- 幂等、重试、回执、revision；
- 冲突可见且不丢原始数据；
- 浏览器关闭、网络抖动、重复发送、存储不足；
- 敏感缓存清理；
- 飞行模式 E2E。

禁止默认 last-write-wins。任何合并规则必须写成可测试领域函数。
