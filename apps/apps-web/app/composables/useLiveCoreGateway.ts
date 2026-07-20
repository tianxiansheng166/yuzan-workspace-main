import { createLiveCoreGateway } from "~/features/live-core/gateway";

export function useLiveCoreGateway() {
  return createLiveCoreGateway(useProductApi());
}