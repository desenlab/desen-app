import { admitEditableProjectRecord } from "../src/project-record.js";

import type {
  EditableProjectAdmissionFailure,
  EditableProjectAdmissionSuccess,
  EditableProjectRecord,
  EditableProjectRecordV1,
  EditableProjectRecordV2,
} from "../src/project-record.js";

declare const input: unknown;
const result = admitEditableProjectRecord(input);

if (result.ok) {
  const success: EditableProjectAdmissionSuccess = result;
  const record: EditableProjectRecord = success.record;
  const kind: "desen.editable-project" = record.kind;
  const current: EditableProjectRecordV2 = record;
  const version: 2 = record.schemaVersion;

  // @ts-expect-error admitted projects are recursively immutable
  record.id = "changed";
  // @ts-expect-error the embedded DESEN Source remains immutable
  record.source.id = "changed";
  // @ts-expect-error successful admission has no diagnostics
  const impossible = success.diagnostics[0];
  // @ts-expect-error the admitted graph is recursively immutable
  record.designSystem.recipeGraph.definitions.push({});
  // @ts-expect-error current records cannot masquerade as the historical envelope
  const legacy: EditableProjectRecordV1 = record;
  void kind;
  void version;
  void impossible;
  void current;
  void legacy;
} else {
  const failure: EditableProjectAdmissionFailure = result;
  const code: string = failure.diagnostics[0]?.code ?? "none";
  // @ts-expect-error failed admission exposes no partial record
  const partial = failure.record;
  void code;
  void partial;
}

declare const legacy: EditableProjectRecordV1;
const legacyVersion: 1 = legacy.schemaVersion;
// @ts-expect-error the historical design-system contract has no recipe graph field
const legacyGraph = legacy.designSystem.recipeGraph;
void legacyVersion;
void legacyGraph;
