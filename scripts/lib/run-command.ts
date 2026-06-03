import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  createInterface,
  type Interface as ReadlineInterface,
} from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const ROOT = path.resolve(import.meta.dirname, "../..");

export const SUPABASE_BIN = path.join(ROOT, "node_modules", ".bin", "supabase");
const TSX_BIN = path.join(ROOT, "node_modules", ".bin", "tsx");
const SEED_SCRIPT = path.join(ROOT, "scripts", "seed.ts");

export function createReadline(): ReadlineInterface {
  return createInterface({ input, output });
}

/** Readline holds stdin; close it before any interactive child process. */
export function closeReadline(rl: ReadlineInterface): void {
  rl.close();
}

function childProcessEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    SUPABASE_TELEMETRY_DISABLED: "1",
    DO_NOT_TRACK: "1",
  };
}

export function runSupabase(
  args: string[],
  options: { input?: string } = {},
): void {
  console.log(`\n> supabase ${args.join(" ")}`);
  const result = spawnSync(SUPABASE_BIN, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: childProcessEnv(),
    input: options.input,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`supabase ${args.join(" ")} failed`);
  }
}

export function runPnpm(
  args: string[],
  options: { env?: Record<string, string> } = {},
): void {
  console.log(`\n> pnpm ${args.join(" ")}`);
  const result = spawnSync("pnpm", args, {
    cwd: ROOT,
    stdio: "inherit",
    env: options.env ? { ...process.env, ...options.env } : undefined,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`pnpm ${args.join(" ")} failed`);
  }
}

export function runSeedAdmin(env: Record<string, string> = {}): void {
  console.log("\n> tsx scripts/seed.ts");
  const result = spawnSync(TSX_BIN, [SEED_SCRIPT], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error("tsx scripts/seed.ts failed");
  }
}

export function runSupabaseCapture(args: string[]): string {
  const result = spawnSync(SUPABASE_BIN, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: childProcessEnv(),
  });

  if (result.error) {
    throw result.error;
  }

  const outputText = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (result.status !== 0) {
    throw new Error(
      outputText || `supabase ${args.join(" ")} failed`,
    );
  }

  return outputText;
}

export function runVercel(
  args: string[],
  options: { input?: string; capture?: boolean } = {},
): string {
  console.log(`\n> vercel ${args.join(" ")}`);
  const capture = options.capture ?? false;
  const result = spawnSync("vercel", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
    input: options.input,
  });

  if (result.error) {
    throw result.error;
  }

  const outputText = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (result.status !== 0) {
    throw new Error(outputText || `vercel ${args.join(" ")} failed`);
  }

  return outputText;
}
