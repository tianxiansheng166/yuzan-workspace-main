# 管理端功能梳理、未实现需求与后端数据设计

更新时间：2026-07-18

## 1. 结论与范围

管理端目前有统一外壳和 10 个已接入路由，但“页面能打开”不等于功能已经完成。`admin.html` 的驾驶舱指标已改为请求真实 API；套餐页面已接入 `GET /admin/product-plans`，其套餐卡片和数量会根据真实返回水合，加载失败会显示明确错误；`admin-integration.js` 仍将多个新页面作为静态子页面载入，其他子页面中的列表、筛选、弹窗、切换、导出和测试按钮尚未统一调用 API。因此本记录把 UI 元素、业务动作、数据来源/去向、权限和验收条件拆开，避免用演示数据掩盖后端缺口。

本轮已落地的最小管理闭环：

- `GET /api/v1/admin/dashboard`：按平台或当前学校范围返回学校、用户、学生、教师、已验收提交和待审核课程版本数量。
- `GET/POST /api/v1/admin/schools`、`GET/PATCH/DELETE /api/v1/admin/schools/:id`：学校查询（支持名称/编码、地区、启用状态和数量上限筛选）、创建、更新和软停用；所有写操作写入 `AuditLog`。
- `GET /api/v1/admin/users`：按学校、角色、成员状态和账号/姓名搜索用户，返回脱敏的用户与成员关系。
- `GET /api/v1/admin/users/:id`：返回管理范围内的账号基本信息、成员关系、学校摘要、未撤销会话数量和安全审计摘要；永不返回密码哈希、访问令牌或刷新令牌。
- `POST /api/v1/admin/users/invitations`：为当前学校生成有期限、有次数上限的邀请码，只在创建响应中返回明文邀请码。
- `GET /api/v1/admin/users/invitations`、`POST /api/v1/admin/users/invitations/:id/revoke`：按平台全局或当前学校列出邀请码状态；撤销使用条件更新并写审计，重复撤销返回幂等成功，学校管理员不能操作其他学校邀请码。
- `POST /api/v1/auth/invitations/redeem`：公开兑换入口校验邀请码的学校归属、撤销时间、过期时间和剩余次数；在同一事务中原子占用次数、创建账号并建立学校成员关系，禁止授予 `PLATFORM_ADMIN`；账号创建后必须重新登录，不在公开兑换响应中发放管理员会话。

管理端独立用户页已接入 `GET /api/v1/admin/users`：搜索、角色筛选和成员状态筛选使用真实返回水合表格；未登录/接口失败显示明确错误，仍未实现的编辑、批量导入、角色创建按钮继续标注为待接入。

