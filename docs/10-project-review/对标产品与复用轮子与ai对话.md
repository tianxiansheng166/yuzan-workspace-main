问：现在的话是叫你找一下竞品方面的关系,然后找一下对标产品,然后就是把我们每一个功能啊,每一个端口啊,都进行拆分,找一下市面上最方面做得很成熟的产品,然后就学一下他们功能。还有现在的话,我现在做的这个项目还属于重复造轮子,你找一下市面上的做得好的一些开源项目,就是找一下前面他们做的那些轮子,然后我们可以拿他们的轮子过来直接用就行了,就不用自己重复造轮子。
答：## 核心结论

你的项目**确实存在重复造轮子的部分**，但不是整个项目都该被开源 LMS 替换。

最合理的路线是：

> **保留一个很薄的自研业务核心，把身份认证、文件上传、互动题型、通知、报表、可观测性、AI 审计、语音识别等通用能力交给成熟开源组件。**

不建议直接把项目整体改成 Moodle、Open edX 或 Canvas，因为你的差异化不在“课程列表、作业表单、用户管理”，而在：

* 西藏农牧区学校场景；
* 弱网与离线学习；
* 藏汉语言教学内容；
* 学生朗读原始证据；
* 语音评分与教师复核；
* 学校、班级、学生之间严格的数据范围；
* 从学习任务到成长干预的证据链。

这些才是你应该自己掌握的核心。

---

# 一、整体竞品关系

## 1. 综合 LMS 对标

### Moodle

适合学习：

* 课程组织；
* 学员注册；
* 作业、测验；
* 成绩册；
* 能力模型和学习计划；
* 移动端离线学习。

Moodle 移动端支持下载课程、离线学习和提交作业，是你学生端离线体验的重要参考。([Moodle][1])

**定位：功能对标，不建议将现有系统整体迁移过去。**

---

### Canvas LMS

Canvas 最值得学习的是：

* Assignment 作业模型；
* Gradebook 成绩册；
* SpeedGrader 教师批阅；
* Rubric 量规；
* 音视频反馈；
* 匿名批阅；
* 按学生或班级差异化布置任务。

SpeedGrader 可以把学生作业、批注、评分量规、音视频评语集中在一个批阅工作流中，这和你的“提交—反馈—成长报告”高度对应。([Instructure][2])

**定位：教师端提交复核的首要产品对标。**

---

### Open edX

适合学习：

* Studio 课程编辑器；
* 课程版本和发布；
* 学习单元组织；
* 内容组件化；
* 学习分析；
* LMS 和课程制作端分离。

Open edX 本身也是以模块化单体、独立服务和前端模块组合形成平台，说明大型教育系统不需要把每个功能都拆成单独微服务。([Open edX][3])

**定位：教师课程工作室和课程发布流程的主要对标。**

---

### Frappe Learning / Frappe Education

Frappe Learning 已包含视频课程、测验、作业、讨论和班级批次；Frappe Education 则覆盖学生、教师、入学、费用、课程表、考试和学生门户。([Frappe 文档][4])

**定位：学校管理、成员管理、班级和教务后台的参考。**

不建议把大量时间投入自研通用“学校信息管理系统”。

---

## 2. 弱网和农村学校对标

### Kolibri

Kolibri 是与你的目标场景最接近的开源产品。

它专门面向：

* 农村学校；
* 低资源地区；
* 无互联网或间歇性联网；
* 本地课堂服务器；
* USB、硬盘传输内容；
* 低配置和老旧设备；
* 教师创建测验和组织学习资源。

Kolibri 可以完全离线工作，也支持在本地网络中由一台设备向教室内其他设备提供内容。([Kolibri][5])

**定位：你的离线架构和校内边缘节点的第一对标产品。**

但不要复制其全部代码。更适合：

* 研究它的内容包；
* 研究校内服务器；
* 研究内容导入、分发和同步；
* 甚至把 Kolibri 作为部分学校的独立内容节点进行集成。

---

## 3. 中文课堂和教学互动对标

### 希沃

适合学习：

* 教师备课；
* 学科工具；
* 课堂互动；
* 课堂小游戏；
* 云端课件；
* 课堂反馈。

希沃白板的优势不是传统 LMS，而是把“课件、互动工具、课堂活动”放在同一个教师操作环境中。([希沃白板][6])

### ClassIn

适合学习：

* 实时课堂；
* 师生互动；
* 云盘与教学资料；
* 混合式教学；
* 课堂行为与数据记录；
* LMS 与直播课堂的结合。([ClassIn][7])

**定位：中长期课堂教学体验参考，当前不建议优先开发直播课堂。**

---

## 4. 朗读和语音评测对标

### Microsoft Reading Progress / Reading Coach

这是你学生朗读模块最值得深入研究的产品之一。

它覆盖：

* 教师布置朗读任务；
* 学生录音；
* 自动识别错误词；
* 正确率；
* 每分钟朗读词数；
* 流利度；
* 困难词训练；
* 教师人工修订结果；
* 学生重新提交；
* 班级和学校层级洞察。([Microsoft Learn][8])

### ELSA

适合学习：

* 音素级反馈；
* 实时发音反馈；
* 个性化练习；
* 教师布置任务；
* CEFR 或教材对齐；
* 学校管理 Dashboard。([ELSA Speak][9])

### 科大讯飞 E 听说、智能语音评测

适合学习：

* 听说教学、练习、测试、评价一体化；
* 单词、句子、篇章朗读评测；
* 班级同时口语训练；
* 大规模考试；
* 教师纠错和分析。([科大讯飞智慧教育][10])

**定位：Microsoft 学习产品流程，讯飞学习中文语音评测和规模化考试，ELSA 学习实时反馈体验。**

---

# 二、当前每个运行端口怎么拆

一个重要原则：

> **不要为每个业务功能单独开放端口。端口应当代表清晰的运行服务，而不是每一个页面或业务模块。**

你当前采用 NestJS 模块化单体是合理的。课程、班级、作业、提交、反馈和报告继续放在 API 内，不需要立即拆成六七个微服务。

| 当前端口    | 当前职责             | 建议                |
| ------- | ---------------- | ----------------- |
| `4175`  | 静态前端、页面路由、API 代理 | 保留；逐步组件化，不急于再次重写  |
| `4000`  | NestJS 业务 API    | 保留为业务核心模块化单体      |
| `55432` | PostgreSQL       | 继续使用，不需要自研替代      |
| `6380`  | Redis、BullMQ     | 继续使用，统一异步任务和重试    |
| `59000` | MinIO 文件 API     | 继续使用，增加可恢复上传协议    |
| `59001` | MinIO 管理控制台      | 仅运维使用，不向普通用户开放    |
| `4300`  | Flowise AI 工作流   | 保留工作流编排，补充审计和评测   |
| `8100`  | 语音评分 Python 服务   | 保留独立边界，内部替换成熟语音组件 |

建议形成以下结构：

```text
浏览器 / PWA
        │
        ▼
frontend :4175
        │
        ▼
NestJS API :4000
   ├── PostgreSQL :55432
   ├── Redis / BullMQ :6380
   ├── MinIO :59000
   ├── Speech Service :8100
   ├── Flowise :4300
   ├── 身份认证服务
   ├── 通知服务
   ├── 报表与 BI
   └── 可观测性系统
```

