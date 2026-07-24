import { REFERENCE_WEB_IMPLEMENTATION_METADATA } from "../src/parity/index.js";

import type {
  ReferenceWebComponentImplementationContract,
  ReferenceWebImplementationMetadata,
  ReferenceWebOperationImplementationContract,
  ReferenceWebStylePartContract,
} from "../src/parity/index.js";

const metadata: ReferenceWebImplementationMetadata = REFERENCE_WEB_IMPLEMENTATION_METADATA;
const component: ReferenceWebComponentImplementationContract = metadata.components[
  "com.example.ui/Button"
] as ReferenceWebComponentImplementationContract;
const operation: ReferenceWebOperationImplementationContract = metadata.operations[
  "com.example.auth/signIn"
] as ReferenceWebOperationImplementationContract;
const stylePart: ReferenceWebStylePartContract = component.declared.styleParts
  .root as ReferenceWebStylePartContract;
const exactTarget: "web-react" = metadata.target;
const exactScope: "reference-sign-in-slice" = metadata.scope;
const exactFidelity: "same" = component.adapterFidelity;
const exactBinding: "application-supplied" = operation.binding;
void metadata;
void component;
void operation;
void stylePart;
void exactTarget;
void exactScope;
void exactFidelity;
void exactBinding;

// @ts-expect-error M03-T09-N01 Metadata is immutable.
REFERENCE_WEB_IMPLEMENTATION_METADATA.target = "ios-swiftui";

// @ts-expect-error M03-T09-N02 Component maps are immutable.
REFERENCE_WEB_IMPLEMENTATION_METADATA.components["com.example.ui/Forged"] = component;

// @ts-expect-error M03-T09-N03 Declared property inventories are readonly.
component.declared.props.push("nativeDomProperty");

// @ts-expect-error M03-T09-N04 Fidelity cannot be widened beyond the exact Catalog value.
component.adapterFidelity = "approximate";

// @ts-expect-error M03-T09-N05 Production export labels are inert strings, not callables.
component.productionExport({});

// @ts-expect-error M03-T09-N06 Parity metadata exposes no module path for dynamic loading.
void component.modulePath;

// @ts-expect-error M03-T09-N07 Known-difference inventories are empty and readonly for same fidelity.
component.differences.push("visual drift");

// @ts-expect-error M03-T09-N08 Style-part semantics cannot be rewritten by consumers.
stylePart.meaning = "private selector";

// @ts-expect-error M03-T09-N09 Host binding mode cannot claim an embedded implementation.
operation.binding = "embedded";

// @ts-expect-error M03-T09-N10 Operation metadata carries no executable handler.
void operation.invoke;
