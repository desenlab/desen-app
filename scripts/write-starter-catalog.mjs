import { writeM10AT01Catalog } from "./lib/m10a-t01-proof.mjs";

try {
  const catalog = await writeM10AT01Catalog();
  process.stdout.write(`${JSON.stringify({ status: "WRITTEN", ...catalog })}\n`);
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      status: "FAIL",
      code: "STARTER_CATALOG_WRITE_FAILED",
      message: error instanceof Error ? error.message : "Unexpected starter Catalog write failure.",
    })}\n`,
  );
  process.exitCode = 1;
}
