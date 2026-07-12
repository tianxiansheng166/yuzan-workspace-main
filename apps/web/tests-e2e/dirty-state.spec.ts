import { expect, test } from "@playwright/test";

interface DirtyStateEntry {
  id: string;
  scope: "GLOBAL" | "SCHOOL" | "ROUTE" | "RESOURCE";
  owner: string;
  title: string;
  description?: string;
  status: string;
  canAutoSave: boolean;
  canDiscard: boolean;
  isBlocking: boolean;
  save: () => Promise<{ status: string; message?: string }>;
  discard: () => Promise<void>;
  metadata?: Record<string, unknown>;
}

interface DirtyStateApi {
  registry: {
    register: (entry: DirtyStateEntry) => void;
    clear: () => void;
    getLeaveRequest: () => unknown;
  };
  coordinator: {
    requestRouteLeave: (to: string) => Promise<boolean>;
    requestSchoolSwitch: () => Promise<boolean>;
    requestLogout: () => Promise<boolean>;
  };
}

declare global {
  interface Window {
    __yuzanDirtyState?: DirtyStateApi;
  }
}

async function injectDirtyState(
  page: import("@playwright/test").Page,
  overrides: Partial<DirtyStateEntry> = {},
): Promise<void> {
  await page.goto("/studio/plateau-route-v3");
  await page.waitForSelector("text=课程草稿详情", { timeout: 10000 });
  await page.evaluate((entryOverrides) => {
    const api = window.__yuzanDirtyState;
    if (!api) throw new Error("Dirty state API not exposed");
    api.registry.register({
      id: "e2e-dirty-entry",
      scope: "RESOURCE",
      owner: "e2e-test",
      title: "E2E 未保存条目",
      description: "测试用的未保存修改",
      status: "DIRTY",
      canAutoSave: true,
      canDiscard: true,
      isBlocking: true,
      save: async () => ({ status: "success" }),
      discard: async () => {},
      metadata: { resourceType: "e2e", resourceId: "entry-1" },
      ...entryOverrides,
    });
  }, overrides);
}

async function openLeaveDialog(page: import("@playwright/test").Page): Promise<void> {
  await injectDirtyState(page);
  await page.getByRole("link", { name: "返回工作台" }).click({ force: true });
  await page.waitForSelector("dialog.dirty-leave-dialog", { state: "visible", timeout: 5000 });
}

test.describe("dirty-state guard", () => {
  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      window.__yuzanDirtyState?.registry.clear();
    });
  });

  test("opens leave dialog when navigating with blocking dirty changes", async ({ page }) => {
    await openLeaveDialog(page);
    await expect(page.locator("dialog.dirty-leave-dialog")).toContainText("离开前请确认未保存内容");
    await expect(page.locator("dialog.dirty-leave-dialog")).toContainText("E2E 未保存条目");
  });

  test("stay editing keeps user on current page", async ({ page }) => {
    await openLeaveDialog(page);
    await page.click("dialog.dirty-leave-dialog button:has-text('返回继续编辑')");
    await expect(page.locator("dialog.dirty-leave-dialog")).toBeHidden();
    await expect(page).toHaveURL(/\/studio\/plateau-route-v3/);
  });

  test("save and continue navigates after success", async ({ page }) => {
    await openLeaveDialog(page);
    await page.click("dialog.dirty-leave-dialog button:has-text('保存并继续')");
    await expect(page).toHaveURL(/\/studio/, { timeout: 10000 });
  });

  test("discard and continue navigates", async ({ page }) => {
    await openLeaveDialog(page);
    await page.click("dialog.dirty-leave-dialog button:has-text('放弃修改并继续')");
    await expect(page).toHaveURL(/\/studio/, { timeout: 10000 });
  });

  test("blocks concurrent navigation while leave dialog is open", async ({ page }) => {
    await openLeaveDialog(page);
    await page.evaluate(() => {
      void window.__yuzanDirtyState?.coordinator.requestRouteLeave("/");
    });
    await expect(page.locator("dialog.dirty-leave-dialog")).toBeVisible();
    await expect(page).toHaveURL(/\/studio\/plateau-route-v3/);
  });

  test("shows demo notice in demo service mode", async ({ page }) => {
    await openLeaveDialog(page);
    await expect(page.locator("dialog.dirty-leave-dialog")).toContainText("演示模式");
    await expect(page.locator("dialog.dirty-leave-dialog")).toContainText("不会写入生产系统");
  });

  test("shows session expired banner and disables save", async ({ page }) => {
    await injectDirtyState(page, { status: "WAITING_SYNC" });
    await page.getByRole("link", { name: "返回工作台" }).click({ force: true });
    await page.waitForSelector("dialog.dirty-leave-dialog", { state: "visible", timeout: 5000 });
    await expect(page.locator("dialog.dirty-leave-dialog")).toContainText("会话已过期");
    await expect(
      page.locator("dialog.dirty-leave-dialog footer button:has-text('保存并继续')"),
    ).toBeDisabled();
  });
});

test.describe("responsive layout", () => {
  test("dialog fits at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openLeaveDialog(page);
    const dialog = page.locator("dialog.dirty-leave-dialog");
    const box = await dialog.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(390);
  });

  test("dialog fits at 768px", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await openLeaveDialog(page);
    const dialog = page.locator("dialog.dirty-leave-dialog");
    const box = await dialog.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(768);
  });

  test("dialog renders at 1440px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openLeaveDialog(page);
    await expect(page.locator("dialog.dirty-leave-dialog")).toBeVisible();
  });
});

test.describe("reduced motion", () => {
  test("respects prefers-reduced-motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openLeaveDialog(page);
    const dialog = page.locator("dialog.dirty-leave-dialog");
    const styles = await dialog.evaluate((el) => window.getComputedStyle(el));
    expect(styles.transition).toMatch(/none/);
    expect(parseFloat(styles.animationDuration)).toBeLessThanOrEqual(0.001);
  });
});
