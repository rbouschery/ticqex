/**
 * Client-safe copy of server/lib/format-subject.ts — keep in sync with canonical impl.
 */
export function formatReplySubject(
  lastSubject: string | null | undefined,
  fallback?: string,
): string {
  const base = (lastSubject?.trim() || fallback?.trim() || "").trim();
  if (!base) return "Re: (no subject)";
  if (/^(re:|fwd:)/i.test(base)) return base;
  return `Re: ${base}`;
}
