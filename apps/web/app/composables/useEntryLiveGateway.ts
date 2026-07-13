import { createEntryLiveGateway } from "~/features/entry-live/gateway";
export function useEntryLiveGateway(){return createEntryLiveGateway(useProductApi());}