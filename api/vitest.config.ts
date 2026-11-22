import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/spendwise_test",
      JWT_SECRET: "test-secret-with-at-least-32-characters",
      NODE_ENV: "test",
    },
  },
});
