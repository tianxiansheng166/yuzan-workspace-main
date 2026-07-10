# 集中开发、集中审查计划

## 1. 资源原则

前端阶段：

```text
80% 资源用于开发
20% 资源用于集中集成和统一审查
```

不再为每个页面创建一套独立复审链。

## 2. 波次

### Wave A：视觉基础

唯一视觉负责人：

- Token；
- 字体；
- AppShell；
- 导航；
- 首页；
- 基础视觉组件；
- 动效规范；
- 旧 Logo 适配。

完成后只做一次方向确认，不做逐文件审查。

### Wave B：四路页面并发

#### Lane 1：教师端

- studio；
- assignments；
- review；
- teacher reports。

#### Lane 2：学生端

- today；
- learning；
- exercises；
- student reports。

#### Lane 3：测评端

- assessment entry；
- reading；
- written；
- report；
- history comparison。

#### Lane 4：公共/公益/管理

- 首页后续区块；
- 志愿者；
- 公益说明；
- 学校管理；
- 登录与学校选择的视觉统一。

### Wave C：统一集成

单一 integration controller：

- 按 Foundation → Teacher → Student → Assessment → Public 合并；
- 处理冲突；
- 启动真实预览；
- 截图全部路由；
- 不做逐提交美学争论。

### Wave D：一次集中视觉审查

审查内容：

- 整体像不像同一产品；
- 援藏公益语义是否清晰；
- 红绿比例；
- 卡片数量；
- 移动端；
- 动效；
- 可访问；
- 页面密度；
- 真实业务状态。

输出一份统一问题清单，分 Critical/High/Medium/Low。

### Wave E：集中返工

- 每条问题只指定一个 owner；
- 同类问题由设计系统统一修复；
- 不在多个页面分别修同一个 Token；
- 返工完成后只做一次最终验收。

## 3. 推荐执行者分配

- Codex 1：视觉基础和高难动效；
- Trae 1：教师端；
- Trae 2：学生端；
- Trae 3：测评端；
- Trae 4：公共/公益/管理；
- Codex 2：统一集成、复杂交互和冲突；
- 其他 Codex 额度保留给后端、安全和真实 API。

## 4. 前端不需要独立复审的内容

只要以下通过，可进入集中集成：

- worktree clean；
- allowed paths；
- test；
- typecheck；
- build；
- 基本截图；
- 无明显权限或数据泄漏。

不需要逐任务安排另一个 AI 重新完整读代码。

## 5. 仍需严格复审的内容

- 身份与会话；
- 权限和多租户；
- 数据库事务；
- 上传与文件边界；
- 日志脱敏；
- 根模块安全接线；
- 语音供应商隐私；
- 对学生数据的导出与报告。
