<script setup lang="ts">
import { onMounted } from "vue";
import { YxButton, YxLink } from "@yuzan/ui";
import { useProductPlans } from "../composables/useProductPlans";
import { formatPrice } from "../data/product-plans";

const { state, error, tiers, features, load } = useProductPlans();

onMounted(() => {
  void load();
});

function featureValue(featureId: string, tierId: string): string {
  const value = features.value?.find((item) => item.id === featureId)?.values[
    tierId
  ];

  if (typeof value === "boolean") {
    return value ? "包含" : "—";
  }

  return value ?? "—";
}
</script>

<template>
  <section class="product-plans yx-shell">
    <header class="product-plans__header">
      <div>
        <p class="yx-kicker">Product Plans</p>
        <h1>产品方案</h1>
        <p class="product-plans__lead">
          普惠版、专业版、旗舰版三级方案，覆盖不同规模学校与教育局的需求。
          资金来源与折扣说明公开透明，不实现支付，仅提供申请与咨询入口。
        </p>
      </div>
    </header>

    <div v-if="state === 'loading'" class="state-message" aria-live="polite">
      正在加载产品方案……
    </div>

    <div
      v-else-if="state === 'error'"
      class="state-message state-message--error"
      role="alert"
    >
      <p>加载失败：{{ error?.message ?? "未知错误" }}</p>
      <YxButton @click="load">重新加载</YxButton>
    </div>

    <div v-else-if="state === 'empty'" class="state-message">
      <p class="yx-kicker">No Plans</p>
      <h2>暂无产品方案</h2>
      <p>产品方案数据为空，请联系运营团队补充配置。</p>
    </div>

    <template v-else-if="state === 'complete'">
      <ul class="tier-grid" role="list">
        <li
          v-for="tier in tiers"
          :key="tier.id"
          class="tier-card"
          :class="{ 'tier-card--highlighted': tier.highlighted }"
        >
          <div class="tier-card__head">
            <h2>{{ tier.name }}</h2>
            <span v-if="tier.highlighted" class="tier-card__badge">推荐</span>
          </div>
          <p class="tier-card__tagline">{{ tier.tagline }}</p>

          <div class="tier-card__price">
            <span class="tier-card__amount">{{
              formatPrice(tier.price.amount)
            }}</span>
            <span class="tier-card__unit">{{ tier.price.unit }}</span>
            <span
              v-if="
                tier.price.originalAmount &&
                tier.price.originalAmount > tier.price.amount
              "
              class="tier-card__original"
            >
              原价 ¥{{ tier.price.originalAmount.toLocaleString("zh-CN") }}
            </span>
          </div>

          <p class="tier-card__audience">
            <strong>目标客群：</strong>{{ tier.targetAudience }}
          </p>

          <p class="tier-card__discount">{{ tier.discountNote }}</p>

          <div class="tier-card__section">
            <h3>服务内容</h3>
            <ul class="tier-card__services">
              <li v-for="service in tier.services" :key="service">
                {{ service }}
              </li>
            </ul>
          </div>

          <div class="tier-card__section">
            <h3>资金来源</h3>
            <ul class="tier-card__funding">
              <li v-for="source in tier.fundingSources" :key="source">
                {{ source }}
              </li>
            </ul>
          </div>

          <div class="tier-card__actions">
            <a :href="tier.actions.trial.href" class="tier-card__cta">
              {{ tier.actions.trial.label }}
            </a>
            <YxLink :href="tier.actions.consult.href" tone="muted">
              {{ tier.actions.consult.label }}
            </YxLink>
            <YxLink :href="tier.actions.schoolPlan.href">
              {{ tier.actions.schoolPlan.label }}
            </YxLink>
          </div>
        </li>
      </ul>

      <div class="comparison">
        <h2 class="comparison__title">服务差异比较</h2>

        <div class="comparison__header" aria-hidden="true">
          <span>功能</span>
          <span v-for="tier in tiers" :key="`h-${tier.id}`">{{
            tier.name
          }}</span>
        </div>

        <div
          v-for="feature in features"
          :key="feature.id"
          class="comparison__row"
        >
          <span class="comparison__label">{{ feature.label }}</span>
          <span
            v-for="tier in tiers"
            :key="`${feature.id}-${tier.id}`"
            class="comparison__value"
            :data-tier="tier.name"
          >
            {{ featureValue(feature.id, tier.id) }}
          </span>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.product-plans {
  padding-block: clamp(3rem, 7vw, 7rem);
}

.product-plans__header {
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--yx-border-default);
}

.product-plans h1 {
  margin: 0.8rem 0;
  font: 600 clamp(2rem, 5vw, 4rem) / 1 var(--yx-font-display);
}

