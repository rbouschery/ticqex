/**
 * Writes local Supabase API keys from `supabase status` into .env.local.
 * Run after `pnpm db:start` (requires a running local stack).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  readOrCreateEnvFile,
  setEnvLine,
  writeEnvFile as saveEnvFile,
} from "./lib/env-file.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const SUPABASE_BIN = path.join(ROOT, "node_modules", ".bin", "supabase");

type SupabaseStatus = {
  API_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
};

const ENV_KEYS: Record<keyof SupabaseStatus, string> = {
  API_URL: "NEXT_PUBLIC_SUPABASE_URL",
  ANON_KEY: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  SERVICE_ROLE_KEY: "SUPABASE_SERVICE_ROLE_KEY",
};

function parseStatusJson(stdout: string): SupabaseStatus {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Could not parse `supabase status` output as JSON");
  }

  const parsed = JSON.parse(stdout.slice(start, end + 1)) as Partial<SupabaseStatus>;
  const { API_URL, ANON_KEY, SERVICE_ROLE_KEY } = parsed;

  if (!API_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing API_URL, ANON_KEY, or SERVICE_ROLE_KEY in `supabase status` output",
    );
  }

  return { API_URL, ANON_KEY, SERVICE_ROLE_KEY };
}

function fetchStatus(): SupabaseStatus {
  const result = spawnSync(SUPABASE_BIN, ["status", "-o", "json"], {
    cwd: ROOT,
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  const output = (result.stdout ?? "") + (result.stderr ?? "");
  if (result.status !== 0) {
    throw new Error(
      output.trim() ||
        "`supabase status` failed. Is local Supabase running? Try `pnpm db:start`.",
    );
  }

  return parseStatusJson(output);
}

function writeEnvFile(filePath: string, status: SupabaseStatus): void {
  const examplePath = path.join(ROOT, ".env.example");
  let content = readOrCreateEnvFile(filePath, examplePath);

  for (const [statusKey, envKey] of Object.entries(ENV_KEYS) as [
    keyof SupabaseStatus,
    string,
  ][]) {
    content = setEnvLine(content, envKey, status[statusKey]);
  }

  saveEnvFile(filePath, content);
}

function main(): void {
  const envFile = process.env.ENV_FILE ?? ".env.local";
  const filePath = path.isAbsolute(envFile) ? envFile : path.join(ROOT, envFile);

  const status = fetchStatus();
  writeEnvFile(filePath, status);

  console.log(`Updated ${path.basename(filePath)} with local Supabase keys:`);
  for (const envKey of Object.values(ENV_KEYS)) {
    console.log(`  ${envKey}`);
  }
}

main();
