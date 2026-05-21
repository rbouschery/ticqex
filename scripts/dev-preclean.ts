import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const NEXT_LOCK = path.join(ROOT, ".next/dev/lock");

function tryExec(command: string) {
  try {
    execSync(command, { stdio: "ignore" });
  } catch {
    // Process may already be gone.
  }
}

function pidOnPort(port: number): number | null {
  try {
    const output = execSync(`lsof -ti :${port} -sTCP:LISTEN`, {
      encoding: "utf8",
    }).trim();
    const pid = Number(output.split("\n")[0]);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

function killDevProcesses() {
  for (const port of [3000, 3001]) {
    const pid = pidOnPort(port);
    if (pid) {
      console.log(`Stopping process ${pid} on port ${port}`);
      tryExec(`kill -9 ${pid}`);
    }
  }

  try {
    const matches = execSync(
      "pgrep -f 'concurrently.*pnpm dev|trigger.dev/dist/esm/index.js dev|next/dist/bin/next dev|devWatchdog.js|trigger-stuck-watchdog'",
      { encoding: "utf8" },
    ).trim();
    for (const pid of matches.split("\n").filter(Boolean)) {
      console.log(`Stopping stale dev process ${pid}`);
      tryExec(`kill -9 ${pid}`);
    }
  } catch {
    // No matching processes.
  }

  const triggerDir = path.join(ROOT, ".trigger");
  const triggerLock = path.join(triggerDir, "dev.lock");
  if (fs.existsSync(triggerLock)) {
    fs.unlinkSync(triggerLock);
    console.log("Removed stale Trigger.dev dev lock");
  }

  if (fs.existsSync(NEXT_LOCK)) {
    fs.unlinkSync(NEXT_LOCK);
    console.log("Removed stale Next.js dev lock");
  }
}

killDevProcesses();
