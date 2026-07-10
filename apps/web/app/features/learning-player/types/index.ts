import type { ActivityType, LearningProgressState } from "../../today/types";

export type PlayerStep =
  "goal" | "material" | "tip" | "practice" | "check" | "save" | "next";
export type PlayerEvent =
  | "START"
  | "NEXT"
  | "BACK"
  | "PAUSE"
  | "RESUME"
  | "SAVE_LOCAL"
  | "SUBMIT"
  | "REQUEST_REVISION";

export interface LearningActivity {
  id: string;
  title: string;
  type: ActivityType;
  goal: string;
  material: string[];
  tip: string;
  prompt: string;
  completion: string;
  state: LearningProgressState;
  speechCapability: "available" | "unavailable";
  aiResult: "pending" | "unavailable";
}

export interface PlayerSnapshot {
  stepIndex: number;
  status: LearningProgressState;
  dirty: boolean;
  busy: boolean;
}

export interface ProgressGateway {
  saveLocal(
    activityId: string,
    snapshot: PlayerSnapshot,
  ): Promise<"local-only">;
  submit(activityId: string, snapshot: PlayerSnapshot): Promise<"unavailable">;
}

export interface ActivityGateway {
  get(activityId: string): Promise<LearningActivity | null>;
}
