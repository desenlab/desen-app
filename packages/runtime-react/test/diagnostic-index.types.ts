import {
  buildRuntimeReactDiagnosticIndex,
  type RuntimeReactDiagnosticIndex,
  type RuntimeReactDiagnosticIndexBinding,
  type RuntimeReactDiagnosticIndexEntry,
} from "../src/diagnostic-index.js";

const bindings = [
  {
    kind: "component",
    runtimeNodeId: "component-runtime",
    sourceNodeId: "source",
    capabilityId: "run.desen.test/Card",
  },
  {
    kind: "behavior",
    runtimeNodeId: "behavior-runtime",
    sourceNodeId: "source",
    capabilityId: "run.desen.test/Sortable",
    behaviorId: "sort",
    ownerRuntimeNodeId: "component-runtime",
  },
] as const satisfies readonly RuntimeReactDiagnosticIndexBinding[];

const result = buildRuntimeReactDiagnosticIndex(bindings, {
  maxBindings: 2,
  maxIdentifierOccurrences: 8,
  maxIdentifierCodeUnits: 1_000,
});

if (result.status === "built") {
  const index: RuntimeReactDiagnosticIndex = result.index;
  const entry: RuntimeReactDiagnosticIndexEntry | undefined =
    index.byRuntimeNodeId["component-runtime"];
  const sourceRuntimeIds: readonly string[] | undefined = index.runtimeNodeIdsBySourceNodeId.source;
  const behaviorRuntimeIds: readonly string[] | undefined = index.runtimeNodeIdsByBehaviorId.sort;

  // @ts-expect-error Forward lookups are readonly.
  index.byRuntimeNodeId["component-runtime"] = bindings[0];
  // @ts-expect-error Inverse lookup arrays are readonly.
  sourceRuntimeIds?.push("another");
  // @ts-expect-error Diagnostic entries expose no resolved props.
  void entry?.props;
  // @ts-expect-error Diagnostic indexes expose no session authority.
  void index.session;

  void behaviorRuntimeIds;
}

const invalidBinding: RuntimeReactDiagnosticIndexBinding = {
  kind: "component",
  runtimeNodeId: "runtime",
  sourceNodeId: "source",
  capabilityId: "run.desen.test/Card",
  // @ts-expect-error Diagnostic inputs contain exact identity data and no executable callback.
  callback: () => undefined,
};

// @ts-expect-error Behavior diagnostic identities require their exact component owner.
const invalidBehavior: RuntimeReactDiagnosticIndexBinding = {
  kind: "behavior",
  runtimeNodeId: "behavior",
  sourceNodeId: "source",
  capabilityId: "run.desen.test/Sortable",
  behaviorId: "sort",
};

void result;
void invalidBinding;
void invalidBehavior;
