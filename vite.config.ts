import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export const generated_adapter = fileURLToPath(
  new URL(
    "./_build/default/engine_js/generated/engine_js/adapter.js",
    import.meta.url,
  ),
);

export default defineConfig({
  root: fileURLToPath(new URL("./web", import.meta.url)),
  publicDir: false,
  base: "./",
  resolve: {
    alias: { "@city-of-vice/engine": generated_adapter },
  },
  server: {
    host: "127.0.0.1",
    fs: { allow: [fileURLToPath(new URL(".", import.meta.url))] },
  },
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
  },
});
