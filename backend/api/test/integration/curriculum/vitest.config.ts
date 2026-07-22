import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../../../");
const apiNodeModules = path.resolve(repoRoot, "apps/api/node_modules");

export default defineConfig({
  root: repoRoot,
  resolve: {
    alias: {
      "@nestjs/common": path.resolve(apiNodeModules, "@nestjs/common"),
      "@nestjs/core": path.resolve(apiNodeModules, "@nestjs/core"),
      "@nestjs/testing": path.resolve(apiNodeModules, "@nestjs/testing"),
    },
  },
  test: {
    include: ["apps/api/test/integration/curriculum/**/*.spec.ts"],
    environment: "node",
    globals: true,
    dotenv: false,
  },
});
