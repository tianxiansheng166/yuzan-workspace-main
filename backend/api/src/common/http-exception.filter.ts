import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const requestId = String(response.getHeader("x-request-id") ?? "unknown");

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // P0-CONTRACT-CONVERGENCE-001: respect stable `code`/`message`/`details`
    // carried by module-level HttpExceptions (e.g. AssessmentHasNoItemsException).
    // Previously the filter overwrote `code` with `HTTP_${status}`, which made
    // front-end branching on stable codes impossible. Now we only fall back to
    // `HTTP_${status}` when the exception did not carry its own code.
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const stableCode =
      exceptionResponse &&
      typeof exceptionResponse === "object" &&
      "code" in exceptionResponse &&
      typeof (exceptionResponse as { code: unknown }).code === "string"
        ? (exceptionResponse as { code: string }).code
        : exception instanceof HttpException
          ? `HTTP_${status}`
          : "INTERNAL_ERROR";

    const stableMessage =
      status >= 500
        ? "服务暂时不可用"
        : exceptionResponse &&
            typeof exceptionResponse === "object" &&
            "message" in exceptionResponse &&
            typeof (exceptionResponse as { message: unknown }).message === "string"
          ? (exceptionResponse as { message: string }).message
          : exception instanceof HttpException
            ? exception.message
            : "请求失败";

    const stableDetails =
      exceptionResponse &&
      typeof exceptionResponse === "object" &&
      "details" in exceptionResponse &&
      typeof (exceptionResponse as { details: unknown }).details === "object"
        ? (exceptionResponse as { details: Record<string, unknown> }).details
        : {};

    // GOV-006 will replace console logging with structured redacted logging.
    if (status >= 500) {
      console.error({
        requestId,
        method: request.method,
        path: request.path,
        exception,
      });
    }

    response.status(status).json({
      error: {
        code: stableCode,
        message: stableMessage,
        details: stableDetails,
        requestId,
      },
    });
  }
}
