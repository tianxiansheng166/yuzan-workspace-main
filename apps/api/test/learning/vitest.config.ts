import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["test/learning/**/*.spec.ts"],
    exclude: ["node_modules", "dist"],
  },
  resolve: {
    alias: {
      "src/": new URL("../../src/", import.meta.url).pathname,
    },
  },
});
