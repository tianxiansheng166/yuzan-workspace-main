import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const worktreeRoot = path.resolve(__dirname, "../../../../../../../worktrees/b31-104");
const apiNodeModules = path.resolve(worktreeRoot, "apps/api/node_modules");

export default defineConfig({
  root: worktreeRoot,
  resolve: {
    alias: {
      "@nestjs/common": path.resolve(apiNodeModules, "@nestjs/common"),
      "@nestjs/core": path.resolve(apiNodeModules, "@nestjs/core"),
      "@nestjs/testing": path.resolve(apiNodeModules, "@nestjs/testing"),
    },
  },
  test: {
    include: ["apps/api/test/modules/cooperation/**/*.spec.ts"],
    environment: "node",
    globals: true,
  },
});
