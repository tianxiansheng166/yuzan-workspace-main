# 与前面任务的连接方式

## 不推翻的任务

以下成果继续保留：

- ACC_ROOT-001；
- ACC_IDN-DB-001；
- ACC_DB-RUNTIME-001；
- ACC_ORG-DB-001；
- ACC_CUR-DB-001；
- ORG/ASN/LRN；
- QST/SUB；
- Offline；
- Speech；
- Reporting；
- Web Auth/API client；
- 页面元数据修复。

设计包只改变前端呈现策略，不改变这些任务的接口和安全结论。

## ACC_UI-001

不重新开第二个 Foundation 分支。

原分支继续使用，加入 v2.1 设计包后：

- 重建 Token；
- 重建 AppShell；
-重做首页；
-提供共享视觉组件；
-冻结公共接口；
-不重写 auth、课程、任务、学习和测评状态。

## ACC_WEB_AUTH-001

继续由原 owner 维护：

- API client；
-cookie/session；
-refresh；
-route middleware；
-学校选择；
-error handling。

Foundation 完成后，原 owner 追加视觉适配，不创建重复 auth 分支。

## QST-001

若 QST 同时修改 Web exercises：

- Student Stream 第一波不拥有 exercises；
- QST owner 完成后将 exercises 视觉迁移到 Foundation；
- integration controller 不通过删除 QST state 解决冲突。

## Offline / Speech

- Student Stream 只消费 offline public state；
- Assessment Stream 只消费 speech/provider public interface；
- 不修改 runtime、outbox、上传和 provider 语义。

## 后端尚未批准

页面可以开发：

- layout；
- loading；
- empty；
- permission；
- unavailable；
-离线等待；
-静态艺术层。

页面不能：

- 假保存；
-假登录；
-假评分；
-假发布；
-静态数组冒充数据库。
