# Stream D：AI 测评五页

v2.1 中本流只负责测评，不再同时拥有公共首页、志愿者和学校管理。

## 路由

以当前仓库实际路由为准：

- assessment entry；
-reading；
-written；
-report；
-history。

创建文件前先扫描 `apps/web/app/pages/assessment`，禁止重复路由。

## 只改呈现

保护：

- speech provider interface；
-recording/upload；
-analysis state；
-consent/privacy；
-auth；
-contract；
-offline save。

## 目标

- 朗读页像可靠测量设备；
- listening/calibrating/recording/analyzing/result 有清晰状态；
-无 provider 时不生成假分数；
-书面作答可保存；
-报告展示证据和建议；
-历史对比可解释。

返回 `FRONTEND_STREAM_D_READY`，附接口比较结果。
