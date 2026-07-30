import { appendJsonPointer, createJsonPointer } from "@desen/protocol";
import {
  validateDesenInteractionCatalogSet,
  validateDesenSourceInteractionContracts,
} from "@desen/validator";

import type { DesenDiagnostic, DesenDiagnosticContext, JsonPointer } from "@desen/protocol";
import type {
  DesenPreparedSourceFoundation,
  DesenSemanticDiagnostic,
  DesenValidatedInteractionCatalogSet,
} from "@desen/validator";

import type { PublishResolvedCatalogPackage } from "./catalog-resolution.js";
import {
  annotatePublishErrorDiagnostic,
  createDeprecatedCapabilityWarning,
  createPublishFailure,
  normalizePublishDiagnostics,
} from "./publish-diagnostics.js";
import type {
  PublishErrorDiagnostic,
  PublishFailure,
  PublishWarningDiagnostic,
} from "./publish-result.js";
import {
  PUBLISH_SOURCE_PREFLIGHT_LIMITS,
  normalizePublishSourcePreflightLimits,
  preflightPublishSource,
  publishDiagnosticCodeUnits,
  publishDiagnosticsExceedSourcePreflightLimits,
} from "./source-preflight.js";
import type {
  PublishSourcePreflightLimits,
  PublishSourcePreflightResult,
  PublishSourcePreflightSuccess,
} from "./source-preflight.js";

/** Package-private diagnostic for bounded capability-preflight report exhaustion. */
export const CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED_CODE =
  "run.desen.publisher/CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED" as const;

/**
 * Complete nonterminal static capability authority prepared for later publication stages.
 *
 * @remarks The Source, selected packages, requirement alignment, and Catalog array are the exact
 * immutable authorities established by M06-T03. The Catalog array additionally carries the
 * Validator's private interaction-contract metadata. Dynamic value obligations deliberately do
 * not cross this boundary; M06-T05 owns their proof. This package-private intermediate has neither
 * `ok` nor `bundle`.
 */
export interface PublishCapabilityPreflightSuccess {
  readonly capabilityPreflighted: true;
  readonly source: DesenPreparedSourceFoundation;
  readonly catalogSet: DesenValidatedInteractionCatalogSet;
  readonly packages: readonly PublishResolvedCatalogPackage[];
  readonly requirementPackageIndexes: readonly number[];
  readonly diagnostics: readonly PublishWarningDiagnostic[];
}

/** Capability preflight either prepares complete downstream authority or exposes no partials. */
export type PublishCapabilityPreflightResult = PublishCapabilityPreflightSuccess | PublishFailure;

type SourceSnapshot = DesenPreparedSourceFoundation;
type SurfaceSnapshot = SourceSnapshot["surfaces"][string];
type NodeSnapshot = SurfaceSnapshot["root"];
type BehaviorSnapshot = NonNullable<NodeSnapshot["behaviors"]>[number];
type ActionSnapshot = NonNullable<NodeSnapshot["on"]>[string][number];
type OperationActionSnapshot = Extract<ActionSnapshot, { readonly type: "operation.invoke" }>;
type CatalogSnapshot = DesenValidatedInteractionCatalogSet[number];

interface DeprecatedCapabilities {
  readonly components: ReadonlySet<string>;
  readonly behaviors: ReadonlySet<string>;
  readonly operations: ReadonlySet<string>;
  readonly resources: ReadonlySet<string>;
}

interface NodeVisit {
  readonly node: NodeSnapshot;
  readonly pointer: JsonPointer;
  readonly surfaceId: string;
}

interface ActionVisit {
  readonly action: ActionSnapshot;
  readonly pointer: JsonPointer;
  readonly context: Readonly<DesenDiagnosticContext>;
}

const CAPABILITY_STAGE = "capability-contracts" as const;

function appendPath(pointer: JsonPointer, ...segments: readonly (number | string)[]): JsonPointer {
  let current = pointer;
  for (const segment of segments) current = appendJsonPointer(current, segment);
  return current;
}

function ownDataValue<Value>(object: object, key: PropertyKey): Value | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor !== undefined && "value" in descriptor
    ? (descriptor.value as Value)
    : undefined;
}

function isSourcePreflightSuccess(
  result: PublishSourcePreflightResult,
): result is PublishSourcePreflightSuccess {
  return ownDataValue(result, "preflighted") === true;
}

