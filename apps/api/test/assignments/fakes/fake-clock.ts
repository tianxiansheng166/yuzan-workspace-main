import type { Clock } from "../../../src/modules/assignments/ports/clock.port.js";

export class FixedClock implements Clock {
  constructor(private fixed: Date) {}

  now(): Date {
    return this.fixed;
  }

  set(now: Date): void {
    this.fixed = now;
  }
}
