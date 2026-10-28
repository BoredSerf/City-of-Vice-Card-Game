import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

export const generated_adapter = fileURLToPath(
  new URL(
    "./_build/default/engine_js/generated/engine_js/adapter.js",
    import.meta.url,
  ),
);

const public_catalog = fileURLToPath(
  new URL("./tests/characterization/cards.json", import.meta.url),
);
const verify_ui_bundle: Plugin = {
  name: "verify_ui_bundle",
  generateBundle(_options, bundle) {
    const modules = [
      ...new Set(
        Object.values(bundle).flatMap((output) =>
          output.type === "chunk" ? Object.keys(output.modules) : [],
        ),
      ),
    ];
    const private_inputs = modules.filter(
      (path) => path.includes("/tests/") && path !== public_catalog,
    );
    if (private_inputs.length)
      this.error("Private test inputs entered the website bundle");
    if (!modules.includes(public_catalog))
      this.error(
        "The public card inventory is missing from the website bundle",
      );
    console.info(
      JSON.stringify({
        ui_bundle_modules: modules.length,
        public_catalog: "tests/characterization/cards.json",
        private_test_modules: private_inputs,
      }),
    );
  },
};

export default defineConfig({
  plugins: [verify_ui_bundle],
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
