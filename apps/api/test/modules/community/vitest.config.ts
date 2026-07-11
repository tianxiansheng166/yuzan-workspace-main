import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["test/modules/community/**/*.spec.ts"] },
});
