import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { WorkbenchApplication } from "./workbench-application.js";
import "./workbench.css";

const rootElement = globalThis.document.querySelector("#root");
if (rootElement === null) throw new TypeError("Theme workbench root is missing.");

createRoot(rootElement).render(
  <StrictMode>
    <WorkbenchApplication />
  </StrictMode>,
);
