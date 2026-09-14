import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  StarterComboboxReactAdapter,
  StarterSliderReactAdapter,
} from "@desen/starter-catalog-web/react-adapters";

import { prepareStarterT07ProofPublications, starterT07ProofCatalog } from "./publications.js";
import {
  disposeStarterProofSurface,
  mountStarterProofSurface,
  StarterProofSurface,
} from "../shared/runtime-surface.js";
import { writeStarterT07ProofEnvelope } from "../t07-shared/proof-channel.js";
import "../t07-application.css";

import type {
  RuntimeReactComponentAdapterProps,
  RuntimeReactInteractionPort,
} from "@desen/runtime-react";

const prepared = prepareStarterT07ProofPublications();
writeStarterT07ProofEnvelope(window.localStorage, prepared.envelope);

const mounted = Object.freeze({
  selectionNumeric: mountStarterProofSurface(
    prepared.envelope.bundles.selectionNumeric,
    starterT07ProofCatalog,
  ),
});

const noOpInteractions = Object.freeze({
  dispatchEvent: () => Object.freeze({ status: "unavailable" }),
  attachCommands: () => Object.freeze({ status: "unavailable" }),
  detachCommands: () => Object.freeze({ status: "unavailable" }),
} satisfies RuntimeReactInteractionPort);

function malformedAdapterInput(
  capability: "Combobox" | "Slider",
  props: unknown,
): RuntimeReactComponentAdapterProps {
  return {
    identity: {
      capabilityId: `run.desen.starter/${capability}`,
      sourceNodeId: `t07.malformed.${capability}`,
      runtimeNodeId: `t07.malformed.${capability}:instance`,
    },
    props: props as RuntimeReactComponentAdapterProps["props"],
    slots: {},
    style: { base: {} },
    interactions: noOpInteractions,
  };
}

/**
 * Confirms the adapter fails closed before it reaches any Base UI hook for data which Source is
 * forbidden to express. The fixed probe is authoring instrumentation, never a data-selected path.
 */
function adapterRejects(attempt: () => unknown): boolean {
  try {
    attempt();
  } catch (error) {
    return error instanceof Error && error.message === "STARTER_ADAPTER_INPUT_INVALID";
  }
  return false;
}

const malformedData = Object.freeze({
  duplicateOptionId: adapterRejects(() =>
    StarterComboboxReactAdapter(
      malformedAdapterInput("Combobox", {
        label: "Malformed duplicate identities",
        options: [
          { id: "same", label: "First duplicate" },
          { id: "same", label: "Second duplicate" },
        ],
        value: "",
        filterMode: "contains",
      }),
    ),
  ),
  nonFiniteValue: adapterRejects(() =>
    StarterSliderReactAdapter(
      malformedAdapterInput("Slider", {
        label: "Malformed non-finite value",
        value: Number.NaN,
        min: 0,
        max: 100,
        step: 1,
      }),
    ),
  ),
  functionRenderer: adapterRejects(() =>
    StarterComboboxReactAdapter(
      malformedAdapterInput("Combobox", {
        label: "Malformed renderer",
        options: [],
        value: "",
        renderItem: () => null,
      }),
    ),
  ),
  functionFilter: adapterRejects(() =>
    StarterComboboxReactAdapter(
      malformedAdapterInput("Combobox", {
        label: "Malformed filter",
        options: [],
        value: "",
        filterMode: () => true,
      }),
    ),
  ),
});

function AuthoringT07Proof() {
  return (
    <div className="t07-proof-shell" data-proof-ready="t07-authoring">
      <header className="t07-proof-header">
        <div>
          <p className="t07-proof-eyebrow">M10A-T07 · bounded authoring graph</p>
          <h1>Source → Publisher → Runtime</h1>
          <p className="t07-proof-lede">
            Fixed Select, Combobox, Tabs, Slider, and NumberField Source nodes are published through
            the reviewed starter Catalog. This isolated harness is not normal DESEN App UI.
          </p>
        </div>
        <a className="t07-proof-link" href="/t07-host.html">
          Open independent host
        </a>
      </header>
      <article className="t07-proof-card">
        <h2>Selection and numeric Source</h2>
        <StarterProofSurface
          mounted={mounted.selectionNumeric}
          rootNodeId={prepared.envelope.roots.selectionNumeric}
          surfaceName="t07-selection-numeric"
        />
      </article>
      <div
        className="t07-proof-metadata"
        data-negative-duplicate-option-id={
          malformedData.duplicateOptionId ? "rejected" : "accepted"
        }
        data-negative-function-filter={malformedData.functionFilter ? "rejected" : "accepted"}
        data-negative-function-renderer={malformedData.functionRenderer ? "rejected" : "accepted"}
        data-negative-nonfinite-value={malformedData.nonFiniteValue ? "rejected" : "accepted"}
      >
        Exact Catalog: {prepared.envelope.catalog.id}@{prepared.envelope.catalog.version}
      </div>
    </div>
  );
}

const container = document.querySelector<HTMLElement>("#root");
if (container === null) throw new TypeError("Missing M10A-T07 authoring proof root.");
const root = createRoot(container);
root.render(
  <StrictMode>
    <AuthoringT07Proof />
  </StrictMode>,
);

window.addEventListener(
  "pagehide",
  () => {
    root.unmount();
    for (const surface of Object.values(mounted)) disposeStarterProofSurface(surface);
  },
  { once: true },
);
