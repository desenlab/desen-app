import { openDesenAppLocalOperationHost } from "../desen-app/dev/local-operation-host.mjs";

/** Other browser-proof entries must not acquire the product server's listener authority. */
export const forbiddenOperationHostComposition = openDesenAppLocalOperationHost;
