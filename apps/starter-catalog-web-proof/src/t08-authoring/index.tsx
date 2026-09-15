import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { T08OverlaySurface } from "../t08-shared/surface.js";
import "../t08-application.css";

function AuthoringT08Proof() {
  return (
    <main className="t08-proof-shell" data-proof-ready="t08-authoring">
      <header className="t08-proof-header">
        <p className="t08-proof-eyebrow">M10A-T08 · authoring graph</p>
        <h1>Overlays and disclosures</h1>
        <p>Fixed design-selection scenarios use the reviewed starter adapter registry.</p>
      </header>
      <T08OverlaySurface graph="authoring" />
    </main>
  );
}

const container = document.querySelector<HTMLElement>("#root");
if (container === null) throw new TypeError("Missing M10A-T08 authoring proof root.");
createRoot(container).render(
  <StrictMode>
    <AuthoringT08Proof />
  </StrictMode>,
);
