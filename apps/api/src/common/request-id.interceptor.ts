import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import type { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp()
    const request = http.getRequest<Request>()
    const response = http.getResponse<Response>()
    const requestId =
      typeof request.header('x-request-id') === 'string'
        ? request.header('x-request-id')!
        : randomUUID()

    response.setHeader('x-request-id', requestId)

    return next.handle().pipe(
      map((body: unknown) => {
        if (body === undefined || response.statusCode === 204) return body
        if (
          typeof body === 'object' &&
          body !== null &&
          ('data' in body || 'error' in body)
        ) {
          return body
        }
        return { data: body, meta: { requestId } }
      }),
    )
  }
}
