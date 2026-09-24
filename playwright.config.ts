import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: {
    colorScheme: "light",
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:4173",
    channel: process.env.CI ? "chromium" : "chrome",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: "npm run preview -- --port 4173",
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
