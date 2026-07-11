import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { createCookiePolicyMiddleware } from "./bootstrap/cookie-policy.middleware.js";
import { requestContextMiddleware } from "./bootstrap/request-context.middleware.js";
import { HttpExceptionFilter } from "./common/http-exception.filter";
import { RequestIdInterceptor } from "./common/request-id.interceptor";

export function configureApplication(
  app: INestApplication,
  config: ConfigService,
): void {
  const origins = config.getOrThrow<readonly string[]>("WEB_ORIGINS");

  app.use(requestContextMiddleware);
  app.use(createCookiePolicyMiddleware(config));
  app.setGlobalPrefix("api/v1");
  app.use(helmet());
  app.enableCors({
    origin: [...origins],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalInterceptors(new RequestIdInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
}

export async function bootstrap(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  configureApplication(app, config);

  await app.listen(config.getOrThrow<number>("API_PORT"), "0.0.0.0");
  return app;
}

if (require.main === module) {
  void bootstrap();
}
