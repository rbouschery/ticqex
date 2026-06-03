import path from "node:path";
import {
  readOrCreateEnvFile,
  setEnvLine,
  writeEnvFile,
} from "./env-file";
import { runSeedAdmin, runSupabase, runSupabaseCapture } from "./run-command";
import {
  isUsableSupabasePublishableKey,
  isUsableSupabaseSecretKey,
} from "./supabase-env";

const ROOT = path.resolve(import.meta.dirname, "../..");
const BOOTSTRAP_SQL = path.join(ROOT, "supabase/bootstrap.sql");

export type CloudSupabaseKeys = {
  url: string;
  publishableKey: string;
  secretKey: string;
};

type ApiKeyEntry = {
  type?: string | null;
  name?: string;
  api_key?: string;
};

function parseJsonPayload<T>(stdout: string): T {
  const arrayStart = stdout.indexOf("[");
  const objectStart = stdout.indexOf("{");
  const start =
    arrayStart >= 0 && objectStart >= 0
      ? Math.min(arrayStart, objectStart)
      : arrayStart >= 0
        ? arrayStart
        : objectStart;
  const end = Math.max(stdout.lastIndexOf("]"), stdout.lastIndexOf("}"));

  if (start === -1 || end === -1) {
    throw new Error("Could not parse Supabase CLI output as JSON");
  }

  return JSON.parse(stdout.slice(start, end + 1)) as T;
}

function pickApiKey(
  entries: ApiKeyEntry[],
  matches: Array<(entry: ApiKeyEntry) => boolean>,
  usable: (value: string | undefined) => boolean,
): string | undefined {
  for (const match of matches) {
    for (const entry of entries) {
      if (match(entry) && usable(entry.api_key)) {
        return entry.api_key!.trim();
      }
    }
  }
  return undefined;
}

export function resolveCloudSupabaseKeys(
  projectRef: string,
  entries: ApiKeyEntry[],
): CloudSupabaseKeys {
  const publishableKey = pickApiKey(
    entries,
    [
      (entry) => entry.type === "publishable",
      (entry) => entry.name === "anon",
      (entry) => entry.type === "legacy" && entry.name === "anon",
    ],
    isUsableSupabasePublishableKey,
  );
  const secretKey = pickApiKey(
    entries,
    [
      (entry) => entry.name === "service_role",
      (entry) => entry.type === "legacy" && entry.name === "service_role",
      (entry) => entry.type === "secret",
    ],
    isUsableSupabaseSecretKey,
  );

  if (!publishableKey || !secretKey) {
    throw new Error(
      "Could not resolve usable publishable and secret Supabase API keys from the linked project. Paste the full keys from Project Settings → API Keys if the CLI returned redacted sb_secret_ values.",
    );
  }

  return {
    url: `https://${projectRef}.supabase.co`,
    publishableKey,
    secretKey,
  };
}

export function fetchCloudSupabaseKeyEntries(projectRef: string): ApiKeyEntry[] {
  const output = runSupabaseCapture([
    "projects",
    "api-keys",
    "--project-ref",
    projectRef,
    "-o",
    "json",
  ]);
  return parseJsonPayload<ApiKeyEntry[]>(output);
}

export function fetchCloudSupabaseKeys(projectRef: string): CloudSupabaseKeys {
  return resolveCloudSupabaseKeys(projectRef, fetchCloudSupabaseKeyEntries(projectRef));
}

export function writeCloudSupabaseEnv(
  envFile: string,
  envExample: string,
  keys: CloudSupabaseKeys,
): string {
  let content = readOrCreateEnvFile(envFile, envExample);
  content = setEnvLine(content, "NEXT_PUBLIC_SUPABASE_URL", keys.url);
  content = setEnvLine(
    content,
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    keys.publishableKey,
  );
  content = setEnvLine(content, "SUPABASE_SECRET_KEY", keys.secretKey);
  writeEnvFile(envFile, content);
  return content;
}

export function assignCloudSupabaseEnv(
  keys: CloudSupabaseKeys,
  target: Record<string, string>,
): void {
  target.NEXT_PUBLIC_SUPABASE_URL = keys.url;
  target.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = keys.publishableKey;
  target.SUPABASE_SECRET_KEY = keys.secretKey;
}

export function bootstrapCloudDatabase(): void {
  runSupabase(["db", "query", "--linked", "-f", BOOTSTRAP_SQL]);
}

export function seedCloudAdmin(
  keys: CloudSupabaseKeys,
  email: string,
  password: string,
  target: Record<string, string>,
): void {
  target.SEED_ADMIN_EMAIL = email;
  target.SEED_ADMIN_PASSWORD = password;
  runSeedAdmin({
    NEXT_PUBLIC_SUPABASE_URL: keys.url,
    SUPABASE_SECRET_KEY: keys.secretKey,
    SEED_ADMIN_EMAIL: email,
    SEED_ADMIN_PASSWORD: password,
  });
}
