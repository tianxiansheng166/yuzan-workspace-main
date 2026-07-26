import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  BeforeApplicationShutdown,
} from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@yuzan/database";
import { Pool, type PoolConfig } from "pg";
import {
  DatabaseError,
  redactConnectionString,
  sanitizeDriverError,
} from "./database.errors";

const ENV_KEY = "DATABASE_URL";

/**
 * Validate and return the DATABASE_URL, throwing a fail-fast error
 * if it is missing or obviously malformed.
 */
function resolveConnectionString(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new DatabaseError(
      "DATABASE_CONFIG_INVALID",
      `${ENV_KEY} is required but not configured`,
      "startup",
      undefined,
      false,
    );
  }

  const url = raw.trim();

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
      throw new DatabaseError(
        "DATABASE_CONFIG_INVALID",
        `${ENV_KEY} must use postgresql:// or postgres:// protocol`,
        "startup",
        undefined,
        false,
      );
    }
    if (!parsed.hostname) {
      throw new DatabaseError(
        "DATABASE_CONFIG_INVALID",
        `${ENV_KEY} must include a hostname`,
        "startup",
        undefined,
        false,
      );
    }
  } catch (err) {
    if (err instanceof DatabaseError) throw err;
    throw new DatabaseError(
      "DATABASE_CONFIG_INVALID",
      `${ENV_KEY} is not a valid URL`,
      "startup",
      undefined,
      false,
    );
  }

  return url;
}

/**
 * Shared PrismaService — one Pool, one PrismaClient per API process.
 *
 * Lifecycle:
 *  1. onModuleInit: Pool + PrismaClient created, connectivity verified.
 *  2. beforeApplicationShutdown: signals "draining", no new business work.
 *  3. onModuleDestroy: Pool.end() + PrismaClient.$disconnect(), idempotent.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, BeforeApplicationShutdown, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;
  private _shuttingDown = false;
  private _destroyed = false;

  constructor(connectionStringOverride?: string) {
    const connectionString = resolveConnectionString(
      connectionStringOverride ?? process.env[ENV_KEY],
    );

    const safeUrl = redactConnectionString(connectionString);
    const poolConfig: PoolConfig = { connectionString };

    const pool = new Pool(poolConfig);
    const adapter = new PrismaPg(pool);

    super({ adapter });

    this.pool = pool;

    this.logger.log(`Database pool created for ${safeUrl}`);
  }

  get isShuttingDown(): boolean {
    return this._shuttingDown;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query("SELECT 1");
      this.logger.log("Database connectivity verified");
    } catch (err) {
      const safe = sanitizeDriverError(err);
      this.logger.error(`Database connectivity check failed: ${safe.message}`);
      throw new DatabaseError(
        safe.code,
        safe.message,
        "startup",
        undefined,
        safe.retryable,
      );
    }
  }

  async beforeApplicationShutdown(): Promise<void> {
    if (this._shuttingDown) return;
    this._shuttingDown = true;
    this.logger.log("Database runtime entering drain mode");
  }

  async onModuleDestroy(): Promise<void> {
    if (this._destroyed) return;
    this._destroyed = true;

    this.logger.log("Shutting down database runtime");

    try {
      await this.pool.end();
    } catch (err) {
      this.logger.warn(`Pool end error: ${(err as Error).message}`);
    }

    this.logger.log("Database runtime shut down");
  }
}
