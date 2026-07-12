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
  updatedAt?: number;
}

interface DirtyStateApi {
  registry: {
    register: (entry: DirtyStateEntry) => void;
    clear: () => void;
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

async function mockMe(page: import("@playwright/test").Page): Promise<void> {
  await page.route("**/api/v1/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          displayName: "测试用户",
          activeSchoolId: "school-1",
          memberships: [
            {
              schoolId: "school-1",
              schoolName: "测试学校",
              role: "TEACHER",
              region: "华北",
              schoolType: "小学",
              membershipStatus: "active",
              schoolStatus: "active",
              lastUsedAt: Date.now(),
            },
          ],
        },
      }),
    });
  });
}

function enterSchoolButton(page: import("@playwright/test").Page) {
  return page.getByRole("button", { name: /确认并进入|进入这所学校/ });
}

async function injectDirtyState(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.waitForFunction(
    () => typeof window.__yuzanDirtyState !== "undefined",
    null,
    { timeout: 5000 },
  );
  await page.evaluate(() => {
    const api = window.__yuzanDirtyState;
    if (!api) throw new Error("Dirty state API not exposed");
    api.registry.register({
      id: "e2e-dirty-entry",
      scope: "SCHOOL",
      owner: "e2e-test",
      title: "E2E 未保存学校上下文",
      description: "测试用的未保存修改",
      status: "DIRTY",
      canAutoSave: true,
      canDiscard: true,
      isBlocking: true,
      save: async () => ({ status: "success" }),
      discard: async () => {},
      metadata: { resourceType: "e2e", resourceId: "entry-1" },
      updatedAt: Date.now(),
    });
  });
}

test.describe("teacher / student core mvp", () => {
  test("teacher page renders with WAITING_BACKEND boundary", async ({ page }) => {
    await page.goto("/teacher");
    await expect(page.locator("text=教学工作台")).toBeVisible();
    await expect(page.locator("text=WAITING_BACKEND")).toBeVisible();
    await expect(
      page.locator("text=教学闭环接口等待后端契约"),
    ).toBeVisible();
  });

  test("student courses page renders with WAITING_BACKEND boundary", async ({ page }) => {
    await page.goto("/student/courses");
    await expect(page.locator("h1")).toContainText("沿着自己的节奏");
    await expect(page.locator("text=WAITING_BACKEND")).toBeVisible();
    await expect(page.locator("text=课程服务尚未接通")).toBeVisible();
  });
});

test.describe("select-school", () => {
  test("loads user and school memberships", async ({ page }) => {
    await mockMe(page);
    await page.goto("/select-school");
    await expect(
      page.locator("h1", { hasText: "选择你今天要进入的学校" }),
    ).toBeVisible();
    await expect(page.locator("text=测试用户")).toBeVisible();
    const schoolNode = page.locator(".school-node").filter({ hasText: "测试学校" });
    await expect(schoolNode.locator("h2", { hasText: "测试学校" })).toBeVisible();
    await expect(schoolNode.locator("dd", { hasText: "教师" })).toBeVisible();
  });

  test("POST /auth/select-school and GET /me verification on enter school", async ({ page }) => {
    let meCallCount = 0;
    let selectSchoolCall: { method: string; body: unknown } | null = null;

    await page.route("**/api/v1/me", async (route) => {
      meCallCount++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            displayName: "测试用户",
            activeSchoolId: "school-1",
            memberships: [
              {
                schoolId: "school-1",
                schoolName: "测试学校",
                role: "TEACHER",
                region: "华北",
                schoolType: "小学",
                membershipStatus: "active",
                schoolStatus: "active",
                lastUsedAt: Date.now(),
              },
            ],
          },
        }),
      });
    });

    await page.route("**/api/v1/auth/select-school", async (route) => {
      selectSchoolCall = {
        method: route.request().method(),
        body: route.request().postDataJSON(),
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: { user: { activeSchoolId: "school-1" } },
        }),
      });
    });

    await page.goto("/select-school");
    await expect(enterSchoolButton(page)).toBeVisible();
    await enterSchoolButton(page).click();
    await page.waitForURL(/\/teacher/, { timeout: 10000 });

    expect(selectSchoolCall).not.toBeNull();
    expect(selectSchoolCall?.method).toBe("POST");
    expect(selectSchoolCall?.body).toMatchObject({ schoolId: "school-1" });
    expect(meCallCount).toBeGreaterThanOrEqual(2);
  });

  test("dirty state blocks school switch and opens leave dialog", async ({ page }) => {
    await mockMe(page);
    await page.goto("/select-school");
    await expect(enterSchoolButton(page)).toBeVisible();
    await injectDirtyState(page);
    await enterSchoolButton(page).click();
    await page.waitForSelector("dialog.dirty-leave-dialog", {
      state: "visible",
      timeout: 5000,
    });
    await expect(page.locator("dialog.dirty-leave-dialog")).toContainText(
      "离开前请确认未保存内容",
    );
    await expect(page).toHaveURL(/\/select-school/);
  });

  test("dirty state blocks logout and opens leave dialog", async ({ page }) => {
    await mockMe(page);
    await page.goto("/select-school");
    await page.waitForSelector("text=退出登录");
    await injectDirtyState(page);
    await page
      .locator("aside.school-help button", { hasText: "退出登录" })
      .click();
    await page.waitForSelector("dialog.dirty-leave-dialog", {
      state: "visible",
      timeout: 5000,
    });
    await expect(page.locator("dialog.dirty-leave-dialog")).toContainText(
      "离开前请确认未保存内容",
    );
    await expect(page).toHaveURL(/\/select-school/);
  });

  test("stay editing does not POST select-school", async ({ page }) => {
    let selectSchoolCalled = false;

    await page.route("**/api/v1/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            displayName: "测试用户",
            activeSchoolId: "school-1",
            memberships: [
              {
                schoolId: "school-1",
                schoolName: "测试学校",
                role: "TEACHER",
                region: "华北",
                schoolType: "小学",
                membershipStatus: "active",
                schoolStatus: "active",
                lastUsedAt: Date.now(),
              },
            ],
          },
        }),
      });
    });

    await page.route("**/api/v1/auth/select-school", async (route) => {
      selectSchoolCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: { user: { activeSchoolId: "school-1" } },
        }),
      });
    });

    await page.goto("/select-school");
    await expect(enterSchoolButton(page)).toBeVisible();
    await injectDirtyState(page);
    await enterSchoolButton(page).click();
    await page.waitForSelector("dialog.dirty-leave-dialog", {
      state: "visible",
    });
    await page.click(
      "dialog.dirty-leave-dialog button:has-text('返回继续编辑')",
    );
    await expect(page.locator("dialog.dirty-leave-dialog")).toBeHidden();
    await page.waitForTimeout(500);
    expect(selectSchoolCalled).toBe(false);
  });
});
