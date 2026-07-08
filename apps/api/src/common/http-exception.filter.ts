import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import type { Request, Response } from 'express'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const request = ctx.getRequest<Request>()
    const response = ctx.getResponse<Response>()
    const requestId = String(response.getHeader('x-request-id') ?? 'unknown')

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR

    const code =
      exception instanceof HttpException
        ? `HTTP_${status}`
        : 'INTERNAL_ERROR'

    const message =
      status >= 500
        ? '服务暂时不可用'
        : exception instanceof HttpException
          ? exception.message
          : '请求失败'

    // GOV-006 will replace console logging with structured redacted logging.
    if (status >= 500) {
      console.error({ requestId, method: request.method, path: request.path, exception })
    }

    response.status(status).json({
      error: {
        code,
        message,
        details: {},
        requestId,
      },
    })
  }
}
