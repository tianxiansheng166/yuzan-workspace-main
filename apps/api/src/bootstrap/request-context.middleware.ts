import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function requestContextMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const candidate = request.header("x-request-id");
  const requestId =
    candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID();

  // The existing interceptor and all guards read this standard header. Setting
  // it before guard execution keeps one ID through authorization and errors.
  request.headers["x-request-id"] = requestId;
  response.setHeader("x-request-id", requestId);
  next();
}
