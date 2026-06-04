import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  createInterface,
  type Interface as ReadlineInterface,
} from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const ROOT = path.resolve(import.meta.dirname, "../..");

export const SUPABASE_BIN = path.join(ROOT, "node_modules", ".bin", "supabase");

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
): void {
  console.log(`\n> pnpm ${args.join(" ")}`);
  const result = spawnSync("pnpm", args, {
    cwd: ROOT,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`pnpm ${args.join(" ")} failed`);
  }
}
