# 前端与既有开发任务的连接

## 总原则

前端视觉不是新业务分支。页面必须基于最新业务语义改造。

## 合并优先级

```text
approved business/API behavior
→ Web API/state commit
→ Foundation
→ page visual migration
```

同一文件冲突时，保留 API 请求、auth、error、offline 和状态机，然后迁移视觉 template。

## 现有任务

- ACC_UI-001：继续做 Foundation；
- ACC_WEB_AUTH-001：原 owner 保留业务语义，Foundation 后做视觉适配；
- QST-001：拥有 exercises 语义，Student Stream 暂不抢占；
- OFF：拥有 offline runtime/outbox；
- Speech：拥有 provider/upload/privacy；
- Curriculum/Assignment/Learning/Submission：业务 gateway/state 受保护；
- 后端持久层尚未批准时显示真实 unavailable。

## 禁止

- 为了截图恢复 demo gateway；
- 静态数组代替 API；
- 假登录；
-假保存；
-假 AI 评分；
-删除冲突测试；
-修改 contract 适配页面。
