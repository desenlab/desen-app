import { canonicalizeJson } from "@desen/protocol";

import {
  STARTER_BUTTON_CAPABILITY_ID,
  STARTER_BOX_CAPABILITY_ID,
  STARTER_DIALOG_CAPABILITY_ID,
  STARTER_GRID_CAPABILITY_ID,
  STARTER_HEADING_CAPABILITY_ID,
  STARTER_ICON_CAPABILITY_ID,
  STARTER_IMAGE_CAPABILITY_ID,
  STARTER_SEPARATOR_CAPABILITY_ID,
  STARTER_SELECT_CAPABILITY_ID,
  STARTER_STACK_CAPABILITY_ID,
  STARTER_TEXT_CAPABILITY_ID,
  starterButtonComponentRegistration,
  starterBoxComponentRegistration,
  starterDialogComponentRegistration,
  starterGridComponentRegistration,
  starterHeadingComponentRegistration,
  starterIconComponentRegistration,
  starterImageComponentRegistration,
  starterSelectComponentRegistration,
  starterSeparatorComponentRegistration,
  starterStackComponentRegistration,
  starterTextComponentRegistration,
} from "./contracts.js";

import type { DesenSource } from "@desen/protocol";

/** Maximum shared prefix length that leaves room for every T01 template-owned child suffix. */
export const STARTER_TEMPLATE_ID_PREFIX_MAX_LENGTH = 120;

/** Maximum existing identity inventory accepted by one bounded template construction. */
export const STARTER_TEMPLATE_MAX_RESERVED_IDS = 25_000;

const LOCAL_ID_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const TEMPLATE_INPUT_KEYS = Object.freeze(["capabilityId", "idPrefix", "reservedIds"] as const);

/** Exact capability ids with an inert starter node template. */
export type StarterTemplateCapabilityId =
  | typeof STARTER_BUTTON_CAPABILITY_ID
  | typeof STARTER_BOX_CAPABILITY_ID
  | typeof STARTER_SELECT_CAPABILITY_ID
  | typeof STARTER_DIALOG_CAPABILITY_ID
  | typeof STARTER_GRID_CAPABILITY_ID
  | typeof STARTER_HEADING_CAPABILITY_ID
  | typeof STARTER_ICON_CAPABILITY_ID
  | typeof STARTER_IMAGE_CAPABILITY_ID
  | typeof STARTER_SEPARATOR_CAPABILITY_ID
  | typeof STARTER_STACK_CAPABILITY_ID
  | typeof STARTER_TEXT_CAPABILITY_ID;

/** One ordinary DESEN 0.1.0 Source node returned by the starter template boundary. */
export type StarterSourceNode = DesenSource["surfaces"][string]["root"];

/** Input accepted by {@link createStarterNodeTemplate}. */
export interface CreateStarterNodeTemplateInput {
  /** Exact registered starter capability to instantiate. */
  readonly capabilityId: StarterTemplateCapabilityId;
  /** Valid local Source identity used for the template root and deterministic child ids. */
  readonly idPrefix: string;
  /** Optional valid identities already reserved by the receiving Source surface. */
  readonly reservedIds?: readonly string[];
}

interface CapturedTemplateInput {
  readonly capabilityId: StarterTemplateCapabilityId;
  readonly idPrefix: string;
  readonly reservedIds: readonly string[];
}

function fail(path: string, message: string): never {
  throw new TypeError(`Invalid starter node template input at ${path}: ${message}`);
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  for (const nested of Object.values(value)) deepFreeze(nested);
  Object.freeze(value);
}

function immutableJsonSnapshot<Value>(value: Value): Readonly<Value> {
  const snapshot = JSON.parse(canonicalizeJson(value)) as unknown;
  deepFreeze(snapshot);
  return snapshot as Readonly<Value>;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function ownEnumerableDataValue(object: object, key: string): unknown | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor !== undefined && descriptor.enumerable && "value" in descriptor
    ? descriptor.value
    : undefined;
}

