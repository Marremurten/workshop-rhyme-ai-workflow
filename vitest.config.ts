import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}", "server/**/*.test.{ts,tsx}"],
    environmentMatchGlobs: [
      ["src/**", "jsdom"],
      ["server/**", "node"],
    ],
    setupFiles: ["src/test-setup.ts"],
  },
});
