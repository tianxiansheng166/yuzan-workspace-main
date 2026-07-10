import {
  type DependencyCategory,
  type DependencyCheckResult,
} from "./health.types.js";

export type DependencyCheckerResult = Omit<
  DependencyCheckResult,
  "name" | "category" | "responseTimeMs" | "optional"
>;

export interface DependencyCheckConfig {
  name: string;
  category: DependencyCategory;
  optional?: boolean;
  timeoutMs?: number;
  checker?: () => Promise<DependencyCheckerResult> | DependencyCheckerResult;
}

export class DependencyCheck {
  constructor(private readonly config: DependencyCheckConfig) {}

  get name(): string {
    return this.config.name;
  }

  get category(): DependencyCategory {
    return this.config.category;
  }

  get optional(): boolean {
    return this.config.optional ?? false;
  }

  async check(): Promise<DependencyCheckResult> {
    const timeoutMs = this.config.timeoutMs ?? 5000;
    const start = Date.now();

    if (!this.config.checker) {
      return {
        name: this.config.name,
        category: this.config.category,
        status: "not-configured",
        responseTimeMs: Date.now() - start,
        optional: this.optional,
      };
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({
          name: this.config.name,
          category: this.config.category,
          status: "timeout",
          responseTimeMs: timeoutMs,
          errorCode: "CHECK_TIMEOUT",
          optional: this.optional,
        });
      }, timeoutMs);

      Promise.resolve()
        .then(() => this.config.checker!())
        .then((result) => {
          clearTimeout(timer);
          resolve({
            ...result,
            name: this.config.name,
            category: this.config.category,
            responseTimeMs: Date.now() - start,
            optional: this.optional,
          });
        })
        .catch(() => {
          clearTimeout(timer);
          resolve({
            name: this.config.name,
            category: this.config.category,
            status: "unavailable",
            responseTimeMs: Date.now() - start,
            errorCode: "CHECK_EXCEPTION",
            optional: this.optional,
          });
        });
    });
  }
}
