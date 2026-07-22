import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../../");  // p0-tests/
const workerSrc = path.resolve(__dirname, "../src");

export default defineConfig({
  root: projectRoot,
  resolve: {
    alias: {
      "../../src/speech/speech-job.consumer.js": path.resolve(workerSrc, "speech/speech-job.consumer.ts"),
      "../../src/speech/speech-job.consumer": path.resolve(workerSrc, "speech/speech-job.consumer.ts"),
    },
  },
  test: {
    include: ["apps/worker/test/**/*.spec.ts"],
    environment: "node",
    globals: true,
  },
});
