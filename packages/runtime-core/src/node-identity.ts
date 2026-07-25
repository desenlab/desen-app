import { canonicalizeJson, createJsonPointer } from "@desen/protocol";

import { isRuntimeJsonObject, snapshotRuntimeJsonValue } from "./runtime-json-snapshot.js";

import type { JsonPointer } from "@desen/protocol";

const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const ROOT_POINTER = createJsonPointer();
const NODE_IDENTITY_BRAND = new WeakSet<object>();
declare const RUNTIME_NODE_IDENTITY_TYPE_BRAND: unique symbol;

/** Exact data-only descriptor used to create or reconcile one non-repeated source node. */
export interface RuntimeNodeIdentityDescriptor {
  /** Exact Source/Bundle document identifier; equality is byte-for-byte JavaScript string equality. */
  readonly documentId: string;
  /** Exact surface identifier containing the source node. */
  readonly surfaceId: string;
  /** Exact protocol `id` of the non-repeated source node. */
  readonly nodeId: string;
  /** Exact component capability selected by the node's protocol `use` field. */
  readonly use: string;
}

/**
 * Factory-branded immutable base identity for one non-repeated source node.
 *
 * @remarks The collision-free canonical key contains document, surface, and source-node identity.
 * Revision, tree position, capability, props, styles, and adapter state are deliberately excluded.
 * Repeat instance discrimination belongs to M04-T07.
 */
export interface RuntimeNodeIdentity {
  /** Compile-time opaque marker; the corresponding runtime brand is held outside the value. */
  readonly [RUNTIME_NODE_IDENTITY_TYPE_BRAND]: true;
  /** Canonical structured tuple used as the stable base key. */
  readonly key: string;
  /** Exact Source/Bundle document identifier. */
  readonly documentId: string;
  /** Exact owning surface identifier. */
  readonly surfaceId: string;
  /** Exact non-repeated source-node identifier. */
  readonly nodeId: string;
  /** Current component capability; not part of the stable base key. */
  readonly use: string;
  /** Number of capability-change remount decisions within the same stable base identity. */
  readonly mountGeneration: number;
}

/** Stable reason why a node identity descriptor or prior identity was rejected. */
export type RuntimeNodeIdentityInvalidReason =
  | "unsafe-or-unbounded-descriptor"
  | "malformed-descriptor"
  | "malformed-document-id"
  | "malformed-surface-id"
  | "malformed-node-id"
  | "malformed-capability-id"
  | "forged-identity"
  | "generation-overflow";

/** Controlled identity failure carrying no substitute key or partial identity. */
export interface RuntimeNodeIdentityInvalid {
  /** Discriminates malformed identity data from successful creation or reconciliation. */
  readonly status: "invalid";
  /** Stable rejection classification. */
  readonly reason: RuntimeNodeIdentityInvalidReason;
  /** Descriptor-relative location when safely known. */
  readonly pointer: JsonPointer;
}

/** Complete outcome of creating one non-repeated base node identity. */
export type RuntimeNodeIdentityCreationResult =
  | Readonly<{
      /** Confirms that the exact descriptor was accepted. */
      status: "created";
      /** New immutable identity. */
      identity: RuntimeNodeIdentity;
    }>
  | RuntimeNodeIdentityInvalid;

