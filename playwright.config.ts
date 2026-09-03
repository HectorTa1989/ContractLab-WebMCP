import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'html',
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'on-first-retry' },
  webServer: [
    { command: 'npm run dev:server', url: 'http://127.0.0.1:8787/api/health', reuseExistingServer: true },
    { command: 'npm run dev:client -- --port 5174 --strictPort', url: 'http://127.0.0.1:5174', reuseExistingServer: true },
  ],
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
})
