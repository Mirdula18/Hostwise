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
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "html"],
      // Everything that ships: logic, store, components, routes and the proxy.
      include: ["src/**/*.{ts,tsx}", "functions/**/*.ts"],
      exclude: ["src/main.tsx"],
      thresholds: {
        // Whole app, including UI.
        lines: 95,
        functions: 95,
        branches: 90,
        statements: 95,
        // Pure logic and the proxy are held to a higher bar.
        "src/lib/**": { lines: 98, functions: 98, branches: 92, statements: 98 },
        "functions/**": { lines: 98, functions: 98, branches: 92, statements: 98 },
      },
    },
  },
});
