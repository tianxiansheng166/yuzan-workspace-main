# v2.1 前端并发总览

## 顺序

```text
Design Pack
→ A Foundation freeze
→ AUTH/B/C/D parallel
→ E second phase
→ single integration
→ one batch review
→ one consolidated rework
```

## 互斥所有权

| Stream | 页面/内容 | 不允许拥有 |
|---|---|---|
| A | Token、AppShell 呈现、导航呈现、首页、共享视觉组件 | Auth API、业务 state、middleware |
| AUTH | login/select-school 呈现，由原 Auth owner 执行 | 重写 API client |
| B | studio、assignments、review、教师报告呈现 | auth、后端、contract |
| C | today、learning、学生报告呈现 | offline runtime、练习题 state（QST 未交接前） |
| D | 测评五页呈现 | speech provider、上传、隐私语义 |
| E | 志愿者、培训、翻译入口、产品、管理 | 首页、Auth、教师、学生、测评 |

## 启动条件

- A 先开始；
- A 冻结 exact commit 后 AUTH/B/C/D 才开始写共享视觉依赖；
- E 在核心页面可预览后启动；
- 所有流从同一个远程 frontend integration exact commit 创建；
- 不允许本地猜测 base。

## 每个流必须运行

- project preflight；
-interface snapshot；
- tests/typecheck/build；
-interface verification；
-截图；
-普通 push。
