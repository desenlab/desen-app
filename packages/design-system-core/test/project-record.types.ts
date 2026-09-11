import { admitEditableProjectRecord } from "../src/project-record.js";

import type {
  EditableProjectAdmissionFailure,
  EditableProjectAdmissionSuccess,
  EditableProjectRecord,
} from "../src/project-record.js";

declare const input: unknown;
const result = admitEditableProjectRecord(input);

if (result.ok) {
  const success: EditableProjectAdmissionSuccess = result;
  const record: EditableProjectRecord = success.record;
  const kind: "desen.editable-project" = record.kind;
  const version: 1 = record.schemaVersion;

  // @ts-expect-error admitted projects are recursively immutable
  record.id = "changed";
  // @ts-expect-error the embedded DESEN Source remains immutable
  record.source.id = "changed";
  // @ts-expect-error successful admission has no diagnostics
  const impossible = success.diagnostics[0];
  void kind;
  void version;
  void impossible;
} else {
  const failure: EditableProjectAdmissionFailure = result;
  const code: string = failure.diagnostics[0]?.code ?? "none";
  // @ts-expect-error failed admission exposes no partial record
  const partial = failure.record;
  void code;
  void partial;
}