内容审核独立页已接入 `GET /api/v1/admin/content-review/queue` 和 `POST /api/v1/admin/content-review/:id/decision`：队列只渲染服务端返回的待审核版本，批准/退回/补充证据提交真实审核状态机；未登录、空队列和提交失败不会显示演示成功。
- 隐私与合规独立页已接入 `GET /api/v1/audit/logs` 与 `GET /api/v1/audit/logs/export`：统计、筛选、详情和 CSV 导出均基于真实审计记录；原“标记已评审/确认并记录/升级处理”按钮不再伪造写入，改为提示审计日志只读并引导至隐私请求审批流程。
- 登录注册链路已用当前 4000 后端实测：新账号注册后可立即用同一密码登录；`409` 表示手机号已存在，`401` 表示账号或密码不匹配，前端会清理失效 token 并提示使用注册时原密码。
- 当前 4175 代理所连接的常驻 API 进程仍返回旧的 `PERSISTENCE_PENDING`（例如 `/admin/schools`、`/audit/logs`），与源码中已实现的 Prisma 控制器不同；本轮未停止既有端口，已通过源码单测/构建验证新实现，运行态切换需在受控重载 API 后再做最终浏览器验收。
- 系统运维/供应商页已接入 `GET /api/v1/audit/providers` 和 `GET /api/v1/audit/providers/:id/health`：卡片从真实目录补充供应商 ID、启用状态和脱敏名称；“测试”按钮调用配置级健康检查，失败显示后端错误，不再用定时器伪造“测试成功”。配置/切换按钮明确提示当前写入接口尚未开放，避免误报成功。
- 邀请兑换成功后，服务端按邀请码 `createdByUserId` 创建 `Notification(type=SYSTEM)`，通知原创建者账号已被兑换；接收者由服务端确定，客户端不能指定任意收件人。
- `PATCH /api/v1/admin/users/:id/membership`：修改学校成员的角色或状态，禁止学校管理员修改平台管理员，禁止其授予 `PLATFORM_ADMIN`。
- `GET /api/v1/audit/logs`：按学校租户、动作、资源类型、操作者和时间范围分页查询审计记录；平台管理员显式使用全局范围，学校管理员只能查询当前学校。
- `GET /api/v1/admin/content-review/queue`、`GET /api/v1/admin/content-review/:id`：查询审核队列和版本详情。
- `POST /api/v1/admin/content-review/:id/decision`：批准、退回或要求补充证据；非批准决定必须填写意见，并同步写 `CourseReview`、更新 `CourseVersion` 状态和 `AuditLog`。
- `GET /api/v1/admin/assessment/overview`：按学校返回测评会话各状态、报告数量和被标记题目数量，供测评管理页展示运行态势。
- `GET /api/v1/admin/schools/:id/overview`：为学校运营详情页返回学校基本信息、成员/班级/课程/作业/提交/审核指标和最近审计记录，所有指标固定在该学校范围内。
- `GET /api/v1/admin/curriculum`、`GET /api/v1/admin/curriculum/:id`：管理端课程/测评内容目录与详情；详情沿课程版本关系返回单元、课节、活动、题目、关联作业和审核记录，平台管理员可跨校查看，学校管理员固定当前学校范围。
- `PATCH /api/v1/admin/curriculum/:id`、`POST /api/v1/admin/curriculum/:id/publish`：对草稿/退回版本进行带 `expectedUpdatedAt` 的乐观并发更新；仅审核通过版本可发布，写入发布时间和审计记录。
- `POST /api/v1/admin/curriculum/:id/assignments`：仅已发布课程版本可创建任务；目标班级和学生报名关系必须属于同一学校且处于有效状态，重复/跨校目标拒绝，任务与目标在同一事务中创建并审计。
- `PATCH /api/v1/admin/curriculum/:versionId/activities/:activityId`、`PATCH /api/v1/admin/curriculum/:versionId/questions/:questionId`：仅草稿/退回版本可编辑活动和题目；资源 ID 必须通过课程版本关系树校验，更新后写入审计。
- `POST /api/v1/admin/curriculum/:versionId/activities`、`POST /api/v1/admin/curriculum/:versionId/activities/:activityId/questions`：仅草稿/退回版本可新增活动和题目；课节、活动归属关系必须属于当前版本，创建后写入审计。
- `PATCH /api/v1/admin/curriculum/:versionId/activities/:activityId/reorder`、`PATCH /api/v1/admin/curriculum/:versionId/questions/:questionId/reorder`：使用事务和临时负序号交换同级元素，避免唯一排序键冲突；仍受版本状态和租户关系校验。
- `DELETE /api/v1/admin/curriculum/:versionId/activities/:activityId`、`DELETE /api/v1/admin/curriculum/:versionId/questions/:questionId`：仅未产生学习/测评证据的草稿内容可删除；已有进度、作答或测评项引用时返回冲突，避免破坏历史证据。
- `PATCH /api/v1/admin/curriculum/:versionId/activities/batch`、`PATCH /api/v1/admin/curriculum/:versionId/questions/batch`：一次最多 100 条、禁止重复 ID，先验证所有条目属于同一课程版本，再在事务中临时移出排序号并批量更新。
- `GET /api/v1/audit/logs/export`：复用审计筛选条件导出 CSV；学校管理员只导出当前学校，平台管理员可导出全局范围，CSV 字段做转义且不包含密码、令牌或录音原文。
- `GET /api/v1/admin/users/:id/privacy-export`：按当前管理员可见租户导出用户基本资料、成员关系和学习/测评证据数量；明确排除密码哈希、令牌和原始录音，并写入导出审计事件。
- `GET/POST /api/v1/admin/privacy/requests`、`POST /api/v1/admin/privacy/requests/:id/decision`：隐私导出/删除/冻结请求进入 `PENDING` 审批状态；删除和冻结只能由平台管理员审批，状态转换及原因/意见写入数据库和审计。
- `POST /api/v1/admin/privacy/requests/:id/execute`：仅平台管理员执行已批准的删除/冻结；冻结暂停账号、成员关系并撤销会话，删除执行账号匿名化、成员退出和会话撤销，保留学习证据不物理删除。
- `POST /api/v1/admin/privacy/requests/:id/revoke`：仅平台管理员可撤销已完成的冻结；执行冻结时保存成员原状态快照，撤销时恢复账号和成员状态并将请求置为 `CANCELLED`。删除匿名化没有恢复路径，避免伪造原身份。
- `GET/POST /api/v1/audit/providers`、`PATCH /api/v1/audit/providers/:id`：平台管理员维护语音、翻译、AI、存储供应商目录；返回值只暴露 `secretConfigured`，不返回 `secretRef`，同一类别只能有一个默认供应商。
- `GET /api/v1/audit/providers/:id/health`：执行配置级健康检查并记录 `ProviderHealthCheck`；未配置 endpoint/secret 时标记 `MISCONFIGURED` 并将供应商置为 `DEGRADED`。当前不宣称已完成外部网络连通性探测。
- `GET/POST /api/v1/admin/product-plans`、`PATCH /api/v1/admin/product-plans/:id`：平台管理员维护版本化套餐和权益；编码唯一、权益键不可重复，已退役套餐不可重新启用，写操作写入审计。
- `GET /api/v1/plans`：公开页面只读取 `ACTIVE` 套餐和启用权益，限制返回字段和数量，不泄露内部元数据/停用套餐；订阅配置仍必须由管理端权限接口完成。
- `GET /api/v1/admin/schools/:id/quota-usage`：按当前学校订阅返回权益上限与真实成员、提交、录音计数；未知权益不猜测用量而返回 `used/remaining/percent=null`，平台管理员可跨校、学校管理员只能看当前租户。
- `POST /api/v1/admin/schools/:id/quota-usage/events`：平台管理员可为已启用权益写入带幂等键的计量事件；重复幂等键只返回原事件，配额查询优先汇总该权益的计量事件并标记 `source=METERED_EVENTS`，没有事件时继续使用可验证的实时计数。
- `POST /api/v1/admin/subscriptions/:id/renew`：平台管理员按天数续期未取消/未过期订阅，续期基于当前有效结束时间或当前时间计算，恢复为 `ACTIVE`，关闭自动续费标志并写入 `SubscriptionEvent(type=RENEWED)` 和审计；支付网关确认仍需外部适配器。
- `GET/POST /api/v1/admin/schools/:id/subscription`、`PATCH /api/v1/admin/subscriptions/:id`：按学校租户读取和维护订阅；只能订阅已启用套餐，创建新订阅会取消该校未结束订阅，状态/日期变更写入 `SubscriptionEvent` 和审计。
- `GET/POST /api/v1/admin/privacy/policies`、`POST /api/v1/admin/privacy/policies/:id/activate`：平台管理员维护按资源类型和版本号管理的数据保留策略；同一资源类型只能有一个 `ACTIVE` 版本，激活新版本会把其他活动版本退役。
- `GET/POST /api/v1/admin/privacy/retention-jobs`、`POST /api/v1/admin/privacy/retention-jobs/:id/run`：创建带学校范围、截止时间和 `dryRun` 标志的保留任务；dry-run 只统计并审计，非 dry-run 通过 `StoragePort` 删除录音及分片对象，保留数据库录音/提交/审计元数据；对象存储失败会将任务标记 `FAILED`，不会删除数据库证据。
- `GET/POST /api/v1/admin/schools/import-jobs`、`POST /api/v1/admin/schools/import`、`POST /api/v1/admin/schools/import-jobs/:id/run`：平台管理员按 `fileHash` 幂等提交学校行数据；默认模式同步处理，`async=true` 模式将受控行载荷保存为 `QUEUED` 任务，由显式 run 接口处理，均规范化编码、检测文件内/数据库重复、逐行记录错误并写入审计；真实大文件仍需对象存储上传和外部队列调度。
- `GET/POST /api/v1/admin/assessment-links`、`POST /api/v1/admin/assessment-links/:id/revoke`、`GET /api/v1/admin/assessment-links/:id/accesses`：创建绑定学校、测评标识和班级/学生报名关系的不可猜测链接；数据库只存 token 哈希和预览片段，创建响应一次性返回明文 token；支持过期/次数/撤销状态和访问日志，学校管理员不能跨租户查看。
- `POST /api/v1/assessment-links/resolve`：登录学生解析链接；服务端校验当前租户、目标班级/报名关系、过期时间和次数上限，原子递增使用次数并写入 `RESOLVED`/拒绝原因访问日志，返回 `enrollmentId` 和测评标识供后续创建会话。

