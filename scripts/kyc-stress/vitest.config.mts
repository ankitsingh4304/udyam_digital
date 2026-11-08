import path from "node:path";
import { defineConfig } from "vitest/config";
// Separate config so the long stress run never joins `npm test`.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "../../src") } },
  test: { include: ["scripts/kyc-stress/run.test.ts"], environment: "node", root: path.resolve(__dirname, "../..") },
});
