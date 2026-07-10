# Stream A 安全启动提示词

你是原 ACC_UI-001 owner。

先读取 v2.1 设计包和项目根 AGENTS。

开始前：

1. 核对原分支、remote、clean；
2. 合并 design pack exact commit；
3. 获得 Token/AppShell shared scope；
4. 运行 project-preflight；
5. 捕获 interface baseline。

只修改授权的 Token、AppShell 呈现、首页、品牌视觉和共享展示组件。

不得修改：

- login API/session；
-lib/api；
-auth ports/adapters/state；
-middleware/plugins；
-business features；
-contract；
-backend。

完成：

-冻结公共 props/token；
-tests/typecheck/build；
-interface verify；
-三视口截图；
-普通 commit/push。

不要自行合入 integration。
