import pino from "pino";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

async function main(): Promise<void> {
  logger.info(
    { worker: "yuzan-worker" },
    "Worker scaffold started. Queue adapters are intentionally disabled until a task enables them.",
  );

  const shutdown = (signal: string): void => {
    logger.info({ signal }, "Worker stopping");
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

void main();
