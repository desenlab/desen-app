import { verifyProtocolTraceability } from "./lib/protocol-traceability.mjs";

try {
  const { evidence } = await verifyProtocolTraceability();
  const { counts } = evidence;
  console.log(
    `DESEN ${evidence.protocol} traceability PASS: ${counts.proseTraceEntries} prose entries, ` +
      `${counts.schemaConstraints} schema constraints in ${counts.schemaFamilies} families, ` +
      `${counts.normativeSectionsReviewed} normative sections reviewed.`,
  );
} catch (error) {
  const code = typeof error?.code === "string" ? error.code : "TRACE_UNEXPECTED_ERROR";
  console.error(`${code}: ${error instanceof Error ? error.message : String(error)}`);
  if (error?.details !== undefined) console.error(JSON.stringify(error.details, null, 2));
  process.exitCode = 1;
}
