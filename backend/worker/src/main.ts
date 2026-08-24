import { Queue } from "bullmq";
import { Redis } from "ioredis";
import pino from "pino";
import { SpeechJobConsumer } from "./speech/speech-job.consumer.js";
import { SpeechScoringClient } from "./speech/speech-scoring.client.js";
import {
  configuredSpeechProvider,
  type SpeechProviderName,
} from "./speech/speech-provider.js";
import { AiGenerationConsumer } from "./ai-generation/ai-generation.consumer.js";
import { TranslationConsumer } from "./translation/translation.consumer.js";
import { WorkerHeartbeat } from "./worker-heartbeat.js";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

const SPEECH_QUEUE_NAME = "speech-jobs";
const AI_GENERATION_QUEUE_NAME = "ai-generation-jobs";
const TRANSLATION_QUEUE_NAME = "translation-jobs";
const WORKER_HEARTBEAT_KEY = process.env.WORKER_HEARTBEAT_KEY ?? "yuzan:worker:heartbeat";
const WORKER_HEARTBEAT_TTL_SECONDS = Number.parseInt(process.env.WORKER_HEARTBEAT_TTL_SECONDS ?? "60", 10);
const WORKER_HEARTBEAT_INTERVAL_MS = Number.parseInt(process.env.WORKER_HEARTBEAT_INTERVAL_MS ?? "15000", 10);

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
    ...(process.env.REDIS_PASSWORD
      ? { password: process.env.REDIS_PASSWORD }
      : {}),
  };
}

async function main(): Promise<void> {
  let speechProvider: SpeechProviderName;
  try {
    speechProvider = configuredSpeechProvider();
  } catch (error: unknown) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Unsupported speech provider; speech processing is disabled",
    );
    speechProvider = "disabled";
  }
  const redisConfig = getRedisConfig();
  const heartbeatRedis = new Redis({ ...redisConfig, lazyConnect: true, maxRetriesPerRequest: 0 });
  heartbeatRedis.on("error", (error: Error) => logger.warn({ error }, "Worker heartbeat Redis connection error"));
  const heartbeat = new WorkerHeartbeat(
    heartbeatRedis,
    WORKER_HEARTBEAT_KEY,
    WORKER_HEARTBEAT_TTL_SECONDS,
    WORKER_HEARTBEAT_INTERVAL_MS,
    (error) => logger.warn({ error }, "Worker heartbeat update failed"),
  );
  heartbeat.start();

  logger.info(
    {
      worker: "yuzan-worker",
      speechProvider,
      redis: `${redisConfig.host}:${redisConfig.port}`,
    },
    "Worker starting",
  );

  // Health check for speech scoring service
  if (speechProvider === "local") {
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
    logger.info(
      "Speech processing is disabled (SPEECH_PROVIDER=disabled). Skipping consumer startup.",
    );

    // Still create the queue so jobs can be enqueued
    try {
      const speechQueue = new Queue(SPEECH_QUEUE_NAME, {
        connection: redisConfig,
      });
      logger.info(
        { queue: SPEECH_QUEUE_NAME },
        "Speech queue created (consumer not started)",
      );
    } catch (error: unknown) {
      logger.warn(
        { error },
        "Could not connect to Redis. Queue creation skipped.",
      );
    }
  }

  // Start AI generation consumer
  let aiConsumer: AiGenerationConsumer | null = null;
  const flowiseFlowId = process.env.FLOWISE_FLOW_ID ?? "";
  const flowiseApiKey = process.env.FLOWISE_API_KEY ?? "";

  if (flowiseFlowId && flowiseApiKey) {
    aiConsumer = new AiGenerationConsumer(
      AI_GENERATION_QUEUE_NAME,
      redisConfig,
    );
    aiConsumer.start();
    logger.info(
      { queue: AI_GENERATION_QUEUE_NAME },
      "AI generation consumer started",
    );
  } else {
    logger.info(
      "AI generation is disabled (FLOWISE_FLOW_ID or FLOWISE_API_KEY not set). Skipping consumer startup.",
    );

    // Still create the queue so API can enqueue jobs
    try {
      const aiQueue = new Queue(AI_GENERATION_QUEUE_NAME, {
        connection: redisConfig,
      });
      logger.info(
        { queue: AI_GENERATION_QUEUE_NAME },
        "AI generation queue created (consumer not started)",
      );
    } catch (error: unknown) {
      logger.warn(
        { error },
        "Could not connect to Redis. AI queue creation skipped.",
      );
    }
  }

  // Start translation consumer if enabled
  let translationConsumer: TranslationConsumer | null = null;
  const translationEnabled = process.env.TRANSLATION_ENABLED !== "false";

  if (translationEnabled) {
    translationConsumer = new TranslationConsumer(
      TRANSLATION_QUEUE_NAME,
      redisConfig,
    );
    translationConsumer.start();
    logger.info(
      { queue: TRANSLATION_QUEUE_NAME },
      "Translation consumer started",
    );
  } else {
    logger.info(
      "Translation is disabled (TRANSLATION_ENABLED=false). Skipping consumer startup.",
    );

    // Still create the queue so API can enqueue jobs
    try {
      const translationQueue = new Queue(TRANSLATION_QUEUE_NAME, {
        connection: redisConfig,
      });
      logger.info(
        { queue: TRANSLATION_QUEUE_NAME },
        "Translation queue created (consumer not started)",
      );
    } catch (error: unknown) {
      logger.warn(
        { error },
        "Could not connect to Redis. Translation queue creation skipped.",
      );
    }
  }

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Worker stopping");
    heartbeat.stop();
    if (speechConsumer) {
      await speechConsumer.stop();
    }
    if (aiConsumer) {
      await aiConsumer.stop();
    }
    if (translationConsumer) {
      await translationConsumer.stop();
    }
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main();
