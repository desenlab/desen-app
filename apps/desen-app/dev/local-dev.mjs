import { resolve } from "node:path";

import { DesenAppLocalDevHostError, startDesenAppLocalDev } from "./local-dev-host.mjs";

async function main() {
  let host;
  try {
    host = await startDesenAppLocalDev({
      appDirectory: resolve(import.meta.dirname, ".."),
      stateDirectory: resolve(import.meta.dirname, "../../..", ".desen"),
    });
  } catch (error) {
    console.error(
      error instanceof DesenAppLocalDevHostError
        ? error.message
        : "The Desen App local runtime could not start.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Desen App is ready at ${host.appOrigin}`);
  console.log("Local Source persistence is active in the app-owned .desen directory.");

  let shutdownStarted = false;
  const shutdown = async () => {
    if (shutdownStarted) return;
    shutdownStarted = true;
    try {
      await host.close();
    } catch (error) {
      console.error(
        error instanceof DesenAppLocalDevHostError
          ? error.message
          : "The Desen App local runtime could not stop cleanly.",
      );
      process.exitCode = 1;
    }
  };

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });
  process.once("SIGHUP", () => {
    void shutdown();
  });
}

await main();
