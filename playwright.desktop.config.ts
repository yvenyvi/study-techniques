import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests-desktop",
  testMatch: "*.spec.ts",
  timeout: 45000,
  expect: { timeout: 10000 },
  use: { baseURL: "http://127.0.0.1:4175", headless: true },
  webServer: {
    command:
      "npx vite preview --mode desktop --port 4175 --strictPort --host 127.0.0.1",
    port: 4175,
    reuseExistingServer: false,
  },
  workers: 1,
});