function captureTemplateInput(input: unknown): CapturedTemplateInput {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      fail("/", "expected an exact inert object");
    }
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== null && prototype !== Object.prototype) {
      fail("/", "expected a plain or null-prototype object");
    }

    const keys = Reflect.ownKeys(input);
    if (
      keys.some((key) => typeof key !== "string") ||
      keys.length < 2 ||
      keys.length > TEMPLATE_INPUT_KEYS.length ||
      !(keys as string[]).includes("capabilityId") ||
      !(keys as string[]).includes("idPrefix") ||
      (keys as string[]).some(
        (key) => !TEMPLATE_INPUT_KEYS.includes(key as (typeof TEMPLATE_INPUT_KEYS)[number]),
      )
    ) {
      fail("/", "expected only capabilityId, idPrefix, and optional reservedIds");
    }
    const capabilityId = ownEnumerableDataValue(input, "capabilityId");
    if (
      capabilityId !== STARTER_BUTTON_CAPABILITY_ID &&
      capabilityId !== STARTER_BOX_CAPABILITY_ID &&
      capabilityId !== STARTER_SELECT_CAPABILITY_ID &&
      capabilityId !== STARTER_DIALOG_CAPABILITY_ID &&
      capabilityId !== STARTER_GRID_CAPABILITY_ID &&
      capabilityId !== STARTER_HEADING_CAPABILITY_ID &&
      capabilityId !== STARTER_ICON_CAPABILITY_ID &&
      capabilityId !== STARTER_IMAGE_CAPABILITY_ID &&
      capabilityId !== STARTER_SEPARATOR_CAPABILITY_ID &&
      capabilityId !== STARTER_STACK_CAPABILITY_ID &&
      capabilityId !== STARTER_TEXT_CAPABILITY_ID
    ) {
      fail("/capabilityId", "unknown starter capability");
    }

    const idPrefix = ownEnumerableDataValue(input, "idPrefix");
    if (
      typeof idPrefix !== "string" ||
      idPrefix.length > STARTER_TEMPLATE_ID_PREFIX_MAX_LENGTH ||
      !LOCAL_ID_PATTERN.test(idPrefix)
    ) {
      fail(
        "/idPrefix",
        `expected a local identifier of at most ${STARTER_TEMPLATE_ID_PREFIX_MAX_LENGTH} characters`,
      );
    }

    const hasReservedIds = (keys as string[]).includes("reservedIds");
    const reservedIdsValue = hasReservedIds
      ? ownEnumerableDataValue(input, "reservedIds")
      : undefined;
    let reservedIdsArray: readonly unknown[] = [];
    if (hasReservedIds) {
      if (!Array.isArray(reservedIdsValue)) {
        fail("/reservedIds", "expected a finite dense array of local identifiers");
      }
      const arrayPrototype = Object.getPrototypeOf(reservedIdsValue);
      const lengthDescriptor = Object.getOwnPropertyDescriptor(reservedIdsValue, "length");
      if (
        arrayPrototype !== Array.prototype ||
        lengthDescriptor === undefined ||
        !("value" in lengthDescriptor) ||
        typeof lengthDescriptor.value !== "number" ||
        lengthDescriptor.value > STARTER_TEMPLATE_MAX_RESERVED_IDS
      ) {
        fail(
          "/reservedIds",
          `expected at most ${STARTER_TEMPLATE_MAX_RESERVED_IDS} local identifiers`,
        );
      }
      reservedIdsArray = reservedIdsValue;
    }

    const reservedIds: string[] = [];
    const reservedIdsLength = reservedIdsArray.length;
    for (let index = 0; index < reservedIdsLength; index += 1) {
      const value = ownEnumerableDataValue(reservedIdsArray, String(index));
      if (typeof value !== "string" || !LOCAL_ID_PATTERN.test(value)) {
        fail(`/reservedIds/${index}`, "expected an own-data local identifier");
      }
      reservedIds.push(value);
    }

    const expectedArrayKeys = Array.from({ length: reservedIdsLength }, (_, index) =>
      String(index),
    ).sort(compareText);
    const actualArrayKeys = Reflect.ownKeys(reservedIdsArray).filter((key) => key !== "length");
    if (
      actualArrayKeys.some((key) => typeof key !== "string") ||
      actualArrayKeys.length !== expectedArrayKeys.length ||
      !(actualArrayKeys as string[])
        .slice()
        .sort(compareText)
        .every((key, index) => key === expectedArrayKeys[index])
    ) {
      fail("/reservedIds", "expected a dense array with no extra properties");
    }

    return Object.freeze({ capabilityId, idPrefix, reservedIds: Object.freeze(reservedIds) });
  } catch (error) {
    if (error instanceof TypeError && error.message.startsWith("Invalid starter node template")) {
      throw error;
    }
    fail("/", "expected inert own data");
  }
}

function assertAvailableNodeIds(
  capabilityId: StarterTemplateCapabilityId,
  input: CapturedTemplateInput,
) {
  const generatedIds = [
    input.idPrefix,
    ...(capabilityId === STARTER_DIALOG_CAPABILITY_ID ||
    capabilityId === STARTER_BOX_CAPABILITY_ID ||
    capabilityId === STARTER_STACK_CAPABILITY_ID
      ? [`${input.idPrefix}.content`]
      : []),
    ...(capabilityId === STARTER_GRID_CAPABILITY_ID
      ? [`${input.idPrefix}.first`, `${input.idPrefix}.second`]
      : []),
  ];
  const reserved = new Set(input.reservedIds);
  for (const id of generatedIds) {
    if (!LOCAL_ID_PATTERN.test(id)) fail("/idPrefix", "produced an invalid child identifier");
    if (reserved.has(id)) fail("/reservedIds", `identity collision for ${JSON.stringify(id)}`);
    reserved.add(id);
  }
}

