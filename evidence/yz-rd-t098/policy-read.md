# T098 policy reading receipt

Fetched through the connected Notion fetch tool; current applicable sections actually read. No Notion writes.

## Policy 17 — current YZ-RD scope and source boundaries

## 2026-10-20｜项目作用域与 Codex 规范读取链修正（ACTIVE，适用于新派发和续接）

<b>原因裁定</b>：<code>AA-DEV-V2.2-20261017</code> 是已核实在 AutoAim/rm\_improve 系列 Lane checkout 适用的版本标识，不是所有项目仓库的通用必填版本标记。例如 <code>tianxiansheng166/yuzan-workspace-main</code> 的 <code>AGENTS.md</code> 与T077隔离worktree都无此标记，这是正常可观测事实而非本身违规。本页旧段落如写“通用开发行为用 AA-DEV-V2.2”，在 AutoAim 路线上继续有效，但不得未作项目适用性检查就强加给 <code>YZ-RD</code>；本节对跨项目应用的歧义给出限定解释，不撤销AutoAim V2.2的合法约束。

<b>执行时适用顺序</b>：①当前用户明确Task合同、Owner授权/安全红线和真实Git/runtime事实；②启动路径实际可读的父级 <code>AGENTS.md</code> 安全约束以及<b>目标项目/准确task worktree</b> <code>AGENTS.md</code>；③该 Route 明确列出的<b>项目专用POLICY\_REF和本页17号通用发卡/核验规则、17A编号规范</b>；④旧handoff/memory/历史卡仅作事实背景。不同来源冲突必须按真实权限更严格的一方执行，不得靠Notion旧泛化语句减弱用户对T005/local\_sources/L4原始读取的禁止。任何AutoAim独有实验、ROS/Provider/AA-DEV版本规则不能自动移植到语赞心声。

<b>YZ-RD当前正式最小入口</b>：<code>PROJECT=语赞心声</code>；<code>REPO=tianxiansheng166/yuzan-workspace-main</code>；<code>ROUTE_ID=YZ-RD</code>；<code>PROJECT_RULES_REF=<目标TASK准确Git BASE 的 AGENTS.md></code>；<code>POLICY_REF=<mention-page url="https://app.notion.com/p/3e7909d673d2816388ced86414c08585"/></code>（本节及17号通用执行/证据契约）；<code>POLICY_LANE_REF=<mention-page url="https://app.notion.com/p/3fc909d673d28175b61fcee160d15c17"/></code>顶部《YZ-RD 最小执行规范》；<code>ROUTING_REF=<mention-page url="https://app.notion.com/p/3eb909d673d281459caad397469005aa"/></code>。<b>YZ-RD不要求 AA-DEV-V2.2 marker，也不声称语赞版本已复制进目标 Git 文件。</b>

<b>Notion 读取与任务卡传递</b>：Web Commander 经Notion连接可读取、回填，不等于用户手动启动的外部Codex会话自动加载Notion。每张发到聊天让Owner复制的<b>任务正文必须自包含</b> <code>TASK_ID</code>/<code>RETURN_TO</code> 第一二行，紧接 <code>REPO/BASE/WORKTREE/EXECUTOR/MODE/POLICY_REF/POLICY_SCOPE/SAFE_BOUNDARY/RESULT_CONTRACT</code> 最小字段；项目专用安全红线必须写进正文而非只写在Notion属性或长Lane历史中。若Codex没有Notion连接，使用卡中冻结的完整执行约束+当前真实仓库AGENTS继续，不因无法联网Notion反复索权/盲查，不谎称已读Notion；<b>主动反馈</b> <code>NOTION_POLICY_READ=UNAVAILABLE</code>，必要时要求Owner提供缺失的特定关键条款；受限源数据/高风险操作始终fail-closed。

<b>启动回执最小格式</b>（不增加大型控制台）:

