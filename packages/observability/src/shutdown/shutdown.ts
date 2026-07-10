export type CleanupStrategy = "parallel" | "sequential";

export interface CleanupTask {
  name: string;
  fn: () => void | Promise<void>;
}

export interface CleanupResult {
  name: string;
  success: boolean;
  error?: string;
}

export interface ShutdownCoordinatorOptions {
  timeoutMs?: number;
  strategy?: CleanupStrategy;
  onError?: (results: CleanupResult[]) => void;
}

export class ShutdownCoordinator {
  private readonly tasks: CleanupTask[] = [];
  private shuttingDown = false;
  private readonly timeoutMs: number;
  private readonly strategy: CleanupStrategy;
  private readonly onError: ((results: CleanupResult[]) => void) | undefined;

  constructor(options: ShutdownCoordinatorOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.strategy = options.strategy ?? "sequential";
    this.onError = options.onError;
  }

  register(task: CleanupTask): void {
    if (this.shuttingDown) {
      throw new Error("Cannot register cleanup tasks during shutdown");
    }
    this.tasks.push(task);
  }

  async shutdown(): Promise<CleanupResult[]> {
    if (this.shuttingDown) {
      return [];
    }
    this.shuttingDown = true;

    const deadline = Date.now() + this.timeoutMs;
    const results: CleanupResult[] = [];

    if (this.strategy === "parallel") {
      const promises = this.tasks.map(async (task) => {
        const remaining = Math.max(1, deadline - Date.now());
        return runWithTimeout(task, remaining);
      });
      const settled = await Promise.all(promises);
      results.push(...settled);
    } else {
      for (const task of this.tasks) {
        const remaining = Math.max(1, deadline - Date.now());
        const result = await runWithTimeout(task, remaining);
        results.push(result);
        if (!result.success && this.strategy === "sequential") {
          // continue running remaining tasks; errors are aggregated
        }
      }
    }

    const failures = results.filter((r) => !r.success);
    if (failures.length > 0 && this.onError) {
      this.onError(failures);
    }

    return results;
  }
}

async function runWithTimeout(
  task: CleanupTask,
  ms: number,
): Promise<CleanupResult> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({
        name: task.name,
        success: false,
        error: "timeout",
      });
    }, ms);

    Promise.resolve()
      .then(() => task.fn())
      .then(() => {
        clearTimeout(timer);
        resolve({ name: task.name, success: true });
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        resolve({
          name: task.name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  });
}

export function createShutdownCoordinator(
  options?: ShutdownCoordinatorOptions,
): ShutdownCoordinator {
  return new ShutdownCoordinator(options);
}
