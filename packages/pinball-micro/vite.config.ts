import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Use workspace source in dev so we don't require a pre-built dist/.
      "react-three-eris": path.resolve(__dirname, "../eris/src/index.ts"),
      // Rapier's package exports don't expose the .wasm file, but we can still
      // load it as an asset via an alias to the real file path.
      //
      // Note: we resolve from the `packages/eris` node_modules because pnpm only
      // links transitive deps into dependents, not every workspace package.
      "@rapier-wasm-url": `${path.resolve(
        __dirname,
        "../eris/node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm"
      )}?url`
    }
  },
  // Rapier relies on `import.meta.url` to locate its .wasm. Vite pre-bundling can
  // rewrite that to "<deleted>", which breaks initialization. Exclude it.
  optimizeDeps: {
    exclude: ["@dimforge/rapier3d-compat"]
  },
  assetsInclude: ["**/*.wasm"]
});
