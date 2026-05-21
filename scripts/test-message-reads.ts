/**
 * Smoke test for message read/unread API (local dev).
 * Run: tsx --env-file=.env.local scripts/test-message-reads.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../server/lib/supabase-admin";

const BASE =
  process.env.LOCAL_APP_URL ??
  (process.env.NEXT_PUBLIC_APP_URL?.includes("127.0.0.1") ||
  process.env.NEXT_PUBLIC_APP_URL?.includes("localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "http://127.0.0.1:3000");
const email = process.env.SEED_ADMIN_EMAIL ?? "admin@ticqex.local";
const password = process.env.SEED_ADMIN_PASSWORD ?? "ticqex-admin-change-me";

async function api<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  const json = (await res.json()) as { data?: T; error?: { message: string } };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `HTTP ${res.status} ${path}`);
  }
  return json.data as T;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: auth, error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr || !auth.session) {
    throw new Error(`Sign in failed: ${signInErr?.message ?? "no session"}`);
  }
  const token = auth.session.access_token;
  const userId = auth.user!.id;

  const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
  if (health.checks?.database !== "ok") {
    throw new Error(`Health check failed: ${JSON.stringify(health)}`);
  }

  const db = createAdminClient();
  const { data: status } = await db
    .from("status_types")
    .select("id")
    .order("position")
    .limit(1)
    .single();
  if (!status) throw new Error("No status found");

  const { data: customer } = await db
    .from("customers")
    .select("id")
    .limit(1)
    .single();
  if (!customer) throw new Error("No customer found");

  const { data: ticket, error: ticketErr } = await db
    .from("tickets")
    .insert({
      title: "Read/unread smoke test",
      customer_id: customer.id,
      status_id: status.id,
      origin: "manual",
    })
    .select("id")
    .single();
  if (ticketErr || !ticket) throw new Error(ticketErr?.message ?? "ticket insert failed");

  const { data: message, error: msgErr } = await db
    .from("messages")
    .insert({
      ticket_id: ticket.id,
      body: "Unread customer reply for smoke test",
      visibility: "public",
      author_type: "customer",
      channel: "email",
    })
    .select("id")
    .single();
  if (msgErr || !message) throw new Error(msgErr?.message ?? "message insert failed");

  const board = await api<{ lanes: { tickets: { id: string; unread_count: number }[] }[] }>(
    "/api/v1/board",
    token,
  );
  const boardTicket = board.lanes.flatMap((l) => l.tickets).find((t) => t.id === ticket.id);
  if (!boardTicket || boardTicket.unread_count !== 1) {
    throw new Error(
      `Expected unread_count=1 on board, got ${boardTicket?.unread_count ?? "missing"}`,
    );
  }

  const detail = await api<{
    messages: { id: string; read?: boolean }[];
  }>(`/api/v1/tickets/${ticket.id}`, token);
  const detailMsg = detail.messages.find((m) => m.id === message.id);
  if (detailMsg?.read !== false) {
    throw new Error(`Expected message read=false before mark-read, got ${detailMsg?.read}`);
  }

  const markResult = await api<{ marked: number }>(
    `/api/v1/tickets/${ticket.id}/read`,
    token,
    { method: "POST" },
  );
  if (markResult.marked !== 1) {
    throw new Error(`Expected marked=1, got ${markResult.marked}`);
  }

  const boardAfter = await api<{ lanes: { tickets: { id: string; unread_count: number }[] }[] }>(
    "/api/v1/board",
    token,
  );
  const boardTicketAfter = boardAfter.lanes
    .flatMap((l) => l.tickets)
    .find((t) => t.id === ticket.id);
  if (!boardTicketAfter || boardTicketAfter.unread_count !== 0) {
    throw new Error(
      `Expected unread_count=0 after mark-read, got ${boardTicketAfter?.unread_count ?? "missing"}`,
    );
  }

  const toggle = await api<{ read: boolean }>(
    `/api/v1/tickets/${ticket.id}/messages/${message.id}/read`,
    token,
    { method: "PATCH" },
  );
  if (toggle.read !== false) {
    throw new Error(`Expected toggle to unread (read=false), got ${toggle.read}`);
  }

  const { count } = await db
    .from("message_reads")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("message_id", message.id);
  if (count !== 0) {
    throw new Error(`Expected no message_reads row after toggle unread, count=${count}`);
  }

  await db.from("tickets").delete().eq("id", ticket.id);

  console.log("OK message read/unread smoke test passed");
}

main().catch((err) => {
  console.error("FAIL", err instanceof Error ? err.message : err);
  process.exit(1);
});
