import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests-e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile 390",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        userAgent: devices["iPhone 13"].userAgent,
      },
    },
    {
      name: "Tablet 768",
      use: {
        browserName: "chromium",
        viewport: { width: 768, height: 1024 },
        userAgent: devices["iPad Mini"].userAgent,
      },
    },
    {
      name: "Desktop 1440",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: "pnpm preview",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