这些接口使用真实 Prisma 数据，并依赖会话身份、当前租户和角色守卫；尚未实现的页面功能仍必须保持“待接入”状态，不能由前端 toast 宣称成功。

## 2. 页面与交互逐项分析

### 2.1 `/admin` 管理驾驶舱

用途：让平台管理员查看平台规模、内容审核压力和学校同步状况，并进入各运营模块。

交互与后端要求：

1. “刷新数据”：重新请求 `GET /admin/dashboard`，显示请求中、成功、空数据、超时和无权限状态；指标必须带生成时间，不能继续写死 12/86/2340 等数字。
2. “查看学校管理”与快捷入口：仅做路由跳转；目标页面加载时必须再次做权限检查。
3. 学校状态表：来源为学校、成员、最近同步/审计事件的聚合；只能返回当前管理员有权查看的学校，平台管理员可跨校，学校管理员只能看到自己的学校。
4. 待审核数量：来源为 `CourseVersion.status=IN_REVIEW`，不能使用导航栏固定的数字 5。

数据流：`School/Membership/CourseVersion/Submission/SyncBatch/AuditLog` → dashboard 聚合 → 管理员浏览器；不返回学生姓名、账号密码、录音原文等敏感数据。

### 2.2 `/admin/schools` 地区 / 学校管理

