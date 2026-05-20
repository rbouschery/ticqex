/**
 * Writes Trigger.dev project ref and DEV secret key into .env.local.
 * Requires `pnpm trigger:login` first (uses the CLI access token on disk).
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

type TriggerCliConfig = {
  profiles: Record<string, { accessToken: string; apiUrl: string }>;
  currentProfile?: string;
};

type DevProjectResponse = {
  apiKey: string;
};

function triggerConfigPath(): string {
  if (process.env.TRIGGER_CONFIG_PATH) {
    return process.env.TRIGGER_CONFIG_PATH;
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library/Preferences/trigger/config.json");
  }

  return path.join(os.homedir(), ".config", "trigger", "config.json");
}

function readAccessToken(): { token: string; apiUrl: string } {
  const configFile = triggerConfigPath();
  if (!fs.existsSync(configFile)) {
    throw new Error(
      `Trigger CLI config not found at ${configFile}. Run \`pnpm trigger:login\` first.`,
    );
  }

  const config = JSON.parse(
    fs.readFileSync(configFile, "utf8"),
  ) as TriggerCliConfig;
  const profileName = config.currentProfile ?? "default";
  const profile = config.profiles[profileName];

  if (!profile?.accessToken) {
    throw new Error(
      `No access token for profile "${profileName}". Run \`pnpm trigger:login\`.`,
    );
  }

  return {
    token: profile.accessToken,
    apiUrl: profile.apiUrl ?? "https://api.trigger.dev",
  };
}

function readProjectRefFromConfig(): string | null {
  const configPath = path.join(ROOT, "trigger.config.ts");
  if (!fs.existsSync(configPath)) return null;

  const content = fs.readFileSync(configPath, "utf8");
  const match =
    content.match(/project:\s*["'](proj_[^"']+)["']/) ??
    content.match(
      /process\.env\.TRIGGER_PROJECT_REF\s*\?\?\s*["'](proj_[^"']+)["']/,
    );

  return match?.[1] ?? null;
}

function resolveProjectRef(): string {
  const fromArg = process.argv.find((arg) => arg.startsWith("--project-ref="));
  if (fromArg) return fromArg.split("=")[1]!;

  const fromEnv = process.env.TRIGGER_PROJECT_REF;
  if (fromEnv && fromEnv.startsWith("proj_")) return fromEnv;

  const fromConfig = readProjectRefFromConfig();
  if (fromConfig) return fromConfig;

  throw new Error(
    "No project ref found. Pass --project-ref=proj_xxx, set TRIGGER_PROJECT_REF, or run `pnpm trigger:init`.",
  );
}

async function fetchDevSecretKey(
  apiUrl: string,
  token: string,
  projectRef: string,
): Promise<string> {
  const response = await fetch(`${apiUrl}/api/v1/projects/${projectRef}/dev`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to fetch dev API key for ${projectRef} (${response.status}): ${body}`,
    );
  }

  const data = (await response.json()) as DevProjectResponse;
  if (!data.apiKey?.startsWith("tr_dev_")) {
    throw new Error(`Unexpected dev API key response for ${projectRef}`);
  }

  return data.apiKey;
}

async function main(): Promise<void> {
  const envFile = process.env.ENV_FILE ?? ".env.local";
  const filePath = path.isAbsolute(envFile) ? envFile : path.join(ROOT, envFile);
  const examplePath = path.join(ROOT, ".env.example");

  const projectRef = resolveProjectRef();
  const { token, apiUrl } = readAccessToken();
  const secretKey = await fetchDevSecretKey(apiUrl, token, projectRef);

  let content = readOrCreateEnvFile(filePath, examplePath);
  content = setEnvLine(content, "TRIGGER_PROJECT_REF", projectRef);
  content = setEnvLine(content, "TRIGGER_SECRET_KEY", secretKey);
  writeEnvFile(filePath, content);

  console.log(`Updated ${path.basename(filePath)} with Trigger.dev credentials:`);
  console.log("  TRIGGER_PROJECT_REF");
  console.log("  TRIGGER_SECRET_KEY");
  console.log(`  (project: ${projectRef})`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
