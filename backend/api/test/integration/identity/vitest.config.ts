import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../../../");
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
    include: ["backend/api/test/integration/identity/**/*.spec.ts"],
    environment: "node",
    globals: true,
    /**
     * Disable auto-loading of .env so that DATABASE_URL is only set when
     * explicitly provided in the shell environment (e.g. CI). This ensures
     * describe.skipIf(!process.env.DATABASE_URL) correctly skips integration
     * tests when PostgreSQL is not running locally.
     */
    dotenv: false,
  },
});