```txt
TASK_ID: YZ-RD-TNNN
RETURN_TO: 语赞心声｜研发施工与上线 Commander 线
REPO_AND_EXACT_BASE: <repo@SHA>
ACTUAL_TASK_WORKTREE: <path>
AGENTS_READ: <actual files, size or blob SHA; missing = MISSING>
POLICY_SCOPE: YZ-RD (AA-DEV V2.2 = NOT_APPLICABLE unless explicitly approved)
POLICY_REF: <real Notion URL or frozen card text>
NOTION_POLICY_READ: READ_OK | UNAVAILABLE | NOT_ATTEMPTED
GUARDS: T005/protected raw sources/L4, distinct test fixture vs live
```

任务结果保留<code>PASS/FAIL/SKIP/NOT_RUN</code>以及<code>TEST_FIXTURE_ONLY</code>、<code>READY_TO_MERGE</code>、历史L4状态独立标识。仅把旧缺marker记为<code>CROSS_PROJECT_MARKER_NOT_APPLICABLE</code>，不把它当成Codex阅读Notion失败的证据。

<b>版本更新规则</b>：如将来Owner正式采用语赞专属版本化规范，应先明确 <code>YZ_POLICY_ID + immutable Git SHA / approved Notion version</code> 并在<b>未来</b>新卡引用；不得直接往语赞 <code>AGENTS.md</code>伪造<code>AA-DEV-V2.2-20261017</code>或覆盖受保护T005工作树/旧Task历史。既有已发行任务合同不倒改；后续续接只附一小段更正入口，原BASE、Owner及验收范围不变。


## 2026-10-20｜强制审查Level级来源读取范围：预检解析也属于读取

任何项目任务声称 <code>L4_UNTOUCHED</code> 或 Level1-only 时，必须拆为四个独立字段：<code>L4_SOURCE_READ</code>（原始来源文件是否被解析/读取）、<code>L4_IMPORT_APPLIED</code>（是否写入运行时数据）、<code>L4_RUNTIME_OPENED</code>（是否在APP/E2E打开）以及<code>HISTORICAL_L4_INCIDENT_OPEN</code>（历史数据/卷事故独立状态）。这四者<b>不可相互替代</b>。

Level1-only脚本先对路径和经核的level manifest进行<b>文件打开之前</b>的限制，不允许先parse整个120条全源再选20条Level1却声明L4没有触碰。如果Level1与L4混同一单体源无法预过滤，不自行打开/复制混合文件，应 <code>NEEDS_OWNER_DECISION_MIXED_SOURCE</code> 并报告独立L1-only认证来源方案。没有源文件访问日志时不得断言L4\_SOURCE\_READ=NO；原T005保护源码即使SHA没变，也不等于没有读取。

具体参照T053结果 <code>Parsed items120 Selected20</code> 且只有20条L1实际导入：业务原生2E2E验收有效，读取边界合规为<code>SCOPE_DECISION_PENDING</code>。T056安全整改与T057源码质量集成可分别用Owner手动派Codex进行，但在取得L1-only证明及Owner判定前，任何可能触发全源读取的E2E/导入器不得执行，禁止将旧E2E冒充新的安全验证。历史L4事故继续OPEN不许借此任务恢复/清理。


## Lane current minimum execution rules

## YZ-RD 最小执行规范（ACTIVE｜本页作为项目执行入口）

<b>项目与路由</b>：PROJECT=语赞心声；REPO=tianxiansheng166/yuzan-workspace-main；ROUTE\_ID=YZ-RD。中央编号与回填路由以 17A Route Registry/Ledger 为准；每个新任务必须沿用准确的 Next Seq，不重复创建已存在任务。

<b>适用顺序</b>：①当前用户明确任务、Owner授权和安全红线；②父级/根目录及准确任务BASE的仓库 <code>AGENTS.md</code>；③本项目当前执行规范和Notion 17/17A；④旧handoff、其他项目的CURRENT\_TASK、历史任务卡仅作背景。用户已明确提出的YZ-RD任务优先于不相干的本地旧任务文件。

<b>任务必须发到聊天</b>：每张可执行Codex卡在当前聊天直接给出完整、独立可复制的围栏代码块；第一行严格 <code>TASK_ID:</code>，第二行严格 <code>RETURN_TO: 语赞心声｜研发施工与上线 Commander 线</code>；正文必须自包含 PROJECT/REPO/准确BASE/EXECUTOR=OWNER\_MANUAL\_CODEX/MODE/POLICY\_SCOPE/POLICY\_REF/LANE\_REF、功能目标、文件归属、前置合同、安全边界、验收与RETURN。Notion链接仅归档，不替代聊天正文。Ledger只有在完整正文实际出现在聊天后才可记PUBLISHED；PUBLISHED不表示Codex已启动或分支已存在。

