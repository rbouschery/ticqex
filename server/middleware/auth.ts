import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";
import { hashApiKey } from "@server/lib/utils";

export type AuthContext = {
  type: "staff" | "api_key";
  userId: string;
  role: "admin" | "agent";
  apiKeyId?: string;
};

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim();
}

export async function authenticateApiKeyToken(
  token: string,
): Promise<AuthContext | null> {
  if (!token.startsWith("tq_live_")) return null;

  const db = createAdminClient();
  const keyHash = hashApiKey(token);
  const prefix = token.slice(0, 12);

  const { data: keys, error } = await db
    .from("api_keys")
    .select("id, key_hash, key_prefix, created_by, revoked_at")
    .eq("key_prefix", prefix)
    .is("revoked_at", null);

  if (error || !keys?.length) return null;

  const match = keys.find((k) => k.key_hash === keyHash);
  if (!match) return null;

  const { data: user } = await db
    .from("users")
    .select("id, role")
    .eq("id", match.created_by)
    .single();

  if (!user) return null;

  void db
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", match.id);

  return {
    type: "api_key",
    userId: user.id,
    role: user.role as "admin" | "agent",
    apiKeyId: match.id,
  };
}

async function authViaJwt(token: string): Promise<AuthContext | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;

  const supabase = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  const db = createAdminClient();
  const { data: staff } = await db
    .from("users")
    .select("id, role")
    .eq("id", data.user.id)
    .single();

  if (!staff) return null;

  return {
    type: "staff",
    userId: staff.id,
    role: staff.role as "admin" | "agent",
  };
}

export async function authViaCookies(): Promise<AuthContext | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;

  const cookieStore = await cookies();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot set cookies; middleware refreshes on navigation
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = createAdminClient();
  const { data: staff } = await db
    .from("users")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!staff) return null;

  return {
    type: "staff",
    userId: staff.id,
    role: staff.role as "admin" | "agent",
  };
}

export async function authenticateRequest(
  request: NextRequest,
): Promise<AuthContext> {
  const token = getBearerToken(request);
  if (token) {
    const viaKey = await authenticateApiKeyToken(token);
    if (viaKey) return viaKey;

    const viaJwt = await authViaJwt(token);
    if (viaJwt) return viaJwt;
  }

  const viaCookies = await authViaCookies();
  if (viaCookies) return viaCookies;

  throw ApiError.unauthorized();
}

export function requireAdmin(auth: AuthContext) {
  if (auth.role !== "admin") {
    throw ApiError.forbidden("Admin role required");
  }
}
