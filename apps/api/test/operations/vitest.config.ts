import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiNodeModules = path.resolve(__dirname, "../../node_modules");
const mockDatabase = path.resolve(__dirname, "__mocks__/@yuzan/database.ts");

export default defineConfig({
  root: "../../",
  resolve: {
    alias: {
      "@nestjs/common": path.resolve(apiNodeModules, "@nestjs/common"),
      "@nestjs/core": path.resolve(apiNodeModules, "@nestjs/core"),
      "@nestjs/testing": path.resolve(apiNodeModules, "@nestjs/testing"),
      "@yuzan/database": mockDatabase,
    },
  },
  test: {
    include: ["apps/api/test/operations/**/*.spec.ts"],
    environment: "node",
    globals: true,
  },
});
