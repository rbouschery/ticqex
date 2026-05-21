/**
 * Merges Cursor Cloud harness secrets into .env.local and writes Trigger CLI config.
 * Safe to run repeatedly — only overwrites keys that are present in process.env.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  readOrCreateEnvFile,
  setEnvLine,
  writeEnvFile,
} from "./lib/env-file.ts";

const ROOT = path.resolve(import.meta.dirname, "..");

const HARNESS_ENV_KEYS = [
  "RESEND_API_KEY",
  "RESEND_INBOUND_WEBHOOK_SECRET",
  "SUPPORT_EMAIL",
  "SUPPORT_FROM_NAME",
  "TRIGGER_PROJECT_REF",
  "TRIGGER_SECRET_KEY",
  "NEXT_PUBLIC_APP_URL",
] as const;

function triggerConfigPath(): string {
  if (process.env.TRIGGER_CONFIG_PATH) {
    return process.env.TRIGGER_CONFIG_PATH;
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library/Preferences/trigger/config.json");
  }
  return path.join(os.homedir(), ".config", "trigger", "config.json");
}

function syncTriggerCliConfig(): boolean {
  const token = process.env.TRIGGER_ACCESS_TOKEN;
  if (!token) return false;

  const configPath = triggerConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        profiles: {
          default: {
            accessToken: token,
            apiUrl: process.env.TRIGGER_API_URL ?? "https://api.trigger.dev",
          },
        },
        currentProfile: "default",
      },
      null,
      2,
    ),
  );
  console.log(`Wrote Trigger CLI config (${configPath})`);
  return true;
}

function main(): void {
  const envFile = process.env.ENV_FILE ?? ".env.local";
  const filePath = path.isAbsolute(envFile) ? envFile : path.join(ROOT, envFile);
  const examplePath = path.join(ROOT, ".env.example");

  let content = readOrCreateEnvFile(filePath, examplePath);
  const merged: string[] = [];

  for (const key of HARNESS_ENV_KEYS) {
    const value = process.env[key];
    if (!value) continue;
    content = setEnvLine(content, key, value);
    merged.push(key);
  }

  writeEnvFile(filePath, content);

  if (merged.length) {
    console.log(`Updated ${path.basename(filePath)} from harness:`);
    for (const key of merged) console.log(`  ${key}`);
  } else {
    console.log(
      `No harness keys in process.env — set secrets in Cursor Cloud or export manually.`,
    );
  }

  syncTriggerCliConfig();
}

main();
