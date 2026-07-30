import { validateDesenPreparedSourcePublicationContracts } from "../src/index.js";

import type {
  DesenPreparedSourceFoundation,
  DesenSourcePublicationContractPhase,
  DesenSourcePublicationContractValidationResult,
  DesenValidatedExecutionCatalogSet,
} from "../src/index.js";

declare const source: DesenPreparedSourceFoundation;
declare const catalogs: DesenValidatedExecutionCatalogSet;

const result: DesenSourcePublicationContractValidationResult =
  validateDesenPreparedSourcePublicationContracts(source, catalogs);

if (result.valid) {
  const exactPreparedSource: DesenPreparedSourceFoundation = result.value;
  void exactPreparedSource;

  // @ts-expect-error Successful publication results expose no stopped phase.
  void result.phase;
} else {
  const phase: DesenSourcePublicationContractPhase = result.phase;
  void phase;

  // @ts-expect-error Failed publication results expose no trusted Source value.
  void result.value;
}

// @ts-expect-error Publication analysis requires runtime-authenticated Source authority.
validateDesenPreparedSourcePublicationContracts({}, catalogs);