身份、通知、BI、监控可以是独立容器，但不需要把班级、课程、作业等领域拆出去。

---

# 三、每个功能域对应的成熟轮子

## 1. 登录、会话、角色、学校成员

### 可选轮子

* **Logto**：OIDC、OAuth 2.1、组织、多租户、RBAC、组织令牌，技术栈为 TypeScript。([Logto 文档][11])
* **Casdoor**：OIDC、SAML、CAS、LDAP、SCIM、WebAuthn、MFA，Apache 2.0。([GitHub][12])
* **Keycloak**：成熟的开源 IAM、单点登录和身份代理。([Keycloak][13])

### 建议

* 中小规模、自托管和 TypeScript 团队：优先评估 **Logto**。
* 需要和国内学校 LDAP、CAS、企业身份系统结合：评估 **Casdoor**。
* 大型政企部署和复杂联合身份：使用 **Keycloak**。

但以下逻辑仍然要自己保留：

* 当前学校；
* 班级范围；
* 学生只能查看自己的提交；
* 教师只能访问授课班级；
* 资源归属学校验证。

IAM 只解决“你是谁”，不能替代“你能访问哪一份学生数据”。

---

## 2. 学校、班级、成员、入学关系

### 产品参考

* Canvas；
* Moodle；
* Frappe Education。

### 建议采用标准

使用 **OneRoster** 作为用户、课程、班级、入学关系和成绩交换格式。OneRoster 定义了 CSV 和 REST 方式交换用户、课程、注册关系及成绩。([1EdTech][14])

这样以后接学校现有教务系统时，不必为每所学校重新设计导入格式。

---

## 3. 课程编辑、课时和学习活动

### 产品对标

* Open edX Studio；
* Moodle；
* 希沃白板。

### 直接复用

使用 **H5P** 处理：

* 互动视频；
* 选择题；
* 填空；
* 配对；
* 时间轴；
* 互动演示；
* 小游戏；
* 可导入导出的教学活动。

H5P 是 MIT 许可的开源互动内容框架，并已有 Moodle、Canvas 等平台集成。([H5P][15])

### 建议

你的课程模型继续负责：

```text
课程版本
→ 单元
→ 课时
→ 活动
→ 资源
```

活动的具体互动内容不要全部自研，可增加：

```text
activity.type = H5P
activity.externalContentId
activity.packageVersion
```

由 H5P 提供互动题型，你负责学校范围、课程发布和学习记录。

---

## 4. 作业、提交、教师批阅

### 产品对标

直接以 **Canvas SpeedGrader** 为母版：

* 左侧学生列表；
* 中间原始作业和录音证据；
* 右侧评分量规、评语和状态；
* 快速切换下一位学生；
* 文字、语音反馈；
* 退回修改；
* 人工覆盖自动评分。([Instructure Community][16])

### 建议

这一部分不适合引入整套 Canvas 代码，应该：

* 学习它的工作流；
* 保留现有 Submission、Feedback 数据模型；
* 自己实现符合你视觉和学校数据范围的批阅页面。

这是“学产品”，不是“搬代码”。

---

## 5. 通用测验和考试

### 可复用轮子

* **TAO Community Edition**；
* **QTI 标准**。

QTI 是测验题目、试卷和结果交换标准，TAO 是成熟的开源电子考试平台，支持 QTI 和大规模考试场景。([1EdTech][17])

### 建议

不要再自己发明完整题目 JSON 格式。

至少支持：

* QTI 导入；
* QTI 导出；
* 选择、填空、匹配、排序等通用题型；
* 自研扩展题型：朗读、口语、录音证据。

TAO 可以：

1. 作为独立考试服务接入；
2. 或仅用于内容制作、导入导出；
3. 不建议直接复制其 AGPL 代码到核心仓库。

---

## 6. 录音、断点续传和对象存储

你已经使用 MinIO，但录音上传协议没有必要继续自己造。

### 推荐组合

* **Uppy**：浏览器上传 UI、状态和进度；
* **tus**：HTTP 可恢复上传协议；
* **tusd**：成熟的 tus 服务端，可接 S3 兼容存储；
* **MinIO**：最终对象存储。

tus 支持通过偏移量恢复上传、校验和扩展，特别适合网络不稳定环境；Uppy 可以暂停并恢复上传，tusd 可作为生产级参考服务并连接 S3 存储。([Tus][18])

建议将当前自研的：

```text
init
→ chunk upload
→ complete
```

逐步换成标准 tus 流程，而不是继续维护自定义分片协议。

---

## 7. 离线数据库和同步

### 主要对标

* Kolibri：离线内容包和校内节点；
* RxDB：客户端本地数据库和复制。

RxDB 支持本地优先读写、断网继续操作、联网后恢复同步，也支持通过 HTTP 或 PostgreSQL 相关方式构建复制层。([RxDB][19])

### 建议

先只在以下数据使用本地数据库：

* 今日任务；
* 下载后的课程元数据；
* 活动进度；
* 草稿答案；
* 待上传录音队列；
* 同步 outbox。

不要一开始把整个 PostgreSQL 业务模型复制到浏览器。

同时注意 RxDB 的部分高级存储和加密能力涉及商业版本，开源核心也有集合数量等许可边界，需要先做小范围验证。([RxDB][20])

---

## 8. 语音识别、对齐和评分

### 可直接复用的底层轮子

* **faster-whisper**：高性能 Whisper 推理，MIT 许可，可量化。([GitHub][21])
* **Vosk**：可离线运行的开源语音识别，适合较弱硬件。([PyPI][22])
* **Montreal Forced Aligner**：将标准文本与音频对齐到词和音素时间位置。([蒙特利尔强制对齐器][23])
* **SpeechBrain**：用于语音识别、说话人、声学模型等任务的 PyTorch 工具箱。([SpeechBrain][24])

### 推荐流水线

```text
录音质检
→ VAD 静音检测
→ ASR 文本识别
→ 标准文本强制对齐
→ 词和音素错误分析
→ 流利度、停顿、完整度计算
→ 置信度
→ 教师复核
```

### 不能直接外包的核心

这些必须由项目自己掌握：

* 藏语母语学生普通话发音特点；
* 本地口音误差；
* 年级差异；
* 教材朗读标准；
* 评分阈值；
* 教师人工修订；
* 模型版本和评分审计；
* 与真实教师评分的一致性验证。

开源模型能提供识别和对齐，但不能自动给你一个可信、适用于本地学生的教育评分标准。

---

## 9. 成长报告和管理 Dashboard

### 管理和教师内部报表

可选：

* **Metabase**：配置较简单，适合快速建立数据库报表和嵌入式 Dashboard，也支持行列权限等控制。([Metabase][25])
* **Apache Superset**：适合复杂 BI、SQL 分析、可视化和更强的扩展能力。([Apache Superset][26])

### 建议

* 试点阶段优先 Metabase；
* 大型管理分析再考虑 Superset；
* 学生个人成长报告继续自研。

学生成长报告不是普通 BI，它需要解释：

