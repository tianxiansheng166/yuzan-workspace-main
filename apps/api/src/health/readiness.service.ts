import { Injectable } from "@nestjs/common";
import { DependencyCheck } from "./dependency-check.js";
import {
  type DependencyCheckResult,
  type ReadinessData,
} from "./health.types.js";

export interface ReadinessOptions {
  productionRequired?: string[];
}

export interface ReadinessReport {
  ready: boolean;
  data: ReadinessData;
}

@Injectable()
export class ReadinessService {
  private readonly checks: DependencyCheck[] = [];

  constructor(
    checks: DependencyCheck[] = [],
    private readonly options: ReadinessOptions = {},
  ) {
    this.checks = checks;
  }

  register(check: DependencyCheck): void {
    this.checks.push(check);
  }

  async check(): Promise<ReadinessReport> {
    const results = await Promise.all(this.checks.map((c) => c.check()));
    const requiredSet = new Set(this.options.productionRequired ?? []);

    let degraded = false;
    let unavailable = false;

    for (const result of results) {
      if (result.status === "healthy") continue;

      if (result.status === "degraded") {
        degraded = true;
        continue;
      }

      if (result.optional) {
        degraded = true;
      } else if (requiredSet.size > 0 && !requiredSet.has(result.name)) {
        degraded = true;
      } else {
        unavailable = true;
      }
    }

    const timestamp = new Date().toISOString();
    const data: ReadinessData = {
      status: degraded || unavailable ? "degraded" : "ok",
      timestamp,
      dependencies: results,
    };

    return {
      ready: !unavailable,
      data,
    };
  }
}
