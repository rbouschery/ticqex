/**
 * Quick sanity check that the dev environment is wired correctly.
 * Does not start services — run after `pnpm env:sync` and before `pnpm dev:all`.
 */
const checks: { name: string; ok: boolean; hint?: string }[] = [];

function requireEnv(key: string, hint?: string) {
  const ok = Boolean(process.env[key]);
  checks.push({ name: key, ok, hint });
}

requireEnv("NEXT_PUBLIC_SUPABASE_URL", "pnpm db:env");
requireEnv("SUPABASE_SERVICE_ROLE_KEY", "pnpm db:env");
requireEnv("RESEND_API_KEY", "harness / .env.local");
requireEnv("RESEND_INBOUND_WEBHOOK_SECRET", "harness / Resend webhook signing secret");
requireEnv("SUPPORT_EMAIL", "harness");
requireEnv("TRIGGER_SECRET_KEY", "pnpm trigger:env");
requireEnv("TRIGGER_PROJECT_REF", "harness / trigger.config.ts");
requireEnv("NEXT_PUBLIC_APP_URL", "https://readbetter.rbouschery.de when tunnel is up");

const optional = [
  "TRIGGER_ACCESS_TOKEN",
  "CLOUDFLARE_TUNNEL_TOKEN",
] as const;
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
  console.error(`\n${failed} required variable(s) missing. Run: pnpm env:sync`);
  process.exit(1);
}

console.log("\nEnvironment looks ready for pnpm dev:all");
