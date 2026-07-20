import type { MembershipLoadResult, SchoolSelectionResult } from "./types";

export interface SchoolSelectionGateway {
  loadMemberships(): Promise<MembershipLoadResult>;
  selectSchool(schoolId: string): Promise<SchoolSelectionResult>;
  clearActiveSchool(): void;
}
