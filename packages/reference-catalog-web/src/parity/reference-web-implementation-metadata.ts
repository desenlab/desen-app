import { canonicalizeJson } from "@desen/protocol";

import { stackComponentRegistration, textComponentRegistration } from "../components/contracts.js";
import {
  alertComponentRegistration,
  buttonComponentRegistration,
  textFieldComponentRegistration,
} from "../components/interactive-contracts.js";
import { signInOperationRegistration } from "../operations/sign-in.js";

type JsonRecord = Readonly<Record<string, unknown>>;

type ComponentRegistration = Readonly<{
  readonly id: string;
  readonly manifest: JsonRecord;
}>;

interface ComponentImplementationDeclaration {
  readonly registration: ComponentRegistration;
  readonly productionExport: string;
  readonly authoringExport: string;
  readonly adapterFidelity: "same";
  readonly differences: readonly [];
  readonly slots: Readonly<Record<string, string>>;
  readonly events: Readonly<Record<string, string>>;
  readonly commands: Readonly<Record<string, string>>;
  readonly styleParts: Readonly<Record<string, ReferenceWebStylePartContract>>;
  readonly accessibilityContract: ReferenceWebAccessibilityContract;
}

/**
 * Stable presence rule for one semantic style-part hook.
 *
 * @remarks A conditional hook can be absent when its underlying content does not exist. This
 * metadata does not create placeholder DOM or apply resolved styles; that adapter work belongs to
 * M05.
 */
export type ReferenceWebStylePartPresence = "always" | "conditional";

/**
 * Inert documentation for one declared semantic style part.
 *
 * @remarks `meaning` describes the public hook without exposing a selector, DOM node, class name,
 * or implementation-library option.
 */
export interface ReferenceWebStylePartContract {
  /** Stable semantic meaning visible to package consumers. */
  readonly meaning: string;
  /** Whether the semantic surface exists for every rendered instance. */
  readonly presence: ReferenceWebStylePartPresence;
}

/**
 * Named accessibility policy exercised by the M03-T09 component contract suite.
 *
 * @remarks These identifiers describe narrow Web–React implementation tests. They are not a
 * universal accessibility certification and do not claim that resolved design styles are already
 * applied.
 */
export type ReferenceWebAccessibilityContract =
  | "neutral-layout-reading-order"
  | "native-semantic-text"
  | "native-labelled-text-input"
  | "native-non-submit-action"
  | "native-feedback-live-region";

/**
 * Catalog-derived public surfaces implemented by one reference component.
 *
 * @remarks Every name is derived from the exact registered manifest. Trusted React binding names
 * are recorded separately and never become DESEN props.
 */
export interface ReferenceWebDeclaredComponentSurfaces {
  /** Exact property names declared by `propsSchema.properties`. */
  readonly props: readonly string[];
  /** Exact named slot identifiers. */
  readonly slots: readonly string[];
  /** Exact event identifiers. */
  readonly events: readonly string[];
  /** Exact command identifiers. */
  readonly commands: readonly string[];
  /** Exact semantic style-part identifiers and documentation. */
  readonly styleParts: Readonly<Record<string, ReferenceWebStylePartContract>>;
  /** Exact visual-state identifiers in their declared order. */
  readonly visualStates: readonly string[];
}

/**
 * Trusted Web binding names that materialize declared slots, events, and commands.
 *
 * @remarks These names describe component-side primitives only. They are not Catalog props and do
 * not constitute the generic React adapter registry or runtime dispatch assigned to M05.
 */
export interface ReferenceWebTrustedComponentBindings {
  /** Declared slot id to trusted React materialization name. */
  readonly slots: Readonly<Record<string, string>>;
  /** Declared event id to trusted callback prop name. */
  readonly events: Readonly<Record<string, string>>;
  /** Declared command id to narrow imperative handle member. */
  readonly commands: Readonly<Record<string, string>>;
}

/**
 * Inert implementation-parity metadata for one real reference component.
 *
 * @remarks Export names are audit labels for statically imported package members. They are never
 * module specifiers and must not be interpreted as document-selected or remotely loaded code.
 */
