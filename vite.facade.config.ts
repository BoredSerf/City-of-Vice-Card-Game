import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { generated_adapter } from "./vite.config.ts";

export default defineConfig({
  publicDir: false,
  base: "./",
  build: {
    outDir: fileURLToPath(
      new URL("./.cache/facade-production", import.meta.url),
    ),
    emptyOutDir: true,
    lib: {
      entry: generated_adapter,
      formats: ["es"],
      fileName: () => "adapter.mjs",
    },
  },
  plugins: [
    {
      name: "verify_facade_bundle",
      generateBundle(_options, bundle) {
        const outputs = Object.values(bundle);
        const chunk = outputs[0];
        if (
          outputs.length !== 1 ||
          chunk?.type !== "chunk" ||
          chunk.fileName !== "adapter.mjs"
        )
          throw new Error("Facade build must emit only adapter.mjs");
        if (chunk.imports.length !== 0 || chunk.dynamicImports.length !== 0)
          throw new Error(
            "Facade verification artifact must be self-contained",
          );
        const modules = Object.keys(chunk.modules);
        if (modules.some((id) => id.includes("/tests/")))
          throw new Error("Test fixtures entered the facade bundle");
        this.info(
          JSON.stringify({
            facade_output: chunk.fileName,
            exports: chunk.exports,
            imports: chunk.imports,
            dynamic_imports: chunk.dynamicImports,
            module_count: modules.length,
          }),
        );
      },
    },
  ],
});
