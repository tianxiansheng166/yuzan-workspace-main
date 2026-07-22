# 夜间执行 · 需人工执行的命令

> 以下操作无法由自动化脚本完成，需要人工在终端执行或审批。

## 1. 重启服务（代码变更后必须执行）

### frontend（前端服务器）
```powershell
# 查找并停止旧进程
$pid = (Get-NetTCPConnection -LocalPort 4175 -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess
if ($pid) { Stop-Process -Id $pid -Force }

# 启动新进程
cd D:\program\test_program\yuzanxinsheng\three\yuzan-next\frontend
node server.mjs
```

### API 后端
```powershell
# 查找并停止旧进程
$pid = (Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess
if ($pid) { Stop-Process -Id $pid -Force }

# 启动新进程
cd D:\program\test_program\yuzanxinsheng\three\yuzan-next
npx nx serve api
```

## 2. 数据库操作（一次性，已完成）

### 创建 AssessmentItems
```powershell
# 通过 docker exec 直接执行 SQL（绕过 Prisma 客户端模块解析问题）
Get-Content D:\program\test_program\yuzanxinsheng\three\yuzan-next\docs\night-run\create-items.sql -Raw | docker exec -i yuzan-four-port-postgres-55432 psql -U yuzan_dev -d yuzan_dev
```

## 3. 浏览器验证（需人工操作麦克风）

录音功能需要真实麦克风权限，无法在无头浏览器中自动测试。
人工验证步骤：

1. 打开 http://127.0.0.1:4175/login
2. 用 `student.test` / `YuzanTest!2026` 登录
3. 导航到 http://127.0.0.1:4175/assessment/sessions/c9b5b37b-728d-4631-a695-c56238a114d9/
4. 确认显示"测评准备"页面，含 2 个测评项（朗读 + 书面）
5. 点击朗读项，进入录音页面
6. 点击"开始录音"，对麦克风说话
7. 点击"结束录音"，试听确认
8. 点击"确认并上传"，观察上传进度条
9. 等待上传完成，确认进入处理状态页面
10. 进入书面题页面，输入答案，点击"完成书面题"
11. 提交整次测评
12. 确认提交成功，跳转到处理状态页面

## 4. 已知限制（BLOCKED 功能）

| 功能 | 原因 | 何时解除 |
|---|---|---|
| 暂停测评 | 后端 AssessmentSession 状态机不支持 PAUSED/RESUMED | 需后端新增状态转换 |
| 延长时间 | 后端不支持 EXTENDED 状态 | 需后端新增时间延长逻辑 |
| 重试评分 | SpeechJob retry 接口未实现 | 需后端新增 POST /speech-jobs/:jobId/retry |
| 测评副本 | 后端无 clone/copy 端点 | 需后端新增副本创建逻辑 |
| 志愿者在线申请 | 后端志愿者模块 API 未完全实现 | 需后端完善 volunteer 模块 |
| 教研在线提交 | 后端教研模块 API 未完全实现 | 需后端完善 research 模块 |
