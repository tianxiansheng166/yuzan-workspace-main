export interface WorkerHeartbeatClient {
  set(key: string, value: string, mode: "EX", ttlSeconds: number): Promise<unknown>;
  disconnect(): void;
}

export class WorkerHeartbeat {
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly client: WorkerHeartbeatClient,
    private readonly key: string,
    private readonly ttlSeconds: number,
    private readonly intervalMs: number,
    private readonly onFailure: (error: unknown) => void,
  ) {}

  async write(): Promise<void> {
    try {
      await this.client.set(this.key, String(Date.now()), "EX", this.ttlSeconds);
    } catch (error: unknown) {
      this.onFailure(error);
    }
  }

  start(): void {
    void this.write();
    this.timer = setInterval(() => { void this.write(); }, this.intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.client.disconnect();
  }
}
