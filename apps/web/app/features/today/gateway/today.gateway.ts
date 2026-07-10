import { todayDemoActivities } from "../demo-data/today.demo";
import type { TodayResult, TodayScenario } from "../types";

export interface TodayGateway {
  load(scenario?: TodayScenario): Promise<TodayResult>;
}

export const demoTodayGateway: TodayGateway = {
  async load(scenario = "demo") {
    if (scenario === "permission") {
      return { marker: "demo", permitted: false, activities: [] };
    }
    if (scenario === "unavailable") {
      return { marker: "unavailable", permitted: true, activities: null };
    }
    return {
      marker: "demo",
      permitted: true,
      activities:
        scenario === "empty" ? [] : structuredClone(todayDemoActivities),
    };
  },
};
