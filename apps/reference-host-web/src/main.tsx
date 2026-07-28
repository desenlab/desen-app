import "./styles.css";

import { createReferenceHostRoot } from "./root.js";

const container = document.getElementById("desen-reference-host-root");
if (!(container instanceof Element)) {
  throw new TypeError("The reference-host root container is missing.");
}

const referenceHostRoot = createReferenceHostRoot({
  container,
  reportDiagnostic: () => undefined,
});

void referenceHostRoot;
