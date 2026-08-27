import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { DesenAppApplication } from "./application.js";
import { normalizeInitialDesenAppLocation } from "./project-navigation.js";
import "./styles.css";

normalizeInitialDesenAppLocation();

const container = document.getElementById("desen-app-root");
if (!(container instanceof Element)) {
  throw new TypeError("The Desen App root container is missing.");
}

const root = createRoot(container);
root.render(
  <StrictMode>
    <DesenAppApplication />
  </StrictMode>,
);

function disposeOnFinalPageHide(event: PageTransitionEvent): void {
  if (event.persisted) return;
  window.removeEventListener("pagehide", disposeOnFinalPageHide);
  root.unmount();
}

window.addEventListener("pagehide", disposeOnFinalPageHide);
