import { spawn } from "node:child_process";
const args = process.argv.slice(2),
  index = args.indexOf("--port");
const port = index >= 0 ? args[index + 1] : "3100";
if (!/^\d{4,5}$/.test(port ?? "") || Number(port) > 65535)
  throw new Error("Invalid port");
const env = {
  ...process.env,
  MARKETING_DEMO_MODE: "true",
  MARKETING_STORE: "file",
  NEXT_TELEMETRY_DISABLED: "1",
};
for (const key of [
  "APP_ORIGIN",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "OPENROUTER_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "MARKETING_WEBHOOK_SECRET",
  "MARKETING_PLAYER_HASH_SECRET",
])
  delete env[key];
console.log(`Local demo: http://127.0.0.1:${port}/marketing`);
const child = spawn(
  "pnpm",
  ["exec", "next", "dev", "--hostname", "127.0.0.1", "--port", port],
  { stdio: "inherit", env },
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
