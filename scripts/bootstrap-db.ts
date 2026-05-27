/**
 * Applies supabase/bootstrap.sql (status columns + global_settings).
 * Safe to re-run. Does not create an admin user or demo tickets.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const container = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_ticqex";
const sqlPath = join(process.cwd(), "supabase/bootstrap.sql");
const sql = readFileSync(sqlPath, "utf8");

try {
  execFileSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"],
    { input: sql, stdio: ["pipe", "inherit", "inherit"] },
  );
  console.log("Bootstrap complete (statuses + global_settings).");
} catch {
  console.error(
    "Bootstrap failed. Is local Supabase running? Try: pnpm db:start",
  );
  process.exit(1);
}