用途：维护平台学校租户和学校运营状态。

1. 地区筛选、学段、状态、套餐、搜索、查询、清空：筛选条件必须映射为 API query；当前 `School` 只有地区编码和活动状态，学段/套餐需新增受审计的组织配置实体后才能实现，不能把前端选项当成已生效。
2. 学校列表/地图切换：列表调用 `GET /admin/schools`；地图需要按 regionCode 聚合，暂不读取精确学生位置。
3. “新增学校”：`POST /admin/schools`，校验 code 唯一、名称长度、时区；成功后返回学校详情并刷新列表，失败显示冲突原因。
4. 行内“查看详情/编辑”：`GET` 后以 `PATCH` 保存；使用版本时间或 `updatedAt` 做乐观并发校验，避免管理员覆盖他人修改。
5. “停用学校”：采用软停用（`isActive=false, deletedAt`），禁止物理删除历史课程、提交、审计和服务记录；停用前检查是否存在未完成的数据迁移/作业。
6. “批量导入”：后端已提供 `SchoolImportJob`、行级错误、幂等文件校验和可选 `QUEUED → PROCESSING → COMPLETED/FAILED` 执行；当前异步模式仍由管理端显式触发 run，真正的对象存储上传、后台队列和大文件自动调度仍待接入。
7. 到期提醒、待处理事项：需要套餐/合同、续期申请、数据异常和导入任务实体；不能从静态数字推断业务状态。

权限：平台管理员可创建、编辑、停用和跨校查看；学校管理员仅能读取当前租户。所有学校级查询必须包含 `schoolId` 条件或明确平台全局权限。

### 2.3 `/admin/school-operation` 学校运营详情

用途：查看单校组织结构、账号构成、活跃度、服务期和审计变化。

1. “编辑学校信息”复用学校 `PATCH`，需要字段级权限和变更前后审计。
2. “查看学校门户”只能跳转到该学校租户上下文，不能仅修改前端角色字符串。
3. 部门/人员搜索与树节点展开：来源为 `Campus/Class/Membership`；增删节点必须有独立组织实体和级联规则。
4. 合同、详情、审计筛选：合同需要 `SchoolAgreement`；审计从 `AuditLog` 按学校、资源类型、时间和操作者过滤，导出必须记录原因。

### 2.4 `/admin/users-roles` 用户与角色

