import { createAuthApiClient, createFetchTransport } from "../lib/api/client";

export function useAuthApi(onRefreshFailure?: () => void) {
  const config = useRuntimeConfig();
  const cookie = import.meta.server
    ? useRequestHeaders(["cookie"]).cookie
    : undefined;
  return createAuthApiClient(
    createFetchTransport(String(config.public.apiBase), cookie),
    onRefreshFailure,
  );
}
