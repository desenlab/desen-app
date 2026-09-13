import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import starterCatalog from "@desen/starter-catalog-web/catalog.json";

import {
  dispatchMalformedStarterEvent,
  disposeStarterProofSurface,
  mountStarterProofSurface,
  readStarterProofState,
  StarterProofSurface,
} from "../shared/runtime-surface.js";
import { readStarterT06ProofEnvelope } from "../t06-shared/proof-channel.js";
import "../t06-application.css";

import type { StarterT06ProofEnvelope } from "../t06-shared/proof-channel.js";

function requireEnvelope(): StarterT06ProofEnvelope {
  const result = readStarterT06ProofEnvelope(window.localStorage);
  if (result === undefined) throw new TypeError("No Publisher-derived M10A-T06 proof envelope.");
  return result;
}

const envelope = requireEnvelope();
if (
  envelope.catalog.id !== starterCatalog.id ||
  envelope.catalog.version !== starterCatalog.version ||
  envelope.catalog.target !== starterCatalog.target ||
  envelope.catalog.packageDigest !== starterCatalog.packageDigest
) {
  throw new TypeError("M10A-T06 proof Catalog identity mismatch.");
}

const mounted = Object.freeze({
  buttonDisabled: mountStarterProofSurface(envelope.bundles.button.disabled, starterCatalog),
  buttonLoading: mountStarterProofSurface(envelope.bundles.button.loading, starterCatalog),
  form: mountStarterProofSurface(envelope.bundles.form, starterCatalog),
});

function HostT06Proof() {
  const [showLoadingButton, setShowLoadingButton] = useState(false);
  return (
    <div className="t06-proof-shell" data-proof-ready="t06-host">
      <header className="t06-proof-header">
        <div>
          <p className="t06-proof-eyebrow">M10A-T06 · independent host graph</p>
          <h1>Bundle → Runtime</h1>
          <p className="t06-proof-lede">
            This separately built graph receives only serialized Publisher output, the exact
            Catalog, and the same static adapter registry. It imports no Editor or Publisher
            authority.
          </p>
        </div>
        <button
          className="t06-proof-control"
          data-t06-proof-switch-button=""
          type="button"
          onClick={() => setShowLoadingButton((current) => !current)}
        >
          Switch Button state
        </button>
      </header>
      <div className="t06-proof-grid">
        <article className="t06-proof-card">
          <h2>Form Bundle</h2>
          <StarterProofSurface
            mounted={mounted.form}
            rootNodeId={envelope.roots.form}
            surfaceName="t06-form"
          />
        </article>
        <article className="t06-proof-card">
          <h2>Reviewed Button Bundle</h2>
          <StarterProofSurface
            mounted={showLoadingButton ? mounted.buttonLoading : mounted.buttonDisabled}
            rootNodeId={envelope.roots.button}
            surfaceName="t06-button"
          />
        </article>
      </div>
      <p className="t06-proof-metadata">Catalog digest: {envelope.catalog.packageDigest}</p>
    </div>
  );
}

const container = document.querySelector<HTMLElement>("#root");
if (container === null) throw new TypeError("Missing M10A-T06 independent host proof root.");
const root = createRoot(container);
root.render(
  <StrictMode>
    <HostT06Proof />
  </StrictMode>,
);

Object.defineProperty(window, "__DESEN_STARTER_T06_HOST_PROOF__", {
  configurable: false,
  enumerable: false,
  writable: false,
  value: Object.freeze({
    dispatchMalformedRadioGroupEvent: () =>
      dispatchMalformedStarterEvent(mounted.form, envelope.nodes.radioGroup, "change", {
        value: "x".repeat(129),
      }),
    dispatchMalformedTextFieldEvent: () =>
      dispatchMalformedStarterEvent(mounted.form, envelope.nodes.textField, "change"),
    readFormState: () => readStarterProofState(mounted.form),
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
