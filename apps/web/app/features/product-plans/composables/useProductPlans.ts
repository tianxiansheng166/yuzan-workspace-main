import { ref, type Ref } from "vue";
import {
  comparisonFeatures,
  pricingTiers,
  type ComparisonFeature,
  type PricingTier,
} from "../data/product-plans";

export type ProductPlansState =
  "idle" | "loading" | "empty" | "error" | "complete";

export interface ProductPlansLoader {
  (): Promise<{ tiers: PricingTier[]; features: ComparisonFeature[] }>;
}

export interface UseProductPlansReturn {
  state: Ref<ProductPlansState>;
  error: Ref<Error | null>;
  tiers: Ref<PricingTier[]>;
  features: Ref<ComparisonFeature[]>;
  load: () => Promise<void>;
}

const defaultLoader: ProductPlansLoader = async () => ({
  tiers: pricingTiers,
  features: comparisonFeatures,
});

/**
 * 产品方案数据加载组合式函数。
 * 默认使用本地集中配置，可通过传入 loader 替换为真实 API 调用；
 * 保留 loading/empty/error/complete 四种状态，页面无需改动。
 */
export function useProductPlans(
  loader: ProductPlansLoader = defaultLoader,
): UseProductPlansReturn {
  const state = ref<ProductPlansState>("idle");
  const error = ref<Error | null>(null);
  const tiers = ref<PricingTier[]>([]);
  const features = ref<ComparisonFeature[]>([]);

  async function load(): Promise<void> {
    if (state.value === "loading") {
      return;
    }

    state.value = "loading";
    error.value = null;

    try {
      const result = await loader();
      // 模拟网络/校验延迟，便于在 UI 中观察 loading 状态。
      await new Promise((resolve) => {
        setTimeout(resolve, 120);
      });

      tiers.value = result.tiers;
      features.value = result.features;
      state.value = result.tiers.length === 0 ? "empty" : "complete";
    } catch (cause) {
      error.value = cause instanceof Error ? cause : new Error(String(cause));
      state.value = "error";
    }
  }

  return {
    state,
    error,
    tiers,
    features,
    load,
  };
}
