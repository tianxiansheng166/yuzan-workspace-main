import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { defineConfig } from "vitest/config";

function resolvePnpmPackage(packageName: string) {
  const pnpmDir = resolve(__dirname, "../../node_modules/.pnpm");
  const packagePrefix = packageName.replace("/", "+");
  const match = readdirSync(pnpmDir).find((entry) =>
    entry.startsWith(`${packagePrefix}@`),
  );

  if (!match) {
    throw new Error(`Unable to resolve ${packageName} from ${pnpmDir}`);
  }

  return resolve(pnpmDir, match, "node_modules", packageName);
}

const vuePluginPath = resolve(
  resolvePnpmPackage("@vitejs/plugin-vue"),
  "dist/index.mjs",
);
const { default: vue } = await import(pathToFileURL(vuePluginPath).href);

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
