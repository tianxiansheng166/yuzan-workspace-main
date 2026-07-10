# 最开始如何具体开发

## 先做的不是四路页面，而是三件事

### A. 设计包入库

只提交参考资料和资产登记，不改运行时代码。

### B. 创建前端 integration

从远程稳定 integration exact commit 建立，由 VM2 单一 controller 维护。

### C. Foundation 冻结

只让一个高质量视觉执行者完成 Token、AppShell、首页和基础组件。

在 Foundation 冻结前，B/C/D 可以阅读和准备，但不要同时修改共享 UI。

## Foundation 通过标准

- 首页方向得到用户确认；
-暖黄已移除；
-无玻璃；
-无内部开发文案；
-红/绿/白职责稳定；
-AppShell role slots 稳定；
-Button/Status/Notice/PageHeader props 稳定；
-三视口；
-tests/typecheck/build；
-接口保护脚本通过。

这不是要求所有页面一步到位，只是冻结共享语言。

## 然后并发

- Teacher：studio、assignments、review；
- Student：today、learning、reports；
- Assessment：五页；
- Auth owner：login/select-school 视觉适配。

每个流完成后直接 push，不安排完整独立视觉复审。

## 什么时候看效果

1. Foundation 合并后立即启动 preview，看首页、AppShell、login 基础；
2. B/C/D 合并后看完整核心路由；
3. 集中审核后做统一返工。

用户无需等所有后端持久层完成才看视觉。
