# 前端集中视觉审核提示词

这是一个波次级集中审核，不是单提交审核。

审核目标：

```text
INTEGRATION_BRANCH=<分支>
EXACT_COMMIT=<提交>
ROUTES=<全部关键路由>
```

只读审核。

## 审核输出

对全部页面统一评分：

- 援藏公益识别；
- 旧品牌延续；
- 红绿比例；
- 卡片依赖；
- 页面结构；
- 角色一致性；
- 动效；
- 响应式；
- 可访问；
- 弱网；
- 真实状态。

输出一份问题清单：

```text
FRONTEND_BATCH_REVIEW

critical：
high：
medium：
low：

systemic fixes：
page-specific fixes：
token fixes：
motion fixes：
content fixes：

recommended owners：
single consolidated rework wave：
```

不要为同一 Token 问题在每个页面重复列项。

审核结束后只安排一次集中返工。
