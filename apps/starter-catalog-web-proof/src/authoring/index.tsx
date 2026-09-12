import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { prepareStarterProofPublications, starterProofCatalog } from "./publications.js";
import {
  disposeStarterProofSurface,
  mountStarterProofSurface,
  StarterProofSurface,
} from "../shared/runtime-surface.js";
import { writeStarterProofEnvelope } from "../shared/proof-channel.js";
import "../application.css";

const prepared = prepareStarterProofPublications();
writeStarterProofEnvelope(window.localStorage, prepared.envelope);

const mounted = Object.freeze({
  button: mountStarterProofSurface(prepared.envelope.bundles.button.initial, starterProofCatalog),
  select: mountStarterProofSurface(prepared.envelope.bundles.select, starterProofCatalog),
  dialog: mountStarterProofSurface(prepared.envelope.bundles.dialog, starterProofCatalog),
  layout: mountStarterProofSurface(prepared.envelope.bundles.layout, starterProofCatalog),
});

function revision(bundle: unknown): string {
  if (typeof bundle !== "object" || bundle === null || Array.isArray(bundle)) return "missing";
  const value = (bundle as Record<string, unknown>).revision;
  return typeof value === "string" ? value : "missing";
}

function AuthoringProof() {
  return (
    <div className="proof-shell" data-proof-ready="authoring">
      <header className="proof-header">
        <div>
          <p className="proof-eyebrow">M10A-T05 · bounded authoring graph</p>
          <h1>Source → Publisher → Runtime</h1>
          <p className="proof-lede">
            Four fixed Source surfaces are published and materialized through the reviewed Neutral
            starter registry. This harness is not normal DESEN App UI.
          </p>
        </div>
        <a className="proof-link" href="/host.html">
          Open independent host
        </a>
      </header>
      <div className="proof-grid">
        <article className="proof-card">
          <h2>Button Source</h2>
          <StarterProofSurface
            mounted={mounted.button}
            rootNodeId={prepared.envelope.roots.button}
            surfaceName="button"
          />
        </article>
        <article className="proof-card">
          <h2>Select Source</h2>
          <StarterProofSurface
            mounted={mounted.select}
            rootNodeId={prepared.envelope.roots.select}
            surfaceName="select"
          />
        </article>
        <article className="proof-card">
          <h2>Dialog Source</h2>
          <StarterProofSurface
            mounted={mounted.dialog}
            rootNodeId={prepared.envelope.roots.dialog}
            surfaceName="dialog"
          />
        </article>
        <article className="proof-card proof-card-wide">
          <h2>Nested layout and content Source</h2>
          <StarterProofSurface
            mounted={mounted.layout}
            rootNodeId={prepared.envelope.roots.layout}
            surfaceName="layout"
          />
        </article>
      </div>
      <div
        className="proof-metadata"
        data-negative-unknown-capability={
          prepared.negative.unknownCapability.rejected ? "rejected" : "accepted"
        }
        data-negative-unknown-part={
          prepared.negative.unknownPart.rejected ? "rejected" : "accepted"
        }
        data-negative-invalid-dimension={
          prepared.negative.invalidDimension.rejected ? "rejected" : "accepted"
        }
        data-negative-unsupported-image-color={
          prepared.negative.unsupportedImageColor.rejected ? "rejected" : "accepted"
        }
        data-negative-unsafe-image-source={
          prepared.negative.unsafeImageSource.rejected ? "rejected" : "accepted"
        }
        data-negative-private-selector={
          prepared.negative.privateSelector.rejected ? "rejected" : "accepted"
        }
      >
        Exact Catalog: {prepared.envelope.catalog.id}@{prepared.envelope.catalog.version} · Button
        revision: {revision(prepared.envelope.bundles.button.initial)}
      </div>
    </div>
  );
}

const container = document.querySelector<HTMLElement>("#root");
if (container === null) throw new TypeError("Missing authoring proof root.");
const root = createRoot(container);
root.render(
  <StrictMode>
    <AuthoringProof />
  </StrictMode>,
);

window.addEventListener(
  "pagehide",
  () => {
    for (const surface of Object.values(mounted)) disposeStarterProofSurface(surface);
  },
  { once: true },
);