* 学了什么；
* 哪些能力进步；
* 哪些问题重复出现；
* 教师给了什么建议；
* 下一项学习行动是什么。

这部分是产品核心，不能只是把数据库图表嵌进去。

---

## 10. 通知、提醒和消息中心

使用 **Novu**，不要自己从头维护：

* 站内信；
* 邮件；
* 短信；
* Push；
* 通知模板；
* 通知工作流；
* 用户订阅偏好；
* 多渠道回退。

Novu 提供统一通知 API、工作流和多渠道 Provider 抽象。([Novu][27])

你的系统只发送业务事件：

```text
assignment.created
submission.received
feedback.published
assessment.report.available
recording.upload.failed
```

具体通过哪个渠道通知，交给 Novu。

---

## 11. AI 教案和 AI 工作流

你已经有 Flowise，可以继续保留。

需要补充 **Langfuse**，负责：

* LLM 调用追踪；
* Prompt 版本；
* 成本；
* 延迟；
* 输入输出审计；
* 人工评价；
* 数据集测试；
* 模型对比。([Langfuse][28])

推荐分工：

```text
Flowise：工作流怎么执行
Langfuse：执行结果是否可信、花了多少、哪个版本产生
业务数据库：教师是否接受、修改、发布
```

不要继续自研一套通用 AI 可观测平台。

---

## 12. 系统日志、性能和错误监控

使用：

* **OpenTelemetry**：统一采集 Trace、Metric、Log；
* **Grafana**：查询、可视化和告警；
* 可搭配 Prometheus、Loki、Tempo。

OpenTelemetry 是厂商中立的遥测标准，Grafana 可统一查看指标、日志和链路并建立告警。([OpenTelemetry][29])

重点监控：

* API 成功率和延迟；
* 学校范围拒绝次数；
* 上传失败率；
* 离线同步积压；
* 语音任务等待时间；
* 评分服务错误；
* AI 工作流成本和失败率。

---

## 13. 产品行为分析

未成年人教育场景应优先考虑隐私和自托管。

### 推荐

* **Matomo**：开源、可自托管，强调数据所有权和隐私。([Analytics Platform - Matomo][30])
* PostHog 功能更广，包含产品分析、Session Replay、Feature Flag、实验和错误跟踪，但学生场景启用录屏等功能时必须特别谨慎。([GitHub][31])

建议优先使用 Matomo，只记录必要的产品事件，不记录学生文本、录音内容或敏感表单。

---

## 14. 藏汉翻译

项目已有 Hunyuan-MT 方向。官方模型支持中文和藏语等语言方向，也提供较小模型版本用于量化或边缘场景。([GitHub][32])

但需要特别注意：

* 它不是普通 MIT 或 Apache 许可；
* 使用的是腾讯混元社区许可证；
* 存在地域、用途和模型输出使用限制；
* 上线前必须进行正式许可证审查。([GitHub][33])

可复用的是：

* 模型推理框架；
* 模型服务；
* 批处理；
* GPU 调度。

仍需自研的是：

* 学校术语表；
* 教材词汇；
* 翻译记忆；
* 教师纠错；
* 语料来源和许可证；
* 藏文文本规范化；
* 审核与版本管理。

---

# 四、哪些轮子可以直接拿来用

## 第一类：可以直接集成

* Uppy；
* tus / tusd；
* H5P；
* Novu；
* OpenTelemetry；
* Grafana；
* Langfuse；
* Matomo；
* faster-whisper；
* Vosk；
* Montreal Forced Aligner；
* SpeechBrain。

这类通常适合作为 npm、Python 包或独立 Docker 服务接入。

---

## 第二类：建议作为独立服务

* Logto、Casdoor 或 Keycloak；
* Metabase 或 Superset；
* TAO；
* Kolibri；
* Novu；
* Langfuse。

这样可以避免把大型项目源代码复制进你的仓库，也便于升级。

---

## 第三类：只学习产品，不搬代码

* Canvas；
* Moodle；
* Open edX；
* 希沃；
* ClassIn；
* Microsoft Reading Progress；
* ELSA；
* 科大讯飞 E 听说。

学习它们的：

* 页面信息结构；
* 操作步骤；
* 状态设计；
* 教师工作流；
* 学生反馈机制；
* 数据指标。

不要为了获得一个批阅页面而把整套 Canvas 搬进来。

---

# 五、许可证风险

以下项目不能简单复制源代码：

* Canvas：AGPL；
* Frappe Learning：AGPL；
* TAO Community Edition：AGPL；
* Moodle：GPL；
* Hunyuan-MT：自定义社区许可证。

Canvas、Frappe LMS 和 TAO 的开源仓库采用强 Copyleft 许可证，修改、部署方式和二次分发可能产生源码开放义务，因此更适合独立部署、API 集成或作为产品参考。([GitHub][34])

推荐复用优先级：

```text
标准协议
> 官方 API
> 独立 Docker 服务
> 官方 SDK / npm / pip 包
> 插件
> Fork
> 复制源代码
```

Fork 和复制源码应该是最后手段。

---

# 六、建议优先引入的十组轮子

按照你当前项目价值排序：

1. **Uppy + tus + tusd**：替换自研录音分片上传。
2. **H5P**：替换大量自研互动题型。
3. **Logto 或 Casdoor**：逐步接管通用身份能力。
4. **faster-whisper + MFA + SpeechBrain**：重构语音处理底座。
5. **Langfuse**：接管 AI 调用、Prompt 和评测审计。
6. **OpenTelemetry + Grafana**：接管运行监控和链路追踪。
7. **Metabase**：快速建立教师和学校内部报表。
8. **Novu**：接管通知和消息工作流。
9. **TAO/QTI**：接管通用测验标准和题目交换。
10. **Kolibri + RxDB 小规模试点**：验证真正的弱网离线模式。

---

# 七、哪些功能应该停止开发

当前阶段建议暂停继续自研：

* 通用登录和 MFA；
* 通用文件分片协议；
* 通用互动题型；
* 通用通知中心；
* 通用 BI 图表编辑器；
* 通用日志平台；
* 通用 LLM 调用监控；
* 通用考试题目格式；
* 通用 ASR 引擎；
* 社区和合作平台；
* 大而全的学校行政管理系统。

把开发资源集中到：

```text
学校和班级数据范围
课程与教材本地化
学生弱网学习
录音证据
本地化语音评分
教师复核
成长干预
真实试点
```

---

# 八、推荐的实施顺序

## 第一批：马上降低技术债

* 引入 Uppy + tus 上传验证；
* 接入 OpenTelemetry；
* 接入 Langfuse；
* 选择 Logto 或 Casdoor；
* 建立开源许可证登记表；
* 暂停新业务模块扩张。

## 第二批：替换通用业务轮子

* H5P 互动活动；
* Novu 通知；
* Metabase 内部报表；
* QTI 导入导出；
* OneRoster 学校数据交换。

## 第三批：形成核心差异化

* Kolibri 式校内边缘节点；
* RxDB 离线 outbox；
* faster-whisper + 强制对齐；
* 语音评分校准；
* 教师人工复核；
* 藏汉教材和术语体系。

最终目标不是让“语赞心声”拥有最多代码，而是：

