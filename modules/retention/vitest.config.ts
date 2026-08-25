import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@midas/retention",
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
  },
});
