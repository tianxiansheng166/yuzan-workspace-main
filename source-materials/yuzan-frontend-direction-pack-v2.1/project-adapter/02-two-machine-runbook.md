# VM1 / VM2 两机协作运行手册

## 唯一事实源

GitHub 是唯一远程事实源。

禁止：

- 两台机器手工复制不同版本设计包；
- task worktree 相互 pull；
- 两个 integration controller；
- 任何人直接改 main；
- force push。

## 推荐角色

### VM1

- 设计包入库；
- Stream A Foundation；
- 需要旧项目本地只读参考的视觉工作；
-本地页面预览。

原因：VM1 有新项目工作区、旧项目受控源和现有预览环境。

### VM2

- 前端 integration controller；
- cross-machine build/browser verification；
- 空闲 Trae 承担 B/C/D 中不与 VM1 冲突的页面流；
-高风险后端任务继续保持原所有权。

## 第 0 步：同步远程

两台机器只在各自主仓库执行：

```bash
git fetch origin --prune
git status --short
git worktree list
```

不要对 task worktree 执行 pull。

先记录：

```text
stable integration branch
stable integration exact commit
active task branches
active owners
dirty worktrees
```

## 第 1 步：VM1 入库设计包

在 VM1 创建独立 worktree：

```bash
REPO=/home/admin01/Documents/yuzan-workspace-main/yuzan-next
WTS=/home/admin01/Documents/yuzan-workspace-main/worktrees
BASE=$(git -C "$REPO" rev-parse origin/integration/core-framework-20260710)

git -C "$REPO" worktree add \
  "$WTS/frontend-directive-v2-1" \
  -b task/frontend-directive-v2-1 \
  "$BASE"
```

将包解压到：

```text
$WTS/frontend-directive-v2-1/
source-materials/yuzan-frontend-direction-pack-v2.1/
```

追加 `project-adapter/asset-register-import.csv` 中的参考资产记录到中央
`design-lab/asset-register.csv`，先去重 asset_id。

运行：

```bash
git status --short
git diff --check
git add source-materials/yuzan-frontend-direction-pack-v2.1 \
        design-lab/asset-register.csv
git commit -m "docs(design): add frontend redesign directive v2.1"
git push origin task/frontend-directive-v2-1
```

## 第 2 步：VM2 创建前端 integration

唯一 controller 在 VM2：

```bash
REPO=/home/tian/文档/yuzan-workspace-main/yuzan-next
WTS=/home/tian/文档/yuzan-workspace-main/worktrees

git -C "$REPO" fetch origin --prune
BASE=$(git -C "$REPO" rev-parse origin/integration/core-framework-20260710)

git -C "$REPO" worktree add \
  "$WTS/integration-frontend-redesign-20260710" \
  -b integration/frontend-redesign-20260710 \
  "$BASE"
```

合并设计包 exact commit，验证并普通 push。

不要在此 worktree 开发页面。

## 第 3 步：Stream A

继续使用原 `task/acc-ui-001-app-shell`，不要创建重复视觉基础分支。

开始前：

- 原 worktree clean；
- 当前成果已 commit/push；
- merge 设计包 exact commit；
- 不 reset、不 rebase、不 amend；
-明确获得 Token shared-file scope。

Stream A 完成后，由 controller 合入 frontend integration，并冻结：

- semantic tokens；
- AppShell slots；
- navigation interface；
-基础组件 props；
-资产路径。

## 第 4 步：B/C/D 并发

B/C/D 全部从包含 Stream A 的同一个 frontend integration exact commit 创建。

每路独立 branch/worktree，不能从各自本地旧 HEAD 开始。

推荐：

- VM1-Trae：Teacher；
- VM2-Trae：Student；
-另一空闲 Trae：Assessment。

实际分配前检查当前任务锁，不能抢占正在执行 QST、MIG、DB 或 OPS 的执行者。

## 第 5 步：Auth 视觉合并

原 Auth owner 合并 Foundation exact commit，在原 auth 分支追加视觉适配提交。

不得让 Stream A 自己重写 auth API client。

## 第 6 步：集中集成与审核

controller 依次合入：

1. Auth visual adaptation；
2. Teacher；
3. Student；
4. Assessment；
5. 第二阶段 Public/Admin。

全量验证后只做一次视觉审核和一次返工。
