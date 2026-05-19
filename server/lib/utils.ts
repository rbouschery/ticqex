import { createHash, randomBytes } from "crypto";

export function initials(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    const s = parts[0]!;
    return s.slice(0, 2).toUpperCase();
  }
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export function normalizeEmailSubject(subject: string): string {
  let s = subject.trim();
  const prefix = /^(re|fwd|fw):\s*/i;
  while (prefix.test(s)) {
    s = s.replace(prefix, "").trim();
  }
  s = s.replace(/^\[[^\]]+\]\s*/g, "").trim();
  return s;
}

export function generateApiKey(): { fullKey: string; prefix: string; hash: string } {
  const random = randomBytes(24).toString("base64url");
  const fullKey = `tq_live_${random}`;
  const prefix = fullKey.slice(0, 12);
  const hash = hashApiKey(fullKey);
  return { fullKey, prefix, hash };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function messagePreview(body: string, maxLen = 120): string {
  const oneLine = body.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, maxLen - 1)}…`;
}

export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("per_page") ?? "25", 10) || 25),
  );
  const offset = (page - 1) * perPage;
  return { page, perPage, offset };
}
