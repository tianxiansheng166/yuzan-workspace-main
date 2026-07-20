import { describe, expect, it } from "vitest";
import { todayDemoActivities } from "../../app/features/today/demo-data/today.demo";
import {
  completedActivities,
  continuingActivities,
  retestReminders,
  selectPrimaryActivity,
  sortTodayActivities,
} from "../../app/features/today/adapters/today.adapter";
import { demoTodayGateway } from "../../app/features/today/gateway/today.gateway";

describe("student today logic", () => {
  it("selects the highest-priority actionable task", () =>
    expect(selectPrimaryActivity(todayDemoActivities)?.id).toBe(
      "read-plateau-morning",
    ));
  it("sorts priorities without mutating the source", () => {
    const copy = [...todayDemoActivities];
    expect(sortTodayActivities(copy)[0]?.priority).toBe(100);
    expect(copy).toEqual(todayDemoActivities);
  });
  it("finds work to continue", () =>
    expect(
      continuingActivities(todayDemoActivities).map((x) => x.state),
    ).toContain("paused"));
  it("finds retest reminders", () =>
    expect(retestReminders(todayDemoActivities)).toHaveLength(1));
  it("separates completed review", () =>
    expect(completedActivities(todayDemoActivities)).toHaveLength(1));
  it("supports empty, unavailable and permission results", async () => {
    expect((await demoTodayGateway.load("empty")).activities).toEqual([]);
    expect((await demoTodayGateway.load("unavailable")).activities).toBeNull();
    expect((await demoTodayGateway.load("permission")).permitted).toBe(false);
  });
});
