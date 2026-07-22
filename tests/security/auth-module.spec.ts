import { describe, expect, it } from "vitest";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import {
  AUTH_CONTEXT_SOURCE,
  AuthenticationGuard,
  Public,
  SecurityException,
} from "../../backend/api/src/common/security/index.js";
import { AuthModule } from "../../backend/api/src/modules/auth/auth.module.js";
import { DenyAllAuthContextSource } from "../../backend/api/src/modules/auth/deny-all-auth-context.source.js";
import { StubAuthContextSource } from "../../backend/api/src/modules/auth/stub-auth-context.source.js";
import { createMockExecutionContext } from "./mock-context.js";

describe("AuthModule default wiring", () => {
  it("uses a deny-all source by default", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    const guard = moduleRef.get(AuthenticationGuard);
    const context = createMockExecutionContext({
      headers: {
        "x-stub-user-id": "attacker",
        "x-stub-school-id": "school-a",
        "x-stub-roles": "TEACHER",
      },
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      SecurityException,
    );
    await expect(guard.canActivate(context)).rejects.toHaveProperty(
      "code",
      "UNAUTHENTICATED",
    );
  });

  it("allows public routes when unauthenticated", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    const guard = moduleRef.get(AuthenticationGuard);
    const publicHandler = () => undefined;
    Public()(publicHandler);
    const context = createMockExecutionContext({ handler: publicHandler });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("only trusts source when tests explicitly override", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(AUTH_CONTEXT_SOURCE)
      .useValue(new StubAuthContextSource())
      .compile();

    const guard = moduleRef.get(AuthenticationGuard);
    const context = createMockExecutionContext({
      headers: {
        "x-stub-user-id": "teacher-1",
        "x-stub-school-id": "school-a",
        "x-stub-roles": "TEACHER",
      },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("rejects forged role headers under the default source", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    const guard = moduleRef.get(AuthenticationGuard);
    const context = createMockExecutionContext({
      headers: {
        "x-role": "PLATFORM_ADMIN",
        "x-user-id": "attacker",
        "x-school-id": "school-a",
      },
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      SecurityException,
    );
    await expect(guard.canActivate(context)).rejects.toHaveProperty(
      "code",
      "UNAUTHENTICATED",
    );
  });

  it("exports the deny-all source implementation", () => {
    const source = new DenyAllAuthContextSource();
    const context = createMockExecutionContext({});
    expect(source.resolve(context)).toBeNull();
  });
});
