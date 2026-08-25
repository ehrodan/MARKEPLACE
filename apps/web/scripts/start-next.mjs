import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextCli = require.resolve("next/dist/bin/next");
const port = Number(process.env.WEB_PORT ?? process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("WEB_PORT/PORT deve ser uma porta TCP válida.");
}

const child = spawn(
  process.execPath,
  [nextCli, "start", "--hostname", process.env.WEB_HOST ?? "127.0.0.1", "--port", String(port)],
  { stdio: "inherit", env: process.env },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", (error) => {
  throw error;
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
