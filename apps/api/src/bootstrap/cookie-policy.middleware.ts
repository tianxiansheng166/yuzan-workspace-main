import type { ConfigService } from "@nestjs/config";
import type { CookieOptions, NextFunction, Request, Response } from "express";
import type { CookieSameSite } from "../config/environment.js";

export function createCookiePolicyMiddleware(config: ConfigService) {
  const policy: CookieOptions = {
    httpOnly: true,
    path: "/",
    sameSite: config.getOrThrow<CookieSameSite>("COOKIE_SAME_SITE"),
    secure: config.getOrThrow<boolean>("COOKIE_SECURE"),
  };
  const domain = config.get<string>("COOKIE_DOMAIN")?.trim();
  if (domain) policy.domain = domain;

  return (_request: Request, response: Response, next: NextFunction): void => {
    const originalCookie = response.cookie.bind(response);
    const originalClearCookie = response.clearCookie.bind(response);

    response.cookie = ((
      name: string,
      value: unknown,
      options?: CookieOptions,
    ) =>
      originalCookie(name, value, {
        ...(options ?? {}),
        ...policy,
      })) as Response["cookie"];
    response.clearCookie = (name, options = {}) =>
      originalClearCookie(name, { ...options, ...policy });
    next();
  };
}