/**
 * Creates one detached, recursively frozen Source-node template for a registered starter component.
 *
 * @remarks Leaf content capabilities yield one node. Every T05 layout primitive and Dialog include
 * a bounded default-slot subtree, so palette insertion never produces a node that needs a later
 * required-child repair. The function never edits a Source, allocates around collisions, imports
 * Editor Core, or grants publication authority. A receiving editor must insert the complete
 * subtree atomically after checking the live surface namespace.
 *
 * @throws TypeError when input is not exact inert JSON, the capability or prefix is unsupported,
 * the reserved identity inventory exceeds its bound, or any generated identity collides.
 */
export function createStarterNodeTemplate(
  input: CreateStarterNodeTemplateInput,
): StarterSourceNode {
  const captured = captureTemplateInput(input);
  assertAvailableNodeIds(captured.capabilityId, captured);

  let node: StarterSourceNode;
  switch (captured.capabilityId) {
    case STARTER_BUTTON_CAPABILITY_ID:
      node = {
        id: captured.idPrefix,
        use: STARTER_BUTTON_CAPABILITY_ID,
        props: starterButtonComponentRegistration.manifest.authoring.defaultProps,
      };
      break;
    case STARTER_BOX_CAPABILITY_ID:
      node = {
        id: captured.idPrefix,
        use: STARTER_BOX_CAPABILITY_ID,
        props: starterBoxComponentRegistration.manifest.authoring.defaultProps,
        slots: {
          default: [
            {
              id: `${captured.idPrefix}.content`,
              use: STARTER_TEXT_CAPABILITY_ID,
              props: { text: "Box content" },
            },
          ],
        },
      };
      break;
    case STARTER_SELECT_CAPABILITY_ID:
      node = {
        id: captured.idPrefix,
        use: STARTER_SELECT_CAPABILITY_ID,
        props: {
          ...starterSelectComponentRegistration.manifest.authoring.defaultProps,
          options: starterSelectComponentRegistration.manifest.authoring.defaultProps.options.map(
            (option) => ({ ...option }),
          ),
        },
      };
      break;
    case STARTER_DIALOG_CAPABILITY_ID:
      node = {
        id: captured.idPrefix,
        use: STARTER_DIALOG_CAPABILITY_ID,
        props: starterDialogComponentRegistration.manifest.authoring.defaultProps,
        slots: {
          content: [
            {
              id: `${captured.idPrefix}.content`,
              use: STARTER_BUTTON_CAPABILITY_ID,
              props: {
                ...starterButtonComponentRegistration.manifest.authoring.defaultProps,
                label: "Continue",
              },
            },
          ],
        },
      };
      break;
    case STARTER_STACK_CAPABILITY_ID:
      node = {
        id: captured.idPrefix,
        use: STARTER_STACK_CAPABILITY_ID,
        props: starterStackComponentRegistration.manifest.authoring.defaultProps,
        slots: {
          default: [
            {
              id: `${captured.idPrefix}.content`,
              use: STARTER_TEXT_CAPABILITY_ID,
              props: { text: "Stack item" },
            },
          ],
        },
      };
      break;
    case STARTER_GRID_CAPABILITY_ID:
      node = {
        id: captured.idPrefix,
        use: STARTER_GRID_CAPABILITY_ID,
        props: starterGridComponentRegistration.manifest.authoring.defaultProps,
        slots: {
          default: [
            {
              id: `${captured.idPrefix}.first`,
              use: STARTER_TEXT_CAPABILITY_ID,
              props: { text: "Grid item one" },
            },
            {
              id: `${captured.idPrefix}.second`,
              use: STARTER_TEXT_CAPABILITY_ID,
              props: { text: "Grid item two" },
            },
          ],
        },
      };
      break;
    case STARTER_TEXT_CAPABILITY_ID:
      node = {
        id: captured.idPrefix,
        use: STARTER_TEXT_CAPABILITY_ID,
        props: starterTextComponentRegistration.manifest.authoring.defaultProps,
      };
      break;
    case STARTER_HEADING_CAPABILITY_ID:
      node = {
        id: captured.idPrefix,
        use: STARTER_HEADING_CAPABILITY_ID,
        props: starterHeadingComponentRegistration.manifest.authoring.defaultProps,
      };
      break;
    case STARTER_IMAGE_CAPABILITY_ID:
      node = {
        id: captured.idPrefix,
        use: STARTER_IMAGE_CAPABILITY_ID,
        props: starterImageComponentRegistration.manifest.authoring.defaultProps,
      };
      break;
    case STARTER_ICON_CAPABILITY_ID:
      node = {
        id: captured.idPrefix,
        use: STARTER_ICON_CAPABILITY_ID,
        props: starterIconComponentRegistration.manifest.authoring.defaultProps,
      };
      break;
    case STARTER_SEPARATOR_CAPABILITY_ID:
      node = {
        id: captured.idPrefix,
        use: STARTER_SEPARATOR_CAPABILITY_ID,
        props: starterSeparatorComponentRegistration.manifest.authoring.defaultProps,
      };
      break;
  }

  return immutableJsonSnapshot(node) as StarterSourceNode;
}