> **用成熟轮子承担 70% 的通用工程，把 30% 的开发能力集中在别人无法直接提供的本地教育、离线学习和语音教学价值上。**

仓库中应当新增一份正式的 `OPEN-SOURCE-REUSE-MAP.md`，为每个候选项目记录功能、集成方式、许可证、维护活跃度、数据隐私、替换范围和退出方案，之后所有新功能立项前先查这张表。

[1]: https://moodle.com/solutions/lms/features/?utm_source=chatgpt.com "Moodle LMS Features - Moodle - Online Learning Platform For Everyone"
[2]: https://www.instructure.com/canvas?domain=canvas&utm_source=chatgpt.com "Canvas by Instructure: World Leading LMS for Teaching & Learning"
[3]: https://openedx.org/the-platform/?utm_source=chatgpt.com "The Platform - Open edX"
[4]: https://docs.frappe.io/learning/introduction?utm_source=chatgpt.com "Introduction"
[5]: https://kolibri.readthedocs.io/en/latest/index.html?utm_source=chatgpt.com "Kolibri User Guide"
[6]: https://www.xiwobaiban.com/?utm_source=chatgpt.com "希沃白板官网"
[7]: https://www.classin.com/students/?utm_source=chatgpt.com "Student Features – ClassIn"
[8]: https://learn.microsoft.com/en-us/training/modules/support-reading-fluency-practice-with-reading-progress/?utm_source=chatgpt.com "Support reading fluency practice with Reading Progress - Training | Microsoft Learn"
[9]: https://elsaspeak.com/en/enterprise/schools?utm_source=chatgpt.com "ELSA Schools | AI English Coaching for Educators & Institutions"
[10]: https://edu.iflytek.com/solution/examination/ai-language-test?utm_source=chatgpt.com "智能语言测试-科大讯飞智慧教育"
[11]: https://docs.logto.io/authorization?utm_source=chatgpt.com "Authorization | Logto docs"
[12]: https://github.com/casdoor/casdoor?utm_source=chatgpt.com "GitHub - casdoor/casdoor: An open-source Agent-first Identity and Access Management (IAM) /LLM MCP & agent gateway and auth server with web UI supporting OpenClaw, MCP, OAuth, OIDC, SAML, CAS, LDAP, SCIM, WebAuthn, TOTP, MFA, Face ID, Google Workspace, Azure AD · GitHub"
[13]: https://www.keycloak.org/?utm_source=chatgpt.com "Keycloak"
[14]: https://www.1edtech.org/standards/oneroster?utm_source=chatgpt.com "OneRoster® | 1EdTech"
[15]: https://h5p.org/?utm_source=chatgpt.com "H5P – Create and Share Rich HTML5 Content and Applications"
[16]: https://community.instructure.com/en/kb/articles/662775-what-is-speedgrader?utm_source=chatgpt.com "What is SpeedGrader? - Instructure Community"
[17]: https://www.1edtech.org/standards/qti?utm_source=chatgpt.com "Question & Test Interoperability® | 1EdTech"
[18]: https://tus.io/protocols/resumable-upload?utm_source=chatgpt.com "Resumable upload protocol 1.0.x | tus.io"
[19]: https://rxdb.info/replication.html?utm_source=chatgpt.com "RxDB realtime Sync Engine for Local-First Apps | RxDB - JavaScript Database"
[20]: https://rxdb.info/premium/?utm_source=chatgpt.com "RxDB for Professionals - RxDB - JavaScript Database | RxDB - JavaScript Database"
[21]: https://github.com/SYSTRAN/faster-whisper?utm_source=chatgpt.com "GitHub - SYSTRAN/faster-whisper: Faster Whisper transcription with CTranslate2 · GitHub"
[22]: https://pypi.org/project/vosk/?utm_source=chatgpt.com "vosk · PyPI"
[23]: https://montreal-forced-aligner.readthedocs.io/en/v3.4.1/user_guide/index.html?utm_source=chatgpt.com "User Guide — Montreal Forced Aligner 3.X documentation"
[24]: https://speechbrain.readthedocs.io/en/latest/?utm_source=chatgpt.com "User guide — SpeechBrain 0.5.0 documentation"
[25]: https://www.metabase.com/docs/latest/embedding/introduction?utm_source=chatgpt.com "Embedding introduction | Metabase Documentation"
[26]: https://superset.apache.org/?utm_source=chatgpt.com "Welcome | Superset"
[27]: https://docs.novu.co/platform/what-is-novu?utm_source=chatgpt.com "What is Novu? | Novu Documentation"
[28]: https://langfuse.com/?tab=public-api&utm_source=chatgpt.com "Langfuse"
[29]: https://opentelemetry.io/docs/?utm_source=chatgpt.com "Documentation | OpenTelemetry"
[30]: https://matomo.org/free-software/?utm_source=chatgpt.com "Free Open-Source Web Analytics | Matomo Analytics"
[31]: https://github.com/posthog?utm_source=chatgpt.com "PostHog · GitHub"
[32]: https://github.com/Tencent-Hunyuan/Hunyuan-MT?utm_source=chatgpt.com "GitHub - Tencent-Hunyuan/Hunyuan-MT · GitHub"
[33]: https://github.com/Tencent-Hunyuan/Hunyuan-MT/blob/main/License.txt "Hunyuan-MT/License.txt at main · Tencent-Hunyuan/Hunyuan-MT · GitHub"
[34]: https://github.com/instructure/canvas-lms?utm_source=chatgpt.com "GitHub - instructure/canvas-lms: The open LMS by Instructure, Inc. · GitHub"


# 技术路线结论

经过对成熟 LMS、弱网学习平台、测评系统、朗读评测产品和相关开源基础设施的进一步拆解，我认为你的项目应该走：

> **模块化业务核心 + 标准化扩展接口 + 成熟开源基础设施 + 本地化教育算法**

而不是：

> 自研一个包含登录、上传、考试、互动题型、通知、BI、监控、语音识别、AI 追踪等全部能力的大平台。

成熟产品共同体现出一个规律：它们通常不会一开始把课程、班级、作业、提交拆成大量微服务，而是保留一个稳定的业务核心，再把异步任务、内容组件、文件处理、搜索、分析等能力通过插件、标准或独立服务扩展。Open edX、Moodle、Canvas、Kolibri 都能支持这个判断。([Open edX 文档][1])

你当前的 **NestJS 模块化单体方向是正确的**。需要调整的不是全部推倒重来，而是：

1. 给核心业务建立稳定契约；
2. 不再继续自研通用基础设施；
3. 把课程内容、测评题型、身份、上传、语音、分析全部改成可替换适配器；
4. 只在本地化教育规则上深度自研。

---

# 一、研究结果的证据等级

下面我把信息分成三类，避免把推测说成事实。

### A：公开代码或官方架构

例如：

* Canvas 的 Ruby、TypeScript、PostgreSQL、Redis；
* Open edX 的 Django、XBlock、Studio/LMS；
* Kolibri 的 Django、Vue、插件架构；
* faster-whisper、tusd、Langfuse 的公开实现。

这些可以直接阅读代码、部署和做实验。

### B：产品公开行为和 API

