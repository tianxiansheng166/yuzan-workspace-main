import { createFetchTransport, createProductApiClient } from "../lib/api/client";

export function useProductApi() {
  const config = useRuntimeConfig();
  const cookie = import.meta.server ? useRequestHeaders(["cookie"]).cookie : undefined;
  return createProductApiClient(
    createFetchTransport(String(config.public.apiBase), cookie),
  );
}
