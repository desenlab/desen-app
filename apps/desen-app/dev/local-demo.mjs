import { resolve } from "node:path";

import { DesenAppLocalDemoError, startDesenAppLocalDemo } from "./local-demo-host.mjs";

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--reset")) {
    console.error("Usage: pnpm demo [--reset]");
    process.exitCode = 1;
    return;
  }
  /** @type {Awaited<ReturnType<typeof startDesenAppLocalDemo>> | undefined} */
  let host;
  let stopRequested = false;
  let closing = false;
  const close = async () => {
    stopRequested = true;
    if (closing || host === undefined) return;
    closing = true;
    try {
      await host.close();
    } catch (error) {
      console.error(
        error instanceof DesenAppLocalDemoError ? error.message : "The demo could not stop safely.",
      );
      process.exitCode = 1;
    }
  };
  // A signal during the independent host build must drain startup before releasing its lease.
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => {
      void close();
    });
  }
  try {
    host = await startDesenAppLocalDemo({
      workspaceDirectory: resolve(import.meta.dirname, "../../.."),
      reset: args[0] === "--reset",
    });
  } catch (error) {
    console.error(
      error instanceof DesenAppLocalDemoError ? error.message : "The demo could not start safely.",
    );
    process.exitCode = 1;
    return;
  }
  if (stopRequested) {
    await close();
    return;
  }
  console.log(`Desen App demo: ${host.appOrigin}`);
  console.log(`Independent published host: ${host.referenceHostOrigin}/home`);
  console.log(
    args[0] === "--reset"
      ? "Choose Flow app → New project. The reset seed contains no authored sign-in screen."
      : "Choose Flow app to resume. Use New project only when its saved workspace is empty.",
  );
  console.log("Demo data: .desen/m10-demo/current. The latest reset backup is in previous.");
  console.log(
    "Existing .desen/desen-app projects are unchanged. Stop with Ctrl+C before resetting.",
  );
}

await main();