例如：

* Microsoft Reading Progress 的错误分类；
* Azure Pronunciation Assessment 的评分字段；
* Canvas SpeedGrader 的批阅流程。

可以学习数据模型和产品流程，但不能确定其内部模型和部署架构。

### C：根据功能进行的技术逆推

例如 Reading Progress 的后台没有全部开源，但从其公开功能，可以合理推断它至少需要：

```text
音频质检
→ 语音识别
→ 参考文本对齐
→ 遗漏/插入/错读识别
→ 流利度统计
→ 教师人工修订
→ 错词训练推荐
```

这种内容我会明确标记为“技术推断”，不能当作微软公开源码事实。

---

# 二、六个最重要的技术对标

## 1. Canvas：学习它的业务交易和批阅系统

### 公开技术

Canvas LMS 的公开仓库以 Ruby 为主，同时包含大量 TypeScript 和 JavaScript。它的生产部署依赖 Rails、PostgreSQL、Redis，并将大量耗时工作放入后台作业系统。Canvas 同时提供 REST 和 GraphQL API，REST API 使用分页链接，并对请求进行限流。([GitHub][2])

### 真正值得学习的架构

Canvas 的重点不是 Ruby，而是：

```text
核心交易进入数据库
→ 大任务进入 Job Queue
→ 状态可以查询
→ 失败可以重试
→ 教师操作不等待耗时计算
```

它的 SpeedGrader 把以下内容放入同一个工作空间：

* 学生原始提交；
* 文档或录音证据；
* 评分量规；
* 教师评语；
* 状态变更；
* 下一名学生切换。

### 应用到你的项目

保留现有：

* `Submission`
* `Feedback`
* `Recording`
* `AssessmentItem`
* `SpeechJob`

增加一个教师批阅聚合接口：

```text
GET /schools/:schoolId/review-queue
GET /schools/:schoolId/reviews/:submissionId/workspace
POST /schools/:schoolId/reviews/:submissionId/decision
```

`workspace` 一次返回：

```text
学生信息
任务要求
提交内容
录音证据
自动评分
历史反馈
评分量规
前后学生导航
```

不要让前端分别请求十几个接口再自行拼接。

### 建议指标

* 批阅工作空间首屏 P95 小于 500ms；
* 切换下一位学生 P95 小于 300ms；
* 保存反馈支持幂等；
* 后台语音评分失败不阻塞人工批阅；
* 自动评分始终允许教师覆盖；
* 每次覆盖记录原值、修改值、教师、时间和原因。

---

## 2. Open edX：学习“创作端”和“学习端”分离

### 公开技术

Open edX 的核心是 Python/Django 平台，采用中心模块化单体、部分独立应用和前端微应用的组合。其课程制作端 Studio 与学习端 LMS 分离。XBlock 是其内容扩展机制：每个 XBlock 类似一个小型 Web 应用，拥有状态、渲染视图和事件处理器，同时要求组件彼此独立并且可以组合。Open edX 也把 LTI 作为稳定的外部内容集成方式。([Open edX 文档][3])

### 真正值得学习的架构

```text
课程创作模型
≠
学生运行时模型
```

教师编辑的是复杂草稿：

```text
课程
→ 单元
→ 课时
→ 活动
→ 资源
→ 配置
```

学生端读取的应该是发布后不可随意变化的运行快照：

```text
PublishedCoursePackage
├── manifest
├── activity definitions
├── resource index
├── offline metadata
└── version/checksum
```

### 应用到你的项目

你现有的 `CourseVersion` 方向正确，但应强化为：

```text
DRAFT
→ IN_REVIEW
→ APPROVED
→ PUBLISHED
→ ARCHIVED
```

发布时生成：

```text
ContentPackage
CourseManifest
ResourceManifest
ActivityManifest
OfflineManifest
```

学生页面不要实时读取教师正在修改的复杂课程表，而应读取已发布版本。

### 建议建立活动运行接口

```ts
interface ActivityDriver {
  type: string;
  validateDefinition(definition: unknown): ValidationResult;
  buildDeliveryPayload(context: DeliveryContext): Promise<unknown>;
  evaluateSubmission(input: unknown): Promise<EvaluationResult>;
  exportEvents(result: EvaluationResult): LearningEvent[];
}
```

以后原生练习、H5P、QTI、朗读练习、视频学习都通过 `ActivityDriver` 接入，而不是每加一种活动就修改课程核心表和所有页面。

---

## 3. Moodle：学习成熟的插件边界

### 公开技术

Moodle 是 PHP 与关系数据库架构，支持多种数据库和文件存储部署方式。它拥有接近 30 类标准插件类型，包括活动、题型、认证、存储、报表等；插件遵守统一的命名、目录和生命周期规范。([Moodle文档][4])

### Moodle 最重要的经验

不是 PHP，而是：

> 平台核心只定义稳定扩展点，具体能力尽量放在插件外围。

你的项目应建立以下适配器注册表：

```text
IdentityProvider
ActivityDriver
AssessmentItemDriver
UploadProvider
SpeechEngine
NotificationProvider
AiWorkflowProvider
AnalyticsSink
ContentImporter
ContentExporter
```

每个适配器必须：

* 有版本；
* 有能力声明；
* 有健康检查；
* 有配置校验；
* 有失败状态；
* 不直接读取其他模块的数据库表；
* 可以被禁用；
* 可以被替换。

### 一个重要规则

插件不能直接依赖 Prisma Service 任意查询全部表。

例如 H5P 驱动只能通过：

```text
ActivityPort
SubmissionPort
LearningEventPort
```

访问业务，不允许直接访问 `User`、`Membership`、`School` 等底层表。

---

## 4. Kolibri：学习真正的弱网和离线架构

### 公开技术

Kolibri 面向低资源和无网络环境，可通过 USB、硬盘、本地网络分发内容，并支持学校设施数据同步。其后端基于 Python/Django 和 REST 接口，前端由多个独立 Vue 单页应用组成；功能以插件形式加载，核心只保留认证、内容、任务等基础能力。其新前端代码优先使用 Vue Composition API 和 composables，而不是继续扩大 Vuex。([kolibri.readthedocs.io][5])

### Kolibri 最值得学习的不是 PWA

普通 PWA 只是缓存页面。

Kolibri 的核心是：

```text
内容被包装成可移动、可校验、可安装的内容单元
```

你的离线包至少需要：

```json
{
  "packageId": "...",
  "courseVersionId": "...",
  "schemaVersion": "...",
  "createdAt": "...",
  "minimumAppVersion": "...",
  "resources": [],
  "activities": [],
  "checksums": {},
  "totalBytes": 0
}
```

### 推荐离线模型

浏览器本地只保存必要切片：

* 今日任务；
* 已下载课程；
* 活动进度；
* 草稿答案；
* 笔记；
* 待上传录音元数据；
* 同步 outbox；
* 最近反馈。

不要把完整 Prisma 数据库复制到浏览器。

同步协议应使用：

```text
checkpoint
clientOperationId
entityVersion
idempotencyKey
conflictType
serverDecision
```

### 建议指标

