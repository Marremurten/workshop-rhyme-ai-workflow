import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    environmentMatchGlobs: [
      ["src/**", "jsdom"],
      ["server/**", "node"],
    ],
    setupFiles: ["src/__tests__/setup.ts"],
  },
});
