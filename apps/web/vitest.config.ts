import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  // Don't load the app's Tailwind v4 PostCSS pipeline in unit tests —
  // an inline empty config stops vite from discovering postcss.config.mjs.
  css: { postcss: {} },
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
