import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Use workspace source in dev so we don't require a pre-built dist/.
      "react-three-eris": path.resolve(__dirname, "../eris/src/index.ts")
    }
  }
});
