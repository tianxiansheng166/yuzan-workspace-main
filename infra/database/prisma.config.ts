import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

const configDir = dirname(fileURLToPath(import.meta.url));
const rootEnvFile = resolve(configDir, "../../.env");

// DATABASE_URL may be supplied directly by deployment tooling. Requiring a
// local .env file makes pristine CI/worktree migration and client-generation
// runs fail before Prisma can read that process environment.
if (existsSync(rootEnvFile)) {
  loadEnvFile(rootEnvFile);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --experimental-strip-types prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
