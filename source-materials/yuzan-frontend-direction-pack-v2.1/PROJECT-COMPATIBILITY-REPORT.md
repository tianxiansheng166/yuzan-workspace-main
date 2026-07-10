# v2.0 对新项目的兼容性审计与 v2.1 修正

## 总结

v2.0 的视觉方向有效，独立页面图、色板、非卡片化规则和集中审查策略均可用。
但不应原样直接派发四路开发，因为它存在接口冲突和仓库治理风险。

v2.1 已处理这些问题。

## v2.0 有效部分

- 继承旧项目公益红、青稞绿、藏式蓝、金色和雪山白；
- 首页、教师工作台、学生页、朗读测评、报告和复核均有独立参考图；
- 明确禁止卡片墙、玻璃拟态、全站暖黄、紫蓝 AI 渐变；
- PNG 只作为构图参考，不允许切图冒充动态 UI；
- 前端采用集中开发、集中审查；
- 已声明不修改 OpenAPI、后端权限和数据库。

## v2.0 的主要风险

### 1. 安装位置不够安全

v2.0 推荐放到 `design-directive/`。新项目根级 `format:check` 会扫描整个仓库，
而现有 `.prettierignore` 已明确排除 `source-materials/`。因此 v2.1 改为安装到
`source-materials/yuzan-frontend-direction-pack-v2.1/`，避免参考 HTML/CSS 影响正式格式检查。

### 2. Stream A 与现有 Auth 任务重叠

新项目已经存在独立的 Web Auth/API 分支，包含真实 API client、刷新单航班、
cookie/session 和学校选择逻辑。视觉基础执行者不能重新拥有这些语义文件。

v2.1 规定：

- Stream A 负责 Token、AppShell、导航、首页和公共视觉；
- 登录与学校选择的业务语义由原 Auth owner 保留；
- Auth owner 在视觉基础冻结后，只迁移模板和样式；
- 视觉执行者不得修改 `lib/api`、auth `ports/adapters/state`、middleware 和 plugins。

### 3. 四路所有权有重叠

v2.0 同时让 A 与 D 负责公共使命内容，且 D 范围过大。

v2.1 改为五个互斥流：

- A：Foundation/Home；
- B：Teacher；
- C：Student；
- D：Assessment；
- E：Public/Admin/Volunteer，第二阶段启动。

### 4. UI Token 属于共享事实

新项目根 `AGENTS.md` 明确 UI tokens、OpenAPI、Prisma schema 和 root config
是共享 owner 文件。v2.1 要求 Foundation 任务先获得共享 Token 的明确授权，
并输出冻结 commit。其他流只能消费语义 Token，不能各自改 Token。

### 5. 缺少可机器验证的接口保护

v2.0 主要依赖文字约束。v2.1 新增：

- protected paths；
- interface baseline snapshot；
- route manifest；
- API reference snapshot；
- before/after comparison；
- 禁止删除现有 API、middleware、状态和测试；
- Stream handoff 的接口保存报告。

### 6. 旧项目参考边界不够具体

v2.1 进一步规定旧仓库：

- 只读；
- 不执行；
- 不作为运行时依赖；
- 不复制用户、学校、课程或统计数据；
- 不复制版权不明图片；
- 不将旧 JSON 接入新项目。

## 结论

```text
V2_0_VISUAL_DIRECTION=usable
V2_0_DIRECT_EXECUTION=safety_changes_required
V2_1_RECOMMENDED=yes
EXPECTED_INTERFACE_LOSS=prevented_by_contract_and_scripts
```
