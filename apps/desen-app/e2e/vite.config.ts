import { resolve } from "node:path";

import { defineConfig } from "vite";

export default defineConfig({
  root: import.meta.dirname,
  build: {
    emptyOutDir: true,
    outDir: resolve(import.meta.dirname, "../dist-e2e"),
  },
  preview: {
    host: "127.0.0.1",
    port: 4174,
    strictPort: true,
  },
});
