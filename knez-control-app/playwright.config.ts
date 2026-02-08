import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/tauri-playwright",
  timeout: 120000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    actionTimeout: 30000,
    trace: "on-first-retry",
  },
});