function isDeprecated(value: CatalogSnapshot["components"][string]["deprecated"]): boolean {
  return value === true || typeof value === "string";
}

function deprecatedCapabilities(
  catalogSet: DesenValidatedInteractionCatalogSet,
): DeprecatedCapabilities {
  const components = new Set<string>();
  const behaviors = new Set<string>();
  const operations = new Set<string>();
  const resources = new Set<string>();

  for (const catalog of catalogSet) {
    for (const [id, capability] of Object.entries(catalog.components)) {
      if (
        isDeprecated(
          ownDataValue<CatalogSnapshot["components"][string]["deprecated"]>(
            capability,
            "deprecated",
          ),
        )
      ) {
        components.add(id);
      }
    }
    for (const [id, capability] of Object.entries(catalog.behaviors)) {
      if (
        isDeprecated(
          ownDataValue<CatalogSnapshot["behaviors"][string]["deprecated"]>(
            capability,
            "deprecated",
          ),
        )
      ) {
        behaviors.add(id);
      }
    }
    for (const [id, capability] of Object.entries(catalog.operations)) {
      if (
        isDeprecated(
          ownDataValue<CatalogSnapshot["operations"][string]["deprecated"]>(
            capability,
            "deprecated",
          ),
        )
      ) {
        operations.add(id);
      }
    }
    for (const [id, capability] of Object.entries(catalog.resources)) {
      if (
        isDeprecated(
          ownDataValue<CatalogSnapshot["resources"][string]["deprecated"]>(
            capability,
            "deprecated",
          ),
        )
      ) {
        resources.add(id);
      }
    }
  }

  return Object.freeze({
    components,
    behaviors,
    operations,
    resources,
  });
}

function nodeContext(
  documentId: string,
  surfaceId: string,
  nodeId: string,
  capabilityId: string,
): Readonly<DesenDiagnosticContext> {
  return Object.freeze({
    documentId,
    surfaceId,
    subject: Object.freeze({ kind: "node", id: nodeId }),
    capabilityId,
  });
}

function behaviorContext(
  documentId: string,
  surfaceId: string,
  behaviorId: string,
  capabilityId: string,
): Readonly<DesenDiagnosticContext> {
  return Object.freeze({
    documentId,
    surfaceId,
    subject: Object.freeze({ kind: "behavior", id: behaviorId }),
    capabilityId,
  });
}

function resourceContext(
  documentId: string,
  surfaceId: string,
  capabilityId: string,
): Readonly<DesenDiagnosticContext> {
  return Object.freeze({ documentId, surfaceId, capabilityId });
}

function actionOwnerContext(
  context: Readonly<DesenDiagnosticContext>,
): Readonly<DesenDiagnosticContext> {
  return Object.freeze({
    ...(context.documentId === undefined ? {} : { documentId: context.documentId }),
    ...(context.surfaceId === undefined ? {} : { surfaceId: context.surfaceId }),
    ...(context.subject === undefined ? {} : { subject: context.subject }),
  });
}

function enqueueActionMap(
  actionVisits: ActionVisit[],
  actionMap: NodeSnapshot["on"] | BehaviorSnapshot["on"] | undefined,
  pointer: JsonPointer,
  context: Readonly<DesenDiagnosticContext>,
): void {
  if (actionMap === undefined) return;
  for (const [eventName, actions] of Object.entries(actionMap)) {
    actions.forEach((action, index) => {
      actionVisits.push({
        action,
        pointer: appendPath(pointer, eventName, index),
        context,
      });
    });
  }
}

function enqueueSlotNodes(
  nodeVisits: NodeVisit[],
  slots: NodeSnapshot["slots"] | BehaviorSnapshot["slots"] | undefined,
  pointer: JsonPointer,
  surfaceId: string,
): void {
  if (slots === undefined) return;
  for (const [slotName, nodes] of Object.entries(slots)) {
    nodes.forEach((node, index) => {
      nodeVisits.push({
        node,
        pointer: appendPath(pointer, slotName, index),
        surfaceId,
      });
    });
  }
}

