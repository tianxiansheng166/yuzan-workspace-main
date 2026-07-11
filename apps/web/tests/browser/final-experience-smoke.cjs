const {
  chromium,
} = require("D:/program/test_program/yuzanxinsheng/three/worktrees/frontend-pixel-v4-runtime-qa-001/design-lab/frontend-pixel-v4-adoption/preflight/node_modules/playwright");

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const cases = [
  {
    name: "multiple-390",
    viewport: { width: 390, height: 844 },
    memberships: [
      {
        schoolId: "school-1",
        schoolName: "青海省海南州高原语言文字实验学校",
        role: "STUDENT",
        region: "青海省海南州",
        schoolType: "九年一贯制",
        membershipStatus: "active",
        schoolStatus: "active",
      },
      {
        schoolId: "school-2",
        schoolName: "河谷中心学校",
        role: "TEACHER",
        region: "青海省",
        membershipStatus: "active",
        schoolStatus: "active",
      },
    ],
  },
  {
    name: "inactive-768",
    viewport: { width: 768, height: 1024 },
    memberships: [
      {
        schoolId: "school-3",
        schoolName: "暂不可用学校",
        role: "STUDENT",
        membershipStatus: "inactive",
        schoolStatus: "active",
      },
    ],
  },
  {
    name: "no-school-1440",
    viewport: { width: 1440, height: 900 },
    memberships: [],
  },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  for (const item of cases) {
    const page = await browser.newPage({
      viewport: item.viewport,
      reducedMotion: "reduce",
    });
    const consoleErrors = [];
    const badResponses = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("response", (response) => {
      if (
        response.status() >= 400 &&
        !response.url().includes("localhost:4000")
      )
        badResponses.push(`${response.status()} ${response.url()}`);
    });
    await page.route("**/api/v1/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "user-1",
            displayName: "卓玛",
            memberships: item.memberships,
          },
          meta: {},
        }),
      }),
    );
    const response = await page.goto(`${baseUrl}/select-school`, {
      waitUntil: "domcontentloaded",
    });
    if (!response || response.status() !== 200)
      failures.push(`${item.name}: route status ${response?.status()}`);
    await page.waitForFunction(
      () => !document.body.textContent.includes("正在读取学校成员身份"),
    );
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
    );
    if (overflow) failures.push(`${item.name}: horizontal overflow`);
    if (consoleErrors.some((entry) => /hydration|mismatch|fatal/i.test(entry)))
      failures.push(`${item.name}: ${consoleErrors.join(" | ")}`);
    if (badResponses.length)
      failures.push(`${item.name}: network ${badResponses.join(" | ")}`);
    if (item.name.startsWith("multiple")) {
      await page.getByRole("button", { name: "进入这所学校" }).first().click();
      await page.waitForURL("**/student/today");
    }
    if (
      item.name.startsWith("inactive") &&
      (await page.getByRole("button", { name: "当前不可进入" }).isEnabled())
    )
      failures.push(`${item.name}: inactive membership enabled`);
    await page.close();
  }
  await browser.close();
  if (failures.length) throw new Error(failures.join("\n"));
  console.log(
    `final experience smoke passed: ${cases.length} states at ${baseUrl}`,
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