export interface ReferenceWebComponentImplementationContract {
  /** Exact Catalog capability identifier. */
  readonly capabilityId: string;
  /** Named component export used by the production role. */
  readonly productionExport: string;
  /** Named component export used by the authoring role. */
  readonly authoringExport: string;
  /** Exact fidelity declared by the component manifest. */
  readonly adapterFidelity: "same";
  /** Known authoring differences; empty for `same` fidelity. */
  readonly differences: readonly [];
  /** Complete Catalog-derived public surface inventory. */
  readonly declared: ReferenceWebDeclaredComponentSurfaces;
  /** Trusted component-side bridge names for declared non-prop surfaces. */
  readonly trustedBindings: ReferenceWebTrustedComponentBindings;
  /** Narrow accessibility policy exercised by the reference proof. */
  readonly accessibilityContract: ReferenceWebAccessibilityContract;
}

/**
 * Inert binding-parity metadata for one explicitly delegated operation.
 *
 * @remarks The metadata names a statically reviewed factory export but carries no handler,
 * endpoint, credential, SDK, database query, authorization rule, or executable value.
 */
export interface ReferenceWebOperationImplementationContract {
  /** Exact Catalog capability identifier. */
  readonly capabilityId: string;
  /** Indicates that the trusted application composition root supplies the implementation. */
  readonly binding: "application-supplied";
  /** Audit label for the fixed-id host binding factory. */
  readonly bindingFactoryExport: "bindReferenceSignInHostOperation";
  /** Exact declared public error codes in Catalog order. */
  readonly publicErrors: readonly string[];
}

/**
 * Complete inert parity metadata for the M03 sign-in reference slice.
 *
 * @remarks This is not the complete frozen example Catalog. It intentionally covers five exact
 * official component entries and the exact sign-in operation entry, with no behavior or resource
 * claim. It contains no React values and is not an executable registry.
 */
export interface ReferenceWebImplementationMetadata {
  /** Metadata format version. */
  readonly schemaVersion: 1;
  /** Frozen DESEN protocol baseline. */
  readonly protocol: "0.1.0";
  /** Exact target implemented by this reference package. */
  readonly target: "web-react";
  /** Honest scope label preventing a full-example-Catalog claim. */
  readonly scope: "reference-sign-in-slice";
  /** Component contracts keyed by exact capability id. */
  readonly components: Readonly<Record<string, ReferenceWebComponentImplementationContract>>;
  /** Behavior contracts; empty until the later Sortable extensibility proof. */
  readonly behaviors: Readonly<Record<string, never>>;
  /** Delegated operation contracts keyed by exact capability id. */
  readonly operations: Readonly<Record<string, ReferenceWebOperationImplementationContract>>;
  /** Resource contracts; empty in the sign-in reference slice. */
  readonly resources: Readonly<Record<string, never>>;
}

