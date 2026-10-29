/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8788" },
  },
  build: { target: "es2022", sourcemap: false },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/components/**/*.test.tsx"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "html"],
      include: ["src/lib/**/*.ts", "functions/**/*.ts", "src/store/**/*.ts"],
      thresholds: {
        "src/lib/**": { lines: 80, functions: 80, branches: 75, statements: 80 },
      },
    },
  },
});
