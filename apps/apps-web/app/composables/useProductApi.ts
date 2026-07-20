import { createFetchTransport, createProductApiClient } from "../lib/api/client";

const clients = new WeakMap<object, ReturnType<typeof createProductApiClient>>();

export function useProductApi() {
  const nuxtApp = useNuxtApp();
  const existing = clients.get(nuxtApp);
  if (existing) return existing;

  const config = useRuntimeConfig();
  const cookie = import.meta.server ? useRequestHeaders(["cookie"]).cookie : undefined;
  let client: ReturnType<typeof createProductApiClient>;
  client = createProductApiClient(createFetchTransport(String(config.public.apiBase), {
    forwardedCookie: cookie,
    getAccessToken: () => client.getAccessToken(),
  }));
  clients.set(nuxtApp, client);
  return client;
}
