import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";

describe("API root startup", () => {
  let app: INestApplication;
  let origin: string;

  beforeAll(async () => {
    Object.assign(process.env, {
      API_PORT: "0",
      COOKIE_SECURE: "false",
      NODE_ENV: "test",
      SESSION_SECRET: "test-only-session-secret-at-least-32-characters",
      WEB_ORIGIN: "http://127.0.0.1:3000",
    });
    const { AppModule } = await import("../../src/app.module.js");
    const { configureApplication } = await import("../../src/main.js");
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApplication(app, app.get(ConfigService));
    await app.listen(0, "127.0.0.1");
    origin = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(["live", "ready"])(
    "starts the public health/%s endpoint",
    async (route) => {
      const response = await fetch(`${origin}/api/v1/health/${route}`);
      const body = (await response.json()) as {
        data?: { status?: string };
        meta?: { requestId?: string };
      };

      expect(response.status).toBe(200);
      expect(body.data?.status).toBe("ok");
      expect(body.meta?.requestId).toBe(response.headers.get("x-request-id"));
    },
  );

  it("keeps protected feature routes closed without an authenticated context", async () => {
    const response = await fetch(
      `${origin}/api/v1/schools/00000000-0000-4000-8000-000000000001/course-versions`,
    );
    expect(response.status).toBe(401);
  });
});
