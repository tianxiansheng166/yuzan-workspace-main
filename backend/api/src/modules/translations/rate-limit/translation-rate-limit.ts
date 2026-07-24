import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { TranslationRateLimitedException } from "../domain/translation.errors.js";

export const TRANSLATION_RATE_LIMITER = Symbol("TRANSLATION_RATE_LIMITER");
export const TRANSLATION_REDIS = Symbol("TRANSLATION_REDIS");

export interface TranslationRateLimiterPort {
  checkRateLimit(userId: string): Promise<void>;
}

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 10;

/**
 * In-memory fallback rate limiter used when Redis is unavailable.
 */
class InMemoryRateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  check(userId: string): void {
    const now = Date.now();
    let bucket = this.buckets.get(userId);

    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + WINDOW_MS };
      this.buckets.set(userId, bucket);
    }

    bucket.count++;

    if (bucket.count > MAX_REQUESTS) {
      throw new TranslationRateLimitedException();
    }
  }
}

@Injectable()
export class TranslationRateLimiter implements TranslationRateLimiterPort {
  private readonly logger = new Logger(TranslationRateLimiter.name);
  private readonly inMemoryFallback = new InMemoryRateLimiter();
  private redisAvailable = true;

  constructor(
    @Optional() @Inject(TRANSLATION_REDIS) private readonly redis?: import("ioredis").Redis,
  ) {
    if (!this.redis) {
      this.redisAvailable = false;
      this.logger.warn(
        "Redis not available for translation rate limiting; falling back to in-memory",
      );
    }
  }

  async checkRateLimit(userId: string): Promise<void> {
    if (!this.redisAvailable || !this.redis) {
      this.inMemoryFallback.check(userId);
      return;
    }

    try {
      const key = `translation:rate:${userId}`;
      const count = await this.redis.incr(key);

      if (count === 1) {
        await this.redis.pexpire(key, WINDOW_MS);
      }

      if (count > MAX_REQUESTS) {
        throw new TranslationRateLimitedException();
      }
    } catch (err) {
      if (err instanceof TranslationRateLimitedException) {
        throw err;
      }
      // Redis error — degrade gracefully to in-memory
      this.logger.warn(
        "Redis rate limit check failed, falling back to in-memory",
      );
      this.inMemoryFallback.check(userId);
    }
  }
}
