import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { AiLessonPlanningController } from "./ai-lesson-planning.controller.js";
import { AiLessonPlanningService } from "./ai-lesson-planning.service.js";

/**
 * Factory for the BullMQ AI generation queue.
 * Returns null if Redis is not available, allowing the module to still load.
 */
const bullMqAiGenerationFactory = {
  provide: "BULLMQ_AI_GENERATION",
  useFactory: (config: ConfigService): Queue | null => {
    const redisUrl = config.get<string>("REDIS_URL");
    const redisHost = config.get<string>("REDIS_HOST") ?? "127.0.0.1";
    const redisPort = parseInt(config.get<string>("REDIS_PORT") ?? "6379", 10);

    const connection: Record<string, unknown> = redisUrl
      ? { url: redisUrl }
      : { host: redisHost, port: redisPort };

    const redisPassword = config.get<string>("REDIS_PASSWORD");
    if (redisPassword) {
      connection.password = redisPassword;
    }

    try {
      return new Queue("ai-generation-jobs", {
        connection: redisUrl
          ? redisUrl
          : { host: redisHost, port: redisPort, ...(redisPassword ? { password: redisPassword } : {}) },
      });
    } catch {
      return null;
    }
  },
  inject: [ConfigService],
};

@Module({
  controllers: [AiLessonPlanningController],
  providers: [AiLessonPlanningService, bullMqAiGenerationFactory],
  exports: [AiLessonPlanningService],
})
export class AiLessonPlanningModule {}