<b>执行角色</b>：Web Commander负责只读/轻量Git与证据核验、完整聊天发卡、Notion状态回填；不得通过Connect/Shell自行修改源码、执行测试、启动/续接本地Codex、做复杂合并或部署。Codex必须由Owner手动复制聊天任务卡启动。

<b>普通功能开发启动规则</b>：准确BASE的仓库 <code>AGENTS.md</code> 是普通功能开发的直接规则。普通功能开发不要求PowerShell、<code>mvp-control.ps1</code>、<code>task-context.ps1</code>、lease、fencing epoch或语义锁；仅当Owner明确要求旧控制面任务时才使用这些旧机制。Linux缺少pwsh/powershell本身不是功能开发阻塞。若项目合同明确要求某种真实外部权限/运行资源，则只对该特定合同执行相应门禁，不把旧控制面泛化为所有任务的硬门禁。

<b>工作树与所有权</b>：根据任务准确BASE创建独立Git worktree/分支，禁止在有未提交改动的主checkout施工。先核对目标路径与分支是否已存在，禁止覆盖他人任务；禁止全量clone、force-push、reset、stash、clean或共享分支合并。只修改任务卡列明的OWNED\_PATHS，读写范围外路径必须先取得明确授权。

<b>产品证据</b>：静态UI、DOM fixture、单元测试、API 200和截图都不能单独宣称完整业务验收。原生浏览器/API/DB/MinIO只在真实执行时记PASS；未执行记NOT\_RUN，环境阻塞与代码缺陷分开。READY\_TO\_MERGE默认NO，直到集成与所需真实验收完成。

<b>安全边界</b>：不得读取/覆盖T005保护文件的未提交diff；不得读取混合原始DOCX/ZIP、<code>local_sources</code>或Level 4原始来源，不得导入/运行Level 4素材；不得使用旧数据库或共享MinIO桶冒充隔离验收；不擅自启动/停止他人服务。历史L4事故持续OPEN，除非Owner按正式流程另行决定。

<b>当前纠正项</b>：T092/T093此前错误地强制旧控制面租约；已在原任务编号下于聊天完整重发修订卡，并在Notion任务卡添加非追溯性纠正说明。T092需验证合法服务端录音播放合同；T093需移除假登录。两者均未启动，需Owner手动派发。

## Policy 17A

Here is the result of "fetch" for the Page with URL https://app.notion.com/p/3eb909d673d281459caad397469005aa as of 2026-10-20T10:52:03.496Z:
<page url="https://app.notion.com/p/3eb909d673d281459caad397469005aa" icon="🧾">
<ancestor-path>
<parent-page url="https://app.notion.com/p/3b2909d673d281f28dadd22392e45144" title="90｜AI 工作台｜系统规范与治理"/>
<ancestor-2-page url="https://app.notion.com/p/3b0909d673d2812f9988fb91d97b78e5" title="【主系统｜唯一权威写入】长期沉淀库｜个人成长・学习・项目"/>
</ancestor-path>
<properties>
{"title":"17A｜Codex 任务编号与回填路由｜Task ID・Route ID・Sequence"}
</properties>
<iconMetadata>{"type":"emoji","emoji":"🧾"}</iconMetadata>
<content>
## 2026-10-20｜17A 发行流程补充：Notion+聊天双确认

17A原条款已有“再输出给用户可复制的Task/Goal”，“Task Card一旦输出到聊天，Ledger状态记为PUBLISHED”。现明确：正式发布必须同时满足<b>Notion Ledger草稿回读成功</b>和<b>当前聊天出现完整可复制的Task代码框</b>；只给Notion链接是不合格发布。

新卡先占号与RESERVED存全文，待当前聊天已交付完整代码块后再设PUBLISHED；代码块第一行TASK\_ID:、第二行RETURN\_TO:，必须涵盖最低执行/安全/验收与RETURN。禁止在聊天输出前把RESERVED当成PUBLISHED交付，或把PUBLISHED误当Codex已启动。

