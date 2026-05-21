/**
 * Test cookie-based API auth after Supabase sign-in.
 * Run: pnpm exec tsx --env-file=.env.local scripts/test-cookie-auth.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = "http://127.0.0.1:3000";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await authClient.auth.signInWithPassword({
    email: "admin@ticqex.local",
    password: "ticqex-admin-change-me",
  });
  if (error || !data.session) throw new Error(error?.message ?? "no session");

  const cookieStore = new Map<string, string>();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return [...cookieStore.entries()].map(([name, value]) => ({ name, value }));
      },
      setAll(cookies) {
        for (const { name, value } of cookies) cookieStore.set(name, value);
      },
    },
  });

  await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  const cookieHeader = [...cookieStore.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");

  if (!cookieHeader) throw new Error("no auth cookies generated");

  const boardRes = await fetch(`${BASE}/api/v1/board`, {
    headers: { Cookie: cookieHeader },
  });
  const boardJson = await boardRes.json();
  console.log("board status", boardRes.status, JSON.stringify(boardJson).slice(0, 120));
  if (!boardRes.ok || "error" in boardJson) {
    throw new Error(boardJson.error?.message ?? `HTTP ${boardRes.status}`);
  }
  console.log("OK cookie auth, lanes:", boardJson.data.lanes.length);
}

main().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
