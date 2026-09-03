import { openDesenAppLocalOperationHost } from "../desen-app/dev/local-operation-host.mjs";

/** Only this reviewed proof-server entry may share the real local listener. */
export const allowedOperationHostComposition = openDesenAppLocalOperationHost;
