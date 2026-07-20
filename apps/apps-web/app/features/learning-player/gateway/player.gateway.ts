import {
  cloneDemoActivity,
  unavailableActivity,
} from "../adapters/demo.adapter";
import type { ActivityGateway, ProgressGateway } from "../types";

export const demoActivityGateway: ActivityGateway = {
  async get(activityId) {
    return cloneDemoActivity(activityId);
  },
};

export const unavailableActivityGateway: ActivityGateway = {
  async get(activityId) {
    return unavailableActivity(activityId);
  },
};

// OFF-001 can implement this port later; this adapter never claims server sync.
export const demoProgressGateway: ProgressGateway = {
  async saveLocal() {
    return "local-only";
  },
  async submit() {
    return "unavailable";
  },
};
