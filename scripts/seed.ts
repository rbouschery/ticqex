/**
 * Creates the default admin staff user in Supabase Auth.
 * Run after migrations + supabase/seed.sql (e.g. `pnpm db:reset && pnpm db:seed-admin`).
 *
 * Env: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (defaults for local dev)
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  formatSupabaseAuthError,
  normalizeSupabaseUrl,
  validateSupabaseSeedEnv,
} from "./lib/supabase-env";

const envLocal = path.resolve(import.meta.dirname, "../.env.local");
if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
}

const email = process.env.SEED_ADMIN_EMAIL ?? "admin@ticqex.local";
const password = process.env.SEED_ADMIN_PASSWORD ?? "ticqex-admin-change-me";

async function main() {
  const url = normalizeSupabaseUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
  );
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim() ?? "";

  try {
    validateSupabaseSeedEnv(url, secretKey);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const supabase = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error(
      "Failed to list users:",
      formatSupabaseAuthError(listError.message, url),
    );
    process.exit(1);
  }

  const found = existing.users.find((user) => user.email === email);

  if (found) {
    await supabase.from("users").update({ role: "admin" }).eq("id", found.id);
    console.log(`Admin already exists: ${email}`);
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "admin" },
    user_metadata: { username: "Admin" },
  });

  if (error) {
    console.error(
      "Failed to create admin:",
      formatSupabaseAuthError(error.message, url),
    );
    process.exit(1);
  }

  if (data.user) {
    await supabase
      .from("users")
      .update({ role: "admin", username: "Admin" })
      .eq("id", data.user.id);
  }

  console.log(`Admin user created: ${email}`);
}

main();