Codex终态若是使用Notion链接执行完成，仍按Git/runtime证据判RETURNED/ACCEPTED，并附历史派发渠道缺陷备注；对有已运行worktree任务不重复派同号。旧任务若未执行可保留号补发聊天完整卡，不能只写“详见Notion”。

Owner派发动作只有“复制聊天内的完整指令代码框并粘贴给自己的Codex”；Notion任务链接只供浏览详细记录，用户不负责自行撰写或补齐执行契约。

## 2026-10-20｜YZ-RD Codex 发卡头两行与规范路由修正（ACTIVE）

17A 规则<b>Task给Codex的可复制正文第1行必须</b><b><code>TASK_ID:</code></b><b>，第2行必须</b><b><code>RETURN_TO:</code></b>。只有Notion Ledger属性里填了 Task ID、Lane URL，或Markdown标题里提了编号，<b>不能替代正文两行</b>；Notion和本地Codex是不同权限/会话，不能因为Web Commander可读Notion，就声称Codex已读取了它。

每个新的YZ-RD卡紧接两行写 <code>PROJECT=语赞心声, REPO=tianxiansheng166/yuzan-workspace-main, BASE=<SHA>, EXECUTOR=OWNER_MANUAL_CODEX, POLICY_SCOPE=YZ-RD, POLICY_REF=https://app.notion.com/p/3e7909d673d2816388ced86414c08585, LANE_REF=https://app.notion.com/p/3fc909d673d28175b61fcee160d15c17</code>，然后写完整<b>卡内自包含</b>安全/文件归属/测试证据/返回字段。<code>AA-DEV-V2.2-20261017</code>仅当卡面项目/仓库明确属于有该版本的AutoAim Lane且经核真实适用时才是强制核验；YZ-RD不能凭缺marker视为政策失效。

回执除 TASK\_ID/STATUS 外额外保留 <code>REPO_AGENTS_ACTUALLY_READ</code>, <code>NOTION_POLICY_READ=READ_OK|UNAVAILABLE|NOT_ATTEMPTED</code>, <code>POLICY_SCOPE</code>, <code>POLICY_GAP</code>：Notion连接不可用可按真实Repo AGENTS及卡内冻结安全规范继续<b>低风险授权任务</b>，高风险未明确则NEEDS\_OWNER\_DECISION；不让Codex无端反复查询Notion或虚报已读。历史卡原始冻结正文不进行隐性改写，若需要补足仅附非追溯性Addendum。

此规则是17A发布格式缺口修补，Route/Sequence/单写者和状态机均不变。

<callout icon="🗂️" color="green_bg">
<b>中央真源</b>：<mention url="https://app.notion.com/p/7d3906dd4783498baa09b4996f1fc223" type="database">71｜Codex Route Registry｜回填路线与序号分配</mention> 负责 ROUTE\_ID / RETURN\_TO / Next Seq；<mention url="https://app.notion.com/p/4219634ea36541debc17f99fc3c8e68c" type="database">72｜Codex Task Ledger｜任务编号・状态・回填记录</mention> 负责每张已占号 Task/Goal 的状态。Lane 页面只保存稳定 ROUTE\_ID，不复制 Next Seq。
</callout>

<callout icon="🧾" color="blue_bg">
<b>目的</b>：任何 Web Commander 只要发布可复制给 Codex 的 Task/Goal，都必须带一个能直接把结果送回正确聊天线的稳定编号。编号是执行路由，不替代业务名称、Git branch 或实验编号。
</callout>

# 1｜统一编号格式

```txt
TASK_ID: <ROUTE_ID>-T<NNN>
RETURN_TO: <Program / Lane / Commander line 人类可读名称>
```

示例：

```txt
TASK_ID: AA-MPC-T007
RETURN_TO: AutoAim / MPC 优化研发线
```

<b>硬规则</b>：

