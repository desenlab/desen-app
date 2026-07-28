import { createRuntimeResolutionSnapshot } from "./value-resolution.js";

import type { RuntimeJsonObject, RuntimeJsonValue } from "./host-ports.js";
import type { RuntimeResolutionSnapshotInput } from "./value-resolution.js";

const EMPTY_OBJECT = Object.freeze({}) as RuntimeJsonObject;
const EMPTY_LIFECYCLE_MAP = Object.freeze({}) as RuntimeResolutionSnapshotInput["resource"];
const UNAVAILABLE_EVENT = Object.freeze({ status: "unavailable" } as const);

/**
 * Copies one unknown value through the existing bounded, data-only runtime snapshot boundary.
 *
 * @remarks Target adapters use this pure seam to detach a hostile value before crossing a
 * framework lifecycle boundary. It deliberately reuses the M04-T02 safety profile instead of
 * creating a second JSON copier. The small scope envelope is counted against the same aggregate
 * limits, invokes no accessors, rejects Proxy/reflection failure, and returns only recursively
 * frozen inert JSON.
 */
export function snapshotRuntimeJsonValue(input: unknown): RuntimeJsonValue | undefined {
  try {
    const snapshot = createRuntimeResolutionSnapshot({
      state: { captured: input as RuntimeJsonValue },
      context: EMPTY_OBJECT,
      resource: EMPTY_LIFECYCLE_MAP,
      operation: EMPTY_LIFECYCLE_MAP,
      event: UNAVAILABLE_EVENT,
      item: EMPTY_OBJECT,
      env: EMPTY_OBJECT,
    });
    return snapshot.state.captured;
  } catch {
    return undefined;
  }
}

/** Returns whether one already-captured JSON value is a non-array object. */
export function isRuntimeJsonObject(value: unknown): value is RuntimeJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
