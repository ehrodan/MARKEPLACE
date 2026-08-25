import { defineConfig, devices } from "@playwright/test";

function readPort(value: string | undefined, fallback: number, name: string): number {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} deve ser uma porta TCP válida.`);
  }
  return port;
}

const webPort = readPort(process.env.WEB_PORT, 3000, "WEB_PORT");
const apiPort = readPort(process.env.PORT ?? process.env.API_PORT, 3001, "PORT/API_PORT");
const webGlLaunchOptions = {
  args: ["--enable-webgl", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
};

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  expect: { timeout: 10_000 },
  projects: [
    {
      name: "chromium-desktop",
      grepInvert: /@webgl/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-mobile",
      grepInvert: /@webgl/,
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "chromium-webgl",
      grep: /@webgl/,
      use: { ...devices["Desktop Chrome"], launchOptions: webGlLaunchOptions },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @midas/api start:test",
      port: apiPort,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @midas/web start:test",
      port: webPort,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
