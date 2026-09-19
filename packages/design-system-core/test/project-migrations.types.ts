import { migrateEditableProjectRecord } from "../src/project-migrations.js";

const result = migrateEditableProjectRecord({ schemaVersion: 1 });
if (result.ok) {
  const migrated: boolean = result.migrated;
  const currentVersion: 2 = result.record.schemaVersion;
  const losses: readonly [] = result.losses;
  const canonical: string = result.canonicalJson;
  // @ts-expect-error the loss report is immutable
  result.losses.push("invented-loss");
  void migrated;
  void losses;
  void canonical;
  void currentVersion;
  if (result.migrated) {
    const previousVersion: 1 = result.fromSchemaVersion;
    const added: "RECIPE_GRAPH_ADDED" = result.changes[1].code;
    void previousVersion;
    void added;
  } else {
    const previousVersion: 2 = result.fromSchemaVersion;
    const changes: readonly [] = result.changes;
    void previousVersion;
    void changes;
  }
} else {
  // @ts-expect-error failures cannot expose unverified canonical bytes
  const bytes = result.canonicalJson;
  void bytes;
}