* 下载后的核心课程断网可打开；
* 飞行模式下可以完成一个完整活动；
* 网络恢复后五分钟内同步成功率不低于 99%；
* 重复同步产生的重复业务记录为 0；
* 所有冲突都可见、可审计；
* 内容包校验失败时绝不静默加载；
* 设备存储不足时显示所需空间和可释放内容。

---

## 5. TAO 和 QTI：学习标准化测评引擎

### 公开技术和标准

QTI 是 1EdTech 制定的测验和题目交换标准，可表达题目内容、响应、评分逻辑、元数据和结果。QTI 3 使用 XML 包，增强了 Web 组件、可访问性、CAT 和自定义交互支持。TAO Community Edition 则围绕测评交付、评分、分析和管理建立模块化平台。([1edtech.org][6])

### 不建议做的事情

不要让你的题目定义继续无限发展为独有 JSON：

```json
{
  "type": "whatever-we-invent-next"
}
```

这会导致以后所有题库、导入工具和第三方系统都无法复用。

### 推荐做法

实现一个经过明确限制的 QTI 子集：

第一阶段支持：

* 单选；
* 多选；
* 判断；
* 填空；
* 简答；
* 排序；
* 配对。

第二阶段自定义：

* 朗读；
* 录音；
* 跟读；
* 音频理解；
* 藏汉双语题目。

使用内部统一模型：

```text
InternalAssessmentItem
        ▲
        │
QTI Importer / Exporter
H5P Adapter
Native Reading Adapter
```

TAO 可以用于对照测试或作为独立考试服务，但不建议直接把其 AGPL 源码复制进你的核心仓库。

### 建议指标

* 支持的 QTI 题型导入再导出，语义一致率 100%；
* 不支持的题型必须显式报错；
* 禁止静默丢弃评分规则；
* 每个题目保存原始标准包和内部转换版本；
* 每次转换记录转换器版本。

---

## 6. Microsoft Reading Progress：学习朗读评测产品闭环

### 公开功能

Reading Progress 会统计朗读准确率和每分钟正确词数，并允许教师修订遗漏、插入、错读、重复和自我纠正等错误类型。Azure Pronunciation Assessment 公开提供准确度、流利度、完整度、韵律，以及词级和音素级结果。([Microsoft Learn][7])

### 根据公开业务进行的技术推断

其完整后台实现没有开源，但从这些功能可以合理推断出类似流水线：

```text
音频质量检测
→ VAD 切分
→ 语音识别
→ 参考文本强制对齐
→ 词级和音素级特征
→ 遗漏/插入/错读分类
→ 准确度/完整度/流利度/韵律
→ 置信度
→ 教师人工修订
→ 错词练习推荐
```

这属于技术推断，不是微软公开源码。

### 应用到你的语音服务

推荐将 `backend/speech-scoring` 拆成清晰流水线，而不是一个函数直接返回总分：

```text
AudioQualityStage
VadStage
AsrStage
AlignmentStage
PronunciationFeatureStage
ScoreStage
ConfidenceStage
ReviewPreparationStage
```

每个阶段保存：

* 输入版本；
* 模型版本；
* 参数版本；
* 输出；
* 耗时；
* 错误；
* 可重试状态。

### 评分结果模型

不要只保存：

```json
{ "score": 83 }
```

应该至少保存：

```text
accuracy
completeness
fluency
prosody
wordsPerMinute
correctWordsPerMinute
omissions
insertions
mispronunciations
repetitions
selfCorrections
unexpectedPauses
wordResults[]
phonemeResults[]
confidence
reviewStatus
modelVersion
scoringPolicyVersion
```

---

# 三、语音轮子的具体技术选择

## faster-whisper：负责 ASR，不负责最终教育评分

faster-whisper 使用 CTranslate2 实现 Whisper 推理，支持 CPU/GPU 量化、批处理、词级时间戳和 VAD。官方仓库的基准中，13 分钟音频在 RTX 3070 Ti 上使用 large-v2、FP16、批量 8 时约为 17 秒；INT8 可以显著降低显存使用。具体性能仍必须在你的 RTX 4070、本地音频和普通话口音数据上重新测量。([GitHub][8])

推荐用途：

* 文本识别；
* 词级粗时间戳；
* 语言检测；
* 初步静音过滤。

不要使用其识别文本直接判断发音正确。ASR 语言模型可能把不正确的发音自动纠正为预期文字。

---

## Montreal Forced Aligner：负责参考文本对齐

MFA 使用录音、正字转写、发音词典和声学模型生成词和音素时间边界，也支持模型训练和适配。其 2026 年论文报告在所测试的英语、日语、韩语数据集上平均边界误差低于 15ms，但这个结果不能直接等同于“藏语母语学生普通话”的效果。([蒙特利尔强制对齐器][9])

你的项目需要自己建立：

* 普通话拼音到音素的词典；
* 教材词汇词典；
* 多音字规则；
* 藏语母语者常见替代音；
* 儿童语音适配数据；
* 静音和停顿规则。

---

## SpeechBrain：用于实验，不直接进入第一版生产

SpeechBrain 适合尝试：

* 音频质量分类；
* 声音嵌入；
* 发音特征模型；
* 说话人和声学任务；
* 自定义多任务评分。

第一版建议仍采用：

```text
faster-whisper
+ MFA
+ 明确可解释规则
+ 教师人工复核
```

等你拥有真实标注数据后，再训练复杂评分模型。

---

# 四、要引入的轮子及最终决策

| 能力      | 建议技术                        | 决策                    |
| ------- | --------------------------- | --------------------- |
| 身份认证    | Logto / Casdoor             | 做 POC，逐步接管登录、MFA、OIDC |
| 学校资源权限  | 现有 NestJS Guard             | 必须保留自研                |
| 可恢复上传   | Uppy + tus-js-client + tusd | 立即替换自研分片协议            |
| 对象存储    | MinIO                       | 保留                    |
| 通用互动题型  | H5P                         | 通过 ActivityDriver 接入  |
| 标准测验    | QTI 3 子集                    | 自建转换层，不自造完整格式         |
| 外部教育工具  | LTI Advantage               | 作为长期集成标准              |
| 教务数据交换  | OneRoster 1.2               | 用于用户、班级、入学、成绩导入       |
| 离线本地存储  | Service Worker + IndexedDB  | 核心方案                  |
| 复杂本地复制  | RxDB                        | 仅做小范围 POC             |
| 异步任务    | BullMQ                      | 保留                    |
| ASR     | faster-whisper              | 接入语音服务                |
| 强制对齐    | MFA                         | 接入语音服务                |
| AI 工作流  | Flowise                     | 保留                    |
| AI 可观测性 | Langfuse                    | 接入                    |
| 系统可观测性  | OpenTelemetry + Grafana     | 接入                    |
| 内部 BI   | PostgreSQL 聚合视图 + Metabase  | 仅供内部教师和管理员            |
| 通知      | BullMQ 薄通知层；后期 Novu         | 暂不立即引入完整 Novu         |

---

# 五、几个关键轮子的实现方式

## 1. 上传：Uppy + tusd + MinIO

