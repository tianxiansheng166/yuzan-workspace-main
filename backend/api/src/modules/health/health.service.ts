import { Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { STORAGE_PORT, type StoragePort } from "../../shared/storage/storage.port.js";

export type DependencyState = "UP" | "DOWN";

export interface CoreReadiness {
  database: DependencyState;
  redis: DependencyState;
  objectStorage: DependencyState;
}

const READINESS_TIMEOUT_MS = 2_500;

function within<T>(action: Promise<T>, timeoutMs = READINESS_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    action,
    new Promise<T>((_resolve, reject) => {
      setTimeout(() => reject(new Error("readiness check timed out")), timeoutMs);
    }),
  ]);
}

/** Small dependency checks shared by public readiness and the pilot overview. */
@Injectable()
export class HealthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() @Inject(STORAGE_PORT) private readonly storage?: StoragePort,
  ) {}

  async coreReadiness(): Promise<CoreReadiness> {
    const [database, redis, objectStorage] = await Promise.all([
      this.database(),
      this.redis(),
      this.objectStorage(),
    ]);
    return { database, redis, objectStorage };
  }

  private async database(): Promise<DependencyState> {
    try {
      await within(this.prisma.$queryRawUnsafe("SELECT 1"));
      return "UP";
    } catch {
      return "DOWN";
    }
  }

  private async redis(): Promise<DependencyState> {
    const url = this.config.get<string>("REDIS_URL");
    const redis = url
      ? new Redis(url, { lazyConnect: true, connectTimeout: READINESS_TIMEOUT_MS, maxRetriesPerRequest: 0 })
      : new Redis({
        host: this.config.get<string>("REDIS_HOST", "127.0.0.1"),
        port: Number(this.config.get<string | number>("REDIS_PORT", 6379)),
        ...(this.config.get<string>("REDIS_PASSWORD") ? { password: this.config.get<string>("REDIS_PASSWORD") } : {}),
        lazyConnect: true,
        connectTimeout: READINESS_TIMEOUT_MS,
        maxRetriesPerRequest: 0,
      });
    try {
      await within(redis.ping());
      return "UP";
    } catch {
      return "DOWN";
    } finally {
      redis.disconnect();
    }
  }

  private async objectStorage(): Promise<DependencyState> {
    try {
      if (!this.storage?.checkBucket) return "DOWN";
      await within(this.storage.checkBucket());
      return "UP";
    } catch {
      return "DOWN";
    }
  }
}
