import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env: Record<string, unknown>) => {
        const required = ["WEB_ORIGIN", "DATABASE_URL", "SESSION_SECRET"];
        const missing = required.filter(
          (key) => typeof env[key] !== "string" || !env[key],
        );
        if (missing.length > 0) {
          throw new Error(
            `Missing required environment variables: ${missing.join(", ")}`,
          );
        }
        if (String(env.SESSION_SECRET).length < 32) {
          throw new Error("SESSION_SECRET must be at least 32 characters");
        }
        return env;
      },
    }),
    HealthModule,
  ],
})
export class AppModule {}
