import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import starterCatalog from "@desen/starter-catalog-web/catalog.json";

import {
  dispatchMalformedStarterEvent,
  disposeStarterProofSurface,
  mountStarterProofSurface,
  readStarterProofState,
  StarterProofSurface,
} from "../shared/runtime-surface.js";
import { readStarterT07ProofEnvelope } from "../t07-shared/proof-channel.js";
import "../t07-application.css";

import type { StarterT07ProofEnvelope } from "../t07-shared/proof-channel.js";

function requireEnvelope(): StarterT07ProofEnvelope {
  const result = readStarterT07ProofEnvelope(window.localStorage);
  if (result === undefined) throw new TypeError("No Publisher-derived M10A-T07 proof envelope.");
  return result;
}

const envelope = requireEnvelope();
if (
  envelope.catalog.id !== starterCatalog.id ||
  envelope.catalog.version !== starterCatalog.version ||
  envelope.catalog.target !== starterCatalog.target ||
  envelope.catalog.packageDigest !== starterCatalog.packageDigest
) {
  throw new TypeError("M10A-T07 proof Catalog identity mismatch.");
}

const mounted = Object.freeze({
  selectionNumeric: mountStarterProofSurface(envelope.bundles.selectionNumeric, starterCatalog),
});

function HostT07Proof() {
  return (
    <div className="t07-proof-shell" data-proof-ready="t07-host">
      <header className="t07-proof-header">
        <div>
          <p className="t07-proof-eyebrow">M10A-T07 · independent host graph</p>
          <h1>Bundle → Runtime</h1>
          <p className="t07-proof-lede">
            This separately built graph receives only serialized Publisher output, the exact
            Catalog, and the same static adapter registry. It imports no Editor or Publisher
            authority.
          </p>
        </div>
      </header>
      <article className="t07-proof-card">
        <h2>Selection and numeric Bundle</h2>
        <StarterProofSurface
          mounted={mounted.selectionNumeric}
          rootNodeId={envelope.roots.selectionNumeric}
          surfaceName="t07-selection-numeric"
        />
      </article>
      <p className="t07-proof-metadata">Catalog digest: {envelope.catalog.packageDigest}</p>
    </div>
  );
}

const container = document.querySelector<HTMLElement>("#root");
if (container === null) throw new TypeError("Missing M10A-T07 independent host proof root.");
const root = createRoot(container);
root.render(
  <StrictMode>
    <HostT07Proof />
  </StrictMode>,
);

Object.defineProperty(window, "__DESEN_STARTER_T07_HOST_PROOF__", {
  configurable: false,
  enumerable: false,
  writable: false,
  value: Object.freeze({
    dispatchMalformedNumericEvent: () =>
      dispatchMalformedStarterEvent(mounted.selectionNumeric, envelope.nodes.slider, "change", {
        value: Number.NaN,
      }),
    dispatchMalformedSelectionEvent: () =>
      dispatchMalformedStarterEvent(mounted.selectionNumeric, envelope.nodes.select, "change", {
        value: "",
      }),
    readSelectionNumericState: () => readStarterProofState(mounted.selectionNumeric),
  }),
});

window.addEventListener(
  "pagehide",
  () => {
    root.unmount();
    for (const surface of Object.values(mounted)) disposeStarterProofSurface(surface);
  },
  { once: true },
);
