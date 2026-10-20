import { defineConfig, devices } from '@playwright/test'

// Тесты идут против production-сборки с base, как на GitHub Pages: npm run test:e2e собирает её сам.
const port = 4173
const baseURL = `http://localhost:${String(port)}/SQLSandbox/`

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    // Локально можно взять установленный Chrome: PW_CHANNEL=chrome. В CI — встроенный Chromium.
    channel: process.env.PW_CHANNEL,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: `npm run preview:pages`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
