# 并发任务依赖图

## Wave 0

- **GOV-001 初始化 monorepo 与开发环境** — `READY` — 依赖：无
- **GOV-002 冻结 OpenAPI v1 基线** — `READY` — 依赖：无
- **GOV-003 冻结 Prisma MVP 数据模型** — `READY` — 依赖：无
- **GOV-004 建立设计 token 与基础原语** — `READY` — 依赖：无
- **GOV-005 建立 CI 与仓库保护基线** — `BLOCKED` — 依赖：GOV-001
- **GOV-006 安全与租户授权基线** — `BLOCKED` — 依赖：GOV-001, GOV-002, GOV-003

## Wave 1

- **IDN-001 身份登录与会话 API** — `BLOCKED` — 依赖：GOV-001, GOV-002, GOV-003, GOV-006
- **IDN-002 登录与会话 Web** — `BLOCKED` — 依赖：GOV-002, GOV-004
- **ORG-001 学校、成员、班级 API** — `BLOCKED` — 依赖：GOV-002, GOV-003, GOV-006
- **CUR-001 课程版本与发布 API** — `BLOCKED` — 依赖：GOV-002, GOV-003, GOV-006
- **CUR-002 教研内容工作台 Web** — `BLOCKED` — 依赖：GOV-002, GOV-004
- **CLS-001 教师班级工作区 Web** — `BLOCKED` — 依赖：GOV-002, GOV-004
- **WEB-001 统一应用壳与角色导航** — `BLOCKED` — 依赖：GOV-004
- **MIG-001 旧资产分类与脱敏导出** — `READY` — 依赖：无

## Wave 2

- **ASN-001 任务编排 API** — `BLOCKED` — 依赖：ORG-001, CUR-001
- **ASN-002 任务编排 Web** — `BLOCKED` — 依赖：GOV-002, GOV-004, CLS-001
- **LRN-001 今日任务与学习 API** — `BLOCKED` — 依赖：ASN-001
- **LRN-002 学生今日页与学习播放器** — `BLOCKED` — 依赖：GOV-002, GOV-004, WEB-001
- **QST-001 练习题与作答** — `BLOCKED` — 依赖：CUR-001, LRN-001
- **SUB-001 提交与教师反馈 API** — `BLOCKED` — 依赖：LRN-001, QST-001
- **SUB-002 教师复核工作台 Web** — `BLOCKED` — 依赖：GOV-002, GOV-004, CLS-001
- **OFF-001 PWA 与最小本地存储** — `BLOCKED` — 依赖：GOV-001, WEB-001
- **DES-001 首页与学生端品牌视觉资产** — `BLOCKED` — 依赖：GOV-004
- **DES-002 自定义核心图标系统** — `BLOCKED` — 依赖：GOV-004

## Wave 3

- **OFF-002 客户端 Outbox 与同步状态机** — `BLOCKED` — 依赖：OFF-001, LRN-002, SUB-001
- **OFF-003 服务端同步 API 与冲突处理** — `BLOCKED` — 依赖：GOV-003, SUB-001
- **SPH-001 录音采集与本地质检 Web** — `BLOCKED` — 依赖：GOV-004, LRN-002, OFF-001
- **SPH-002 语音任务与供应商适配 Worker** — `BLOCKED` — 依赖：GOV-002, GOV-003, SUB-001
- **SPH-003 语音基准数据集与评测** — `BLOCKED` — 依赖：SPH-002
- **RPT-001 学习事件与指标管道** — `BLOCKED` — 依赖：SUB-001, OFF-003
- **RPT-002 学生成长与教师干预报告 Web** — `BLOCKED` — 依赖：GOV-002, GOV-004
- **MIG-002 课程与双语内容转换** — `BLOCKED` — 依赖：MIG-001, CUR-001
- **MIG-003 媒体资产迁移与版权台账** — `BLOCKED` — 依赖：MIG-001, CUR-001

## Wave 4

- **SEC-001 安全威胁建模与渗透回归** — `BLOCKED` — 依赖：IDN-001, ASN-001, SUB-001, OFF-003, SPH-002
- **OPS-001 部署、健康、日志与指标** — `BLOCKED` — 依赖：GOV-001, GOV-005
- **OPS-002 备份恢复与数据保留演练** — `BLOCKED` — 依赖：OPS-001, RPT-001
- **QA-001 核心教学闭环 E2E** — `BLOCKED` — 依赖：CUR-001, ASN-001, LRN-001, SUB-001, CUR-002, ASN-002, LRN-002, SUB-002
- **QA-002 离线与同步 E2E** — `BLOCKED` — 依赖：OFF-002, OFF-003
- **QA-003 视觉、可访问性与性能验收** — `BLOCKED` — 依赖：IDN-002, CUR-002, ASN-002, LRN-002, SUB-002, RPT-002, DES-001, DES-002
- **CMP-001 比赛证据包与演示环境** — `BLOCKED` — 依赖：QA-001, QA-002, SPH-003, RPT-001
- **PIL-001 试点运行与四周复盘** — `BLOCKED` — 依赖：QA-001, SEC-001, OPS-002

## 推荐并发槽位

- Integration/Contract/Schema/Design/CI 各自独立，Wave 0 最多 4–5 个槽位。
- Wave 1 可并行：身份 API、课程 API、组织 API、Web 壳、课程工作台 mock、迁移。
- Wave 2 以 API 契约冻结为前提；Web 可先接 mock，合并前必须接真实 API。
- Offline、Speech、Reporting 各有独立负责人，但共享状态/错误需要 Contract Owner。
- QA 从 Wave 1 就编写测试，不等到最后突击。
