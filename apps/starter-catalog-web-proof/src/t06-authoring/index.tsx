import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { prepareStarterT06ProofPublications, starterT06ProofCatalog } from "./publications.js";
import {
  disposeStarterProofSurface,
  mountStarterProofSurface,
  StarterProofSurface,
} from "../shared/runtime-surface.js";
import { writeStarterT06ProofEnvelope } from "../t06-shared/proof-channel.js";
import "../t06-application.css";

const prepared = prepareStarterT06ProofPublications();
writeStarterT06ProofEnvelope(window.localStorage, prepared.envelope);

const mounted = Object.freeze({
  button: mountStarterProofSurface(
    prepared.envelope.bundles.button.disabled,
    starterT06ProofCatalog,
  ),
  form: mountStarterProofSurface(prepared.envelope.bundles.form, starterT06ProofCatalog),
});

function AuthoringT06Proof() {
  return (
    <div className="t06-proof-shell" data-proof-ready="t06-authoring">
      <header className="t06-proof-header">
        <div>
          <p className="t06-proof-eyebrow">M10A-T06 · bounded authoring graph</p>
          <h1>Source → Publisher → Runtime</h1>
          <p className="t06-proof-lede">
            Fixed TextField, TextArea, Checkbox, RadioGroup, and Switch Source nodes are published
            through the reviewed starter Catalog. This isolated harness is not normal DESEN App UI.
          </p>
        </div>
        <a className="t06-proof-link" href="/t06-host.html">
          Open independent host
        </a>
      </header>
      <div className="t06-proof-grid">
        <article className="t06-proof-card">
          <h2>Form Source</h2>
          <StarterProofSurface
            mounted={mounted.form}
            rootNodeId={prepared.envelope.roots.form}
            surfaceName="t06-form"
          />
        </article>
        <article className="t06-proof-card">
          <h2>Reviewed Button Source</h2>
          <StarterProofSurface
            mounted={mounted.button}
            rootNodeId={prepared.envelope.roots.button}
            surfaceName="t06-button"
          />
        </article>
      </div>
      <div
        className="t06-proof-metadata"
        data-negative-invalid-rows={
          prepared.negative.invalidRows.rejected ? "rejected" : "accepted"
        }
        data-negative-invalid-radio-option-value={
          prepared.negative.invalidRadioOptionValue.rejected ? "rejected" : "accepted"
        }
      >
        Exact Catalog: {prepared.envelope.catalog.id}@{prepared.envelope.catalog.version}
      </div>
    </div>
  );
}

const container = document.querySelector<HTMLElement>("#root");
if (container === null) throw new TypeError("Missing M10A-T06 authoring proof root.");
const root = createRoot(container);
root.render(
  <StrictMode>
    <AuthoringT06Proof />
  </StrictMode>,
);

window.addEventListener(
  "pagehide",
  () => {
    for (const surface of Object.values(mounted)) disposeStarterProofSurface(surface);
  },
  { once: true },
);
