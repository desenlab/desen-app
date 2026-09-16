import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { T09DataDisplayFeedbackSurface } from "../t09-shared/surface.js";
import "../t09-application.css";

function HostT09Proof() {
  return (
    <main className="t09-proof-shell" data-proof-ready="t09-host">
      <header className="t09-proof-header">
        <p className="t09-proof-eyebrow">M10A-T09 · independent host graph</p>
        <h1>Bundle → Runtime</h1>
        <p>The host receives the same static adapter registry and no authoring authority.</p>
      </header>
      <T09DataDisplayFeedbackSurface graph="host" />
    </main>
  );
}

const container = document.querySelector<HTMLElement>("#root");
if (container === null) throw new TypeError("Missing M10A-T09 host proof root.");
createRoot(container).render(
  <StrictMode>
    <HostT09Proof />
  </StrictMode>,
);
