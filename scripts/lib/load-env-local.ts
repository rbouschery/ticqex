import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

const ENV_LOCAL = path.resolve(import.meta.dirname, "../../.env.local");

/** Load `.env.local` when present; cloud init may skip creating the file. */
export function loadEnvLocalIfPresent(): void {
  if (fs.existsSync(ENV_LOCAL)) {
    dotenv.config({ path: ENV_LOCAL });
  }
}
