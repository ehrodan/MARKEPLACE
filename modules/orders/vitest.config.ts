import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // Integração fica de fora de `test`/`test:unit` pelos `--exclude` dos scripts.
    exclude: ["dist/**"],
  },
});