tus 是标准化 HTTP 可恢复上传协议，通过 `HEAD` 获取已上传偏移量，再通过 `PATCH` 从偏移量继续上传。tusd 是官方 Go 参考服务，支持 S3 兼容存储和认证、校验、后处理 Hook。([Tus][10])

建议架构：

```text
浏览器 Uppy/tus-js-client
        │
        ▼
tusd
        │
        ├── Pre-create Hook → NestJS 鉴权
        ├── MinIO 保存数据
        └── Post-finish Hook → NestJS 创建 Recording
```

NestJS 仍然负责：

* 当前用户；
* 学校范围；
* Submission 关系；
* 文件类型；
* 文件大小；
* 完成后的业务记录。

tusd 只负责可靠传输。

---

## 2. 身份：Logto 优先，Casdoor 作为国内集成候选

Logto 公开支持 OAuth/OIDC、组织、多租户和组织级 RBAC，技术栈与 TypeScript 团队较匹配。Casdoor 以 Go 实现，并公开支持 OIDC、SAML、CAS、LDAP、SCIM、WebAuthn 和 MFA，更适合以后接国内学校身份体系。Keycloak 能力更全面，但高可用部署、数据库和缓存运维复杂度也更高。([Logto文档][11])

推荐顺序：

1. Logto 本地 POC；
2. 测试账号密码、OIDC、MFA、组织声明；
3. NestJS 将外部 subject 映射到内部 `User`；
4. 保留 `Membership`、`activeSchoolId` 和资源权限；
5. 若未来需要 CAS/LDAP，再评估 Casdoor。

绝不能把学校权限直接交给 IAM。

---

## 3. AI：Flowise + Langfuse

Langfuse 的公开架构使用 Web 和 Worker 两类应用容器；PostgreSQL 保存事务数据，ClickHouse 保存跟踪和评分分析，Redis/Valkey 负责队列和缓存，S3 保存原始事件和多模态附件。它从早期 Next.js + PostgreSQL 演进到这套架构，说明分析型数据只有在规模增长后才需要从事务数据库分离。([Langfuse][12])

应用分工：

```text
Flowise
负责工作流执行

Langfuse
负责模型、Prompt、成本、延迟、Trace、评测

语赞心声数据库
负责教师是否接受、修改、拒绝、发布
```

当前不要自己部署另一个通用 ClickHouse 分析平台；让 Langfuse 自己管理其内部分析依赖即可。

---

## 4. 系统监控：OpenTelemetry Collector

OpenTelemetry Collector 通过 Receiver、Processor、Exporter 管道接收、处理并转发 Trace、Metric 和 Log，可作为应用与 Grafana 等后端之间的统一网关。([OpenTelemetry][13])

推荐链路：

```text
frontend
backend/api
backend/worker
speech-scoring
tusd
Flowise
        │
        ▼
OpenTelemetry Collector
        │
        ├── Tempo / traces
        ├── Prometheus / metrics
        └── Loki / logs
```

所有异步任务必须传递：

```text
traceId
requestId
schoolId
jobId
submissionId
```

但日志中不得记录：

* 学生录音原文；
* 完整答案；
* 密码；
* Token；
* 原始 AI 敏感输入。

---

# 六、你的目标架构

```text
                         HTTPS :443
                             │
                     Reverse Proxy
                             │
       ┌─────────────────────┼─────────────────────┐
       ▼                     ▼                     ▼
Frontend :4175          NestJS API :4000      Identity Provider
                               │
       ┌───────────────────────┼────────────────────────┐
       ▼                       ▼                        ▼
PostgreSQL :55432        Redis/BullMQ :6380        tusd Upload
                                                        │
                                                        ▼
                                                   MinIO :59000

NestJS / BullMQ
       │
       ├── Speech Service :8100
       │      ├── faster-whisper
       │      ├── MFA
       │      └── scoring policy
       │
       ├── Flowise :4300
       │      └── Langfuse
       │
       └── OpenTelemetry Collector :4317/:4318
              └── Grafana stack
```

## 端口原则

对外原则上只开放：

* `443`
* 必要情况下 `80` 重定向到 HTTPS。

以下端口应当只存在于 Docker 内部网络：

* 4000；
* 55432；
* 6380；
* 59000；
* 4300；
* 8100；
* 4317；
* 4318。

**课程、作业、反馈、报告不需要各自拥有端口。**

只有以下情况才值得独立服务：

* 不同计算负载；
* 不同扩展方式；
* 不同安全边界；
* 不同伸缩策略；
* 不同数据存储类型。

---

# 七、结合当前仓库应立即做出的决策

## 保留

* NestJS 模块化单体；
* PostgreSQL + Prisma；
* Redis + BullMQ；
* MinIO；
* 独立 Worker；
* 独立 Speech Service；
* `CourseVersion`；
* Submission—Feedback—Recording 证据关系；
* 学校和资源范围 Guard；
* AI 输出版本与人工复核原则。

## 替换

* 自定义录音分片上传 → tus；
* 通用登录和 MFA → IdP；
* 通用题型 → H5P/QTI；
* 自建 AI Trace → Langfuse；
* 自建系统日志平台 → OpenTelemetry；
* 前端自行聚合复杂教师批阅数据 → 后端 Workspace API。

## 暂缓

* 将课程、班级、作业拆成微服务；
* Kafka；
* 自建 ClickHouse；
* 全面 Nuxt 重写；
* 完整部署 Novu；
* 整体迁移到 Canvas、Moodle 或 Open edX；
* 继续扩展社区、志愿者和合作模块。

## 必须修正

结合我刚才对你仓库的检查，`packages/contracts` 不能在没有替代方案的情况下删除。

你的目标架构明确依赖 OpenAPI 作为共享事实源，API 包也引用了 `@yuzan/contracts`。正确方式可以是迁移、重构或重新生成，但必须保留：

```text
OpenAPI 源文件
契约验证
生成类型
版本策略
不兼容变更检测
```

---

# 八、项目验收指标

下面是**建议给语赞心声制定的项目目标**，不是竞品公开承诺。

| 领域     | 第一阶段指标                              |
| ------ | ----------------------------------- |
| 核心 API | 普通读取 P95 `<300ms`，普通写入 P95 `<500ms` |
| 可用性    | 试点期月可用性 `≥99.5%`                    |
| 租户安全   | P0 接口学校负向测试覆盖率 `100%`               |
| 数据泄漏   | 跨学校资源泄漏 `0`                         |
| 上传     | 20–50MB 录音中断三次后恢复成功率 `≥98%`         |
| 上传幂等   | 同一录音产生重复最终对象 `0`                    |
| 离线     | 已安装课程断网首屏 `<2s`                     |
| 同步     | 联网后五分钟内成功率 `≥99%`                   |
| 同步幂等   | 重复业务记录 `0`                          |
| QTI    | 支持题型往返转换语义一致率 `100%`                |
| Trace  | P0 API Trace 覆盖率 `≥90%`             |
| 异步链路   | Job 携带关联 ID 比例 `100%`               |
| AI     | 模型、Prompt、成本、输入版本、人工决定记录率 `100%`    |
| 语音速度   | 目标硬件上 RTF P95 `<1`                  |
| 语音可信度  | 高置信度结果与教师评分相关系数初期目标 `≥0.6`          |
| 人工控制   | 每个语音结果均可人工修订 `100%`                 |
| 隐私     | 应用日志中学生原文和原始录音内容 `0`                |