function appendBoundedWarning(
  warnings: PublishWarningDiagnostic[],
  warning: PublishWarningDiagnostic,
  budget: { aggregateCodeUnits: number },
  limits: Readonly<PublishSourcePreflightLimits>,
): boolean {
  const pointerCodeUnits = warning.pointer?.length ?? 0;
  const nextAggregate = budget.aggregateCodeUnits + publishDiagnosticCodeUnits(warning);
  if (
    warnings.length >= limits.maxDiagnosticsPerStoppedStage ||
    pointerCodeUnits > limits.maxDiagnosticPointerCodeUnits ||
    nextAggregate > limits.maxAggregateDiagnosticCodeUnits
  ) {
    return false;
  }
  warnings.push(warning);
  budget.aggregateCodeUnits = nextAggregate;
  return true;
}

/**
 * Finds deprecation uses only after the same Source and Catalog set passed static contracts.
 *
 * @remarks Worklists keep adversarially deep, but already structurally admitted, action and node
 * graphs off the JavaScript call stack. Every warning is derived from an exact Source use site.
 * Collection stops at the first output-budget crossing instead of materializing a larger report
 * that cannot cross the package boundary.
 */
function deprecatedCapabilityWarnings(
  source: DesenPreparedSourceFoundation,
  catalogSet: DesenValidatedInteractionCatalogSet,
  limits: Readonly<PublishSourcePreflightLimits>,
): readonly PublishWarningDiagnostic[] | undefined {
  const deprecated = deprecatedCapabilities(catalogSet);
  const warnings: PublishWarningDiagnostic[] = [];
  const budget = { aggregateCodeUnits: 0 };
  const nodeVisits: NodeVisit[] = [];
  const actionVisits: ActionVisit[] = [];
  const surfacesPointer = createJsonPointer(["surfaces"]);

  for (const [surfaceKey, surface] of Object.entries(source.surfaces)) {
    const surfacePointer = appendJsonPointer(surfacesPointer, surfaceKey);
    for (const [resourceKey, resource] of Object.entries(surface.resources)) {
      if (deprecated.resources.has(resource.use)) {
        const warning = createDeprecatedCapabilityWarning(
          appendPath(surfacePointer, "resources", resourceKey, "use"),
          resourceContext(source.id, surface.id, resource.use),
        );
        if (!appendBoundedWarning(warnings, warning, budget, limits)) return undefined;
      }
    }
    nodeVisits.push({
      node: surface.root,
      pointer: appendPath(surfacePointer, "root"),
      surfaceId: surface.id,
    });
  }

  while (nodeVisits.length > 0) {
    const visit = nodeVisits.pop();
    if (visit === undefined) break;
    const { node, pointer, surfaceId } = visit;
    const componentContext = nodeContext(source.id, surfaceId, node.id, node.use);

    if (deprecated.components.has(node.use)) {
      const warning = createDeprecatedCapabilityWarning(
        appendJsonPointer(pointer, "use"),
        componentContext,
      );
      if (!appendBoundedWarning(warnings, warning, budget, limits)) return undefined;
    }

    enqueueActionMap(
      actionVisits,
      ownDataValue<NodeSnapshot["on"]>(node, "on"),
      appendJsonPointer(pointer, "on"),
      componentContext,
    );
    enqueueSlotNodes(
      nodeVisits,
      ownDataValue<NodeSnapshot["slots"]>(node, "slots"),
      appendJsonPointer(pointer, "slots"),
      surfaceId,
    );

    const behaviors = ownDataValue<NodeSnapshot["behaviors"]>(node, "behaviors") ?? [];
    for (const [index, behavior] of behaviors.entries()) {
      const behaviorPointer = appendPath(pointer, "behaviors", index);
      const context = behaviorContext(source.id, surfaceId, behavior.id, behavior.use);
      if (deprecated.behaviors.has(behavior.use)) {
        const warning = createDeprecatedCapabilityWarning(
          appendJsonPointer(behaviorPointer, "use"),
          context,
        );
        if (!appendBoundedWarning(warnings, warning, budget, limits)) return undefined;
      }
      enqueueActionMap(
        actionVisits,
        ownDataValue<BehaviorSnapshot["on"]>(behavior, "on"),
        appendJsonPointer(behaviorPointer, "on"),
        context,
      );
      enqueueSlotNodes(
        nodeVisits,
        ownDataValue<BehaviorSnapshot["slots"]>(behavior, "slots"),
        appendJsonPointer(behaviorPointer, "slots"),
        surfaceId,
      );
    }
  }

  while (actionVisits.length > 0) {
    const visit = actionVisits.pop();
    if (visit === undefined) break;
    const { action, pointer, context } = visit;
    if (action.type !== "operation.invoke") continue;

    if (deprecated.operations.has(action.operation)) {
      const warning = createDeprecatedCapabilityWarning(
        appendJsonPointer(pointer, "operation"),
        Object.freeze({ ...context, capabilityId: action.operation }),
      );
      if (!appendBoundedWarning(warnings, warning, budget, limits)) return undefined;
    }

    const nestedContext = actionOwnerContext(context);
    const operation = action as OperationActionSnapshot;
    ownDataValue<OperationActionSnapshot["onSuccess"]>(operation, "onSuccess")?.forEach(
      (nested, index) => {
        actionVisits.push({
          action: nested,
          pointer: appendPath(pointer, "onSuccess", index),
          context: nestedContext,
        });
      },
    );
    ownDataValue<OperationActionSnapshot["onFailure"]>(operation, "onFailure")?.forEach(
      (nested, index) => {
        actionVisits.push({
          action: nested,
          pointer: appendPath(pointer, "onFailure", index),
          context: nestedContext,
        });
      },
    );
  }

  return normalizePublishDiagnostics(warnings) as readonly PublishWarningDiagnostic[];
}

