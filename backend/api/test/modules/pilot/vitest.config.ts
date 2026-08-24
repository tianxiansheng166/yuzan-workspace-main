import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const directory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(directory, "../../../../../");
const apiNodeModules = path.resolve(repoRoot, "backend/api/node_modules");

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
    include: [
      "backend/api/test/health/**/*.spec.ts",
      "backend/api/test/modules/pilot/**/*.spec.ts",
      "backend/api/test/pilot/**/*.spec.ts",
    ],
    environment: "node",
    globals: true,
  },
});