用途：管理学校范围内的账号、成员关系和角色生命周期。

1. 搜索、角色筛选、状态筛选：调用 `GET /admin/users`，按 `Membership.schoolId` 隔离；只返回展示名、账号标识、成员角色和状态等最小字段。
2. “邀请用户”：邀请码生成、列表、撤销、兑换/首次密码设置及兑换成功通知已实现；邮件/短信发送及批量邀请通知仍待接入，兑换时已强制校验过期、撤销和次数上限。
3. “编辑角色/状态”：调用 `PATCH /admin/users/:id/membership`；状态变更应同步撤销会话、通知用户并写审计；角色变更不能绕过学校/平台层级。
4. “查看详情”：需要用户安全事件、成员关系和最近登录摘要；不得返回密码哈希、刷新令牌或完整 IP。
5. 批量导入/导出：必须以异步任务处理并记录 `AuditLog`，导出需脱敏和授权原因。

### 2.5 `/admin/curriculum` 课程与内容管理

用途：管理课程草稿、版本、单元、课次、活动和资源。

1. “创建课程/新建版本”：`Course` 与 `CourseVersion` 建立不可变版本链，创建人绑定 `authorUserId` 和 `schoolId`。
2. 学段筛选、目录排序、列表/网格切换：筛选只改变查询参数；排序基于版本更新时间/状态，不在前端重排伪造。
3. 批量操作、导出：需要选择集权限、异步导出和操作审计。
4. 编辑/提交审核/发布：状态必须遵守 `DRAFT → IN_REVIEW → APPROVED/PUBLISHED`，发布版本不可原地覆盖；审核意见写 `CourseReview`。
5. 资源和离线包：`Resource` 必须校验学校范围、版权状态和 `offlineAllowed`；上传使用预签名 URL，下载使用短时效 URL。

### 2.6 `/admin/assessment-content` 测评内容管理

用途：维护阅读/书面/混合测评的题目内容、评分规则和发布范围。

1. 新建、编辑、复制题目：写入版本化的题库/题目实体；答案键和评分规则不能发送给学生端。
2. 预览与发布：发布前校验题目完整性、资源版权和适龄范围；发布后锁定版本。
3. 筛选、批量启停、删除：删除只能软删除；已被测评会话引用的题目不可物理删除。
4. 与学生/教师数据流：管理员发布 `AssessmentDefinition` → 教师创建 `AssessmentSession` → 学生提交 `AssessmentItem/WrittenAnswer/Recording` → 生成 `AssessmentReport` → 教师和学生按权限查看。

### 2.7 `/admin/assessment-links` 测评链接与二维码

用途：生成面向班级或指定学生的短链接/二维码并管理生命周期。

1. “新建测评链接”：已实现不可猜测 token，绑定 `schoolId、assessmentKey、targetType/targetId、expiresAt、createdBy`，当前 `assessmentKey` 是已发布测评定义接入前的稳定标识。
2. 复制链接/下载二维码：复制的是创建响应一次性返回的 token 路径；数据库不保存明文 token，链接和访问记录可按学校审计；二维码渲染仍由页面层负责。
3. 重新生成、停用：当前已实现撤销，旧 token 立即失效；学生兑换解析已实现，后续创建测评会话仍由现有测评服务负责。
4. 异常访问趋势：来源为链接访问日志，按 token 脱敏聚合；不能把静态近 7 天曲线当真实数据。

### 2.8 `/admin/content-review` 内容审核

用途：审核课程、图片、音视频、翻译和版权证据。

1. 队列筛选与分页：基于 `CourseReview/Resource.rightsStatus` 查询并按风险/截止时间排序。
2. 目录节点、证据标签和播放预览：只加载审核员有权访问的版本资源；音视频播放地址短时效且记录访问审计。
3. 通过/退回/要求补充证据：写入审核决定、意见、操作者和时间；通过后才能推进课程版本状态，退回必须有可行动原因。
4. “对照一致性检查”：需要可追溯的检查结果实体；AI 检查只能作为建议，最终决定由人工确认。
5. “提交包/更多操作”：需要审核包快照和导出审批，不允许直接读取对象存储路径。

### 2.9 `/admin/product-plans` 套餐管理

