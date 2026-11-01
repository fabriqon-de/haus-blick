import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', workers: 1, retries: 0,
  use: { baseURL: 'http://127.0.0.1:4176', viewport: { width: 1100, height: 1000 },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  webServer: { command: 'python3 -m http.server 4176 --bind 127.0.0.1', url: 'http://127.0.0.1:4176/tests/fixtures/', reuseExistingServer: !process.env.CI }
});
