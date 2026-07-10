import { HttpStatus, RequestMethod } from "@nestjs/common";
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { LoginDto } from "../../src/modules/identity/dto/login.dto.js";
import { IdentityController } from "../../src/modules/identity/identity.controller.js";
import { IdentityException } from "../../src/modules/identity/identity.errors.js";

function methodMetadata(method: keyof IdentityController) {
  const handler = IdentityController.prototype[method];
  return {
    path: Reflect.getMetadata(PATH_METADATA, handler),
    method: Reflect.getMetadata(METHOD_METADATA, handler),
    status: Reflect.getMetadata(HTTP_CODE_METADATA, handler),
  };
}

describe("IdentityController contract metadata", () => {
  it("keeps the controller at the root", () => {
    expect(Reflect.getMetadata(PATH_METADATA, IdentityController)).toBe("/");
  });

  it.each([
    ["login", "/auth/login", RequestMethod.POST, HttpStatus.OK],
    ["refresh", "/auth/refresh", RequestMethod.POST, HttpStatus.OK],
    ["logout", "/auth/logout", RequestMethod.POST, HttpStatus.NO_CONTENT],
    ["me", "/me", RequestMethod.GET, HttpStatus.OK],
  ] as const)(
    "maps %s to its OpenAPI route and status",
    (method, path, requestMethod, status) => {
      expect(methodMetadata(method)).toEqual({
        path,
        method: requestMethod,
        status,
      });
    },
  );

  it("returns no logout response body", async () => {
    const identityService = {
      logout: async () => undefined,
    };
    const controller = new IdentityController(identityService as never);
    const response = {
      clearCookie: () => response,
    };

    await expect(
      controller.logout(
        {},
        "Bearer access-token",
        undefined,
        response as never,
      ),
    ).resolves.toBeUndefined();
  });

  it("keeps unauthorized errors generic", () => {
    const missing = new IdentityException("AUTH_INVALID_CREDENTIALS");
    const wrongPassword = new IdentityException("AUTH_INVALID_CREDENTIALS");

    expect(missing.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    expect(missing.getResponse()).toEqual(wrongPassword.getResponse());
    expect(missing.getResponse()).not.toHaveProperty("details.userExists");
  });

  it("rejects invalid login payloads through DTO validation", async () => {
    const dto = Object.assign(new LoginDto(), {
      identifier: "",
      password: "short",
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
