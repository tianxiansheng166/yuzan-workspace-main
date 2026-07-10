import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["tests/**/*.spec.ts"],
    exclude: ["node_modules", "dist", ".nuxt"],
  },
  resolve: {
    alias: {
      "~/": new URL("./app/", import.meta.url).pathname,
    },
  },
});
