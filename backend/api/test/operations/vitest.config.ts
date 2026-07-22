import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../../");
const apiNodeModules = path.resolve(repoRoot, "backend/api/node_modules");
const mockDatabase = path.resolve(__dirname, "__mocks__/@yuzan/database.ts");

export default defineConfig({
  root: repoRoot,
  resolve: {
    alias: {
      "@nestjs/common": path.resolve(apiNodeModules, "@nestjs/common"),
      "@nestjs/core": path.resolve(apiNodeModules, "@nestjs/core"),
      "@nestjs/testing": path.resolve(apiNodeModules, "@nestjs/testing"),
      "@yuzan/database": mockDatabase,
    },
  },
  test: {
    include: ["backend/api/test/operations/**/*.spec.ts"],
    environment: "node",
    globals: true,
  },
});
