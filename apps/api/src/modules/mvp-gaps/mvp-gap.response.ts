export type MvpGapCode =
  | "PERSISTENCE_PENDING"
  | "UNAVAILABLE"
  | "PROVIDER_NOT_CONFIGURED";

export interface MvpGapResponse {
  readonly error: {
    readonly code: MvpGapCode;
    readonly message: string;
    readonly scope: string;
  };
  readonly meta: {
    readonly requestId: string;
  };
}

export function mvpGapResponse(
  scope: string,
  code: MvpGapCode,
  message: string,
): MvpGapResponse {
  return {
    error: { code, message, scope },
    meta: { requestId: `mvp-gap-${scope.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` },
  };
}
