import { copyFile } from "node:fs/promises";

// The target package ships its declared CSS Module beside the compiled adapter import.
await copyFile(
  new URL("../src/neutral.module.css", import.meta.url),
  new URL("../dist/neutral.module.css", import.meta.url),
);
