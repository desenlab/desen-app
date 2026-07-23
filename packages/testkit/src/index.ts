/**
 * Synthetic fixtures, host fakes, conformance helpers, trace assertions, and proof artifact utilities.
 *
 * @packageDocumentation
 */

export {
  createSyntheticFixtureSnapshot,
  lookupSyntheticOperationError,
  lookupSyntheticOperationSuccess,
  lookupSyntheticResourceFixture,
  SYNTHETIC_FIXTURE_CONTEXT,
} from "./synthetic-fixtures.js";

export type {
  CreateSyntheticFixtureSnapshotInput,
  SyntheticFixtureContext,
  SyntheticFixtureLookupResult,
  SyntheticFixtureSnapshot,
  SyntheticFixtureValue,
  SyntheticOperationFixtures,
} from "./synthetic-fixtures.js";
