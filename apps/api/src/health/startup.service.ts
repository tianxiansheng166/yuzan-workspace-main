import { Injectable } from "@nestjs/common";
import type { StartupState } from "./health.types.js";

@Injectable()
export class StartupService {
  private state: StartupState = "starting";

  starting(): void {
    this.state = "starting";
  }

  ready(): void {
    this.state = "ready";
  }

  failed(): void {
    this.state = "failed";
  }

  getState(): StartupState {
    return this.state;
  }

  isReady(): boolean {
    return this.state === "ready";
  }
}
