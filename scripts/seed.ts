/**
 * Creates the default admin staff user in Supabase Auth.
 * Run after migrations + supabase/seed.sql (e.g. `pnpm db:reset && pnpm db:seed-admin`).
 *
 * Env: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (defaults for local dev)
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const email = process.env.SEED_ADMIN_EMAIL ?? "admin@ticqex.local";
const password = process.env.SEED_ADMIN_PASSWORD ?? "ticqex-admin-change-me";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    console.error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (see .env.example)",
    );
    process.exit(1);
  }

  const supabase = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing.users.find((u) => u.email === email);

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
    console.error("Failed to create admin:", error.message);
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
