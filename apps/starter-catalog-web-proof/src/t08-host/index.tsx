import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { T08OverlaySurface } from "../t08-shared/surface.js";
import "../t08-application.css";

function HostT08Proof() {
  return (
    <main className="t08-proof-shell" data-proof-ready="t08-host">
      <header className="t08-proof-header">
        <p className="t08-proof-eyebrow">M10A-T08 · independent host graph</p>
        <h1>Bundle → Runtime</h1>
        <p>The host graph receives the same static adapter registry and no authoring authority.</p>
      </header>
      <T08OverlaySurface graph="host" />
    </main>
  );
}

const container = document.querySelector<HTMLElement>("#root");
if (container === null) throw new TypeError("Missing M10A-T08 host proof root.");
createRoot(container).render(
  <StrictMode>
    <HostT08Proof />
  </StrictMode>,
);
