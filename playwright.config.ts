import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a production build on :3100 (its own port, so it
 * never collides with `npm run dev`). Point them anywhere else with
 * E2E_BASE_URL=https://... . Locally they drive the installed Microsoft Edge,
 * so no browser download is needed.
 */
const externalBaseUrl = process.env.E2E_BASE_URL;
const isCI = !!process.env.CI;
const baseURL = externalBaseUrl ?? "http://localhost:3100";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["list"]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    acceptDownloads: true,
    ...(isCI ? {} : { channel: "msedge" }),
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      grepInvert: /@mobile/,
    },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: isCI ? undefined : "msedge" }, grep: /@mobile/ },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm run build && npm run start -- -p 3100",
        url: baseURL,
        timeout: 300_000,
        reuseExistingServer: !isCI,
      },
});
