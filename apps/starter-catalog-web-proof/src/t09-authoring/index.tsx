import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { T09DataDisplayFeedbackSurface } from "../t09-shared/surface.js";
import "../t09-application.css";

function AuthoringT09Proof() {
  return (
    <main className="t09-proof-shell" data-proof-ready="t09-authoring">
      <header className="t09-proof-header">
        <p className="t09-proof-eyebrow">M10A-T09 · authoring graph</p>
        <h1>Data display and feedback</h1>
        <p>Sample-data design uses the reviewed starter adapter registry without an operation.</p>
      </header>
      <T09DataDisplayFeedbackSurface graph="authoring" />
    </main>
  );
}

const container = document.querySelector<HTMLElement>("#root");
if (container === null) throw new TypeError("Missing M10A-T09 authoring proof root.");
createRoot(container).render(
  <StrictMode>
    <AuthoringT09Proof />
  </StrictMode>,
);