function fail(message: string): never {
  throw new TypeError(`Invalid reference Web implementation metadata: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) fail(`${label} must be an object`);
  return value;
}

function canonicalNames(value: unknown, label: string): readonly string[] {
  if (value === undefined) return Object.freeze([]);
  return Object.freeze(Object.keys(requireRecord(value, label)).sort());
}

function declaredVisualStates(manifest: JsonRecord): readonly string[] {
  const value = manifest.visualStates;
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    fail("visualStates must contain only strings");
  }
  if (new Set(value).size !== value.length) fail("visualStates must not contain duplicates");
  return Object.freeze([...value] as string[]);
}

function assertExactNames(
  declared: readonly string[],
  implemented: Readonly<Record<string, unknown>>,
  label: string,
): void {
  const actual = Object.keys(implemented).sort();
  if (declared.length !== actual.length || declared.some((name, index) => name !== actual[index])) {
    fail(`${label} must cover exactly ${JSON.stringify(declared)}`);
  }
}

function componentSurfaces(
  declaration: ComponentImplementationDeclaration,
): ReferenceWebDeclaredComponentSurfaces {
  const manifest = declaration.registration.manifest;
  const propsSchema = requireRecord(manifest.propsSchema, `${declaration.registration.id} props`);
  const props = canonicalNames(
    propsSchema.properties,
    `${declaration.registration.id} prop properties`,
  );
  const slots = canonicalNames(manifest.slots, `${declaration.registration.id} slots`);
  const events = canonicalNames(manifest.events, `${declaration.registration.id} events`);
  const commands = canonicalNames(manifest.commands, `${declaration.registration.id} commands`);
  const stylePartNames = canonicalNames(
    manifest.styleParts,
    `${declaration.registration.id} style parts`,
  );

  assertExactNames(slots, declaration.slots, `${declaration.registration.id} slot bindings`);
  assertExactNames(events, declaration.events, `${declaration.registration.id} event bindings`);
  assertExactNames(
    commands,
    declaration.commands,
    `${declaration.registration.id} command bindings`,
  );
  assertExactNames(
    stylePartNames,
    declaration.styleParts,
    `${declaration.registration.id} style-part documentation`,
  );

  const fidelity = requireRecord(
    manifest.authoring,
    `${declaration.registration.id} authoring metadata`,
  ).adapterFidelity;
  if (fidelity !== declaration.adapterFidelity) {
    fail(`${declaration.registration.id} authoring fidelity must be same`);
  }
  if (
    declaration.adapterFidelity === "same" &&
    declaration.productionExport !== declaration.authoringExport
  ) {
    fail(`${declaration.registration.id} same fidelity must reuse one export`);
  }

  return {
    props,
    slots,
    events,
    commands,
    styleParts: declaration.styleParts,
    visualStates: declaredVisualStates(manifest),
  };
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  for (const nested of Object.values(value)) deepFreeze(nested);
  Object.freeze(value);
}

function immutableMetadata<Value>(value: Value): Value {
  const snapshot = JSON.parse(canonicalizeJson(value)) as Value;
  deepFreeze(snapshot);
  return snapshot;
}

const COMPONENT_IMPLEMENTATION_DECLARATIONS = Object.freeze([
  {
    registration: stackComponentRegistration,
    productionExport: "Stack",
    authoringExport: "Stack",
    adapterFidelity: "same",
    differences: Object.freeze([]),
    slots: Object.freeze({ default: "children" }),
    events: Object.freeze({}),
    commands: Object.freeze({}),
    styleParts: Object.freeze({
      root: Object.freeze({
        meaning: "Neutral linear-layout container.",
        presence: "always",
      }),
    }),
    accessibilityContract: "neutral-layout-reading-order",
  },
  {
    registration: textComponentRegistration,
    productionExport: "Text",
    authoringExport: "Text",
    adapterFidelity: "same",
    differences: Object.freeze([]),
    slots: Object.freeze({}),
    events: Object.freeze({}),
    commands: Object.freeze({}),
    styleParts: Object.freeze({
      text: Object.freeze({
        meaning: "Native semantic text element containing inert text.",
        presence: "always",
      }),
    }),
    accessibilityContract: "native-semantic-text",
  },
  {
    registration: textFieldComponentRegistration,
    productionExport: "TextField",
    authoringExport: "TextField",
    adapterFidelity: "same",
    differences: Object.freeze([]),
    slots: Object.freeze({}),
    events: Object.freeze({ change: "onChange" }),
    commands: Object.freeze({ focus: "ref.focus" }),
    styleParts: Object.freeze({
      control: Object.freeze({
        meaning: "Native text input control.",
        presence: "always",
      }),
      label: Object.freeze({
        meaning: "Visible label associated with the native text input.",
        presence: "always",
      }),
      message: Object.freeze({
        meaning: "Validation-message surface when trusted message content exists.",
        presence: "conditional",
      }),
      root: Object.freeze({
        meaning: "Text-field layout container.",
        presence: "always",
      }),
    }),
    accessibilityContract: "native-labelled-text-input",
  },
  {
    registration: buttonComponentRegistration,
    productionExport: "Button",
    authoringExport: "Button",
    adapterFidelity: "same",
    differences: Object.freeze([]),
    slots: Object.freeze({}),
    events: Object.freeze({ press: "onPress" }),
    commands: Object.freeze({}),
    styleParts: Object.freeze({
      label: Object.freeze({
        meaning: "Visible native button label.",
        presence: "always",
      }),
      leadingIcon: Object.freeze({
        meaning: "Decorative leading-icon surface when trusted icon content exists.",
        presence: "conditional",
      }),
      root: Object.freeze({
        meaning: "Native non-submit button control.",
        presence: "always",
      }),
    }),
    accessibilityContract: "native-non-submit-action",
  },
  {
    registration: alertComponentRegistration,
    productionExport: "Alert",
    authoringExport: "Alert",
    adapterFidelity: "same",
    differences: Object.freeze([]),
    slots: Object.freeze({}),
    events: Object.freeze({}),
    commands: Object.freeze({}),
    styleParts: Object.freeze({
      icon: Object.freeze({
        meaning: "Decorative tone indicator when trusted icon content exists.",
        presence: "conditional",
      }),
      root: Object.freeze({
        meaning: "Feedback live-region container.",
        presence: "always",
      }),
      text: Object.freeze({
        meaning: "Visible inert feedback text.",
        presence: "always",
      }),
    }),
    accessibilityContract: "native-feedback-live-region",
  },
] as const satisfies readonly ComponentImplementationDeclaration[]);

function buildComponentContracts(): Readonly<
  Record<string, ReferenceWebComponentImplementationContract>
> {
  const components: Record<string, ReferenceWebComponentImplementationContract> = Object.create(
    null,
  ) as Record<string, ReferenceWebComponentImplementationContract>;

  for (const declaration of COMPONENT_IMPLEMENTATION_DECLARATIONS) {
    const capabilityId = declaration.registration.id;
    if (Object.hasOwn(components, capabilityId)) {
      fail(`duplicate component ${JSON.stringify(capabilityId)}`);
    }
    components[capabilityId] = {
      capabilityId,
      productionExport: declaration.productionExport,
      authoringExport: declaration.authoringExport,
      adapterFidelity: declaration.adapterFidelity,
      differences: declaration.differences,
      declared: componentSurfaces(declaration),
      trustedBindings: {
        slots: declaration.slots,
        events: declaration.events,
        commands: declaration.commands,
      },
      accessibilityContract: declaration.accessibilityContract,
    };
  }

  return components;
}

function signInPublicErrors(): readonly string[] {
  const errors = signInOperationRegistration.manifest.errors;
  if (!Array.isArray(errors) || errors.some((entry) => !isRecord(entry))) {
    fail("sign-in public errors must be inert records");
  }
  const codes = errors.map((entry) => entry.code);
  if (codes.some((code) => typeof code !== "string")) {
    fail("sign-in public error codes must be strings");
  }
  return codes as string[];
}

/**
 * Canonical, recursively frozen, executable-free parity metadata for the exact M03 reference
 * sign-in slice.
 *
 * @remarks Component surfaces are derived from their registered Catalog manifests. Manual trusted
 * binding and style-part documentation must cover those declared names exactly or module
 * initialization fails. The artifact records export labels only; it carries no React component,
 * callback, host handler, module path, URL, selector, or loader.
 */
export const REFERENCE_WEB_IMPLEMENTATION_METADATA: ReferenceWebImplementationMetadata =
  immutableMetadata({
    schemaVersion: 1,
    protocol: "0.1.0",
    target: "web-react",
    scope: "reference-sign-in-slice",
    components: buildComponentContracts(),
    behaviors: {},
    operations: {
      [signInOperationRegistration.id]: {
        capabilityId: signInOperationRegistration.id,
        binding: "application-supplied",
        bindingFactoryExport: "bindReferenceSignInHostOperation",
        publicErrors: signInPublicErrors(),
      },
    },
    resources: {},
  });
