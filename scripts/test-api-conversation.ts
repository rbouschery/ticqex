/**
 * Smoke test for API-originated conversation tickets (local dev).
 * Run: tsx --env-file=.env.local scripts/test-api-conversation.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../server/lib/supabase-admin";
import { isChannelOperational } from "../server/config/channel-gate";

const BASE =
  process.env.LOCAL_APP_URL ??
  (process.env.NEXT_PUBLIC_APP_URL?.includes("127.0.0.1") ||
  process.env.NEXT_PUBLIC_APP_URL?.includes("localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "http://127.0.0.1:3000");
const email = process.env.SEED_ADMIN_EMAIL ?? "admin@ticqex.local";
const password = process.env.SEED_ADMIN_PASSWORD ?? "ticqex-admin-change-me";

const FORM_BODY = "I was charged twice for my subscription.";
const AGENT_BODY = "Thanks for reaching out — we're looking into this.";

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
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const supabase = createClient(url, publishableKey, {
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

  const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
  if (health.checks?.database !== "ok") {
    throw new Error(`Health check failed: ${JSON.stringify(health)}`);
  }

  const contactAddress = `api-conversation-${Date.now()}@ticqex.local`;

  const ticket = await api<{
    id: string;
    kind: string;
    channel: string | null;
    origin: string;
    contact_address: string | null;
    messages: { id: string; author_type: string; channel: string; body: string }[];
  }>("/api/v1/tickets", token, {
    method: "POST",
    body: JSON.stringify({
      kind: "conversation",
      title: "Help with billing",
      contact_address: contactAddress,
      message: { body: FORM_BODY },
    }),
  });

  if (ticket.kind !== "conversation") {
    throw new Error(`Expected kind=conversation, got ${ticket.kind}`);
  }
  if (ticket.channel !== "email") {
    throw new Error(`Expected channel=email, got ${ticket.channel}`);
  }
  if (ticket.origin !== "api") {
    throw new Error(`Expected origin=api, got ${ticket.origin}`);
  }
  if (ticket.contact_address !== contactAddress) {
    throw new Error(
      `Expected contact_address=${contactAddress}, got ${ticket.contact_address}`,
    );
  }

  const customerMessages = ticket.messages.filter((m) => m.author_type === "customer");
  if (customerMessages.length !== 1) {
    throw new Error(`Expected 1 customer message, got ${customerMessages.length}`);
  }
  const customerMessage = customerMessages[0]!;
  if (customerMessage.channel !== "api") {
    throw new Error(`Expected customer message channel=api, got ${customerMessage.channel}`);
  }
  if (customerMessage.body !== FORM_BODY) {
    throw new Error("Customer message body mismatch");
  }

  const reply = await api<{
    id: string;
    body: string;
    email_delivery_status: string | null;
  }>(`/api/v1/tickets/${ticket.id}/messages`, token, {
    method: "POST",
    body: JSON.stringify({
      body: AGENT_BODY,
      channel: "api",
    }),
  });

  if (!reply.body.includes("On ") || !reply.body.includes(" wrote:")) {
    throw new Error("Expected quoted reply header in agent message body");
  }
  if (!reply.body.includes(`> ${FORM_BODY.split("\n")[0]}`)) {
    throw new Error("Expected quoted form text in agent message body");
  }
  if (!reply.body.includes(AGENT_BODY)) {
    throw new Error("Expected agent reply text in message body");
  }

  if (isChannelOperational("email") && reply.email_delivery_status !== "pending") {
    throw new Error(
      `Expected email_delivery_status=pending when email operational, got ${reply.email_delivery_status}`,
    );
  }

  const db = createAdminClient();
  await db.from("tickets").delete().eq("id", ticket.id);

  console.log("OK API conversation ticket smoke test passed");
}

main().catch((err) => {
  console.error("FAIL", err instanceof Error ? err.message : err);
  process.exit(1);
});
