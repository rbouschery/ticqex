/**
 * Quick sanity check that the dev environment is wired correctly.
 * Does not start services — run after `pnpm db:env` and before `pnpm dev`.
 * Reads `.env.local` and inherits Cursor Cloud / shell secrets from process.env.
 */
const checks: { name: string; ok: boolean; hint?: string }[] = [];

function requireEnv(key: string, hint?: string) {
  const ok = Boolean(process.env[key]);
  checks.push({ name: key, ok, hint });
}

requireEnv("NEXT_PUBLIC_SUPABASE_URL", "pnpm db:env");
requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pnpm db:env");
requireEnv("SUPABASE_SECRET_KEY", "pnpm db:env");
requireEnv("RESEND_API_KEY", "Cursor Cloud secrets or .env.local");
requireEnv("RESEND_INBOUND_WEBHOOK_SECRET", "Cursor Cloud secrets or Resend webhook signing secret");
requireEnv("SUPPORT_EMAIL", "Cursor Cloud secrets or .env.local");
requireEnv("NEXT_PUBLIC_APP_URL", "https://readbetter.rbouschery.de when tunnel is up");

const optional = ["CLOUDFLARE_TUNNEL_TOKEN"] as const;
for (const key of optional) {
  checks.push({
    name: `${key} (optional)`,
    ok: Boolean(process.env[key]),
  });
}

let failed = 0;
for (const { name, ok, hint } of checks) {
  const mark = ok ? "ok" : "MISSING";
  console.log(`${mark.padEnd(8)} ${name}${hint && !ok ? ` — ${hint}` : ""}`);
  if (!ok && !name.includes("optional")) failed++;
}

if (failed) {
  console.error(
    `\n${failed} required variable(s) missing. Run pnpm db:env for Supabase keys; set email/tunnel vars in Cursor Cloud or .env.local.`,
  );
  process.exit(1);
}

console.log("\nEnvironment looks ready for pnpm dev");