.product-plans__lead {
  max-width: 52rem;
  color: var(--yx-text-muted);
  line-height: 1.7;
}

.state-message {
  min-height: 18rem;
  display: grid;
  align-content: center;
  justify-items: start;
  gap: 1rem;
  max-width: 42rem;
  padding-block: 3rem;
}

.state-message--error {
  color: var(--yx-danger-fg);
}

.tier-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  gap: 1.5rem;
  list-style: none;
  margin: 2rem 0 0;
  padding: 0;
}

.tier-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-lg);
  background: var(--yx-surface-default);
}

.tier-card--highlighted {
  border-color: var(--yx-text-accent);
  box-shadow: var(--yx-shadow-200);
}

.tier-card__head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
}

.tier-card h2 {
  margin: 0;
  font: 600 var(--yx-font-size-600) / 1.2 var(--yx-font-display);
}

.tier-card__badge {
  padding: 0.35rem 0.75rem;
  border-radius: var(--yx-radius-pill);
  background: var(--yx-text-accent);
  color: var(--yx-text-on-brand);
  font-size: var(--yx-font-size-100);
  font-weight: var(--yx-font-weight-semibold);
}

.tier-card__tagline {
  margin: 0;
  color: var(--yx-text-secondary);
}

.tier-card__price {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: baseline;
  padding-block: 0.75rem;
  border-block: 1px solid var(--yx-border-subtle);
}

.tier-card__amount {
  font: 600 var(--yx-font-size-700) / 1 var(--yx-font-display);
  color: var(--yx-text-accent);
}

.tier-card__unit {
  color: var(--yx-text-muted);
  font-size: var(--yx-font-size-200);
}

.tier-card__original {
  margin-left: auto;
  color: var(--yx-text-muted);
  font-size: var(--yx-font-size-200);
  text-decoration: line-through;
}

.tier-card__audience {
  margin: 0;
  color: var(--yx-text-secondary);
  font-size: var(--yx-font-size-200);
  line-height: 1.6;
}

.tier-card__discount {
  margin: 0;
  padding: 0.75rem;
  border-radius: var(--yx-radius-md);
  background: var(--yx-bg-muted);
  color: var(--yx-text-secondary);
  font-size: var(--yx-font-size-200);
  line-height: 1.6;
}

.tier-card__section h3 {
  margin: 0 0 0.5rem;
  font: 600 var(--yx-font-size-300) / 1.2 var(--yx-font-sans);
}

.tier-card__services,
.tier-card__funding {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding-left: 1.2rem;
  color: var(--yx-text-secondary);
  font-size: var(--yx-font-size-200);
}

.tier-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  align-items: center;
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid var(--yx-border-subtle);
}

.tier-card__cta {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  padding: 0.7rem 1.15rem;
  border-radius: var(--yx-radius-pill);
  background: var(--yx-action-primary-bg);
  color: var(--yx-action-primary-fg);
  text-decoration: none;
  font-weight: var(--yx-font-weight-semibold);
  box-shadow: var(--yx-shadow-100);
  transition:
    background-color var(--yx-motion-duration-base)
      var(--yx-motion-ease-standard),
    box-shadow var(--yx-motion-duration-base) var(--yx-motion-ease-standard);
}

.tier-card__cta:hover {
  background: var(--yx-action-primary-bg-hover);
}

.comparison {
  margin-top: 3rem;
  padding: 1.5rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-lg);
  background: var(--yx-surface-default);
}

.comparison__title {
  margin: 0 0 1.25rem;
  font: 600 var(--yx-font-size-500) / 1.2 var(--yx-font-display);
}

.comparison__header,
.comparison__row {
  display: grid;
  grid-template-columns: minmax(10rem, 1.2fr) repeat(3, minmax(0, 1fr));
  gap: 1rem;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--yx-border-subtle);
}

.comparison__header {
  font-weight: var(--yx-font-weight-semibold);
  color: var(--yx-text-secondary);
  border-bottom-color: var(--yx-border-default);
}

.comparison__label {
  color: var(--yx-text-secondary);
}

.comparison__value {
  color: var(--yx-text-primary);
}

@media (max-width: 48rem) {
  .comparison__header {
    display: none;
  }

  .comparison__row {
    grid-template-columns: 1fr;
    gap: 0.5rem;
    padding: 1rem 0;
  }

  .comparison__label {
    font-weight: var(--yx-font-weight-semibold);
    color: var(--yx-text-primary);
  }

  .comparison__value {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    color: var(--yx-text-secondary);
  }

  .comparison__value::before {
    content: attr(data-tier);
    color: var(--yx-text-primary);
    font-weight: var(--yx-font-weight-medium);
  }
}
</style>
