# 在新项目中使用 v2.1

## 1. 不要直接在当前主工作区解压后开发

设计包必须先通过独立 docs/source-materials 任务入库，再由 GitHub 同步到两台机器。

推荐目标：

```text
/home/admin01/Documents/yuzan-workspace-main/yuzan-next/
  source-materials/yuzan-frontend-direction-pack-v2.1/
```

不要放入：

```text
apps/web/
packages/ui/
public/
node_modules/
```

参考 PNG 不会自动成为生产资源。真正用于产品的图形必须经过资产登记、文化审查、
响应式裁切和低带宽处理后，再复制到正式资产目录。

## 2. 先提交设计包

建立独立任务：

```text
task/frontend-directive-v2-1
```

允许路径：

```text
source-materials/yuzan-frontend-direction-pack-v2.1/**
design-lab/asset-register.csv
```

设计包提交完成并 push 后，VM2 只从 GitHub fetch，不手工复制第二份。

## 3. 前端开发基线

不要让四个页面流直接从旧 `577a...` 各自开始。

先建立：

```text
integration/frontend-redesign-20260710
```

由唯一 integration controller 从当前稳定 integration exact commit 创建，并依次合入：

1. 设计包 commit；
2. Stream A Foundation commit；
3. 已批准的 Web Auth/API client；
4. B/C/D 页面流；
5. E 第二阶段。

尚未批准的后端持久层不阻止视觉开发，但页面必须显示真实 unavailable，不能伪造成功。

## 4. 接口保护

每个流开发前运行：

```bash
bash source-materials/yuzan-frontend-direction-pack-v2.1/scripts/project-preflight.sh
bash source-materials/yuzan-frontend-direction-pack-v2.1/scripts/snapshot-web-interface.sh \
  . .local/interface-baseline/<stream>
```

开发后运行：

```bash
bash source-materials/yuzan-frontend-direction-pack-v2.1/scripts/verify-web-interface.sh \
  . .local/interface-baseline/<stream>
```

`.local/` 不提交。

若接口比较失败，执行者必须停止，不得通过删除基线或测试来放行。

## 5. 页面流

### Stream A — Foundation/Home

负责：

- shared semantic tokens；
- AppShell；
- role navigation presentation；
- 首页；
-共享按钮、状态、Notice、PageHeader；
-视觉图层和资源路径。

不负责 Auth API、session、refresh、middleware。

### Auth Visual Adaptation — 原 Auth owner

原 `ACC-WEB-AUTH-001` owner 在 Stream A 冻结后：

- 合并 Foundation exact commit；
- 保留 API client、cookie、session、refresh、route guard；
- 只改 login/select-school 模板和样式；
- 跑原 Auth 测试。

### Stream B — Teacher

只改教师页面模板、视觉 feature 和展示组件。保留课程、任务、提交的 gateway/state。

### Stream C — Student

只改 today/learning/report。练习题页面在 QST Web commit 稳定后再并入，避免冲突。

### Stream D — Assessment

只负责测评五页及其展示状态。语音 provider 和上传语义不由视觉任务重写。

### Stream E — Public/Admin/Volunteer

第二阶段启动，不与首页 Foundation 同时修改公共首页。

## 6. 审查

前端每个流只做：

- interface preservation；
- tests；
- typecheck；
- build；
- 390/768/1440 截图；
- scope check；
-普通 commit/push。

所有流合并后做一次视觉集中审查和一次集中返工。

## 7. 不会丢接口的前提

只要执行者遵守以下条件，视觉重构不会导致接口丢失：

- 页面流以包含真实 API client 的 exact commit 为 base；
- protected paths 不被视觉流修改；
- before/after interface snapshot 通过；
- 原业务测试保留并通过；
- integration conflict 由唯一 controller 处理；
- 冲突时业务语义优先，视觉模板迁移到最新业务逻辑；
- 不使用静态数据绕过接口。
