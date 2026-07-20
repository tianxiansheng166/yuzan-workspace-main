import { Queue } from "bullmq";
import pino from "pino";
import { SpeechJobConsumer } from "./speech/speech-job.consumer.js";
import { SpeechScoringClient } from "./speech/speech-scoring.client.js";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

const SPEECH_QUEUE_NAME = "speech-jobs";

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

function getRedisConfig(): RedisConfig {
  const url = process.env.REDIS_URL;
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port, 10) || 6379,
      ...(parsed.password ? { password: parsed.password } : {}),
    };
  }
  return {
    host: process.env.REDIS_HOST ?? "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
  };
}

async function main(): Promise<void> {
  const speechProvider = process.env.SPEECH_PROVIDER ?? "disabled";
  const redisConfig = getRedisConfig();

  logger.info(
    { worker: "yuzan-worker", speechProvider, redis: `${redisConfig.host}:${redisConfig.port}` },
    "Worker starting",
  );

  // Health check for speech scoring service
  if (speechProvider !== "disabled") {
    const scoringClient = new SpeechScoringClient();
    const healthy = await scoringClient.isHealthy();
    if (!healthy) {
      logger.warn(
        { url: process.env.SPEECH_API_URL },
        "Speech scoring service is not reachable. Jobs will fail until it becomes available.",
      );
    } else {
      logger.info("Speech scoring service is healthy");
    }
  }

  // Start speech job consumer if enabled
  let speechConsumer: SpeechJobConsumer | null = null;

  if (speechProvider !== "disabled") {
    speechConsumer = new SpeechJobConsumer(SPEECH_QUEUE_NAME, redisConfig);
    speechConsumer.start();
    logger.info({ queue: SPEECH_QUEUE_NAME }, "Speech job consumer started");
  } else {
    logger.info("Speech processing is disabled (SPEECH_PROVIDER=disabled). Skipping consumer startup.");

    // Still create the queue so jobs can be enqueued
    try {
      const speechQueue = new Queue(SPEECH_QUEUE_NAME, { connection: redisConfig });
      logger.info({ queue: SPEECH_QUEUE_NAME }, "Speech queue created (consumer not started)");
    } catch (error: unknown) {
      logger.warn({ error }, "Could not connect to Redis. Queue creation skipped.");
    }
  }

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Worker stopping");
    if (speechConsumer) {
      await speechConsumer.stop();
    }
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main();
