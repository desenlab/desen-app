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
import { readStarterProofEnvelope } from "../shared/proof-channel.js";
import "../application.css";

import type { Root } from "react-dom/client";
import type { StarterProofEnvelope } from "../shared/proof-channel.js";

function requireEnvelope(): StarterProofEnvelope {
  const result = readStarterProofEnvelope(window.localStorage);
  if (result === undefined) throw new TypeError("No Publisher-derived starter proof envelope.");
  return result;
}

const envelope = requireEnvelope();
if (
  envelope.catalog.id !== starterCatalog.id ||
  envelope.catalog.version !== starterCatalog.version ||
  envelope.catalog.target !== starterCatalog.target ||
  envelope.catalog.packageDigest !== starterCatalog.packageDigest
) {
  throw new TypeError("Starter proof Catalog identity mismatch.");
}

const mounted = Object.freeze({
  buttonInitial: mountStarterProofSurface(envelope.bundles.button.initial, starterCatalog),
  buttonCompatible: mountStarterProofSurface(envelope.bundles.button.compatible, starterCatalog),
  select: mountStarterProofSurface(envelope.bundles.select, starterCatalog),
  dialog: mountStarterProofSurface(envelope.bundles.dialog, starterCatalog),
});

function HostProof() {
  const [compatibleButton, setCompatibleButton] = useState(false);
  return (
    <div className="proof-shell" data-proof-ready="host">
      <header className="proof-header">
        <div>
          <p className="proof-eyebrow">M10A-T01 · independent host graph</p>
          <h1>Bundle → Runtime</h1>
          <p className="proof-lede">
            This separately built graph consumes only serialized Publisher output and the same exact
            Catalog/static adapter registry. It imports no Editor or Publisher authority.
          </p>
        </div>
        <button
          className="proof-control"
          data-proof-switch-publication=""
          type="button"
          onClick={() => setCompatibleButton((current) => !current)}
        >
          Switch compatible publication
        </button>
      </header>
      <div className="proof-grid">
        <article className="proof-card">
          <h2>Button Bundle</h2>
          <StarterProofSurface
            mounted={compatibleButton ? mounted.buttonCompatible : mounted.buttonInitial}
            rootNodeId={envelope.roots.button}
            surfaceName="button"
          />
        </article>
        <article className="proof-card">
          <h2>Select Bundle</h2>
          <StarterProofSurface
            mounted={mounted.select}
            rootNodeId={envelope.roots.select}
            surfaceName="select"
          />
        </article>
        <article className="proof-card">
          <h2>Dialog Bundle</h2>
          <StarterProofSurface
            mounted={mounted.dialog}
            rootNodeId={envelope.roots.dialog}
            surfaceName="dialog"
          />
        </article>
      </div>
      <p className="proof-metadata">Catalog digest: {envelope.catalog.packageDigest}</p>
    </div>
  );
}

function requireRootContainer(): HTMLElement {
  const result = document.querySelector<HTMLElement>("#root");
  if (result === null) throw new TypeError("Missing independent host proof root.");
  return result;
}

const container = requireRootContainer();
let root: Root | undefined;

function mountRoot(): void {
  root = createRoot(container);
  root.render(
    <StrictMode>
      <HostProof />
    </StrictMode>,
  );
}

function remountRoot(): void {
  root?.unmount();
  mountRoot();
}

mountRoot();

Object.defineProperty(window, "__DESEN_STARTER_HOST_PROOF__", {
  configurable: false,
  enumerable: false,
  writable: false,
  value: Object.freeze({
    remountRoot,
    readSelectState: () => readStarterProofState(mounted.select),
    readDialogState: () => readStarterProofState(mounted.dialog),
    dispatchMalformedSelectEvent: () =>
      dispatchMalformedStarterEvent(mounted.select, envelope.roots.select, "change"),
    publicationRuntimeIds: () =>
      Object.freeze({
        initial: mounted.buttonInitial.serverSnapshot.bindings.find(
          (binding) => binding.sourceNodeId === envelope.roots.button,
        )?.runtimeInstanceId,
        compatible: mounted.buttonCompatible.serverSnapshot.bindings.find(
          (binding) => binding.sourceNodeId === envelope.roots.button,
        )?.runtimeInstanceId,
      }),
  }),
});

window.addEventListener(
  "pagehide",
  () => {
    root?.unmount();
    for (const surface of Object.values(mounted)) disposeStarterProofSurface(surface);
  },
  { once: true },
);
