import { describe, expect, it } from "vitest";
import { useProductPlans } from "../../app/features/product-plans/composables/useProductPlans";
import {
  comparisonFeatures,
  formatPrice,
  pricingTiers,
  type ComparisonFeature,
  type PricingTier,
} from "../../app/features/product-plans/data/product-plans";

describe("product plans data", () => {
  it("contains three tiers: basic, pro and premium", () => {
    expect(pricingTiers).toHaveLength(3);
    expect(pricingTiers.map((tier) => tier.id)).toEqual(
      expect.arrayContaining(["basic", "pro", "premium"]),
    );
  });

  it("includes required fields for every tier", () => {
    for (const tier of pricingTiers) {
      expect(tier.name).toBeTruthy();
      expect(tier.tagline).toBeTruthy();
      expect(tier.targetAudience).toBeTruthy();
      expect(typeof tier.price.amount).toBe("number");
      expect(tier.price.unit).toBeTruthy();
      expect(tier.discountNote).toBeTruthy();
      expect(tier.fundingSources.length).toBeGreaterThan(0);
      expect(tier.services.length).toBeGreaterThan(0);
      expect(tier.actions.trial.label).toBeTruthy();
      expect(tier.actions.trial.href).toBeTruthy();
      expect(tier.actions.consult.label).toBeTruthy();
      expect(tier.actions.consult.href).toBeTruthy();
      expect(tier.actions.schoolPlan.label).toBeTruthy();
      expect(tier.actions.schoolPlan.href).toBeTruthy();
    }
  });

  it("formats prices for display", () => {
    expect(formatPrice(0)).toBe("免费");
    expect(formatPrice(3600)).toBe("¥3,600");
    expect(formatPrice(9800)).toBe("¥9,800");
  });

  it("keeps comparison feature values aligned to tier ids", () => {
    const tierIds = new Set(pricingTiers.map((tier) => tier.id));

    for (const feature of comparisonFeatures) {
      for (const tierId of tierIds) {
        expect(Object.hasOwn(feature.values, tierId)).toBe(true);
      }
    }
  });
});

describe("useProductPlans composable", () => {
  it("transitions from idle to loading to complete", async () => {
    const plans = useProductPlans();
    expect(plans.state.value).toBe("idle");

    const loadPromise = plans.load();
    expect(plans.state.value).toBe("loading");
    await loadPromise;

    expect(plans.state.value).toBe("complete");
    expect(plans.tiers.value).toHaveLength(3);
    expect(plans.features.value.length).toBeGreaterThan(0);
  });

  it("enters empty state when loader returns no tiers", async () => {
    const plans = useProductPlans(async () => ({
      tiers: [],
      features: [],
    }));

    await plans.load();

    expect(plans.state.value).toBe("empty");
    expect(plans.tiers.value).toHaveLength(0);
  });

  it("enters error state when loader throws", async () => {
    const plans = useProductPlans(async () => {
      throw new Error("network failure");
    });

    await plans.load();

    expect(plans.state.value).toBe("error");
    expect(plans.error.value).toBeInstanceOf(Error);
    expect(plans.error.value?.message).toBe("network failure");
  });

  it("does not restart while already loading", async () => {
    const plans = useProductPlans(async () => ({
      tiers: pricingTiers,
      features: comparisonFeatures,
    }));

    const first = plans.load();
    const second = plans.load();
    await Promise.all([first, second]);

    expect(plans.state.value).toBe("complete");
  });
});
