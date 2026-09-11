import { migrateEditableProjectRecord } from "../src/project-migrations.js";

const result = migrateEditableProjectRecord({ schemaVersion: 1 });
if (result.ok) {
  const migrated: false = result.migrated;
  const losses: readonly [] = result.losses;
  const canonical: string = result.canonicalJson;
  // @ts-expect-error the v1 identity report is immutable
  result.losses.push("invented-loss");
  void migrated;
  void losses;
  void canonical;
} else {
  // @ts-expect-error failures cannot expose unverified canonical bytes
  const bytes = result.canonicalJson;
  void bytes;
}
