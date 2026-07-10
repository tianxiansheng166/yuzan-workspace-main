# Stream E：公共扩展、志愿者、培训、翻译与管理

## 启动时机

核心 A/AUTH/B/C/D 可预览后再启动。

## 负责

仅处理当前仓库真实存在或已批准新增的：

- volunteer；
-training；
-translation entry；
-products；
-admin。

## 不负责

- 首页；
-login/select-school；
-teacher/student/assessment；
-后端 API；
-权限和多租户。

缺少 API 时显示 unavailable，不创建假公益数字、假学校和假志愿者记录。

返回 `FRONTEND_STREAM_E_READY`。
