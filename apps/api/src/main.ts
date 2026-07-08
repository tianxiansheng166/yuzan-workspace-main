import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/http-exception.filter'
import { RequestIdInterceptor } from './common/request-id.interceptor'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  const config = app.get(ConfigService)
  const origin = config.getOrThrow<string>('WEB_ORIGIN')
  const port = config.get<number>('API_PORT', 4000)

  app.setGlobalPrefix('api/v1')
  app.use(helmet())
  app.enableCors({
    origin: [origin],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  app.useGlobalInterceptors(new RequestIdInterceptor())
  app.useGlobalFilters(new HttpExceptionFilter())

  await app.listen(port, '0.0.0.0')
}

void bootstrap()