用途：维护学校可用的产品能力、配额和服务期。

当前已新增 `ProductPlan、PlanEntitlement、SchoolSubscription、SubscriptionEvent`，可支撑套餐发布、权益限制、试用/启用/暂停/过期状态、历史状态事件和带幂等键的配额计量事件；支付、自动续费和账单仍需独立计费适配器。

### 2.10 `/admin/privacy` 隐私与合规

用途：管理数据保留、导出、删除/冻结、未成年人保护和隐私事件。

1. 数据分类、保留期和授权：需要 `DataPolicyVersion`，每次发布版本须可回溯。
2. 导出申请：创建 `PrivacyExportRequest`，二次授权后异步生成脱敏包；下载 URL 短时效并写审计。
3. 删除/冻结：必须区分账号停用、业务数据冻结和法定保留；不能直接删除学生录音、反馈和审计历史。
4. 隐私事件：需要 `PrivacyIncident`、处理人、影响范围、通知记录和关闭条件。

### 2.11 `/admin/system-providers` 系统运维 / 服务提供商

用途：管理语音、翻译、AI、存储、消息服务的配置、健康检查和降级策略。

1. 分类筛选：从 `ProviderConfig.category` 查询，不在前端写死服务状态。
2. 配置/切换：密钥只能来自密钥管理服务；数据库保存引用、版本和掩码摘要，不能保存明文密钥。切换前创建变更记录并执行连通性验证。
3. 测试：创建 `ProviderHealthCheck`，记录目标、耗时、结果、错误码和操作者；禁止把测试成功写死为 632ms。
4. 维护模式：需要受权限保护的 feature flag，影响范围、开始/结束时间和通知必须审计。
5. 降级：供应商不可用时由适配器按策略切换，AI 输出必须保留供应商披露和人工复核状态。

## 3. 管理端核心数据流与隔离规则

### 3.1 租户与账号

`User` 是全局账号；`Membership` 是用户在学校中的角色关系。所有学校级数据必须通过 `schoolId` 直接关联或经 `Membership/Class/Enrollment` 间接关联。平台管理员可跨校聚合，学校管理员只能读取当前 `TenantContext.schoolId`。不得使用前端传入的角色或学校 ID 代替服务端授权。

### 3.2 内容发布到学习链路

`Admin/Researcher` 创建课程或测评版本 → `CourseVersion/AssessmentDefinition` 审核发布 → 教师选择已发布版本创建班级任务/测评会话 → 学生收到与自己 `Enrollment` 匹配的任务 → 学生提交 `Submission/Recording/WrittenAnswer` → 后端生成 `Feedback/AssessmentReport` → 教师查看本班数据，学生只查看自己的结果。每次跨角色查看、导出、播放原始证据写 `AuditLog`。

### 3.3 用户操作与通知

角色/状态变更、学校停用、课程审核、测评发布、供应商切换和隐私导出都要产生审计事件；需要通知用户的动作创建 `Notification`，接收者由服务端根据成员关系确定，不能由客户端指定任意收件人。

## 4. 数据库增量需求

已有模型可直接支撑本轮学校/成员闭环：`School、User、Membership、InviteCode、AuditLog、CourseVersion、Submission`。下一批管理端功能所需实体：

| 优先级 | 实体 | 关键字段/关系 | 数据访问边界 |
|---|---|---|---|
| P0 | `SchoolImportJob` | schoolId、actor、fileHash、status、rowErrors | 平台管理员；导入文件不可跨租户复用 |
| P1 | `AssessmentDefinition/AssessmentItemVersion` | schoolId、版本、发布状态、评分规则 | 管理员/教师读已发布；学生只读题面 |
| P1 | `AssessmentLink/LinkAccessLog` | tokenHash、session/class/enrollment、expiresAt、revokedAt | 访问记录仅管理员；URL 不泄露身份 |
| P1 | `PrivacyExportRequest` | requester、scope、approval、objectKey、expiresAt | 仅本人/合规管理员；下载审计 |
| P1 | `ProviderConfig/ProviderHealthCheck` | category、secretRef、version、status、checkedAt | 平台管理员；密钥不落库 |
| P2 | `ProductPlan/SchoolSubscription` | planVersion、quota、period、status、events | 平台管理员和本校只读摘要 |
| P2 | `DataPolicyVersion/PrivacyRetentionJob` | resourceType、version、retentionDays、cutoffAt、dryRun、scan/redact counts | 平台管理员；学校管理员只能看当前学校任务，实际删除需对象存储执行器 |
| P2 | `PrivacyIncident` | policy、acknowledgement、incident timeline | 合规管理员；学生字段脱敏 |
| P1 | `AssessmentLink/AssessmentLinkAccess` | tokenHash、schoolId、target、expiresAt、revokedAt、access outcome | 管理员按学校查看；URL 不泄露学生身份 |

