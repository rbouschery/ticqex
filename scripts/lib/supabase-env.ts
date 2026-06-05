export function normalizeSupabaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function isRedactedSupabaseKey(value: string | undefined): boolean {
  if (!value?.trim()) return true;
  return value.includes("...");
}

export function isUsableSupabasePublishableKey(value: string | undefined): boolean {
  if (isRedactedSupabaseKey(value)) return false;
  const key = value!.trim();
  return key.startsWith("eyJ") || key.startsWith("sb_publishable_");
}

export function isUsableSupabaseSecretKey(value: string | undefined): boolean {
  if (isRedactedSupabaseKey(value)) return false;
  const key = value!.trim();
  return key.startsWith("eyJ") || key.startsWith("sb_secret_");
}

export function validateSupabaseSeedEnv(
  url: string | undefined,
  secretKey: string | undefined,
): void {
  if (!url?.trim() || !secretKey?.trim()) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (see .env.example)",
    );
  }

  const normalizedUrl = normalizeSupabaseUrl(url);
  const isCloud = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(normalizedUrl);
  const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(
    normalizedUrl,
  );
  if (!isCloud && !isLocal) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL must be a Supabase Cloud URL (https://<project-ref>.supabase.co) or local stack (http://127.0.0.1:54321) (got ${url})`,
    );
  }

  if (!isUsableSupabaseSecretKey(secretKey)) {
    throw new Error(
      "SUPABASE_SECRET_KEY looks missing or redacted. Use the full service_role JWT or sb_secret_ key from Supabase Project Settings → API Keys.",
    );
  }
}

export function formatSupabaseAuthError(message: string, url: string): string {
  if (message.includes("<!DOCTYPE") || message.includes("is not valid JSON")) {
    return [
      "Supabase Auth returned HTML instead of JSON.",
      `Check NEXT_PUBLIC_SUPABASE_URL (${normalizeSupabaseUrl(url)}) and SUPABASE_SECRET_KEY.`,
      "Use the full service_role JWT or sb_secret_ key from Project Settings → API Keys (not a redacted value from the CLI).",
    ].join(" ");
  }

  return message;
}