- 提示词正文第 1 行必须是 <code>TASK_ID:</code>；第 2 行必须是 <code>RETURN_TO:</code>。不能只放在写作卡片标题、外围 UI、Notion 页面标题或说明文字里。
- Codex 的 final response 第 1 行必须原样回显同一个 <code>TASK_ID:</code>；第 2 行写 <code>STATUS: DONE | BLOCKED | NEEDS_DECISION</code>。
- 若 Codex 支持中途 checkpoint，每个 checkpoint 仍使用同一个 TASK\_ID，可在第 2/3 行追加 <code>CHECKPOINT: C01/C02...</code>；不要因为内部 retry、修复、重跑而领取新号。
- Commander 真正改变 Outcome / contract 并发布新提示词时，领取下一个 Task ID。

# 2｜ROUTE\_ID 代表“结果回到哪一条线”

- 一个会独立发布 Codex 指令的 Commander chat / Feature Lane / Platform line 拥有一个稳定 <code>ROUTE_ID</code>。
- 同一条线换新聊天接手时，若只是 continuity takeover，继承原 ROUTE\_ID；登记库里的 <code>RETURN_TO</code> 更新为新的当前聊天名称/Resume Capsule。
- 如果同一个业务 Lane 同时存在两个独立 Commander 聊天并行派任务，它们必须拥有不同 ROUTE\_ID；不能共用计数器。
- ROUTE\_ID 一经分配不回收、不复用。Line 结束后标记 HOLD/RETIRED。
- 推荐格式 <code><PROGRAM>-<LINE></code>，全大写 ASCII、短而可读，例如 <code>AA-MPC</code>、<code>AA-EST</code>、<code>AA-FIRE</code>、<code>AA-P1SIM</code>。不要把易变 branch/SHA/日期写入 ROUTE\_ID。

# 3｜Task Seq 是该线的进度刻度

- 每条 Route 独立从 <code>T001</code> 开始递增：T001 → T002 → T003。
- 本体系启用前的历史 Prompt <b>不回填编号</b>；从启用后的第一张新 Task/Goal 开始 T001。
- 发布前先占号。编号一旦被占用，即使后续取消/失败也不复用；Task Ledger 标记 CANCELLED/BLOCKED 即可。
- 新 Task 名称应简短说明这一步真正增加的 capability/evidence，推荐格式：<code>TNNN｜<动作> <对象/证据></code>，例如 <code>T004｜Freeze replay baseline</code>、<code>T005｜Closed-loop candidate A/B</code>。编号提供顺序，名称提供语义；不要用“继续推进”“再测试一下”作为正式任务名。
- 业务内部已有 R6D、M3、S2 等 scientific/experiment ID 可以继续保留，但它们不能替代 TASK\_ID。建议放在任务正文的 KNOWN\_REALITY / CONTEXT 中。

# 4｜发布前领取流程

1. 根据当前 Canonical Program/Lane 查询 <code>Codex Route Registry</code>。
2. 已有 Route：继承 ROUTE\_ID，读取 <code>Next Seq</code>。
3. 新 Commander line：先注册唯一 ROUTE\_ID 和 RETURN\_TO，再从 T001 开始。
4. 在 <code>Codex Task Ledger</code> 新建记录并占用 <code><ROUTE_ID>-T<NNN></code>；随后把 Route 的 <code>Next Seq</code> +1。
5. 再输出给用户可复制的 Task/Goal，正文第一、二行写 TASK\_ID / RETURN\_TO。
6. Task Card 一旦输出到聊天，Ledger 状态记为 PUBLISHED，同时 Route Registry 更新 <code>Last Task ID=<本号></code>、<code>Next Seq=<下一号></code>。
7. 用户粘回 Codex 结果时，Commander 首先读取第一行 TASK\_ID；若 TASK\_ID 与本聊天 Route 不一致，应提示用户应该回到哪个 RETURN\_TO，而不是静默接管。
8. Commander 验收结果后将 Ledger 标记 ACCEPTED / BLOCKED；只有 ACCEPTED 时才更新 Route Registry 的 <code>Last Accepted ID</code>。因此：<code>Last Task ID</code> 表示发到哪一步，<code>Last Accepted ID</code> 表示真正验收到哪一步，<code>Next Seq</code> 表示下一张该领几号。若发布 successor，则领取下一号。

# 5｜单写者与防撞号