## 5. 后端验收与未实现清单

已完成：学校/成员基础管理 API、用户详情聚合、用户隐私安全导出、隐私请求创建/列表/审批状态机与批准后执行器、冻结状态快照与平台撤销恢复、学校管理员租户隔离、平台管理员跨校范围、学校列表筛选、学校批量导入同步/可选异步任务（幂等哈希和行级错误）、邀请码生成/列表/撤销与兑换/首次密码设置、成员权限变更时会话撤销、审计日志分页查询与 CSV 导出、课程审核队列/详情/决定 API、课程/测评内容目录与详情 API、课程元数据并发更新与审核后发布 API、已发布课程任务创建与目标校验 API、活动/题目关系校验、创建、编辑、事务排序、证据保护删除与批量更新 API、测评运行态势聚合、学校运营详情聚合、供应商目录与配置级健康检查、套餐/权益目录、学校订阅状态和订阅事件、订阅续期事件、公开启用套餐查询、学校配额实时计数与幂等计量事件、数据保留策略版本、租户范围扫描/dry-run 与对象存储执行器、测评链接 token 生命周期、学生兑换权限校验与访问审计、写操作审计；管理控制器单测 38/38、邀请码兑换单测 2/2、测评链接单测 2/2、公开套餐单测 1/1、审计控制器单测 3/3 通过。

驾驶舱前端已同步改为读取 `GET /api/v1/admin/dashboard`，接口未加载或无权限时显示 `—` 和错误提示，不再把演示数字当成真实指标。

验证边界：当前 `@yuzan/api` typecheck 与 build 均通过；全量测试仍可能触发已有的 Submissions 依赖注入失败和本地 PostgreSQL `unused` 凭据失败。当前运行中的 4000 进程没有重启，实际请求仍返回旧的 `PERSISTENCE_PENDING`，必须由运行维护者在确认窗口内正常重启 API 才会加载本次构建产物。

仍未完成且不得标记为“已接入”：

- 管理端集成壳中的学校列表及其筛选、分页、编辑弹窗前端仍需统一水合到真实 API；独立学校页面已接入 `/admin/schools` 列表请求并在无权限/失败时显示明确错误（驾驶舱指标已接入真实 API，接口不可用时显示 `—`）；
- 地区/学段/套餐筛选、合同和到期提醒（学校批量导入任务、幂等校验和行级错误已实现，仍需真实文件对象存储与异步队列接入）。
- 邮件/短信发送、批量邀请通知、兑换成功后的会话撤销通知；
- 课程活动/题目的批量删除（当前已提供活动/题目新增、单项更新、事务排序、受证据保护的删除和批量更新 API）；
- 数据保留执行器已支持租户范围扫描、dry-run 审计和通过 `StoragePort` 的对象/分片删除；仍待接入证据保留豁免规则、异步队列和合规工单联动；冻结的状态快照与平台管理员撤销接口已实现，删除匿名化仍不可逆。
- 供应商密钥引用、健康检查、切换和降级适配器；
- 套餐的计费支付、自动续费执行器、账单和到期通知（套餐/订阅/权益目录、订阅状态事件及配额计量事件 API 已实现）。
- 管理端审计日志 UI 的真实筛选控件、分页状态和下载交互（后端查询与 CSV 导出接口已实现）；
- 跨学校负向测试、敏感字段脱敏测试、并发更新/幂等测试。

每个未实现按钮必须覆盖正常、加载、空、错误、离线和无权限状态；API 必须增加跨学校、非本人、低权限角色的拒绝测试。迁移采用向前兼容字段，回滚先关闭路由/功能开关，不删除历史审计或学习证据。
