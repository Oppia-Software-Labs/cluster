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
    // NEXT_PUBLIC_* vars are read at module-load time by the confidential hooks;
    // seed them here so they exist before any test module imports run.
    env: {
      NEXT_PUBLIC_CONFIDENTIAL_TOKEN_CONTRACT_ID: "CTOKEN123",
      NEXT_PUBLIC_STELLAR_RPC_URL: "https://rpc.example",
    },
  },
});
