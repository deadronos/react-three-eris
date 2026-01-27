import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "react-three-eris": path.resolve(__dirname, "packages/eris/src/index.ts")
    }
  },
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"]
  }
});

