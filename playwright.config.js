// Pruebas de la página (tests/web/). Usan el Chromium de Playwright (npx playwright install chromium);
// con KAAK_CHROME=1, el Chrome instalado en la máquina.
const { defineConfig } = require('@playwright/test');

const chrome = process.env.KAAK_CHROME === '1';

module.exports = defineConfig({
  testDir: 'tests/web',
  testMatch: '*.spec.js',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:8790',
    ...(chrome ? { channel: 'chrome' } : {}),
  },
  webServer: {
    command: 'python3 -m http.server 8790 -d web --bind 127.0.0.1',
    url: 'http://127.0.0.1:8790/index.html',
    reuseExistingServer: !process.env.CI,
  },
});
