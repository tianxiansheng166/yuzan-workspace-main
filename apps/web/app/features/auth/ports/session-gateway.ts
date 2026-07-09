import type { AuthenticatedSession, SessionSnapshot } from "../models";

export interface SessionGateway {
  restore(): Promise<SessionSnapshot>;
  persist(session: AuthenticatedSession): Promise<void> | void;
  clear(): Promise<void> | void;
}