function capabilityLimitFailure(): PublishFailure {
  const diagnostic = Object.freeze({
    code: CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED_CODE,
    message: "Capability preflight diagnostics exceeded the finite Publisher profile.",
    pointer: createJsonPointer(),
  }) satisfies Readonly<DesenDiagnostic<typeof CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED_CODE>>;
  return createPublishFailure([annotatePublishErrorDiagnostic(diagnostic, CAPABILITY_STAGE)]);
}

function stoppedCapabilityFailure(
  diagnostics: readonly DesenSemanticDiagnostic[],
  limits: Readonly<PublishSourcePreflightLimits>,
): PublishFailure {
  if (publishDiagnosticsExceedSourcePreflightLimits(diagnostics, limits)) {
    return capabilityLimitFailure();
  }
  const annotated: PublishErrorDiagnostic[] = diagnostics.map((diagnostic) =>
    annotatePublishErrorDiagnostic(diagnostic, CAPABILITY_STAGE),
  );
  return createPublishFailure(annotated);
}

/**
 * Runs M06-T03 internally, then proves every statically knowable capability contract.
 *
 * @internal Catalog schema contracts are prepared before the Source is checked. Static failures
 * suppress deprecation discovery, and any over-budget report becomes one redacted same-stage
 * error. The Validator's cloned document and dynamic obligations are intentionally ignored:
 * downstream stages retain the exact M06-T03 Source authority and M06-T05 owns dynamic binding
 * compatibility.
 */
export function preflightPublishCapabilities(
  rawSourceInput: unknown,
  catalogPackageCandidatesInput: unknown,
  limitInput: Readonly<PublishSourcePreflightLimits> = PUBLISH_SOURCE_PREFLIGHT_LIMITS,
): PublishCapabilityPreflightResult {
  const limits = normalizePublishSourcePreflightLimits(limitInput);
  const sourcePreflight = preflightPublishSource(
    rawSourceInput,
    catalogPackageCandidatesInput,
    limits,
  );
  if (!isSourcePreflightSuccess(sourcePreflight)) return sourcePreflight;

  const catalogContracts = validateDesenInteractionCatalogSet(sourcePreflight.catalogSet);
  if (!catalogContracts.valid) {
    return stoppedCapabilityFailure(catalogContracts.diagnostics, limits);
  }

  const sourceContracts = validateDesenSourceInteractionContracts(
    sourcePreflight.source,
    catalogContracts.value,
  );
  if (!sourceContracts.valid) {
    return stoppedCapabilityFailure(sourceContracts.diagnostics, limits);
  }

  const diagnostics = deprecatedCapabilityWarnings(
    sourcePreflight.source,
    catalogContracts.value,
    limits,
  );
  if (diagnostics === undefined) {
    return capabilityLimitFailure();
  }

  return Object.freeze({
    capabilityPreflighted: true,
    source: sourcePreflight.source,
    catalogSet: catalogContracts.value,
    packages: sourcePreflight.packages,
    requirementPackageIndexes: sourcePreflight.requirementPackageIndexes,
    diagnostics,
  });
}
