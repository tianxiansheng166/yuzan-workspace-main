import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { SpeechJobController } from "./speech-job.controller.js";
import { SpeechJobService } from "./speech-job.service.js";
import { SPEECH_QUEUE } from "./speech-job.tokens.js";

/**
 * SpeechJobModule provides speech processing job management and BullMQ queue dispatch.
 *
 * When REDIS_HOST is configured and SPEECH_PROVIDER is not "disabled",
 * a BullMQ Queue is created for dispatching speech processing jobs to the Worker.
 * Otherwise, the queue provider is not registered and jobs remain in CREATED status.
 */
@Module({
  controllers: [SpeechJobController],
  providers: [
    {
      provide: SPEECH_QUEUE,
      useFactory: (config: ConfigService) => {
        const speechProvider = config.get<string>("SPEECH_PROVIDER", "disabled");
        const redisHost = config.get<string>("REDIS_HOST");
        const redisPort = config.get<number>("REDIS_PORT", 6379);

        // Only create queue if both Redis and speech provider are configured
        if (speechProvider === "disabled" || !redisHost) {
          return null;
        }

        return new Queue("speech-jobs", {
          connection: {
            host: redisHost,
            port: redisPort,
            ...(config.get<string>("REDIS_PASSWORD")
              ? { password: config.get<string>("REDIS_PASSWORD") }
              : {}),
          },
        });
      },
      inject: [ConfigService],
    },
    SpeechJobService,
  ],
  exports: [SpeechJobService],
})
export class SpeechJobModule {}