/** Complete compatibility decision between a prior node identity and a next descriptor. */
export type RuntimeNodeIdentityReconciliation =
  | Readonly<{
      /** Base identity and capability match; an adapter may preserve its compatible instance. */
      status: "preserve-eligible";
      /** Exact previous identity, preserved by reference. */
      identity: RuntimeNodeIdentity;
    }>
  | Readonly<{
      /** Base identity matches but the component capability changed. */
      status: "remount-required";
      /** Stable remount classification. */
      reason: "capability-changed";
      /** Same base key with an incremented mount generation. */
      identity: RuntimeNodeIdentity;
    }>
  | Readonly<{
      /** Document, surface, or source-node identity changed. */
      status: "replace-required";
      /** Stable replacement classification. */
      reason: "identity-changed";
      /** Factory-authenticated identity being replaced. */
      previousIdentity: RuntimeNodeIdentity;
      /** Fresh base identity for the next node. */
      nextIdentity: RuntimeNodeIdentity;
    }>
  | RuntimeNodeIdentityInvalid;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isAsciiLetter(character: string): boolean {
  const code = character.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isAsciiDigit(character: string): boolean {
  const code = character.charCodeAt(0);
  return code >= 48 && code <= 57;
}

function isAsciiLetterOrDigit(character: string): boolean {
  return isAsciiLetter(character) || isAsciiDigit(character);
}

// The repeated dotted group in the frozen regex is language-redundant because the preceding
// namespace class already accepts dots. This linear scan preserves its exact accepted language
// without exposing a hostile descriptor to catastrophic RegExp backtracking.
function isCapabilityId(value: string): boolean {
  const slash = value.indexOf("/");
  if (slash <= 0 || slash !== value.lastIndexOf("/") || slash === value.length - 1) {
    return false;
  }
  const namespace = value.slice(0, slash);
  const name = value.slice(slash + 1);
  if (!isAsciiLetterOrDigit(namespace[0] as string)) return false;
  for (let index = 1; index < namespace.length; index += 1) {
    const character = namespace[index] as string;
    if (!isAsciiLetterOrDigit(character) && character !== "." && character !== "-") {
      return false;
    }
  }
  if (name.length === 0 || name.length > 128 || !isAsciiLetter(name[0] as string)) {
    return false;
  }
  for (let index = 1; index < name.length; index += 1) {
    const character = name[index] as string;
    if (
      !isAsciiLetterOrDigit(character) &&
      character !== "." &&
      character !== "_" &&
      character !== ":" &&
      character !== "-"
    ) {
      return false;
    }
  }
  return true;
}

function hasExactDescriptorKeys(value: Readonly<Record<string, unknown>>): boolean {
  const expected = ["documentId", "nodeId", "surfaceId", "use"];
  const actual = Object.keys(value).sort(compareText);
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function invalidIdentity(
  reason: RuntimeNodeIdentityInvalidReason,
  pointer: JsonPointer = ROOT_POINTER,
): RuntimeNodeIdentityInvalid {
  return Object.freeze({ status: "invalid", reason, pointer });
}

function descriptorPointer(member: keyof RuntimeNodeIdentityDescriptor): JsonPointer {
  return `/${member}` as JsonPointer;
}

function createIdentity(
  descriptor: RuntimeNodeIdentityDescriptor,
  mountGeneration: number,
): RuntimeNodeIdentity {
  const identity = Object.freeze({
    key: canonicalizeJson([descriptor.documentId, descriptor.surfaceId, descriptor.nodeId]),
    documentId: descriptor.documentId,
    surfaceId: descriptor.surfaceId,
    nodeId: descriptor.nodeId,
    use: descriptor.use,
    mountGeneration,
  });
  NODE_IDENTITY_BRAND.add(identity);
  return identity as unknown as RuntimeNodeIdentity;
}

function captureDescriptor(
  input: RuntimeNodeIdentityDescriptor,
):
  | Readonly<{ status: "captured"; descriptor: RuntimeNodeIdentityDescriptor }>
  | RuntimeNodeIdentityInvalid {
  const captured = snapshotRuntimeJsonValue(input);
  if (captured === undefined) {
    return invalidIdentity("unsafe-or-unbounded-descriptor");
  }
  if (!isRuntimeJsonObject(captured) || !hasExactDescriptorKeys(captured)) {
    return invalidIdentity("malformed-descriptor");
  }
  if (typeof captured.documentId !== "string" || captured.documentId.length === 0) {
    return invalidIdentity("malformed-document-id", descriptorPointer("documentId"));
  }
  if (typeof captured.surfaceId !== "string" || !IDENTIFIER_PATTERN.test(captured.surfaceId)) {
    return invalidIdentity("malformed-surface-id", descriptorPointer("surfaceId"));
  }
  if (typeof captured.nodeId !== "string" || !IDENTIFIER_PATTERN.test(captured.nodeId)) {
    return invalidIdentity("malformed-node-id", descriptorPointer("nodeId"));
  }
  if (typeof captured.use !== "string" || !isCapabilityId(captured.use)) {
    return invalidIdentity("malformed-capability-id", descriptorPointer("use"));
  }
  return Object.freeze({
    status: "captured",
    descriptor: captured as unknown as RuntimeNodeIdentityDescriptor,
  });
}

/**
 * Creates a stable base identity for one validated, non-repeated source node.
 *
 * @remarks Exact strings are never trimmed, case-folded, or Unicode-normalized. The descriptor is
 * bounded and copied before its fields become observable. Revisions and repeat keys are absent by
 * design.
 */
export function createRuntimeNodeIdentity(
  input: RuntimeNodeIdentityDescriptor,
): RuntimeNodeIdentityCreationResult {
  const captured = captureDescriptor(input);
  return captured.status === "invalid"
    ? captured
    : Object.freeze({
        status: "created",
        identity: createIdentity(captured.descriptor, 0),
      });
}

/**
 * Classifies whether a non-repeated node is eligible for preservation or requires replacement.
 *
 * @remarks Matching base identity and `use` returns the exact prior object. A `use` change
 * deterministically requires a remount in this headless profile. Actual adapter preservation,
 * remount-required prop policy, conditional mount state, and repeat keys remain later tasks.
 */
export function reconcileRuntimeNodeIdentity(
  previousIdentity: RuntimeNodeIdentity,
  next: RuntimeNodeIdentityDescriptor,
): RuntimeNodeIdentityReconciliation {
  if (
    typeof previousIdentity !== "object" ||
    previousIdentity === null ||
    !NODE_IDENTITY_BRAND.has(previousIdentity)
  ) {
    return invalidIdentity("forged-identity");
  }
  const captured = captureDescriptor(next);
  if (captured.status === "invalid") return captured;
  const descriptor = captured.descriptor;
  if (
    previousIdentity.documentId !== descriptor.documentId ||
    previousIdentity.surfaceId !== descriptor.surfaceId ||
    previousIdentity.nodeId !== descriptor.nodeId
  ) {
    return Object.freeze({
      status: "replace-required",
      reason: "identity-changed",
      previousIdentity,
      nextIdentity: createIdentity(descriptor, 0),
    });
  }
  if (previousIdentity.use === descriptor.use) {
    return Object.freeze({ status: "preserve-eligible", identity: previousIdentity });
  }
  if (previousIdentity.mountGeneration >= Number.MAX_SAFE_INTEGER) {
    return invalidIdentity("generation-overflow");
  }
  return Object.freeze({
    status: "remount-required",
    reason: "capability-changed",
    identity: createIdentity(descriptor, previousIdentity.mountGeneration + 1),
  });
}