语音准确率不要一开始拍脑袋定“95%”。

正确顺序是：

1. 建立本地标注集；
2. 测 WER、字错误率、音素边界误差；
3. 测遗漏、插入、错读的 Precision、Recall、F1；
4. 测与教师评分相关性；
5. 分年级、性别、口音、设备和噪声统计；
6. 再制定正式门槛。

---

# 九、十二周技术路线

## 第 1–2 周：先稳定仓库

完成：

* `GOV-ROOT-002`；
* 统一 Node 24；
* 修复 OpenAPI 契约位置；
* 新目录重新执行全部验证；
* 建立 `OPEN-SOURCE-REGISTER`；
* 每个轮子记录许可证、版本、维护状态和退出方案。

退出门禁：

```text
Git 工作区干净
frozen install 通过
API / Worker / DB / Frontend 验证通过
旧路径引用为 0
契约生成通过
```

---

## 第 3–4 周：上传、监控和 AI 审计

实现三个 POC：

1. Uppy + tusd + MinIO；
2. OpenTelemetry 全链路；
3. Flowise + Langfuse。

退出门禁：

* 上传中断后恢复；
* 不重复上传已有字节；
* API → Worker → Speech 有统一 Trace；
* 每个 AI 任务可查模型、Prompt、费用和人工状态。

---

## 第 5–6 周：课程内容扩展层

实现：

* `ActivityDriver`；
* H5P 适配器；
* QTI 导入导出子集；
* 发布内容包；
* 教师创作模型与学生运行模型分离。

退出门禁：

* 原生活动和 H5P 活动使用同一学习进度模型；
* QTI 支持题型往返成功；
* 已发布内容修改后必须产生新版本；
* 学生不读取教师草稿。

---

## 第 7–8 周：离线闭环

实现：

* Service Worker；
* IndexedDB；
* 课程包安装；
* outbox；
* checkpoint；
* 幂等写入；
* 冲突界面。

退出门禁：

```text
下载课程
→ 断网
→ 完成活动
→ 保存答案和录音队列
→ 联网
→ 同步
→ 教师看到提交
```

---

## 第 9–10 周：语音评分基线

实现：

* 音频质检；
* faster-whisper；
* MFA；
* 错误分类；
* 评分策略版本；
* 教师修订；
* 本地标注数据集。

第一阶段不追求“自动定论”，只提供：

> 可解释、可审计、可人工修订的辅助评分。

---

## 第 11–12 周：完整试点门禁

验证：

* 教师建立任务；
* 学生在线和离线完成；
* 录音恢复上传；
* 语音任务完成；
* 教师复核；
* 学生看到反馈；
* 成长报告更新；
* 跨学校访问被拒绝；
* 数据备份恢复成功。

---

# 十、建议的学习顺序

不要从框架教程重新学起，而是直接研究成熟项目的关键目录和设计思想。

### 第一阶段：平台架构

1. Open edX 的 extension points；
2. XBlock runtime；
3. Kolibri plugin architecture；
4. Canvas production deployment 和 background jobs；
5. Moodle plugin types。

目标产出：

```text
ADR：语赞心声核心与插件边界
```

### 第二阶段：教育标准

1. QTI 3；
2. LTI Advantage；
3. OneRoster 1.2；
4. Caliper Analytics；
5. xAPI。

OneRoster 已经定义用户、组织、课程、班级、注册关系和成绩的 CSV 与 REST 交换方式；使用它能避免未来为每个学校重新设计导入模型。([1edtech.org][14])

目标产出：

```text
ADR：外部教育系统集成标准
```

### 第三阶段：弱网工程

1. Kolibri 内容包；
2. tus 协议；
3. Service Worker；
4. IndexedDB；
5. outbox、checkpoint、幂等和冲突。

目标产出：

```text
离线黄金流程 POC
```

### 第四阶段：语音评测

1. faster-whisper；
2. MFA；
3. Azure 公开评分字段；
4. Reading Progress 教师修订流程；
5. 本地口音数据标注。

目标产出：

```text
语音评测基线报告
```

---

## 最终技术定位

你的项目不应该变成另一个 Moodle，也不应该把 Canvas、Kolibri、TAO 的代码拼成一个巨大系统。

它应该成为：

> **一个以学校、班级、课程、学习证据和本地化语音反馈为核心，兼容 QTI、LTI、OneRoster、H5P 等教育生态，通过 tus、OIDC、OpenTelemetry、Langfuse 等成熟基础设施构建的弱网教学平台。**

真正需要自研的只有五块：

1. 西藏学校和班级资源范围；
2. 本地课程与双语内容；
3. 弱网学习和同步冲突规则；
4. 藏语母语学生普通话评测校准；
5. 教师反馈到学生成长干预的证据链。

其余能力，应优先选择标准、适配器或成熟开源服务。

[1]: https://docs.openedx.org/projects/edx-platform/en/latest/concepts/extension_points.html?utm_source=chatgpt.com "Options for Extending the Open edX Platform — edx-platform documentation"
[2]: https://github.com/instructure/canvas-lms?utm_source=chatgpt.com "GitHub - instructure/canvas-lms: The open LMS by Instructure, Inc. · GitHub"
[3]: https://docs.openedx.org/en/latest/developers/references/developer_guide/architecture.html?utm_source=chatgpt.com "Open edX Platform Architecture — Latest documentation"
[4]: https://docs.moodle.org/19/en/Moodle_architecture?utm_source=chatgpt.com "Moodle architecture - MoodleDocs"
[5]: https://kolibri.readthedocs.io/en/latest/faq.html?utm_source=chatgpt.com "Frequently Asked Questions - Kolibri User Guide"
[6]: https://www.1edtech.org/standards/qti?utm_source=chatgpt.com "Question & Test Interoperability® | 1EdTech"
[7]: https://learn.microsoft.com/en-us/azure/ai-services/Speech-Service/how-to-pronunciation-assessment?utm_source=chatgpt.com "Use pronunciation assessment - Foundry Tools | Microsoft Learn"
[8]: https://github.com/SYSTRAN/faster-whisper "GitHub - SYSTRAN/faster-whisper: Faster Whisper transcription with CTranslate2 · GitHub"
[9]: https://montreal-forced-aligner.readthedocs.io/en/v3.1.2/user_guide/index.html?utm_source=chatgpt.com "User Guide — Montreal Forced Aligner 3.0.0 documentation"
[10]: https://tus.github.io/tusd/?utm_source=chatgpt.com "Home | tusd documentation"
[11]: https://docs.logto.io/authorization/organization-permissions?utm_source=chatgpt.com "Protect organization (non-API) permissions | Logto docs"
[12]: https://langfuse.com/handbook/product-engineering/architecture?utm_source=chatgpt.com "Architecture - Langfuse"
[13]: https://opentelemetry.io/docs/collector/architecture/?utm_source=chatgpt.com "Architecture | OpenTelemetry"
[14]: https://www.1edtech.org/standards/oneroster?utm_source=chatgpt.com "OneRoster® | 1EdTech"