- 同一 ROUTE\_ID 同一时刻只有一个 Commander line 拥有发布权；这是编号不撞车的主要保证。
- 并行聊天若都要独立派任务，必须拆成不同 ROUTE\_ID。
- Route Registry 是编号权威，聊天记忆不是。换账号/换聊天先查 Registry。
- 读取 <code>Next Seq</code> 后应立即登记并递增；不要先把编号写进 Prompt、过很久再回填登记库。
- 如果发现重复 Task ID，后创建者立即作废并领取新号；已经发出的两个不同 Contract 绝不能继续共享一个 ID。

## 2026-10-08｜AA-RDOPS：既有 Task Ledger 即 AI 任务评价基线（AutoAim ACTIVE）

- <b>不新增任务台账，不回写旧科学结论，不强制重发旧 Prompt。</b> 每条 Task 的 72 Ledger 项是稳定 TASK\_ID 与真实发送内容/冻结链接的索引；冻结全文可放 Ledger 正文或不可变 Git 文件，不要求两处重复。缺正文的历史任务标 FROZEN\_PROMPT\_MISSING，不猜测其提示词质量。
- 新发 AutoAim Task 时，除已有 Route/Status 外，Commander 在 Ledger 正文或其 Git 证据中保留 <code>VALUE_DELTA</code>、最低充分 <code>EVIDENCE_LEVEL</code>、<code>MODEL_TIER_REQUESTED</code>（DIRECT\_LOCAL/LOW/MEDIUM/HIGH 或 UNKNOWN）、所需 Provider/资源资格、预期 stop reason；不强制扩充中央数据库 schema，不拖累其他项目。
- 回填后在原 Task 关联 <code>DELIVERY_REF</code>（完整 Git SHA）、<code>ACTUAL_RESULT</code>（不仅 Codex 自报）、<code>REVIEW_VERDICT</code>、关键 blockers/retries/handoffs、起止可核验时刻及实际 model usage（无数据=UNKNOWN）；长期材料放 Git/Run receipt。<code>PUBLISHED</code> 仅代表任务卡实际交付，<code>RETURNED</code> 仅代表模型交了答卷，<code>ACCEPTED</code> 必须以可核验证据判定，不等于性能提升。
- <b>回放评测四对象</b>：派发前 Lane state → 冻结 Task/Goal 原文 → 本地真实 Git/runtime evidence → Commander acceptance。诊断 <code>目标 fidelity / Provider 真实性 / 自治是否保留 / 闭环完整度 / 证据层级 / 粒度 / 成本</code>。只比较同难度/同科学层级，明确遗漏值；不能凭 prompt 长度或 PASS 数排名模型。
- 默认验收结果用 5 行中文向 Owner 解释任务成果和投入；Independent Assurance 仅抽查跨层级 claim、费用失控、方向偏移或样本疑点，不对每条 Task 重做一轮审计。详细指标见 <mention url="https://app.notion.com/p/3f3909d673d28114a340fd580e593f38" />；2026-10-22（周四）做首次 review。

# 6｜Codex Result Contract

Codex 的结果开头固定：

```txt
TASK_ID: AA-MPC-T007
STATUS: DONE
RESULT: <一句话说明新增 capability / evidence>
```

后续再按 17 的 Result Contract 输出 EVIDENCE / VALIDATION / CLAIM\_BOUNDARY / DELIVERY\_POINTER / NEXT\_CURRENT\_QUESTION。

# 7｜搜索关键词

任务编号、Task ID、Codex 编号、回填路由、返回哪个聊天、RETURN\_TO、Route ID、任务顺序、进度编号、Codex result routing、prompt identifier、任务登记库。

<database url="https://app.notion.com/p/7d3906dd4783498baa09b4996f1fc223" data-source-url="collection://6aad8b5e-9410-45ea-82d4-dfed7864608f" inline="false">
71｜Codex Route Registry｜回填路线与序号分配
</database>

<database url="https://app.notion.com/p/4219634ea36541debc17f99fc3c8e68c" data-source-url="collection://1098729a-f880-466d-9d4b-237ddbfc24fb" inline="false">
72｜Codex Task Ledger｜任务编号・状态・回填记录
</database>
</content>
</page>
