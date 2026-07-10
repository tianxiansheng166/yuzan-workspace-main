# 集中审核政策

## 普通前端流

不安排第二个执行者完整重读代码。

只要求：

-接口保护比较；
-业务测试；
-typecheck；
-build；
-三视口截图；
-scope；
-self-review；
-普通 push。

## 波次级审核

所有流合并后，一个高质量 Codex 进行：

-全路由视觉一致性；
-红绿比例；
-卡片数量；
-信息层级；
-响应式；
-无障碍；
-动效；
-真实状态；
-browser console/resource；
-接口保持抽查。

输出一份去重后的问题清单。

## 仍需独立严格复审

- auth/token；
- authorization/multi-tenancy；
- database transaction；
- file/upload；
- privacy/student data；
- speech provider；
- root security wiring。

视觉集中审核不能替代上述安全审核。
